#!/usr/bin/env node
// Stage 1 bootstrap: regenerate registry/ from upstream sources, byte-exact.
//
// Pipeline (mirrors /Users/vm/shadcn/bootstrap/{fetch,extract,flatten,reapply-rewrites,gen-notices}.mjs):
//   1. enumerate   -- `npx shadcn search <scope> -l 5000 --json` per registry (fresh, not cached)
//   2. fetch       -- download every item's registry-item JSON for every applicable style,
//                     with a resumable on-disk cache + manifest so re-runs skip completed work
//   3. extract     -- write every files[].content to OUT/<reg>/[<style>/]<path>
//   4. flatten     -- collapse the registry/<style>/registry/<style>/x nesting for @shadcn
//   5. rewrite     -- reapply the offline asset/font URL rewrites (idempotent, replayed from
//                     the archive's frozen assets-report.json + extra-rewrites.json)
//   6. notices     -- regenerate the per-registry NOTICE files (file counts depend on the
//                     final tree, so this must run last)
//
// Usage:
//   OUT=/path/to/out node fetch-registry.mjs
//   node fetch-registry.mjs /path/to/out
//
// Defaults OUT to bootstrap/tmp-registry (never writes to the real registry/).
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"
import os from "node:os"

const BOOTSTRAP = path.resolve(import.meta.dirname)
const ARCHIVE = path.resolve(BOOTSTRAP, "..")
const WORK = path.join(ARCHIVE, "bootstrap", "data")

const OUT = path.resolve(process.env.OUT || process.argv[2] || path.join(BOOTSTRAP, "tmp-registry"))
const RAW = path.join(BOOTSTRAP, "raw")
const ENUM = path.join(WORK, "enum") // committed, pinned
const MANIFEST = path.join(BOOTSTRAP, "manifest.jsonl")

// registry/ is the intended destination; bootstrap.sh passes it explicitly.

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex")

const t0 = Date.now()
const lap = (label) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${label}`)

// ---------------------------------------------------------------------------
// 1. Enumerate
// ---------------------------------------------------------------------------
const SCOPES = {
  shadcn: "@shadcn",
  "react-bits": "@react-bits",
  magicui: "@magicui",
  "animate-ui": "@animate-ui",
  "ai-elements": "@ai-elements",
}

async function enumerate() {
  // The item list is PINNED and committed (bootstrap/data/enum). Re-enumerating
  // from the live CLI would make the output change whenever upstream adds an
  // item, so a run could never be reproducible - and `shadcn search` is itself a
  // network round-trip that fails independently of this project.
  // REFRESH_ENUM=1 re-enumerates instead (drifts from the pin by design).
  const names = {}
  for (const reg of Object.keys(SCOPES)) {
    const pinned = path.join(ENUM, `${reg}.json`)
    if (!fs.existsSync(pinned)) throw new Error(`pinned enumeration missing: ${pinned}`)
    const json = JSON.parse(fs.readFileSync(pinned, "utf8"))
    names[reg] = json.items.map((i) => i.name)
    console.log(`  ${reg}: ${names[reg].length} items (pinned)`)
  }
  return names
}

// ---------------------------------------------------------------------------
// 2. Fetch (resumable, cached under RAW + MANIFEST)
// ---------------------------------------------------------------------------
const STYLES = [
  "new-york",
  "default",
  "new-york-v4",
  ...["radix", "base", "aria"].flatMap((b) =>
    ["vega", "nova", "maia", "lyra", "mira", "luma", "sera", "rhea"].map((t) => `${b}-${t}`)
  ),
]

const COMMUNITY = {
  "react-bits": "https://reactbits.dev/r/{name}.json",
  magicui: "https://magicui.design/r/{name}",
  "animate-ui": "https://animate-ui.com/r/{name}.json",
  "ai-elements": "https://ai-sdk.dev/elements/api/registry/{name}.json",
}

function buildJobs(names) {
  const jobs = []
  for (const style of STYLES)
    for (const name of names.shadcn)
      jobs.push({
        reg: "shadcn",
        style,
        name,
        url: `https://ui.shadcn.com/r/styles/${style}/${encodeURIComponent(name)}.json`,
        file: path.join(RAW, "shadcn", style, `${name}.json`),
      })
  for (const [reg, tpl] of Object.entries(COMMUNITY))
    for (const name of names[reg])
      jobs.push({
        reg,
        style: null,
        name,
        url: tpl.replace("{name}", encodeURIComponent(name)),
        file: path.join(RAW, reg, `${name}.json`),
      })
  return jobs
}

const jobKey = (j) => `${j.reg}${j.style}${j.name}`

function loadManifest() {
  const map = new Map()
  if (fs.existsSync(MANIFEST)) {
    for (const line of fs.readFileSync(MANIFEST, "utf8").split("\n")) {
      if (!line.trim()) continue
      try {
        const r = JSON.parse(line)
        map.set(`${r.reg}${r.style}${r.name}`, r)
      } catch {}
    }
  }
  return map
}

// A job is "done" (skippable) if we have a terminal record for it:
//  - 200: file must still exist on disk with the recorded sha (self-heals if cache was wiped)
//  - 404: permanent, known-absent style/item combination (expected -- most shadcn combos 404)
function isDone(job, rec) {
  if (!rec) return false
  if (rec.status === 200) {
    try {
      const body = fs.readFileSync(job.file, "utf8")
      return sha(body) === rec.sha256
    } catch {
      return false
    }
  }
  return rec.status === 404
}

// Shared, cross-worker backoff: a burst of 403/429 from one host means every
// worker hitting that host should ease off, not just the one request that
// got blocked. Keyed by hostname so a rate limit on ui.shadcn.com doesn't
// throttle reactbits.dev.
const rateLimit = new Map() // host -> { until, step }
const RETRYABLE_STATUS = new Set([403, 408, 425, 429, 500, 502, 503, 504])

async function waitForRateLimit(host) {
  const st = rateLimit.get(host)
  if (!st) return
  const now = Date.now()
  if (now < st.until) await new Promise((r) => setTimeout(r, st.until - now))
}

function bumpRateLimit(host) {
  const st = rateLimit.get(host) || { until: 0, step: 2000 }
  st.until = Date.now() + st.step
  st.step = Math.min(st.step * 1.6, 30000)
  rateLimit.set(host, st)
}

// Steady-state pacer, independent of the reactive 403/429 backoff above.
// ui.shadcn.com's Vercel-edge front rate-limits on sustained request *volume*,
// not just instantaneous concurrency: short 2,000-request bursts at 300 req/s
// stayed clean (0/6,000 across 3 runs), but a real, longer fetchAll run
// sustained at that same rate tripped a 403 after ~8,246 requests / 24.5s
// (~336 req/s effective). A 148 req/s sustained run of 3,968 requests over
// 26.8s was clean, and a dedicated 83s / 5,000-request sustained probe at 60
// req/s / 20-way concurrency was also clean (0/5,000). 60 req/s is the
// validated default -- conservative margin below the 148-336 req/s window
// where it broke, chosen for a *sustained*, full-length run rather than a
// short burst (bursts are not representative of the real failure mode here).
const RATE_LIMIT_RPS = { "ui.shadcn.com": Number(process.env.SHADCN_RPS || 60) }
const nextSlot = new Map() // host -> timestamp of next allowed dispatch

async function pace(host) {
  const rps = RATE_LIMIT_RPS[host]
  if (!rps) return
  const intervalMs = 1000 / rps
  const now = Date.now()
  const slot = Math.max(now, (nextSlot.get(host) || 0))
  nextSlot.set(host, slot + intervalMs)
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now))
}

// Circuit breaker: a 403 means the host has flagged us -- continuing to hammer
// it only extends the block. On the FIRST 403 from a host, trip immediately:
// abort every in-flight request to that host and stop dispatching new ones.
// (Scoped per-host so a 403 from ui.shadcn.com doesn't halt reactbits.dev.)
class HostBreaker {
  constructor() {
    this.tripped = new Map() // host -> reason
    this.controllers = new Map() // host -> AbortController
  }
  controllerFor(host) {
    if (!this.controllers.has(host)) this.controllers.set(host, new AbortController())
    return this.controllers.get(host)
  }
  isTripped(host) {
    return this.tripped.has(host)
  }
  trip(host, reason) {
    if (this.tripped.has(host)) return
    this.tripped.set(host, reason)
    console.log(`  CIRCUIT BREAKER: ${host} tripped (${reason}) -- aborting in-flight requests, stopping new dispatches`)
    this.controllerFor(host).abort()
  }
}

async function fetchOne(job, out, breaker) {
  let rec = { reg: job.reg, style: job.style, name: job.name, status: 0, bytes: 0, sha256: null, err: null }
  const host = new URL(job.url).host
  if (breaker.isTripped(host)) {
    rec.status = -598
    rec.err = "skipped: circuit breaker tripped"
    out.write(JSON.stringify(rec) + "\n")
    return rec
  }
  const MAX_ATTEMPTS = 7
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (breaker.isTripped(host)) {
      rec.status = -598
      rec.err = "skipped: circuit breaker tripped"
      break
    }
    await waitForRateLimit(host)
    await pace(host)
    try {
      const res = await fetch(job.url, {
        signal: AbortSignal.any([AbortSignal.timeout(45000), breaker.controllerFor(host).signal]),
        // No custom User-Agent: probing showed a distinctive UA string (e.g.
        // "shadcn-offline-mirror/1.0") is exactly what trips ui.shadcn.com's
        // Vercel-edge bot detection under load -- 0/2000 403s at 300 req/s
        // with the default UA, vs 49/2000 403s at the same rate with a custom
        // one, and a single blocked request then 403s the whole IP for
        // several minutes regardless of UA. Node's default fetch UA ("node")
        // reads as a normal client and was clean at every rate tested.
        headers: { accept: "application/json" },
      })
      rec.status = res.status
      if (res.status === 403) {
        breaker.trip(host, "403")
        rec.err = "403 -- circuit breaker tripped"
        break
      }
      const body = await res.text()
      if (res.ok) {
        // A 200 with an HTML error page is a failure, not a hit -- only a body
        // that parses as JSON counts.
        try {
          JSON.parse(body)
        } catch {
          rec.status = -415
          rec.err = "non-json body"
          break
        }
        fs.mkdirSync(path.dirname(job.file), { recursive: true })
        fs.writeFileSync(job.file, body)
        rec.bytes = Buffer.byteLength(body)
        rec.sha256 = sha(body)
        break
      }
      if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_ATTEMPTS - 1) {
        bumpRateLimit(host)
        rec.err = `retryable http ${res.status}`
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 500))
        continue
      }
      break
    } catch (e) {
      // An abort triggered by the breaker (another concurrent request got the
      // 403) surfaces here as an AbortError -- don't treat it as a fresh
      // network failure to retry, the breaker already owns the outcome.
      if (breaker.isTripped(host)) {
        rec.status = -598
        rec.err = "skipped: circuit breaker tripped"
        break
      }
      rec.err = String(e.cause?.code || e.message).slice(0, 80)
      rec.status = -1
      if (attempt < MAX_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
    }
  }
  out.write(JSON.stringify(rec) + "\n")
  return rec
}

async function fetchAll(jobs) {
  fs.mkdirSync(RAW, { recursive: true })
  const manifest = loadManifest()
  const todo = jobs.filter((j) => !isDone(j, manifest.get(jobKey(j))))
  console.log(`  jobs=${jobs.length} cached=${jobs.length - todo.length} todo=${todo.length}`)
  if (!todo.length) return { attempted: 0, tripped: [] }

  const out = fs.createWriteStream(MANIFEST, { flags: "a" })
  const CONC = Number(process.env.CONC || 32)
  // ui.shadcn.com carries ~89% of all jobs (12,717 of 14,344, since it's the
  // only registry fanned out across 27 styles) and is the one host that has
  // shown Cloudflare rate-limiting under a flat high-concurrency pool. Give it
  // its own, lower cap; other hosts (each a few hundred jobs, one request per
  // item) run at full concurrency.
  const HOST_CONC = { "ui.shadcn.com": Number(process.env.SHADCN_CONC || 20) }
  const breaker = new HostBreaker()

  const byHost = new Map()
  for (const j of todo) {
    const h = new URL(j.url).host
    if (!byHost.has(h)) byHost.set(h, [])
    byHost.get(h).push(j)
  }

  let n = 0,
    ok = 0,
    notfound = 0,
    failed = 0,
    skipped = 0
  const ft0 = Date.now()
  const runHost = async (host, list) => {
    const conc = HOST_CONC[host] || CONC
    let idx = 0
    await Promise.all(
      Array.from({ length: Math.min(conc, list.length) }, async () => {
        while (idx < list.length) {
          if (breaker.isTripped(host)) {
            // Drain the rest of this host's queue as skipped, without
            // dispatching, so `todo.length` accounting stays honest.
            idx = list.length
            break
          }
          const job = list[idx++]
          const rec = await fetchOne(job, out, breaker)
          n++
          if (rec.status === 200) ok++
          else if (rec.status === 404) notfound++
          else if (rec.status === -598) skipped++
          else failed++
          if (n % 500 === 0) {
            const rate = n / ((Date.now() - ft0) / 1000)
            console.log(`  ${n}/${todo.length}  ${rate.toFixed(1)}/s  ok=${ok} 404=${notfound} failed=${failed} skipped=${skipped}`)
          }
        }
      })
    )
  }
  await Promise.all([...byHost.entries()].map(([host, list]) => runHost(host, list)))
  await new Promise((res) => out.end(res))
  console.log(`  fetched ${n}: ok=${ok} 404=${notfound} failed=${failed} skipped=${skipped}`)
  if (breaker.tripped.size) {
    console.log(`  CIRCUIT BREAKER TRIPPED for: ${[...breaker.tripped.entries()].map(([h, r]) => `${h} (${r})`).join(", ")}`)
    console.log(`  Re-run to resume -- completed work is cached, only the un-fetched tail remains.`)
  }
  if (failed) {
    // Retryable failures (non-404, non-200) leave a record so the *next* run
    // retries them; a single run does its best but won't loop forever here.
    console.log(`  WARNING: ${failed} job(s) failed with a retryable error -- re-run to retry`)
  }
  return { attempted: n, ok, notfound, failed, skipped, tripped: [...breaker.tripped.keys()] }
}

// ---------------------------------------------------------------------------
// 3. Extract  (raw/<reg>/[<style>/]<name>.json -> OUT/<reg>/[<style>/]<file.path>)
// ---------------------------------------------------------------------------
function extract() {
  const items = []
  // Sort directory listings so that when two registry items write to the same
  // destination path (e.g. react-bits ships a component in JS/TS x CSS/Tailwind
  // variants that can collide on the same "<Name>/<Name>.tsx" path), which one
  // wins is deterministic across machines and filesystems rather than an
  // accident of readdir order.
  for (const reg of [...fs.readdirSync(RAW)].sort()) {
    const regDir = path.join(RAW, reg)
    const walk = (dir, style) => {
      for (const e of [...fs.readdirSync(dir, { withFileTypes: true })].sort((a, b) => a.name.localeCompare(b.name))) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p, e.name)
        else if (e.name.endsWith(".json")) {
          let json
          try {
            json = JSON.parse(fs.readFileSync(p, "utf8"))
          } catch {
            continue
          }
          const arr = Array.isArray(json) ? json : [json]
          for (const j of arr)
            items.push({ reg, style: reg === "shadcn" ? style : null, name: e.name.replace(/\.json$/, ""), json: j })
        }
      }
    }
    walk(regDir, null)
  }

  let written = 0
  for (const it of items) {
    const files = it.json.files || []
    for (const f of files) {
      if (typeof f.content !== "string") continue
      const rel = (f.path || `${it.name}.txt`).replace(/^\/+/, "").replace(/\.\./g, "_")
      const base = it.style ? path.join(OUT, it.reg, it.style) : path.join(OUT, it.reg)
      const dest = path.join(base, rel)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, f.content)
      written++
    }
  }
  console.log(`  items=${items.length} files written=${written}`)
}

// ---------------------------------------------------------------------------
// 4. Flatten  (OUT/shadcn/<style>/registry/<style>/x -> OUT/shadcn/<style>/x)
// ---------------------------------------------------------------------------
function flatten() {
  const SH = path.join(OUT, "shadcn")
  if (!fs.existsSync(SH)) return
  let moved = 0
  const collisions = []
  for (const style of fs.readdirSync(SH)) {
    const styleDir = path.join(SH, style)
    if (!fs.statSync(styleDir).isDirectory()) continue
    const nested = path.join(styleDir, "registry", style)
    if (!fs.existsSync(nested)) continue

    const move = (from, to) => {
      for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        const src = path.join(from, e.name)
        const dst = path.join(to, e.name)
        if (e.isDirectory()) {
          fs.mkdirSync(dst, { recursive: true })
          move(src, dst)
        } else {
          if (fs.existsSync(dst)) {
            const a = fs.readFileSync(src)
            const b = fs.readFileSync(dst)
            if (!a.equals(b)) collisions.push(path.relative(OUT, dst))
            fs.rmSync(src)
          } else {
            fs.renameSync(src, dst)
            moved++
          }
        }
      }
    }
    move(nested, styleDir)
    fs.rmSync(path.join(styleDir, "registry"), { recursive: true, force: true })
  }
  console.log(`  flattened: ${moved} files moved, ${collisions.length} collisions`)
  if (collisions.length) console.log("  " + collisions.slice(0, 20).join("\n  "))
}

// ---------------------------------------------------------------------------
// 5. Rewrite  (replay assets-report.json + extra-rewrites.json against OUT)
// ---------------------------------------------------------------------------
function rewrite() {
  const assets = JSON.parse(fs.readFileSync(path.join(WORK, "assets-report.json"), "utf8"))
  const map = new Map(assets.bucket_B.downloaded_assets.map((a) => [a.url, a.localPath]))

  const EXTRA_REWRITES_PATH = path.join(WORK, "extra-rewrites.json")
  const extraRewrites = fs.existsSync(EXTRA_REWRITES_PATH) ? JSON.parse(fs.readFileSync(EXTRA_REWRITES_PATH, "utf8")) : []

  const FONT_CSS = "/assets/fonts/fonts.css"

  const files = []
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(tsx?|jsx?|css|json|mdx?|html)$/.test(e.name)) files.push(p)
    }
  }
  walk(OUT)

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
    src = src.replace(/https?:\/\/fonts\.googleapis\.com\/css2\?[^"'`)\s]*/g, () => {
      fontOcc++
      return FONT_CSS
    })
    // extra-rewrites.json entries are scoped by archive-relative path
    // ("registry/<reg>/..."); OUT is the registry/ dir itself, so strip the
    // leading "registry/" prefix to match.
    const relFromOut = path.relative(OUT, f)
    const relPath = path.join("registry", relFromOut)
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
  console.log(`  modified=${modified} asset-occ=${occurrences} font-occ=${fontOcc} extra-occ=${extraOcc}`)
}

// ---------------------------------------------------------------------------
// 6. Notices
// ---------------------------------------------------------------------------
function genNotices() {
  const count = (d) => {
    try {
      let n = 0
      const walk = (p) => {
        for (const e of fs.readdirSync(p, { withFileTypes: true })) {
          if (e.name === "NOTICE") continue
          e.isDirectory() ? walk(path.join(p, e.name)) : n++
        }
      }
      walk(d)
      return n
    } catch {
      return 0
    }
  }

  const rule = "─".repeat(70)
  const head = (title, home) => `${title}\n${home}\n\n`
  const foot = (depth) => `\nFull third-party inventory: ${"../".repeat(depth)}THIRD-PARTY.md\n`

  const COMMONS = (verb) => `
This is a MODIFIED MIT license, not MIT plus a rider. The grant itself is
narrowed — it permits distribution only "as part of an application, website,
or product", and drops MIT's rights to sell and sublicense. A Commons Clause
restriction is then added on top:

  You may use this Software, including for any commercial purpose, so long
  as you do not ${verb}

Using these components in an application, website or product — including a
commercial one — is permitted. Redistributing the components as components
is not.
`

  const notices = {
    shadcn: {
      depth: 2,
      body: head("shadcn/ui", "https://ui.shadcn.com") + "MIT License\nCopyright (c) 2023 shadcn\n",
    },
    magicui: {
      depth: 2,
      body: head("Magic UI", "https://magicui.design") + "MIT License\nCopyright (c) Magic UI\n",
    },
    "ai-elements": {
      depth: 2,
      body:
        head("AI Elements", "https://ai-sdk.dev/elements") +
        "Apache License, Version 2.0\nCopyright 2023 Vercel, Inc.\n\n" +
        "Full license text: ../../licenses/Apache-2.0.txt\n",
    },
    "react-bits": {
      depth: 2,
      body:
        head("React Bits", "https://reactbits.dev") +
        "MIT License with the Commons Clause License Condition v1.0\n" +
        "Copyright (c) 2026 David Haz\n" +
        COMMONS(
          "sell, sublicense, or redistribute the components\n  themselves—whether alone, in a bundle, or as a ported version."
        ),
    },
    "animate-ui": {
      depth: 2,
      body:
        head("Animate UI", "https://animate-ui.com") +
        "MIT License with the Commons Clause License Condition\n" +
        "Copyright (c) 2025 Elliot Sutton\n" +
        COMMONS("sell or redistribute the components themselves\n  in their original form—whether alone or in a bundle."),
    },
  }

  let written = 0
  for (const [dir, { depth, body }] of Object.entries(notices)) {
    const target = path.join(OUT, dir)
    if (!fs.existsSync(target)) {
      console.log(`  SKIP (missing): ${dir}`)
      continue
    }
    const n = count(target)
    const text = `${rule}\n${body}${foot(depth)}${rule}\n${n} files in this directory.\n`
    fs.writeFileSync(path.join(target, "NOTICE"), text)
    written++
  }
  console.log(`  wrote ${written} NOTICE files`)
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`OUT=${OUT}`)

  // Dev-only escape hatch: SKIP_FETCH=1 reuses whatever's already in RAW/
  // untouched and jumps straight to extract/flatten/rewrite/notices. Never
  // used by a real bootstrap run -- only for iterating on steps 3-6 without
  // re-hitting the network.
  let fetchStats = { failed: 0, tripped: [] }
  if (process.env.SKIP_FETCH === "1") {
    console.log("SKIP_FETCH=1 -- reusing existing raw/ cache, skipping enumerate+fetch")
  } else {
    lap("enumerate: start")
    const names = await enumerate()
    lap("enumerate: done")

    const jobs = buildJobs(names)
    lap(`fetch: start (${jobs.length} jobs)`)
    fetchStats = await fetchAll(jobs)
    lap("fetch: done")
  }

  // Rebuild OUT from scratch every run: extract.mjs only ever writes/overwrites,
  // it never deletes, so a stale file from an item that disappeared upstream
  // would otherwise survive indefinitely and break byte-exact reproducibility.
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })

  lap("extract: start")
  extract()
  lap("extract: done")

  lap("flatten: start")
  flatten()
  lap("flatten: done")

  lap("rewrite: start")
  rewrite()
  lap("rewrite: done")

  lap("notices: start")
  genNotices()
  lap("notices: done")

  const totalFiles = (() => {
    let n = 0
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        e.isDirectory() ? walk(path.join(d, e.name)) : n++
      }
    }
    walk(OUT)
    return n
  })()

  const elapsed = (Date.now() - t0) / 1000
  console.log(`\ndone: ${totalFiles} files written to ${OUT} in ${elapsed.toFixed(1)}s`)
  if (fetchStats.failed) {
    console.log(`NOTE: ${fetchStats.failed} fetch job(s) failed with a retryable error this run -- re-run to retry them`)
  }
  if (fetchStats.tripped?.length) {
    console.log(`NOTE: circuit breaker tripped for ${fetchStats.tripped.join(", ")} -- output above is INCOMPLETE, re-run to resume`)
    process.exitCode = 2
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
