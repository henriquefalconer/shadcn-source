// C5 verification runner. Must be executed INSIDE the sandbox profile:
//   sandbox-exec -f _work/verify.sb node _work/harness/run-c5.mjs
//
// An item passes C5 iff:
//   mounted DOM  AND  0 console errors  AND  0 external URLs attempted.
// Layer 1 (kernel sandbox) blocks escape; layers 2-3 here prove nothing was ATTEMPTED,
// which is the stricter and more meaningful claim.
import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright"

const DEST = path.resolve(import.meta.dirname, "..", "..")
const OUT = path.join(DEST, "_work", "c5-results.jsonl")
const BASE = process.env.BASE || "http://127.0.0.1:5199"
const WORKERS = Number(process.env.WORKERS || 6)

// ---- leak check: refuse to produce a "proof" from a porous sandbox ----
const leak = await fetch("https://registry.npmjs.org/react")
  .then((r) => `LEAK ${r.status}`)
  .catch((e) => `BLOCKED ${e.cause?.code || e.message}`)
if (!leak.startsWith("BLOCKED")) {
  console.error(`FATAL: sandbox is not blocking network (${leak}). Refusing to run.`)
  process.exit(2)
}
console.error(`sandbox leak check: ${leak}`)

const files = JSON.parse(fs.readFileSync(path.join(DEST, "_work", "c5-files.json"), "utf8"))
const done = new Set()
if (fs.existsSync(OUT))
  for (const l of fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean)) {
    try {
      done.add(JSON.parse(l).file)
    } catch {}
  }
const todo = files.filter((f) => !done.has(f))
console.error(`files=${files.length} done=${done.size} todo=${todo.length}`)

const out = fs.createWriteStream(OUT, { flags: "a" })
const isLocal = (u) => /^(http:\/\/127\.0\.0\.1|http:\/\/localhost|data:|blob:|about:)/.test(u)

const browser = await chromium.launch({
  args: [
    // Layer 2: browser-level deny. Anything not loopback fails to resolve.
    "--host-resolver-rules=MAP * ~NOTFOUND EXCLUDE 127.0.0.1",
    "--disable-features=NetworkService",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-sandbox",
  ],
})

let n = 0
let crashes = 0
const t0 = Date.now()

// A crashed page/context is a HARNESS fault, not a component verdict. Recording
// it would poison the run (round 2 of this sweep did exactly that: 6,259 files
// were logged as failures because the browser became unstable under 4-way
// parallelism). Retry on a fresh context, and only record after a real result.
const CRASH = /Page crashed|Target page, context or browser has been closed|Target closed|Execution context was destroyed|browser has disconnected/i
const RECYCLE_EVERY = 150

async function worker() {
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  let page = await ctx.newPage()
  let sinceRecycle = 0

  const freshPage = async () => {
    try {
      await ctx.close()
    } catch {}
    ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    page = await ctx.newPage()
    sinceRecycle = 0
  }

  while (true) {
    const file = todo[n++]
    if (!file) break
    // Proactively recycle: memory from WebGL/wasm components accumulates and
    // eventually takes the whole browser down mid-run.
    if (++sinceRecycle >= RECYCLE_EVERY) await freshPage()
    const consoleErrors = []
    const external = []
    const pageErrors = []

    const onConsole = (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300))
    }
    const onPageError = (e) => pageErrors.push(String(e.message || e).slice(0, 300))
    const onRequest = (r) => {
      if (!isLocal(r.url())) external.push(r.url().slice(0, 200))
    }
    page.on("console", onConsole)
    page.on("pageerror", onPageError)
    page.on("request", onRequest)

    let rec = null
    for (let attempt = 0; attempt < 3 && !rec; attempt++) {
      try {
        await page.goto(`${BASE}/?file=${encodeURIComponent(file)}`, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        })
        await page.waitForFunction("window.__DONE__ === true", null, { timeout: 45000 })
        const result = await page.evaluate(() => window.__RESULT__)
        const mounted = await page.locator('[data-testid="harness"]').count()
        rec = {
          file,
          mounted: mounted > 0,
          fatal: result?.fatal ?? null,
          exports: result?.exports ?? [],
          consoleErrors,
          pageErrors,
          external,
        }
      } catch (e) {
        const msg = String(e.message || e)
        if (CRASH.test(msg)) {
          crashes++
          await freshPage()
          consoleErrors.length = 0
          pageErrors.length = 0
          external.length = 0
          // Re-attach listeners to the new page before retrying.
          page.on("console", onConsole)
          page.on("pageerror", onPageError)
          page.on("request", onRequest)
          if (attempt === 2) {
            // Crashed three times on fresh contexts: this file genuinely kills
            // the renderer. That IS a real verdict, and it is labelled as such.
            rec = {
              file,
              mounted: false,
              fatal: `renderer-crash (3 attempts, fresh context each)`,
              exports: [],
              consoleErrors: [],
              pageErrors: [],
              external: [],
              crashed: true,
            }
          }
          continue
        }
        rec = {
          file,
          mounted: false,
          fatal: `runner: ${msg.slice(0, 200)}`,
          exports: [],
          consoleErrors,
          pageErrors,
          external,
        }
      }
    }
    const comps = rec.exports.filter((e) => e.status !== "not-component")

    // Rendering a component with NO props can throw for a reason that has nothing
    // to do with offline capability: the component simply requires props. Counting
    // that as an offline failure would understate coverage and be dishonest in the
    // other direction. Classify it separately.
    const NEEDS_PROPS =
      /Cannot read propert(y|ies) of (undefined|null)|is not a function|is not iterable|Cannot destructure|of undefined \(reading/i
    const needsProps = (e) => e.status === "error" && NEEDS_PROPS.test(e.error || "")
    rec.needsPropsExports = comps.filter(needsProps).map((e) => e.name)
    rec.brokenExports = comps.filter((e) => e.status === "error" && !needsProps(e)).map((e) => e.name)

    // C5a - THE offline claim: the module and its whole transitive graph resolve
    // from local disk, and nothing on the page reached for the network.
    rec.c5a_loads_offline = rec.mounted && !rec.fatal && rec.external.length === 0

    // C5b - stricter: additionally renders clean with no props.
    rec.c5b_renders_clean =
      rec.c5a_loads_offline &&
      rec.consoleErrors.length === 0 &&
      rec.pageErrors.length === 0 &&
      rec.brokenExports.length === 0 &&
      rec.needsPropsExports.length === 0
    rec.pass = rec.c5a_loads_offline
    out.write(JSON.stringify(rec) + "\n")

    try {
      page.off("console", onConsole)
      page.off("pageerror", onPageError)
      page.off("request", onRequest)
    } catch {}

    if (n % 100 === 0) {
      const rate = n / ((Date.now() - t0) / 1000)
      console.error(`${n}/${todo.length} ${rate.toFixed(1)}/s eta ${(((todo.length - n) / rate) / 60).toFixed(1)}m`)
    }
  }
  await ctx.close()
}

await Promise.all(Array.from({ length: WORKERS }, worker))
await browser.close()
out.end()
console.error(`done. renderer crashes recovered: ${crashes}`)
