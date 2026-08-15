// Phase 3a: extract every registry item's files into a browsable tree,
// and build the complete reference graph for C3 closure analysis.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const WORK = path.resolve(import.meta.dirname)
const DEST = path.resolve(WORK, "..")
const RAW = path.join(WORK, "raw")

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex")

const items = [] // {reg, style, name, type, json}
for (const reg of fs.readdirSync(RAW)) {
  const regDir = path.join(RAW, reg)
  const walk = (dir, style) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p, e.name)
      else if (e.name.endsWith(".json")) {
        let json
        try {
          json = JSON.parse(fs.readFileSync(p, "utf8"))
        } catch {
          continue
        }
        // magicui returns {name,...} directly; some return arrays
        const arr = Array.isArray(json) ? json : [json]
        for (const j of arr)
          items.push({ reg, style: reg === "shadcn" ? style : null, name: e.name.replace(/\.json$/, ""), type: j.type, json: j })
      }
    }
  }
  walk(regDir, null)
}
console.log(`items loaded: ${items.length}`)

// ---- extract files ----
const fileIndex = [] // {reg, style, item, path, bytes, sha256, dest}
let written = 0,
  noFiles = 0
for (const it of items) {
  const files = it.json.files || []
  if (!files.length) noFiles++
  for (const f of files) {
    if (typeof f.content !== "string") continue
    const rel = (f.path || `${it.name}.txt`).replace(/^\/+/, "").replace(/\.\./g, "_")
    const base = it.style
      ? path.join(DEST, "registry", it.reg, it.style)
      : path.join(DEST, "registry", it.reg)
    const dest = path.join(base, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, f.content)
    written++
    fileIndex.push({
      reg: it.reg,
      style: it.style,
      item: it.name,
      type: f.type || it.type,
      path: rel,
      bytes: Buffer.byteLength(f.content),
      sha256: sha(f.content),
      dest: path.relative(DEST, dest),
    })
  }
}
console.log(`files written: ${written}  (items with no files: ${noFiles})`)

// ---- reference graph ----
const npmDeps = new Map() // spec -> count
const regDeps = new Map() // ref -> count
const remoteUrls = new Map() // url -> Set(item)
const imports = new Map() // specifier -> count

const IMPORT_RE = /(?:import|export)[\s\S]{0,400}?from\s*["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)|import\(\s*["']([^"']+)["']\s*\)/g
const URL_RE = /https?:\/\/[^\s"'`)<>\\]+/g

const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1)

for (const it of items) {
  for (const d of it.json.dependencies || []) bump(npmDeps, d)
  for (const d of it.json.devDependencies || []) bump(npmDeps, d)
  for (const d of it.json.registryDependencies || []) bump(regDeps, d)
  const blobs = [
    ...(it.json.files || []).map((f) => f.content).filter((c) => typeof c === "string"),
    JSON.stringify(it.json.cssVars || {}),
    JSON.stringify(it.json.css || {}),
  ]
  for (const c of blobs) {
    let m
    IMPORT_RE.lastIndex = 0
    while ((m = IMPORT_RE.exec(c))) bump(imports, m[1] || m[2] || m[3])
    URL_RE.lastIndex = 0
    while ((m = URL_RE.exec(c))) {
      const u = m[0].replace(/[.,;]+$/, "")
      if (!remoteUrls.has(u)) remoteUrls.set(u, new Set())
      remoteUrls.get(u).add(`${it.reg}/${it.name}`)
    }
  }
}

// classify imports
const isRelative = (s) => s.startsWith(".") || s.startsWith("/")
const isAlias = (s) => s.startsWith("@/") || s.startsWith("~/")
const pkgOf = (s) => (s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : s.split("/")[0])

const bare = new Map()
for (const [spec, n] of imports) {
  if (isRelative(spec) || isAlias(spec)) continue
  bump(bare, pkgOf(spec))
}

const report = {
  generated_from: "raw registry item JSON",
  items: items.length,
  files_written: written,
  distinct_files: new Set(fileIndex.map((f) => f.sha256)).size,
  npm_declared: [...npmDeps.entries()].sort((a, b) => b[1] - a[1]),
  npm_imported_bare: [...bare.entries()].sort((a, b) => b[1] - a[1]),
  registry_deps: [...regDeps.entries()].sort((a, b) => b[1] - a[1]),
  remote_urls: [...remoteUrls.entries()]
    .map(([u, s]) => ({ url: u, count: s.size, sample: [...s].slice(0, 3) }))
    .sort((a, b) => b.count - a.count),
}
fs.writeFileSync(path.join(WORK, "refs.json"), JSON.stringify(report, null, 2))
fs.writeFileSync(path.join(WORK, "fileindex.json"), JSON.stringify(fileIndex))

console.log(`distinct file blobs: ${report.distinct_files}`)
console.log(`npm packages declared: ${npmDeps.size}   imported-bare: ${bare.size}`)
console.log(`registryDependencies refs: ${regDeps.size}`)
console.log(`REMOTE URLs found in content: ${remoteUrls.size}  (total refs ${[...remoteUrls.values()].reduce((a, s) => a + s.size, 0)})`)
