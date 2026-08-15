// Standalone probe: find the highest sustained request rate to ui.shadcn.com
// that does not trigger a 403. Does NOT write to raw/ or manifest.jsonl --
// purely measures status codes for a batch of real, distinct URLs at a given
// rate, so it doesn't corrupt the real fetch's resumable state.
import fs from "node:fs"
import path from "node:path"

const STYLES = [
  "new-york", "default", "new-york-v4",
  ...["radix", "base", "aria"].flatMap((b) =>
    ["vega", "nova", "maia", "lyra", "mira", "luma", "sera", "rhea"].map((t) => `${b}-${t}`)
  ),
]
const names = JSON.parse(fs.readFileSync("/Users/vm/shadcn/_work/enum/shadcn.json", "utf8")).items.map((i) => i.name)

// Exclude combos already recorded in manifest.jsonl so probing doesn't just
// re-hit cache-hit URLs (want realistic, varied load).
const MANIFEST = "/Users/vm/shadcn/_work/bootstrap/manifest.jsonl"
const done = new Set()
if (fs.existsSync(MANIFEST)) {
  for (const line of fs.readFileSync(MANIFEST, "utf8").split("\n")) {
    if (!line.trim()) continue
    try {
      const r = JSON.parse(line)
      done.add(`${r.style}|${r.name}`)
    } catch {}
  }
}

const allUrls = []
for (const style of STYLES)
  for (const name of names) {
    if (done.has(`${style}|${name}`)) continue
    allUrls.push(`https://ui.shadcn.com/r/styles/${style}/${encodeURIComponent(name)}.json`)
  }
console.log(`candidate untested urls: ${allUrls.length}`)

// shuffle deterministically-ish so repeated probe runs sample different urls
for (let i = allUrls.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
  ;[allUrls[i], allUrls[j]] = [allUrls[j], allUrls[i]]
}

const RPS = Number(process.env.RPS || 5)
const CONC = Number(process.env.CONC || 6)
const N = Number(process.env.N || 200)
const urls = allUrls.slice(0, N)

const intervalMs = 1000 / RPS
let nextSlot = Date.now()
async function pace() {
  const now = Date.now()
  const slot = Math.max(now, nextSlot)
  nextSlot = slot + intervalMs
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now))
}

// Circuit breaker: stop on the first 403. Continuing to hammer a host that
// just flagged us only extends the block -- abort in-flight requests and
// stop dispatching new ones immediately.
const breakerController = new AbortController()
let tripped = false

let idx = 0
const counts = {}
const t0 = Date.now()
await Promise.all(
  Array.from({ length: Math.min(CONC, urls.length) }, async () => {
    while (idx < urls.length) {
      if (tripped) break
      const url = urls[idx++]
      await pace()
      if (tripped) break
      try {
        const res = await fetch(url, {
          signal: AbortSignal.any([AbortSignal.timeout(20000), breakerController.signal]),
          headers: process.env.UA ? { accept: "application/json", "user-agent": process.env.UA } : {},
        })
        counts[res.status] = (counts[res.status] || 0) + 1
        if (res.status === 403 && !tripped) {
          tripped = true
          console.log(`  CIRCUIT BREAKER: 403 seen -- aborting in-flight requests, stopping`)
          breakerController.abort()
        }
      } catch (e) {
        if (tripped) break
        counts.err = (counts.err || 0) + 1
      }
    }
  })
)
const elapsed = (Date.now() - t0) / 1000
console.log(
  `RPS=${RPS} CONC=${CONC} N=${urls.length} dispatched=${idx} elapsed=${elapsed.toFixed(1)}s actual_rate=${(idx / elapsed).toFixed(1)}/s tripped=${tripped}`
)
console.log(counts)
if (tripped) process.exitCode = 2
