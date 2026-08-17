#!/usr/bin/env node
// Stage 5: compile the registry's baked Tailwind utilities into static CSS.
//
// Every component in registry/ carries its Tailwind classes inline, but the
// archive shipped only those inputs -- never the stylesheet that makes them
// mean anything. A consumer without a bundler (a single HTML file, an email, a
// sandboxed canvas) therefore had to hand-port each component's metrics into
// literal CSS, which is slow, lossy, and produces untraceable magic numbers.
//
// One Tailwind pass per style closes that gap. Produces, under dist/:
//
//   tokens.css           :root + .dark token block only            (~2 KB)
//                        (one file: the palette is style-independent)
//   <style>.css          tokens + every utility used by that
//                        style's ui/ and blocks/                  (~185 KB)
//   <style>.full.css     the above plus the four community
//                        registries (react-bits, magicui,
//                        animate-ui, ai-elements)                 (~395 KB)
//
// Inlined in a <style> tag, `<style>.full.css` is ~54 KB gzipped, so the real
// class strings can be copied out of the .tsx source verbatim with no build
// step and no network access.
//
// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
// 1. NON-FATAL BY DESIGN. This is the only stage needing an npm install, so it
//    is the most likely to fail on a restricted machine. A failure here must
//    not invalidate a registry/ and assets/ tree that fetched fine: we record
//    the reason in state.json as `dist: "skipped: <why>"` and exit 0. The
//    consuming skill reads that field and reports precisely which capability
//    is missing rather than emitting a blanket "bootstrap failed".
//
// 2. Token values come from bootstrap/raw/shadcn/new-york-v4/theme-*.json,
//    the only style upstream publishes cssVars for. They are the canonical
//    shadcn palettes and apply to every style; a style changes geometry
//    (radius, density, shadow) via its baked classes, not the palette.
//
// 3. The @theme inline block is what maps tokens onto utility names, so
//    `bg-background` resolves to var(--background). Without it Tailwind emits
//    the layout utilities but every colour utility silently goes missing.
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

const BOOTSTRAP = path.resolve(import.meta.dirname)
const ARCHIVE = path.resolve(BOOTSTRAP, "..")
const REGISTRY = path.join(ARCHIVE, "registry")
const DIST = path.join(ARCHIVE, "dist")
const THEME = path.join(BOOTSTRAP, "raw/shadcn/new-york-v4/theme-neutral.json")

const COMMUNITY = ["react-bits", "magicui", "animate-ui", "ai-elements"]

// Written to state.json by bootstrap.sh, which reads this file back.
const STATUS = path.join(BOOTSTRAP, "dist-status.json")
const skip = (why) => {
  fs.writeFileSync(STATUS, JSON.stringify({ dist: `skipped: ${why}` }, null, 2) + "\n")
  console.log(`    skipped: ${why}`)
  console.log("    registry/ and assets/ are unaffected; dist/ can be built later")
  process.exit(0)
}

// ---- token block ------------------------------------------------------------
// Utility name -> token, for @theme inline. Colour tokens are every key in the
// palette that is not radius; radius gets the four-step scale shadcn expects.
function themeBlock(vars) {
  const colours = Object.keys(vars)
    .filter((k) => k !== "radius")
    .map((k) => `  --color-${k}: var(--${k});`)
    .join("\n")
  return `@theme inline {
${colours}
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}`
}

const decls = (vars) =>
  Object.entries(vars)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join("\n")

function tokensCss(theme) {
  return `:root {
${decls(theme.cssVars.light)}
}

.dark {
${decls(theme.cssVars.dark)}
}
`
}

// Tailwind emits only what it finds in the scanned sources, so a sheet built
// purely from registry/ covers every class the components use and nothing
// else. That is enough to paste component markup verbatim, but not to write
// the page around it -- the registry happens to use `md:p-10` and never bare
// `p-10`, so a plain `p-10` wrapper would silently do nothing.
//
// This safelist adds the ordinary layout vocabulary on the standard scale.
// It costs ~98 KB raw but only ~10 KB gzipped, which is the right trade for
// making the sheet usable as the single stylesheet of a whole page.
const SCALE =
  "0,px,0.5,1,1.5,2,2.5,3,3.5,4,5,6,7,8,9,10,11,12,14,16,20,24,28,32"
const SAFELIST = [
  `{p,px,py,pt,pr,pb,pl,m,mx,my,mt,mr,mb,ml,gap,gap-x,gap-y,space-x,space-y}-{${SCALE}}`,
  `{w,h,min-w,min-h,size}-{${SCALE},auto,full,screen,fit,min,max}`,
  "max-w-{xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl,full,none,prose}",
  "{grid-cols,col-span,row-span}-{1,2,3,4,5,6,7,8,9,10,11,12}",
  "{sm,md,lg,xl}:{grid-cols,col-span}-{1,2,3,4,5,6,7,8,9,10,11,12}",
  `{sm,md,lg,xl}:{p,px,py,gap,w,h}-{${SCALE}}`,
  "text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl,6xl}",
  "font-{thin,light,normal,medium,semibold,bold,extrabold}",
  "{rounded,rounded-t,rounded-b,rounded-l,rounded-r}-{none,xs,sm,md,lg,xl,2xl,3xl,full}",
  "{items,justify,self,content}-{start,end,center,between,around,evenly,stretch,baseline}",
]

// `source(none)` disables Tailwind's automatic base-directory scan. Without it
// the compiler also scans the directory holding this input file -- which is
// the shared temp dir -- so every style would pick up every other style's
// candidate list and all 54 sheets would come out identical.
function inputCss(theme, sources) {
  return `@import "tailwindcss" source(none);
${sources.map((s) => `@source ${JSON.stringify(s)};`).join("\n")}
${SAFELIST.map((s) => `@source inline(${JSON.stringify(s)});`).join("\n")}
@custom-variant dark (&:is(.dark *));

${tokensCss(theme)}
${themeBlock(theme.cssVars.light)}
`
}

// ---- preflight ---------------------------------------------------------------
if (!fs.existsSync(REGISTRY)) skip("registry/ absent -- run stages 1-4 first")
if (!fs.existsSync(THEME)) skip("theme JSON absent -- stage 1 did not complete")

const theme = JSON.parse(fs.readFileSync(THEME, "utf8"))
if (!theme?.cssVars?.light || !theme?.cssVars?.dark) skip("theme JSON has no cssVars")

const styles = fs
  .readdirSync(REGISTRY + "/shadcn", { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort()
if (!styles.length) skip("no styles under registry/shadcn")

// Resolve the CLI. Installed into bootstrap/ rather than the archive root so a
// consuming project never sees a stray node_modules/ at the top level.
let cli = path.join(BOOTSTRAP, "node_modules/.bin/tailwindcss")
if (!fs.existsSync(cli)) {
  console.log("    installing @tailwindcss/cli")
  try {
    execFileSync("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error", "@tailwindcss/cli"], {
      cwd: BOOTSTRAP,
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 300_000,
    })
  } catch (e) {
    const msg = (e.stderr?.toString() || e.message || "").trim().split("\n").pop()
    skip(`npm install @tailwindcss/cli failed -- ${msg || "no network?"}`)
  }
}
if (!fs.existsSync(cli)) skip("@tailwindcss/cli not present after install")

// ---- candidate extraction ----------------------------------------------------
// Scanning a directory delegates class discovery to Tailwind's own extractor.
// That is almost always right, but it leaves "did we get everything?" as an
// assumption. So we also extract candidates ourselves and hand them to the
// compiler explicitly, then verify the output covers them. Belt and braces:
// the explicit list closes any gap in Tailwind's extractor, and the
// verification turns coverage into a checked fact rather than a hope.
const SRC_EXT = new Set([".tsx", ".ts", ".jsx", ".js", ".mdx", ".html", ".css"])

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (SRC_EXT.has(path.extname(e.name))) yield p
  }
}

// A token is a candidate if it could plausibly be a utility. Deliberately
// over-inclusive: non-utilities (data-slot values, locale strings, import
// paths) are harmless because Tailwind simply emits nothing for them, and the
// probe below is what tells the two apart.
function candidatesIn(dir) {
  const out = new Set()
  for (const file of walk(dir)) {
    const src = fs.readFileSync(file, "utf8")
    for (const m of src.matchAll(/["'`]([^"'`\n]{0,600})["'`]/g)) {
      for (const tok of m[1].split(/\s+/)) {
        if (tok.length < 2 || tok.length > 120) continue
        if (!/^[a-z@[]/.test(tok)) continue
        if (/^(https?:|\.|\/|@\/|node:)/.test(tok)) continue
        out.add(tok)
      }
    }
  }
  return out
}

// Class selectors present in a compiled sheet, un-escaped back to the form
// they take in markup: `.md\:p-10` -> `md:p-10`, `.\[\&_svg\]\:size-4` ->
// `[&_svg]:size-4`. Stops at an UNescaped delimiter so pseudo-class suffixes
// (`.disabled\:opacity-50:disabled`) are not folded into the name.
function emittedClasses(css) {
  const out = new Set()
  for (const m of css.matchAll(/\.((?:\\.|[^\\\s.,{}()>~+[\]:'"])+)/g)) {
    // A bare `.` also appears inside decimal values (`oklch(0.237 ...)`, `7%`),
    // so drop anything that cannot be a CSS identifier. Junk here would not
    // invent a missing class, but it could hide one, which is worse.
    if (/^-?\d/.test(m[1]) || m[1].includes("%")) continue
    out.add(m[1].replace(/\\(.)/g, "$1"))
  }
  return out
}

// ---- flat rule model ---------------------------------------------------------
// Some targets impose their own authoring format and will not accept a
// stylesheet at all -- the design-component harness, for one, mandates inline
// style="" attributes. Those consumers cannot use <style>, and typically
// cannot run tooling either: they can read files and search them, nothing
// more. Handing them only a 265 KB compiled sheet means they go back to
// transcribing values by eye, which is the failure this whole stage exists to
// end.
//
// So flatten the sheet into two artifacts a read-only consumer can use:
//
//   <style>.vars.css   every custom property, so var() references resolve
//   <style>.map.tsv    class -> declarations, one line per class, greppable
//
// The vars file matters more than it looks. Tailwind compiles `h-9` to
// `calc(var(--spacing) * 9)` and defines --spacing in its own theme layer, not
// in the shadcn token block -- so a consumer that inlines tokens.css alone and
// copies declarations gets silently broken sizing.

// Minimal CSS walker: enough for Tailwind's output, which is well-formed and
// machine-generated. Returns flat rules carrying their at-rule context.
function parseRules(css) {
  const rules = []
  const stack = []
  let i = 0
  let buf = ""
  // Comments and bare at-statements (`@layer properties;`) would otherwise be
  // glued onto the next selector -- and a leading /*! banner */ is enough to
  // stop `@layer theme {` from being recognised as an at-rule, which swallows
  // the whole theme block and loses --spacing and every font/text token.
  css = css.replace(/\/\*[\s\S]*?\*\//g, "")
  while (i < css.length) {
    const ch = css[i]
    if (ch === ";" && !buf.includes("{")) {
      buf = ""
      i++
      continue
    }
    if (ch === "{") {
      const head = buf.trim()
      buf = ""
      i++
      if (head.startsWith("@")) {
        // Layers are transparent for our purposes; conditionals are not.
        stack.push(head.startsWith("@layer") ? null : head)
        continue
      }
      // Collect this rule's own declarations, then keep walking for nesting.
      let depth = 1
      let body = ""
      while (i < css.length && depth > 0) {
        if (css[i] === "{") depth++
        else if (css[i] === "}") {
          depth--
          if (depth === 0) break
        }
        body += css[i]
        i++
      }
      i++
      const decls = body
        .replace(/\{[^{}]*\}/g, "") // drop nested blocks
        .split(";")
        .map((d) => d.trim())
        .filter((d) => d && !d.startsWith("@") && d.includes(":"))
      if (decls.length) {
        rules.push({ context: stack.filter(Boolean).join(" "), selector: head, decls })
      }
      // Nested rules (`&:hover`, `@media` inside) are rare in this output and
      // are covered by the flattened selectors Tailwind emits at top level.
      continue
    }
    if (ch === "}") {
      stack.pop()
      buf = ""
      i++
      continue
    }
    buf += ch
    i++
  }
  return rules
}

// Every custom property defined at the root, in source order, split by whether
// it sits under a dark selector.
function varsCss(rules) {
  const light = []
  const dark = []
  const universal = []
  for (const r of rules) {
    const props = r.decls.filter((d) => d.startsWith("--"))
    if (!props.length) continue
    const sel = r.selector.trim()
    // Tailwind's own --tw-* defaults sit on a universal selector, not :root.
    // Miss them and every shadow/ring/transform declaration in the map file
    // resolves to nothing.
    if (sel.startsWith("*")) universal.push(...props)
    else if (/\.dark\b/.test(sel)) dark.push(...props)
    else if (/(^|,)\s*(:root|:host)\b/.test(sel)) light.push(...props)
  }
  const uniq = (a) => [...new Map(a.map((d) => [d.split(":")[0].trim(), d])).values()]
  const block = (sel, ds) => `${sel} {\n${ds.map((d) => `  ${d};`).join("\n")}\n}`
  return `/* Every custom property the compiled sheet defines: the shadcn tokens,
   Tailwind's theme vars (--spacing, --text-*, --radius-*, fonts) and the
   --tw-* defaults that shadow, ring and transform declarations rely on.
   Inline this alongside any declarations taken from <style>.map.tsv, or their
   var() references resolve to nothing. */
${block(":root", uniq(light))}

${block("*, ::before, ::after, ::backdrop", uniq(universal))}

${block(".dark", uniq(dark))}
`
}

// class -> declarations, one line each. Selector remainder is kept as context
// so a consumer can tell a base rule from a :hover or [data-state] variant.
function mapTsv(rules) {
  const rows = new Map()
  for (const r of rules) {
    for (const sel of r.selector.split(",")) {
      const s = sel.trim()
      if (!s.startsWith(".")) continue
      const m = s.match(/^\.((?:\\.|[^\s.,:>~+[\]()])+)(.*)$/)
      if (!m) continue
      const cls = m[1].replace(/\\(.)/g, "$1")
      if (/^-?\d/.test(cls) || cls.includes("%")) continue
      const ctx = [r.context, m[2].trim()].filter(Boolean).join(" ")
      const key = cls + "\t" + ctx
      if (!rows.has(key)) rows.set(key, `${key}\t${r.decls.join("; ")};`)
    }
  }
  return (
    "# class\tcontext\tdeclarations\n" +
    "# context is empty for the base rule; anything else is a variant\n" +
    "# (:hover, [data-state=open], @media ...). Inline styles cannot express\n" +
    "# a variant -- use the base rule and handle state another way.\n" +
    [...rows.keys()].sort().map((k) => rows.get(k)).join("\n") +
    "\n"
  )
}

// ---- build -------------------------------------------------------------------
fs.mkdirSync(DIST, { recursive: true })
const tmp = path.join(BOOTSTRAP, "data", "dist-input")
fs.mkdirSync(tmp, { recursive: true })

// Tailwind's extractor runs over any file it is pointed at, so the simplest
// way to force a candidate set through is to write it out as one whitespace-
// separated blob and @source that. Avoids @source inline()'s brace-expansion
// syntax, which a literal class containing braces would break.
function candidateFile(name, cands) {
  const f = path.join(tmp, `${name}.candidates.txt`)
  fs.writeFileSync(f, [...cands].join("\n"))
  return f
}

function compile(name, sources, cands) {
  const inFile = path.join(tmp, `${name}.css`)
  const outFile = path.join(DIST, `${name}.css`)
  const all = [...sources, candidateFile(name, cands)]
  fs.writeFileSync(inFile, inputCss(theme, all))
  execFileSync(cli, ["-i", inFile, "-o", outFile], { stdio: ["ignore", "ignore", "pipe"] })
  return fs.readFileSync(outFile, "utf8")
}

// Which of `cands` are real utilities? Compile them alone: whatever comes out
// the far side was valid, and anything else was never a class to begin with.
function probe(name, cands) {
  const inFile = path.join(tmp, `${name}.probe.css`)
  const outFile = path.join(tmp, `${name}.probe.out.css`)
  fs.writeFileSync(inFile, inputCss(theme, [candidateFile(`${name}.probe`, cands)]))
  execFileSync(cli, ["-i", inFile, "-o", outFile], { stdio: ["ignore", "ignore", "pipe"] })
  return emittedClasses(fs.readFileSync(outFile, "utf8"))
}

let built = 0
let bytes = 0
const failed = []
const coverage = {}

fs.writeFileSync(path.join(DIST, "tokens.css"), tokensCss(theme))

// Community candidates are the same for every style; extract once.
const communityDirs = COMMUNITY.map((c) => path.join(REGISTRY, c)).filter((d) => fs.existsSync(d))
const communityCands = new Set()
for (const d of communityDirs) for (const c of candidatesIn(d)) communityCands.add(c)

// Utilities the safelist claims to add. Validated like everything else, so a
// typo or a name Tailwind dropped between versions shows up as a warning
// rather than as a class that silently does nothing at runtime.
const safelistCands = new Set()
{
  const expand = (s) => {
    const m = s.match(/\{([^{}]*)\}/)
    if (!m) return [s]
    return m[1].split(",").flatMap((opt) => expand(s.slice(0, m.index) + opt + s.slice(m.index + m[0].length)))
  }
  for (const pat of SAFELIST) for (const c of expand(pat)) safelistCands.add(c)
}

function verify(name, css, cands) {
  const valid = probe(name, cands) // candidates that are real utilities
  const have = emittedClasses(css)
  const missing = [...valid].filter((c) => !have.has(c))
  coverage[name] = {
    candidates: cands.size,
    utilities: valid.size,
    emitted: have.size,
    missing: missing.length,
    ...(missing.length ? { examples: missing.slice(0, 20) } : {}),
  }
  if (missing.length) failed.push(`${name}: ${missing.length} utilities used in source but absent from sheet`)
  return missing.length
}

for (const style of styles) {
  const dir = path.join(REGISTRY, "shadcn", style)
  try {
    const styleCands = candidatesIn(dir)

    const plain = new Set([...styleCands, ...safelistCands])
    const cssPlain = compile(style, [dir], plain)
    bytes += Buffer.byteLength(cssPlain)
    verify(style, cssPlain, plain)

    // Flattened form, for targets that cannot accept a stylesheet at all.
    // Built from the base sheet only: a format hostile enough to forbid
    // <style> is not the place for react-bits.
    const rules = parseRules(cssPlain)
    fs.writeFileSync(path.join(DIST, `${style}.vars.css`), varsCss(rules))
    fs.writeFileSync(path.join(DIST, `${style}.map.tsv`), mapTsv(rules))

    const full = new Set([...plain, ...communityCands])
    const cssFull = compile(`${style}.full`, [dir, ...communityDirs], full)
    bytes += Buffer.byteLength(cssFull)
    verify(`${style}.full`, cssFull, full)

    built++
  } catch (e) {
    failed.push(`${style}: ${(e.stderr?.toString() || e.message).trim().split("\n").pop()}`)
  }
}

if (!built) skip(`every style failed to compile -- ${failed[0] ?? "unknown"}`)

fs.writeFileSync(path.join(DIST, "coverage.json"), JSON.stringify(coverage, null, 1) + "\n")

fs.writeFileSync(
  path.join(DIST, "NOTICE"),
  `──────────────────────────────────────────────────────────────────────
Compiled CSS

Generated at bootstrap time by running Tailwind over the class strings
already baked into registry/. Derived work, not a separate source: each
rule traces back to a component whose own licence governs it. See
../THIRD-PARTY.md.

Tailwind CSS itself is MIT.

  tokens.css           token block only
  <style>.css          tokens + utilities used by that style
  <style>.full.css     the above + the four community registries
──────────────────────────────────────────────────────────────────────
`,
)

const totalMissing = Object.values(coverage).reduce((n, c) => n + c.missing, 0)
const status = {
  dist: "built",
  styles: built,
  files: fs.readdirSync(DIST).length,
  coverage: totalMissing === 0 ? "complete" : `${totalMissing} utilities missing -- see dist/coverage.json`,
}
if (failed.length) status.failed = failed
fs.writeFileSync(STATUS, JSON.stringify(status, null, 2) + "\n")

for (const f of failed) console.log(`    warn  ${f}`)
console.log(`    ${built} styles, ${fs.readdirSync(DIST).length} files, ${(bytes / 1048576).toFixed(1)} MB`)
console.log(
  totalMissing === 0
    ? "    coverage  every utility used in registry/ resolves in its sheet"
    : `    coverage  ${totalMissing} missing -- see dist/coverage.json`,
)
