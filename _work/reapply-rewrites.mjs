// Idempotent re-application of the offline rewrites.
// Needed because re-running extract.mjs restores pristine upstream content from
// raw JSON and therefore reverts them. Safe to run any number of times.
import fs from "node:fs"
import path from "node:path"

const DEST = path.resolve(import.meta.dirname, "..")
const REG = path.join(DEST, "registry")

const assets = JSON.parse(fs.readFileSync(path.join(DEST, "_work", "assets-report.json"), "utf8"))
const map = new Map(assets.bucket_B.downloaded_assets.map((a) => [a.url, a.localPath]))

// Extra, hand-authored rewrites (net-fix pass): dynamic templates, JSX prop
// additions, and library-runtime-default overrides that a plain URL->localPath
// substring map can't express as a single global find/replace. Each entry is
// scoped to its `file` and applied as an exact old_string -> new_string swap.
const EXTRA_REWRITES_PATH = path.join(DEST, "_work", "extra-rewrites.json")
const extraRewrites = fs.existsSync(EXTRA_REWRITES_PATH) ? JSON.parse(fs.readFileSync(EXTRA_REWRITES_PATH, "utf8")) : []

// Fonts: every css2 stylesheet reference collapses to the one self-hosted bundle.
const FONT_CSS = "/assets/fonts/fonts.css"

const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(tsx?|jsx?|css|json|mdx?|html)$/.test(e.name)) files.push(p)
  }
}
walk(REG)

// Longest URL first so a prefix never shadows a longer, more specific match.
const urls = [...map.keys()].sort((a, b) => b.length - a.length)

let modified = 0,
  occurrences = 0,
  fontOcc = 0,
  extraOcc = 0
for (const f of files) {
  let src
  try {
    src = fs.readFileSync(f, "utf8")
  } catch {
    continue
  }
  const before = src
  for (const u of urls) {
    if (!src.includes(u)) continue
    const n = src.split(u).length - 1
    src = src.split(u).join(map.get(u))
    occurrences += n
  }
  // Google Fonts stylesheet URLs -> local bundle. Matches the full css2 URL
  // including its query string, which is why a plain split() is not enough.
  src = src.replace(/https?:\/\/fonts\.googleapis\.com\/css2\?[^"'`)\s]*/g, () => {
    fontOcc++
    return FONT_CSS
  })
  const relPath = path.relative(DEST, f)
  for (const r of extraRewrites) {
    if (r.file !== relPath) continue
    if (!src.includes(r.url)) continue
    const n = src.split(r.url).length - 1
    src = src.split(r.url).join(r.localPath)
    extraOcc += n
  }
  if (src !== before) {
    fs.writeFileSync(f, src)
    modified++
  }
}

console.log(`files modified: ${modified}`)
console.log(`asset occurrences replaced: ${occurrences}`)
console.log(`font stylesheet occurrences replaced: ${fontOcc}`)
console.log(`extra-rewrites.json occurrences replaced: ${extraOcc} (of ${extraRewrites.length} entries)`)

// Verify: which bucket-B URLs survive, and why.
const remaining = []
const all = fs.readFileSync.bind(fs)
for (const u of urls) {
  const hits = files.filter((f) => {
    try {
      return all(f, "utf8").includes(u)
    } catch {
      return false
    }
  })
  if (hits.length) remaining.push({ url: u, files: hits.length })
}
console.log(`\nbucket-B URLs still present: ${remaining.length}`)
remaining.slice(0, 15).forEach((r) => console.log("  ", r.files, r.url.slice(0, 100)))
for (const h of ["fonts.googleapis.com/css2", "fonts.gstatic.com"]) {
  const n = files.filter((f) => {
    try {
      return all(f, "utf8").includes(h)
    } catch {
      return false
    }
  }).length
  console.log(`${h}: ${n} files`)
}
