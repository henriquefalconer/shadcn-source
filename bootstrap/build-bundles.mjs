#!/usr/bin/env node
// Stage 6: compile each style's components into one browser-ready bundle.
//
// Stage 5 solved styling for hosts without a bundler. This solves the
// components themselves. A `.tsx` copied into a bundler-less page is dead
// weight -- nothing resolves `radix-ui`, `class-variance-authority` or
// `@/lib/utils` -- so consumers were left rebuilding the markup by hand.
//
// Produces, under dist/js/:
//
//   shadcn-ui.<style>.js    every component in that style, one IIFE,
//                           ~1.3 MB (~330 KB gzipped)
//
// The bundle reads React from `window.React` and carries everything else,
// including its own stylesheet, which it injects once on load. A consumer
// copies ONE file:
//
//   <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
//   <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
//   <script src="./shadcn-ui.new-york-v4.js"></script>
//   <script>const {Button, Card} = ShadcnUI</script>
//
// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
// 1. ONE BUNDLE PER PAGE. Two independently built bundles each carry their own
//    copy of every module, so a provider from one cannot satisfy a consumer in
//    the other -- `TooltipProvider` from bundle A leaves bundle B's `Tooltip`
//    throwing "must be used within TooltipProvider". Found the hard way while
//    building stage 7, which exists partly to keep catching it.
//
// 2. Dependencies come from INDEX.json's own `dependencies` fields, not a list
//    maintained here. Version suffixes are stripped: two styles pin conflicting
//    recharts majors and npm cannot satisfy both in one tree.
//
// 3. Undeclared peers are repaired only through the provenance gate in
//    lib-bundle.mjs -- an unresolved import is installed only when an already
//    installed manifest asks for it, at the range it asks for. Nothing is
//    fetched on the strength of its name.
//
// 4. NON-FATAL, like stage 5. Records the reason in bundles-status.json and
//    exits 0, so a good registry/ is never invalidated by a build failure.
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import {
  ARCHIVE,
  BOOTSTRAP,
  DIST,
  REGISTRY,
  bundle,
  declaredDependencies,
  resolveFromTree,
  stylesWithUi,
  unresolvedPackages,
  weeklyDownloads,
} from "./lib-bundle.mjs"

const OUT = path.join(DIST, "js")
const STATUS = path.join(BOOTSTRAP, "bundles-status.json")

const skip = (why) => {
  fs.writeFileSync(STATUS, JSON.stringify({ bundles: `skipped: ${why}` }, null, 2) + "\n")
  console.log(`    skipped: ${why}`)
  console.log("    registry/, assets/ and dist/*.css are unaffected")
  process.exit(0)
}

// ---- preflight -----------------------------------------------------------------
if (!fs.existsSync(path.join(REGISTRY, "shadcn"))) skip("registry/ absent -- run stages 1-4 first")
if (!fs.existsSync(DIST)) skip("dist/ absent -- stage 5 must run first (the bundle inlines its CSS)")

const INDEX = path.join(ARCHIVE, "INDEX.json")
if (!fs.existsSync(INDEX)) skip("INDEX.json absent -- stage 4 must run first")

const styles = stylesWithUi()
if (!styles.length) skip("no styles with a ui/ directory")

// ---- dependencies ----------------------------------------------------------------
// The root of trust here is shadcn's own registry metadata: these names come
// from INDEX.json, which came from the upstream registry JSON. That cannot be
// eliminated -- installing the components' dependencies means trusting the
// declaration of what those dependencies are. What CAN be reduced is how much
// that trust buys an attacker:
//
//   * --ignore-scripts for the component dependencies. Only esbuild and
//     @parcel/watcher run install-time code, and both are toolchain, so the
//     ~250 component packages never execute anything at install.
//   * package-lock.json is committed and every entry carries an integrity
//     hash, so later installs resolve to the same bytes and any change to the
//     dependency set shows up as a reviewable lockfile diff rather than a
//     silent swap.
//   * the provenance gate below, for anything not declared at all.
const TOOLCHAIN = ["esbuild"]
const componentDeps = [...new Set([...declaredDependencies(INDEX), "react", "react-dom"])]

const installed = (p) => fs.existsSync(path.join(BOOTSTRAP, "node_modules", p, "package.json"))

function npmInstall(pkgs, { allowScripts }) {
  execFileSync(
    "npm",
    [
      "install",
      "--legacy-peer-deps",
      "--no-audit",
      "--no-fund",
      "--loglevel=error",
      ...(allowScripts ? [] : ["--ignore-scripts"]),
      ...pkgs,
    ],
    { cwd: BOOTSTRAP, stdio: ["ignore", "ignore", "pipe"], timeout: 900_000 },
  )
}

if (!installed("esbuild") || !installed("react")) {
  console.log(`    installing ${componentDeps.length} declared dependencies (--ignore-scripts)`)
  try {
    npmInstall(componentDeps, { allowScripts: false })
    npmInstall(TOOLCHAIN, { allowScripts: true }) // needs its postinstall to fetch a binary
  } catch (e) {
    const msg = (e.stderr?.toString() || e.message || "").trim().split("\n").pop()
    skip(`npm install failed -- ${msg || "no network?"}`)
  }
}

let esbuild
try {
  esbuild = await import(path.join(BOOTSTRAP, "node_modules/esbuild/lib/main.js"))
} catch (e) {
  skip(`esbuild not loadable -- ${e.message}`)
}

// ---- build -------------------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true })
const work = path.join(BOOTSTRAP, "data", "bundle-input")
fs.mkdirSync(work, { recursive: true })

let built = 0
let bytes = 0
const report = {}

async function buildStyle(style) {
  const styleDir = path.join(REGISTRY, "shadcn", style)
  const uiDir = path.join(styleDir, "ui")
  const names = fs
    .readdirSync(uiDir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""))
  const size = await bundle({
    esbuild,
    entryContents: names.map((n) => `export * from ${JSON.stringify(path.join(uiDir, n + ".tsx"))};`).join("\n"),
    entryDir: work,
    styleDir,
    allStyles: styles,
    outfile: path.join(OUT, `shadcn-ui.${style}.js`),
    globalName: "ShadcnUI",
    css: path.join(DIST, `${style}.css`),
  })
  return { components: names.length, bytes: size }
}

async function pass(list) {
  const missing = new Set()
  const failures = []
  for (const style of list) {
    try {
      const r = await buildStyle(style)
      bytes += r.bytes
      built++
      report[style] = r
    } catch (e) {
      for (const p of unresolvedPackages(e.errors)) missing.add(p)
      const msg = (e.errors?.[0]?.text || e.message || "").split("\n")[0]
      failures.push(`${style}: ${msg}`)
      report[style] = { error: msg }
    }
  }
  return { missing: [...missing], failures }
}

let { missing, failures } = await pass(styles)

// Repair pass, provenance-gated.
if (failures.length && missing.length) {
  const vouched = []
  const refused = []
  for (const name of missing) {
    const origin = resolveFromTree(name)
    if (origin) vouched.push({ name, ...origin })
    else refused.push(name)
  }
  for (const name of refused) {
    const dl = await weeklyDownloads(name)
    failures.push(
      `unresolved import "${name}": no installed package declares it` +
        (dl ? ` (npm reports ${dl.toLocaleString()} weekly downloads, which is not evidence of legitimacy)` : ""),
    )
  }
  if (vouched.length) {
    for (const v of vouched) console.log(`    peer ${v.name}@${v.range}  (via ${v.by} ${v.field})`)
    try {
      npmInstall(vouched.map((v) => `${v.name}@${v.range}`), { allowScripts: false })
      const retry = await pass(styles.filter((s) => report[s]?.error))
      failures = retry.failures
    } catch (e) {
      failures.push(`peer install failed: ${(e.stderr?.toString() || e.message).trim().split("\n").pop()}`)
    }
  }
}

if (!built) skip(`every style failed to bundle -- ${failures[0] ?? "unknown"}`)

fs.writeFileSync(
  path.join(OUT, "NOTICE"),
  `──────────────────────────────────────────────────────────────────────
Compiled component bundles

Each file bundles a style's components together with their npm
dependencies -- Radix UI, Base UI, lucide, cva, recharts and others --
plus the compiled stylesheet. Those dependencies keep their own licences
and travel inside these files; see ../../THIRD-PARTY.md before
redistributing one.

React is NOT bundled. It is read from window.React at load time.

react-bits and animate-ui are deliberately excluded: their Commons
Clause permits use in what you build but not republication of the
components themselves, which a redistributable bundle would be.

ONE BUNDLE PER PAGE. Two bundles on one page duplicate every module and
break React context across them.
──────────────────────────────────────────────────────────────────────
`,
)

fs.writeFileSync(path.join(OUT, "bundles.json"), JSON.stringify(report, null, 1) + "\n")

const status = { bundles: "built", styles: built, mb: +(bytes / 1048576).toFixed(1) }
if (failures.length) status.failed = failures
fs.writeFileSync(STATUS, JSON.stringify(status, null, 2) + "\n")

for (const f of failures) console.log(`    warn  ${f}`)
console.log(`    ${built}/${styles.length} styles, ${(bytes / 1048576).toFixed(1)} MB`)
