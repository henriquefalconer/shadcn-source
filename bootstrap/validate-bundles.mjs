#!/usr/bin/env node
// Stage 7: prove the bundles actually work.
//
// Stage 6 producing a file is not evidence that a consumer can use it. Two
// tiers, because the expensive half is the browser:
//
//   Tier 1  compile   always. Builds every block and example against the
//                     style, on top of the components themselves. If they all
//                     compile, most breakage is already excluded, and it costs
//                     no browser.
//
//   Tier 2  mount     opt-in (--browser). Loads one page per style in headless
//                     Chromium and mounts every block and example into its own
//                     React root. Catches what compiling cannot: throwing
//                     renders, missing providers, and CSS that never applied.
//
// Tier 2 is opt-in because Playwright downloads a ~150 MB browser. It is also
// the only tier that would have caught the duplicate-bundle context bug -- two
// separately built bundles compile perfectly and then fail at runtime, because
// a provider in one cannot serve a consumer in the other.
//
// Writes dist/js/validation.json. Non-fatal: reports, never blocks.
import fs from "node:fs"
import path from "node:path"
import { BOOTSTRAP, DIST, REGISTRY, bundle, stylesWithUi } from "./lib-bundle.mjs"

const OUT = path.join(DIST, "js")
const WORK = path.join(BOOTSTRAP, "data", "validate")
const args = process.argv.slice(2)
const WANT_BROWSER = args.includes("--browser")
// Blocks and examples only exist for a few styles; validating every style's
// components is cheap, but the demo sweep has one natural home.
const only = args.find((a) => a.startsWith("--style="))?.split("=")[1]
const TARGETS = only ? [only] : ["new-york-v4"]

const fail = (why) => {
  console.log(`    skipped: ${why}`)
  process.exit(0)
}

if (!fs.existsSync(OUT)) fail("dist/js absent -- stage 6 must run first")
let esbuild
try {
  esbuild = await import(path.join(BOOTSTRAP, "node_modules/esbuild/lib/main.js"))
} catch (e) {
  fail(`esbuild not loadable -- ${e.message}`)
}

fs.mkdirSync(WORK, { recursive: true })
const styles = stylesWithUi()
const results = {}

// ---- tier 1: compile ------------------------------------------------------------
// Blocks and examples are page-level compositions, so they exercise the
// components in combination -- the way a consumer will actually use them.
function entriesFor(styleDir) {
  const out = []
  const blocks = path.join(styleDir, "blocks")
  if (fs.existsSync(blocks)) {
    for (const d of fs.readdirSync(blocks)) {
      const p = path.join(blocks, d, "page.tsx")
      if (fs.existsSync(p)) out.push({ kind: "block", name: d, file: p })
    }
  }
  const examples = path.join(styleDir, "examples")
  if (fs.existsSync(examples)) {
    for (const f of fs.readdirSync(examples).filter((f) => f.endsWith(".tsx"))) {
      out.push({ kind: "example", name: f.replace(/\.tsx$/, ""), file: path.join(examples, f) })
    }
  }
  return out
}

const ident = (e) => `${e.kind === "block" ? "Blk" : "Ex"}_${e.name.replace(/[^a-zA-Z0-9]/g, "_")}`

// One entry at a time would be 259 esbuild runs. Instead build them together
// and, when that fails, bisect out the offenders so one broken demo does not
// mask the other 258.
async function compileSet(style, entries) {
  const styleDir = path.join(REGISTRY, "shadcn", style)
  const outfile = path.join(WORK, `demos.${style}.js`)
  const build = (list) =>
    bundle({
      esbuild,
      entryContents:
        list.map((e) => `export { default as ${ident(e)} } from ${JSON.stringify(e.file)};`).join("\n") +
        // Providers the demos assume an app would supply.
        `\nexport { TooltipProvider } from ${JSON.stringify(path.join(styleDir, "ui/tooltip.tsx"))};\n`,
      entryDir: WORK,
      styleDir,
      allStyles: styles,
      outfile,
      globalName: "ShadcnDemos",
      css: path.join(DIST, `${style}.css`),
    })

  try {
    await build(entries)
    return { ok: entries, broken: [], outfile }
  } catch {
    const ok = []
    const broken = []
    for (const e of entries) {
      try {
        await build([e])
        ok.push(e)
      } catch (err) {
        broken.push({ name: e.name, kind: e.kind, error: (err.errors?.[0]?.text || err.message).split("\n")[0] })
      }
    }
    await build(ok)
    return { ok, broken, outfile }
  }
}

for (const style of TARGETS) {
  const entries = entriesFor(path.join(REGISTRY, "shadcn", style))
  if (!entries.length) {
    results[style] = { note: "no blocks or examples in this style" }
    continue
  }
  const { ok, broken, outfile } = await compileSet(style, entries)
  results[style] = {
    compile: { total: entries.length, ok: ok.length, broken },
    _outfile: outfile,
    _names: ok.map((e) => ({ id: ident(e), name: e.name, kind: e.kind })),
  }
  console.log(`    compile ${style}: ${ok.length}/${entries.length} blocks+examples`)
  for (const b of broken) console.log(`      broken  ${b.kind}/${b.name}: ${b.error}`)
}

// ---- tier 2: mount ---------------------------------------------------------------
function harnessHtml(bundleFile, names) {
  return `<!doctype html><html><head><meta charset="utf-8">
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="./${path.basename(bundleFile)}"></script>
</head><body><div id="grid"></div><script>
window.__done=false;
(async () => {
  const names = ${JSON.stringify(names)};
  const grid = document.getElementById("grid");
  const results = [];
  const P = ShadcnDemos.TooltipProvider || React.Fragment;
  for (const it of names) {
    const Comp = ShadcnDemos[it.id];
    const cell = document.createElement("div");
    cell.setAttribute("data-item", it.name);
    grid.appendChild(cell);
    let status = "ok", detail = "";
    if (typeof Comp !== "function") status = "no-export";
    else {
      class B extends React.Component {
        constructor(p){ super(p); this.state={e:null} }
        static getDerivedStateFromError(e){ return {e} }
        componentDidCatch(e){ status="threw"; detail=String(e&&e.message).slice(0,160) }
        render(){ return this.state.e ? null : this.props.children }
      }
      try {
        ReactDOM.createRoot(cell).render(
          React.createElement(B,null,React.createElement(P,null,React.createElement(Comp))));
        await new Promise(r=>setTimeout(r,0));
      } catch (e) { status="threw"; detail=String(e&&e.message).slice(0,160) }
    }
    results.push({ ...it, status, detail });
  }
  await new Promise(r=>setTimeout(r,2000));
  for (const r of results) {
    const cell = document.querySelector('[data-item="'+r.name+'"]');
    r.nodes = cell ? cell.querySelectorAll("*").length : 0;
    if (r.status === "ok" && r.nodes === 0) r.status = "empty";
  }
  // Did the injected stylesheet actually take effect? Ask a known utility
  // rather than whichever element happens to be first -- plenty of real
  // components legitimately have no radius, which reads as a false negative.
  const probe = document.createElement("div");
  probe.className = "h-9 rounded-md bg-primary";
  document.body.appendChild(probe);
  const pcs = getComputedStyle(probe);
  const cssApplied = { height: pcs.height, borderRadius: pcs.borderRadius, background: pcs.backgroundColor };
  const cssOk = pcs.height === "36px" && pcs.borderRadius !== "0px";
  probe.remove();

  window.__results = {
    total: results.length,
    ok: results.filter(r=>r.status==="ok").length,
    failures: results.filter(r=>r.status!=="ok").map(r=>({name:r.name,kind:r.kind,status:r.status,detail:r.detail})),
    cssInjected: !!document.getElementById("shadcn-ui-css"),
    cssApplied: cssOk,
    cssProbe: cssApplied,
  };
  window.__done = true;
})();
</script></body></html>`
}

if (WANT_BROWSER) {
  let chromium = null
  try {
    // playwright is CommonJS: under import() the exports land on .default, so
    // destructuring `chromium` directly yields undefined and every branch
    // below falls through in silence.
    const pw = await import(path.join(BOOTSTRAP, "node_modules/playwright/index.js"))
    chromium = pw.chromium ?? pw.default?.chromium ?? null
  } catch {
    chromium = null
  }
  if (!chromium) {
    console.log("    tier 2 skipped: playwright unavailable")
    console.log("    install it with:  cd bootstrap && npm i playwright && npx playwright install chromium")
  }
  if (chromium) {
    let browser
    try {
      browser = await chromium.launch()
    } catch (e) {
      console.log(`    tier 2 skipped: chromium would not launch -- ${e.message.split("\n")[0]}`)
    }
    if (browser) {
      for (const style of TARGETS) {
        const r = results[style]
        if (!r?._outfile) continue
        const html = path.join(WORK, `validate.${style}.html`)
        fs.writeFileSync(html, harnessHtml(r._outfile, r._names))
        const page = await browser.newPage()
        const consoleErrors = []
        page.on("pageerror", (e) => consoleErrors.push(String(e.message).slice(0, 160)))
        await page.goto("file://" + html)
        try {
          await page.waitForFunction("window.__done === true", { timeout: 120_000 })
          r.mount = await page.evaluate("window.__results")
          if (consoleErrors.length) r.mount.pageErrors = [...new Set(consoleErrors)].slice(0, 10)
          console.log(`    mount   ${style}: ${r.mount.ok}/${r.mount.total}, css applied: ${r.mount.cssApplied}`)
          for (const f of r.mount.failures) console.log(`      failed  ${f.kind}/${f.name}: ${f.status} ${f.detail}`)
        } catch (e) {
          r.mount = { error: `harness did not finish -- ${e.message.split("\n")[0]}` }
          console.log(`    mount   ${style}: ${r.mount.error}`)
        }
        await page.close()
      }
      await browser.close()
    }
  }
} else {
  console.log("    tier 2 not run (pass --validate-browser to mount every demo in headless Chromium)")
}

for (const v of Object.values(results)) {
  delete v._outfile
  delete v._names
}
fs.writeFileSync(path.join(OUT, "validation.json"), JSON.stringify(results, null, 1) + "\n")

const anyBroken = Object.values(results).some((r) => r.compile?.broken?.length || r.mount?.failures?.length)
console.log(anyBroken ? "    validation recorded with failures -- see dist/js/validation.json" : "    validation clean")
