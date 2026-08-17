#!/usr/bin/env bash
# Generate the component archive from upstream sources.
#
#   ./bootstrap.sh          generate registry/, assets/, indexes, css and bundles
#   ./bootstrap.sh --force  regenerate even if the tree already matches
#   ./bootstrap.sh --check  report status and exit; write nothing
#   ./bootstrap.sh --validate[-browser]
#                           re-run stage 7 only; --validate-browser also mounts
#                           every block and example in headless Chromium
#
# Idempotent. If the tree already matches the recorded state this exits 0
# immediately without touching the network.
set -euo pipefail

ARCHIVE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ARCHIVE"

BOOT="bootstrap"
STATE="$BOOT/state.json"
FORCE=0
CHECK=0
VALIDATE=0
VALIDATE_ARGS=""
for a in "$@"; do
  case "$a" in
    --force) FORCE=1 ;;
    --check) CHECK=1 ;;
    --validate) VALIDATE=1 ;;
    --validate-browser) VALIDATE=1; VALIDATE_ARGS="--browser" ;;
    -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

command -v node >/dev/null || { echo "bootstrap: node is required" >&2; exit 1; }

# Order-stable digest of a directory's contents: depends only on paths and
# bytes, never on filesystem ordering or timestamps.
#
# This hashes each file individually and folds the per-file digests together.
# It previously piped the sorted list through tar, which embeds mtime, uid and
# gid in every header -- so merely touching a file changed the digest and
# --check reported "regeneration needed" on a tree that was byte-for-byte
# intact.
tree_hash() {
  local dir="$1"
  [ -d "$dir" ] || { echo "absent"; return; }
  find "$dir" -type f -print0 | LC_ALL=C sort -z \
    | xargs -0 shasum -a 256 | shasum -a 256 | cut -d' ' -f1
}

read_state() { [ -f "$STATE" ] && node -e "try{process.stdout.write(String(require('./$STATE').$1||''))}catch(e){}" || true; }

REG_NOW="$(tree_hash registry)"
AST_NOW="$(tree_hash assets)"
REG_WANT="$(read_state registry)"
AST_WANT="$(read_state assets)"
DIST_STATE="$(read_state dist)"
BUNDLE_STATE="$(read_state bundles)"

if [ "$VALIDATE" = 1 ]; then
  node "$BOOT/validate-bundles.mjs" $VALIDATE_ARGS
  exit 0
fi

if [ "$CHECK" = 1 ]; then
  echo "registry  now=${REG_NOW:0:12}  recorded=${REG_WANT:0:12}"
  echo "assets    now=${AST_NOW:0:12}  recorded=${AST_WANT:0:12}"
  echo "dist      ${DIST_STATE:-absent}"
  echo "bundles   ${BUNDLE_STATE:-absent}"
  [ -n "$REG_WANT" ] && [ "$REG_NOW" = "$REG_WANT" ] && [ "$AST_NOW" = "$AST_WANT" ] \
    && { echo "up to date"; exit 0; } || { echo "regeneration needed"; exit 1; }
fi

# ---- short-circuit ---------------------------------------------------------
# The fetched tree matching is not sufficient on its own: stage 5 is allowed to
# fail without failing the run, so a tree can be complete while dist/ is still
# missing. In that case fall through and retry stage 5 alone -- it is the only
# stage needing npm, and the machine may simply have been offline last time.
if [ "$FORCE" = 0 ] && [ -n "$REG_WANT" ] && [ "$REG_NOW" = "$REG_WANT" ] && [ "$AST_NOW" = "$AST_WANT" ]; then
  if [ "$DIST_STATE" = "built" ] && [ "$BUNDLE_STATE" = "built" ]; then
    echo "archive already matches the recorded state; nothing to do"
    exit 0
  fi
  echo "registry and assets are current; dist=${DIST_STATE:-absent} bundles=${BUNDLE_STATE:-absent} -- retrying stages 5-7 only"
  [ "$DIST_STATE" = "built" ] || node "$BOOT/build-dist.mjs"
  node "$BOOT/build-bundles.mjs" || echo "    stage 6 errored; continuing"
  node "$BOOT/validate-bundles.mjs" || echo "    stage 7 errored; continuing"
  node -e "
  const fs=require('fs'),s='$STATE';
  const st=JSON.parse(fs.readFileSync(s,'utf8'));
  const read=(f,k)=>{try{return JSON.parse(fs.readFileSync(f,'utf8'))[k]}catch{return 'absent'}};
  st.dist=read('$BOOT/dist-status.json','dist');
  st.bundles=read('$BOOT/bundles-status.json','bundles');
  fs.writeFileSync(s, JSON.stringify(st,null,2)+'\n');
  "
  exit 0
fi

start=$(date +%s)
echo "==> stage 1/7  registry"
OUT="$ARCHIVE/registry" node "$BOOT/fetch-registry.mjs"

echo "==> stage 2/7  assets"
node "$BOOT/fetch-assets.mjs"

echo "==> stage 3/7  docs"
node "$BOOT/fetch-docs.mjs"

echo "==> stage 4/7  indexes"
node "$BOOT/build-indexes.mjs"

# Non-fatal: a compile failure here must not invalidate a good registry/ tree.
# build-dist.mjs records why in bootstrap/dist-status.json and exits 0.
echo "==> stage 5/7  compiled css"
node "$BOOT/build-dist.mjs" || echo "    stage 5 errored; continuing"

# Also non-fatal: needs npm, and bundles are useless without stage 5's CSS.
echo "==> stage 6/7  component bundles"
node "$BOOT/build-bundles.mjs" || echo "    stage 6 errored; continuing"

echo "==> stage 7/7  validation"
node "$BOOT/validate-bundles.mjs" $VALIDATE_ARGS || echo "    stage 7 errored; continuing"

# ---- record the resulting state --------------------------------------------
REG_NEW="$(tree_hash registry)"
AST_NEW="$(tree_hash assets)"
mkdir -p "$BOOT"
node -e "
const fs=require('fs');
let dist='absent', bundles='absent';
try { dist=JSON.parse(fs.readFileSync('$BOOT/dist-status.json','utf8')).dist } catch {}
try { bundles=JSON.parse(fs.readFileSync('$BOOT/bundles-status.json','utf8')).bundles } catch {}
fs.writeFileSync('$STATE', JSON.stringify({
  registry: '$REG_NEW',
  assets: '$AST_NEW',
  dist,
  bundles,
  files: {
    registry: Number(process.argv[1]),
    assets: Number(process.argv[2]),
    dist: Number(process.argv[3]),
  },
}, null, 2) + '\n');
" "$(find registry -type f | wc -l | tr -d ' ')" "$(find assets -type f | wc -l | tr -d ' ')" "$(find dist -type f 2>/dev/null | wc -l | tr -d ' ')"

echo "==> done in $(( $(date +%s) - start ))s"
echo "    registry  $(find registry -type f | wc -l | tr -d ' ') files  ${REG_NEW:0:12}"
echo "    assets    $(find assets -type f | wc -l | tr -d ' ') files  ${AST_NEW:0:12}"
echo "    dist      $(find dist -type f 2>/dev/null | wc -l | tr -d ' ') files  $(node -e "try{process.stdout.write(require('./$BOOT/dist-status.json').dist)}catch(e){process.stdout.write('absent')}")"
