#!/usr/bin/env node
// Stage 2 bootstrap: regenerate assets/ from upstream sources.
//
// Composition (each step owns disjoint subdirectories):
//   1. media     -- the 120 concrete image/video URLs recorded in assets-report.json
//   2. fonts     -- bootstrap/fetch-fonts.mjs          -> assets/fonts
//   3. icons     -- bootstrap/fetch-simpleicons.mjs    -> assets/cdn.simpleicons.org
//                   + postprocess-simpleicons.mjs
//   4. static    -- bootstrap/fetch-static-assets.mjs  -> picsum, flagcdn, models.dev,
//                                                     jsdelivr, unpkg, raw.githack
//   5. notices   -- bootstrap/gen-notices.mjs          -> assets/NOTICE, assets/fonts/NOTICE
//
// No ffmpeg. Videos are fetched as the upstream ORIGINALS; the archive previously
// carried locally transcoded copies, which are not reproducible without pinning an
// exact encoder build.
//
// Usage:  node fetch-assets.mjs            (writes to <archive>/assets)
//         MEDIA_ONLY=1 node fetch-assets.mjs
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"

const BOOTSTRAP = path.resolve(import.meta.dirname)
const ARCHIVE = path.resolve(BOOTSTRAP, "..")
const WORK = path.join(ARCHIVE, "bootstrap", "data")
const ASSETS = process.env.OUT || path.join(ARCHIVE, "assets")

const CONC = Number(process.env.ASSET_CONC || 10)
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex")
const t0 = Date.now()
const el = () => `[${((Date.now() - t0) / 1000).toFixed(1)}s]`

// ---- 1. media: concrete URLs recorded when the archive was built ----------
function mediaJobs() {
  const jobs = new Map() // localPath -> url
  const rep = JSON.parse(fs.readFileSync(path.join(WORK, "assets-report.json"), "utf8"))
  for (const a of rep.bucket_B.downloaded_assets) jobs.set(a.localPath.replace(/^\//, ""), a.url)
  return [...jobs].map(([local, url]) => ({ local, url }))
}

async function fetchMedia() {
  const jobs = mediaJobs()
  console.log(`${el()} media: ${jobs.length} files`)
  let ok = 0
  const failed = []
  let i = 0
  await Promise.all(
    Array.from({ length: CONC }, async () => {
      while (i < jobs.length) {
        const job = jobs[i++]
        const dest = path.join(ASSETS, job.local.replace(/^assets\//, ""))
        // Idempotent: skip a file that is already present and non-empty.
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
          ok++
          continue
        }
        let done = false
        for (let attempt = 0; attempt < 3 && !done; attempt++) {
          try {
            // No custom User-Agent: a distinctive UA trips bot detection on the
            // Vercel-fronted hosts (established while building stage 1).
            const res = await fetch(job.url, { signal: AbortSignal.timeout(120000) })
            if (!res.ok) {
              if (attempt === 2) failed.push({ url: job.url, status: res.status })
              else await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
              continue
            }
            const buf = Buffer.from(await res.arrayBuffer())
            fs.mkdirSync(path.dirname(dest), { recursive: true })
            fs.writeFileSync(dest, buf)
            ok++
            done = true
          } catch (e) {
            if (attempt === 2) failed.push({ url: job.url, status: String(e.message || e).slice(0, 60) })
            else await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
          }
        }
      }
    })
  )
  console.log(`${el()} media: ${ok} ok, ${failed.length} failed`)
  return { attempted: jobs.length, ok, failed }
}

// ---- 2-5. delegate to the scripts that produced the current tree ----------
function run(script, label) {
  const p = path.join(BOOTSTRAP, script)
  // A missing delegated step must fail loudly: silently skipping it produced an
  // assets/ tree with only the media files and no fonts, icons or static assets.
  if (!fs.existsSync(p)) throw new Error(`bootstrap step missing: ${p}`)
  console.log(`${el()} ${label}: running ${script}`)
  try {
    execFileSync("node", [p], { cwd: ARCHIVE, stdio: ["ignore", "pipe", "pipe"] })
    return { script, ok: true }
  } catch (e) {
    return { script, ok: false, error: String(e.message || e).slice(0, 200) }
  }
}

// ---- per-subdirectory tar hashes -----------------------------------------
// A stable, order-independent digest per subdirectory, so each one can be gated
// individually. Subdirectories whose sources are not reproducible are recorded
// but not gated (see UNVERIFIABLE).
export function subdirHashes(root) {
  const out = {}
  for (const d of fs.readdirSync(root, { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    const files = []
    const walk = (p) => {
      for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        const q = path.join(p, e.name)
        if (e.isDirectory()) walk(q)
        else if (e.name !== "NOTICE") files.push(q)
      }
    }
    walk(path.join(root, d.name))
    files.sort()
    const h = crypto.createHash("sha256")
    for (const f of files) {
      h.update(path.relative(root, f))
      h.update(sha(fs.readFileSync(f)))
    }
    out[d.name] = { sha256: h.digest("hex"), files: files.length }
  }
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = { steps: [] }
  report.media = await fetchMedia()
  if (!process.env.MEDIA_ONLY) {
    for (const [s, l] of [
      ["fetch-fonts.mjs", "fonts"],
      ["fetch-simpleicons.mjs", "icons"],
      ["postprocess-simpleicons.mjs", "icons-post"],
      ["fetch-static-assets.mjs", "static"],
      ["gen-notices.mjs", "notices"],
    ])
      report.steps.push(run(s, l))
  }
  report.subdirs = subdirHashes(ASSETS)
  report.elapsed_s = +((Date.now() - t0) / 1000).toFixed(1)
  fs.writeFileSync(path.join(BOOTSTRAP, "assets-run.json"), JSON.stringify(report, null, 2))
  console.log(`${el()} done. subdirs: ${Object.keys(report.subdirs).length}`)
  for (const s of report.steps) if (s.ok === false) console.log(`  STEP FAILED ${s.script}: ${s.error}`)
}
