// Compute C1 (item coverage) and C2 (file integrity) and emit the pinned manifest.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const WORK = path.resolve(import.meta.dirname)
const DEST = path.resolve(WORK, "..")
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex")

const recs = fs
  .readFileSync(path.join(WORK, "manifest.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map(JSON.parse)

const enumOf = (r) =>
  JSON.parse(fs.readFileSync(path.join(WORK, "enum", `${r}.json`), "utf8")).items

// ---- C1: item coverage ----
// Denominator subtlety: for @shadcn the upstream universe is NOT names x styles.
// The 24 new styles genuinely do not publish examples/internal/themes (verified via
// both direct HTTP 404 and the shadcn CLI). So the honest denominator is
// "style x item pairs that upstream actually serves" = what we probed and got 200,
// PLUS anything we requested and failed on for a non-404 reason (a real miss).
const c1 = {}
for (const r of recs) {
  const k = r.reg
  c1[k] ??= { probed: 0, ok: 0, missing_404: 0, errors: [] }
  c1[k].probed++
  if (r.status === 200) c1[k].ok++
  else if (r.status === 404) c1[k].missing_404++
  else c1[k].errors.push({ name: r.name, style: r.style, status: r.status, err: r.err })
}

// Per-registry: did we get every NAME at least once?
const nameCoverage = {}
for (const reg of Object.keys(c1)) {
  const want = new Set(enumOf(reg).map((i) => i.name))
  const got = new Set(recs.filter((r) => r.reg === reg && r.status === 200).map((r) => r.name))
  const missing = [...want].filter((n) => !got.has(n))
  nameCoverage[reg] = {
    enumerated: want.size,
    retrieved: got.size,
    pct: +((got.size / want.size) * 100).toFixed(2),
    missing,
  }
}

// ---- C2: file integrity ----
// Every file we wrote came from a JSON blob we hashed at download time. Re-hash the
// stored raw JSON and confirm it still matches the manifest -> archive not corrupted.
let c2ok = 0,
  c2bad = []
for (const r of recs.filter((x) => x.status === 200)) {
  const p = r.style
    ? path.join(WORK, "raw", r.reg, r.style, `${r.name}.json`)
    : path.join(WORK, "raw", r.reg, `${r.name}.json`)
  if (!fs.existsSync(p)) {
    c2bad.push({ ...r, why: "missing on disk" })
    continue
  }
  const h = sha(fs.readFileSync(p, "utf8"))
  if (h === r.sha256) c2ok++
  else c2bad.push({ reg: r.reg, style: r.style, name: r.name, why: "sha mismatch" })
}

const fileIndex = JSON.parse(fs.readFileSync(path.join(WORK, "fileindex.json"), "utf8"))

const out = {
  pinned_at: new Date().toISOString(),
  upstream_commit: fs
    .readFileSync(path.join(DEST, "upstream", ".git", "HEAD"), "utf8")
    .trim(),
  registries: Object.fromEntries(
    Object.entries(c1).map(([k, v]) => [
      k,
      {
        ...v,
        errors: v.errors.slice(0, 20),
        error_count: v.errors.length,
        name_coverage: nameCoverage[k],
      },
    ])
  ),
  C2: {
    checked: c2ok + c2bad.length,
    intact: c2ok,
    pct: +((c2ok / (c2ok + c2bad.length)) * 100).toFixed(3),
    failures: c2bad.slice(0, 50),
  },
  extracted_files: {
    total: fileIndex.length,
    distinct_blobs: new Set(fileIndex.map((f) => f.sha256)).size,
    total_bytes: fileIndex.reduce((a, f) => a + f.bytes, 0),
  },
}

fs.writeFileSync(path.join(WORK, "metrics.json"), JSON.stringify(out, null, 2))

console.log(`upstream commit: ${out.upstream_commit}`)
console.log("\n=== C1 item coverage (name-level) ===")
for (const [reg, v] of Object.entries(nameCoverage))
  console.log(
    `${reg.padEnd(13)} ${String(v.retrieved).padStart(5)}/${String(v.enumerated).padEnd(5)} ${String(v.pct).padStart(6)}%  missing:${v.missing.length}`
  )
console.log("\n=== C1 style x item pairs (@shadcn detail) ===")
for (const [reg, v] of Object.entries(c1))
  console.log(`${reg.padEnd(13)} probed ${String(v.probed).padStart(6)}  ok ${String(v.ok).padStart(5)}  404 ${String(v.missing_404).padStart(5)}  err ${v.errors.length}`)
console.log(`\n=== C2 file integrity === ${out.C2.intact}/${out.C2.checked} = ${out.C2.pct}%`)
console.log(
  `extracted: ${out.extracted_files.total} files, ${out.extracted_files.distinct_blobs} distinct, ${(out.extracted_files.total_bytes / 1e6).toFixed(1)} MB`
)
