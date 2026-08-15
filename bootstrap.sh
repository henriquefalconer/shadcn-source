#!/usr/bin/env bash
# Generate the component archive from upstream sources.
#
#   ./bootstrap.sh          generate registry/, assets/ and the index files
#   ./bootstrap.sh --force  regenerate even if the tree already matches
#   ./bootstrap.sh --check  report status and exit; write nothing
#
# Idempotent. If the tree already matches the recorded state this exits 0
# immediately without touching the network.
set -euo pipefail

ARCHIVE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ARCHIVE"

BOOT="_work/bootstrap"
STATE="$BOOT/state.json"
FORCE=0
CHECK=0
for a in "$@"; do
  case "$a" in
    --force) FORCE=1 ;;
    --check) CHECK=1 ;;
    -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

command -v node >/dev/null || { echo "bootstrap: node is required" >&2; exit 1; }

# Order-stable digest of a directory's contents. Uses tar over a sorted file
# list so the result depends only on paths and bytes, never on filesystem
# ordering or timestamps.
tree_hash() {
  local dir="$1"
  [ -d "$dir" ] || { echo "absent"; return; }
  find "$dir" -type f | LC_ALL=C sort | tar -cf - --no-recursion -T - 2>/dev/null | shasum -a 256 | cut -d' ' -f1
}

read_state() { [ -f "$STATE" ] && node -e "try{process.stdout.write(String(require('./$STATE').$1||''))}catch(e){}" || true; }

REG_NOW="$(tree_hash registry)"
AST_NOW="$(tree_hash assets)"
REG_WANT="$(read_state registry)"
AST_WANT="$(read_state assets)"

if [ "$CHECK" = 1 ]; then
  echo "registry  now=${REG_NOW:0:12}  recorded=${REG_WANT:0:12}"
  echo "assets    now=${AST_NOW:0:12}  recorded=${AST_WANT:0:12}"
  [ -n "$REG_WANT" ] && [ "$REG_NOW" = "$REG_WANT" ] && [ "$AST_NOW" = "$AST_WANT" ] \
    && { echo "up to date"; exit 0; } || { echo "regeneration needed"; exit 1; }
fi

# ---- short-circuit ---------------------------------------------------------
if [ "$FORCE" = 0 ] && [ -n "$REG_WANT" ] && [ "$REG_NOW" = "$REG_WANT" ] && [ "$AST_NOW" = "$AST_WANT" ]; then
  echo "archive already matches the recorded state; nothing to do"
  exit 0
fi

start=$(date +%s)
echo "==> stage 1/3  registry"
OUT="$ARCHIVE/registry" node "$BOOT/fetch-registry.mjs"

echo "==> stage 2/3  assets"
node "$BOOT/fetch-assets.mjs"

echo "==> stage 3/3  indexes"
node "$BOOT/build-indexes.mjs"

# ---- record the resulting state --------------------------------------------
REG_NEW="$(tree_hash registry)"
AST_NEW="$(tree_hash assets)"
mkdir -p "$BOOT"
node -e "
const fs=require('fs');
fs.writeFileSync('$STATE', JSON.stringify({
  registry: '$REG_NEW',
  assets: '$AST_NEW',
  files: {
    registry: Number(process.argv[1]),
    assets: Number(process.argv[2]),
  },
}, null, 2) + '\n');
" "$(find registry -type f | wc -l | tr -d ' ')" "$(find assets -type f | wc -l | tr -d ' ')"

echo "==> done in $(( $(date +%s) - start ))s"
echo "    registry  $(find registry -type f | wc -l | tr -d ' ') files  ${REG_NEW:0:12}"
echo "    assets    $(find assets -type f | wc -l | tr -d ' ') files  ${AST_NEW:0:12}"
