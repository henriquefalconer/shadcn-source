#!/usr/bin/env node
// Stage 3 acceptance test. Verifies:
//   2. every INDEX.json files[].local exists on disk and its sha256 matches
//   3. item counts hold: 2098 unique items, 6126 style-resolved entries,
//      7080 file entries
//   4. the generator is idempotent: running it twice produces byte-identical
//      INDEX.tsv / INDEX.json / INDEX-compact.json / manifest.json
// Exits non-zero on any failure.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"

const BOOTSTRAP = path.resolve(import.meta.dirname)
const WORK = path.resolve(BOOTSTRAP, "..")
const DEST = path.resolve(WORK, "..")
const FILES = ["INDEX.json", "INDEX.tsv", "INDEX-compact.json", "manifest.json"]

let failed = false
const fail = (msg) => {
  console.error(`FAIL: ${msg}`)
  failed = true
}
const ok = (msg) => console.log(`OK:   ${msg}`)

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex")

// ---------------------------------------------------------------------------
// Criterion 4 (checked first): idempotency. Run the generator twice and
// diff the sha256 of all four output files between runs.
// ---------------------------------------------------------------------------
console.log("== idempotency: running generator twice ==")
execFileSync("node", [path.join(BOOTSTRAP, "build-indexes.mjs")], { cwd: DEST, stdio: "inherit" })
const hashes1 = Object.fromEntries(FILES.map((f) => [f, sha256(fs.readFileSync(path.join(DEST, f)))]))
execFileSync("node", [path.join(BOOTSTRAP, "build-indexes.mjs")], { cwd: DEST, stdio: "inherit" })
const hashes2 = Object.fromEntries(FILES.map((f) => [f, sha256(fs.readFileSync(path.join(DEST, f)))]))

for (const f of FILES) {
  if (hashes1[f] === hashes2[f]) ok(`${f} byte-identical across two runs (${hashes1[f].slice(0, 12)})`)
  else fail(`${f} DIFFERS between run 1 (${hashes1[f]}) and run 2 (${hashes2[f]})`)
}

// ---------------------------------------------------------------------------
// Load the (now regenerated) INDEX.json for criteria 2 and 3
// ---------------------------------------------------------------------------
console.log("\n== loading INDEX.json ==")
const index = JSON.parse(fs.readFileSync(path.join(DEST, "INDEX.json"), "utf8"))
const compact = JSON.parse(fs.readFileSync(path.join(DEST, "INDEX-compact.json"), "utf8"))
const tsvLines = fs
  .readFileSync(path.join(DEST, "INDEX.tsv"), "utf8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
const manifest = JSON.parse(fs.readFileSync(path.join(DEST, "manifest.json"), "utf8"))

// ---------------------------------------------------------------------------
// Criterion 3: counts
// ---------------------------------------------------------------------------
console.log("\n== counts ==")
const expect = { uniqueItems: 2098, styleResolvedEntries: 6126, fileEntries: 7080 }
const totalFiles = index.items.reduce((n, it) => n + it.files.length, 0)

if (compact.length === expect.uniqueItems) ok(`INDEX-compact.json: ${compact.length} unique items`)
else fail(`INDEX-compact.json: ${compact.length} unique items, expected ${expect.uniqueItems}`)

if (tsvLines.length === expect.uniqueItems) ok(`INDEX.tsv: ${tsvLines.length} data rows`)
else fail(`INDEX.tsv: ${tsvLines.length} data rows, expected ${expect.uniqueItems}`)

if (index.items.length === expect.styleResolvedEntries) ok(`INDEX.json: ${index.items.length} style-resolved entries`)
else fail(`INDEX.json: ${index.items.length} style-resolved entries, expected ${expect.styleResolvedEntries}`)

if (totalFiles === expect.fileEntries) ok(`INDEX.json: ${totalFiles} file entries`)
else fail(`INDEX.json: ${totalFiles} file entries, expected ${expect.fileEntries}`)

if (manifest.items.length === expect.styleResolvedEntries) ok(`manifest.json: ${manifest.items.length} items`)
else fail(`manifest.json: ${manifest.items.length} items, expected ${expect.styleResolvedEntries}`)

// ---------------------------------------------------------------------------
// Criterion 2: every files[].local exists on disk and its sha256 matches
// ---------------------------------------------------------------------------
console.log("\n== file existence + sha256 verification ==")
let checked = 0,
  missing = 0,
  mismatched = 0
for (const it of index.items) {
  for (const f of it.files) {
    checked++
    const abs = path.join(DEST, f.local)
    if (!fs.existsSync(abs)) {
      missing++
      if (missing <= 10) fail(`missing on disk: ${f.local}`)
      continue
    }
    const buf = fs.readFileSync(abs)
    if (buf.length !== f.bytes) {
      mismatched++
      if (mismatched <= 10) fail(`bytes mismatch: ${f.local} (recorded ${f.bytes}, actual ${buf.length})`)
      continue
    }
    const actualSha = sha256(buf)
    if (actualSha !== f.sha256) {
      mismatched++
      if (mismatched <= 10) fail(`sha256 mismatch: ${f.local} (recorded ${f.sha256}, actual ${actualSha})`)
    }
  }
}
console.log(`checked ${checked} file entries: ${checked - missing - mismatched} match, ${missing} missing, ${mismatched} sha256/bytes mismatch`)
if (missing === 0 && mismatched === 0) ok(`all ${checked} files[].local exist on disk with matching sha256`)
else fail(`${missing} missing + ${mismatched} mismatched out of ${checked}`)

// ---------------------------------------------------------------------------
console.log(failed ? "\nRESULT: FAIL" : "\nRESULT: PASS")
process.exit(failed ? 1 : 0)
