// Determine the C5 denominator honestly: which archived files are INDEPENDENTLY
// renderable (default export, zero required props) vs. which are library primitives
// that can only be exercised through an example.
import fs from "node:fs"
import path from "node:path"

const DEST = path.resolve(import.meta.dirname, "..")
const REG = path.join(DEST, "registry")

const srcFiles = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(tsx|jsx)$/.test(e.name)) srcFiles.push(p)
  }
}
walk(REG)

// Match the default export and capture its parameter list.
const PATTERNS = [
  /export\s+default\s+function\s*([A-Za-z0-9_$]*)\s*\(([^)]*)\)/,
  /export\s+default\s+(?:React\.)?(?:memo|forwardRef)\s*\(\s*(?:function\s*[A-Za-z0-9_$]*\s*)?\(([^)]*)\)/,
  /export\s+default\s+\(([^)]*)\)\s*=>/,
  /export\s+default\s+([A-Za-z0-9_$]+)\s*;?\s*$/m,
]

const results = []
for (const f of srcFiles) {
  let src
  try {
    src = fs.readFileSync(f, "utf8")
  } catch {
    continue
  }
  const rel = path.relative(DEST, f)
  let verdict = "no-default-export"
  let params = null

  const m0 = src.match(PATTERNS[0])
  const m1 = src.match(PATTERNS[1])
  const m2 = src.match(PATTERNS[2])
  const m3 = src.match(PATTERNS[3])

  if (m0) {
    params = m0[2].trim()
    verdict = params === "" ? "renderable" : "needs-props"
  } else if (m1) {
    params = m1[1].trim()
    verdict = params === "" ? "renderable" : "needs-props"
  } else if (m2) {
    params = m2[1].trim()
    verdict = params === "" ? "renderable" : "needs-props"
  } else if (m3) {
    // `export default Foo` - resolve Foo's declaration to see its params.
    const nm = m3[1]
    const decl = new RegExp(`(?:function\\s+${nm}\\s*\\(([^)]*)\\)|const\\s+${nm}\\s*[=:][^=]*?\\(([^)]*)\\)\\s*=>)`).exec(src)
    if (decl) {
      params = (decl[1] ?? decl[2] ?? "").trim()
      verdict = params === "" ? "renderable" : "needs-props"
    } else verdict = "indirect-default-export"
  }

  // A destructured param list where EVERY key has a default is still zero-arg callable.
  if (verdict === "needs-props" && params && params.startsWith("{")) {
    const body = params.slice(1, params.lastIndexOf("}"))
    const keys = body.split(/,(?![^{[]*[}\]])/).map((s) => s.trim()).filter(Boolean)
    const allDefaulted = keys.length > 0 && keys.every((k) => k.includes("=") || k.startsWith("..."))
    if (allDefaulted) verdict = "renderable-defaulted"
  }

  const reg = rel.split(path.sep)[1]
  results.push({ file: rel, registry: reg, verdict, params: params?.slice(0, 80) ?? null,
    isClient: /^["']use client["']/m.test(src),
    usesWebGL: /\b(three|ogl|@react-three|postprocessing|WebGL|gl-matrix)\b/.test(src) })
}

fs.writeFileSync(path.join(path.dirname(import.meta.dirname), "_work", "renderable.json"), JSON.stringify(results))

const tally = {}
for (const r of results) {
  tally[r.registry] ??= {}
  tally[r.registry][r.verdict] = (tally[r.registry][r.verdict] || 0) + 1
}
console.log(`source files scanned: ${results.length}\n`)
const verdicts = ["renderable", "renderable-defaulted", "needs-props", "no-default-export", "indirect-default-export"]
console.log("registry".padEnd(14) + verdicts.map((v) => v.slice(0, 12).padStart(14)).join(""))
for (const [reg, t] of Object.entries(tally))
  console.log(reg.padEnd(14) + verdicts.map((v) => String(t[v] || 0).padStart(14)).join(""))
const tot = (v) => results.filter((r) => r.verdict === v).length
console.log(
  `\nDIRECTLY RENDERABLE: ${tot("renderable") + tot("renderable-defaulted")} / ${results.length}`
)
console.log(`WebGL-dependent files: ${results.filter((r) => r.usesWebGL).length}`)
