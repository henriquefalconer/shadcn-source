#!/usr/bin/env node
// Compares a produced registry tree against the frozen reference.json byte-for-byte.
//
// Usage:
//   OUT=/path/to/out node test-registry.mjs
//   node test-registry.mjs /path/to/out
//
// Exits 0 iff every file in reference.json's "registry" map is present with a
// matching sha256, and no unexpected extra files exist. Exits non-zero otherwise.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

const BOOTSTRAP = path.resolve(import.meta.dirname)
const OUT = path.resolve(process.env.OUT || process.argv[2] || path.join(BOOTSTRAP, "tmp-registry"))
const REFERENCE = path.join(BOOTSTRAP, "reference.json")

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex")

const reference = JSON.parse(fs.readFileSync(REFERENCE, "utf8")).registry
// reference keys are archive-relative, e.g. "registry/shadcn/new-york-v4/ui/button.tsx"
// OUT corresponds to the registry/ dir itself, so strip that prefix.
const expected = new Map()
for (const [key, hash] of Object.entries(reference)) {
  if (!key.startsWith("registry/")) continue
  expected.set(key.slice("registry/".length), hash)
}

const actualFiles = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else actualFiles.push(p)
  }
}
if (fs.existsSync(OUT)) walk(OUT)

const actual = new Map()
for (const f of actualFiles) {
  const rel = path.relative(OUT, f).split(path.sep).join("/")
  actual.set(rel, sha(fs.readFileSync(f)))
}

const matched = []
const mismatched = []
const missing = []
for (const [rel, expectedHash] of expected) {
  if (!actual.has(rel)) {
    missing.push(rel)
  } else if (actual.get(rel) !== expectedHash) {
    mismatched.push(rel)
  } else {
    matched.push(rel)
  }
}
const extra = [...actual.keys()].filter((rel) => !expected.has(rel)).sort()

console.log(`expected: ${expected.size}`)
console.log(`matched:  ${matched.length}`)
console.log(`mismatched: ${mismatched.length}`)
if (mismatched.length) mismatched.sort().forEach((p) => console.log(`  MISMATCH  ${p}`))
console.log(`missing: ${missing.length}`)
if (missing.length) missing.sort().forEach((p) => console.log(`  MISSING   ${p}`))
console.log(`unexpected-extra: ${extra.length}`)
if (extra.length) extra.forEach((p) => console.log(`  EXTRA     ${p}`))

const perfect = mismatched.length === 0 && missing.length === 0 && extra.length === 0 && matched.length === expected.size
console.log(`\n${perfect ? "PASS" : "FAIL"}: ${matched.length}/${expected.size} matched, ${mismatched.length} mismatched, ${missing.length} missing, ${extra.length} extra`)
process.exit(perfect ? 0 : 1)
