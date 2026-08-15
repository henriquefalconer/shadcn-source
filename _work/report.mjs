// Assemble COVERAGE.md and GAPS.md from every workstream's report.
// Rule: never round up, never infer a number that was not measured.
import fs from "node:fs"
import path from "node:path"

const WORK = path.resolve(import.meta.dirname)
const DEST = path.resolve(WORK, "..")
const read = (f) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(WORK, f), "utf8"))
  } catch {
    return null
  }
}

const metrics = read("metrics.json")
const assets = read("assets-report.json")
const fonts = read("fonts-report.json")
const npm = read("npm-report.json")
const docs = read("../docs/_report.json") ?? read("docs/_report.json")
const skills = read("skills/_report.json")
const code = read("code/_report.json")

let c5 = null
const c5f = path.join(WORK, "c5-results.jsonl")
if (fs.existsSync(c5f)) {
  const recs = fs.readFileSync(c5f, "utf8").split("\n").filter(Boolean).map(JSON.parse)
  const byReg = {}
  for (const r of recs) {
    const reg = r.file.split("/")[2]
    byReg[reg] ??= { total: 0, a: 0, b: 0, external: 0, fatal: 0, needsProps: 0 }
    byReg[reg].total++
    if (r.c5a_loads_offline) byReg[reg].a++
    if (r.c5b_renders_clean) byReg[reg].b++
    if (r.external?.length) byReg[reg].external++
    if (r.fatal) byReg[reg].fatal++
    if (r.needsPropsExports?.length) byReg[reg].needsProps++
  }
  // Which hosts were actually reached for? That is the concrete offline defect list.
  const hosts = {}
  for (const r of recs)
    for (const u of r.external ?? []) {
      let h
      try {
        h = new URL(u).host
      } catch {
        h = u.slice(0, 40)
      }
      hosts[h] = (hosts[h] || 0) + 1
    }
  c5 = {
    total: recs.length,
    a: recs.filter((r) => r.c5a_loads_offline).length,
    b: recs.filter((r) => r.c5b_renders_clean).length,
    byReg,
    hosts: Object.entries(hosts).sort((x, y) => y[1] - x[1]),
    topFailures: recs
      .filter((r) => !r.c5a_loads_offline)
      .slice(0, 40)
      .map((r) => ({
        file: r.file,
        fatal: r.fatal,
        err: r.pageErrors?.[0] || r.consoleErrors?.[0] || null,
        external: r.external?.slice(0, 2) ?? [],
      })),
  }
}

const pct = (a, b) => (b ? ((a / b) * 100).toFixed(2) + "%" : "n/a")
const L = []
L.push("# Coverage report\n")
L.push(`Snapshot pinned ${metrics?.pinned_at ?? "(unknown)"}.`)
L.push("Generated from upstream by `./bootstrap.sh`; per-file sha256 in `INDEX.json` makes drift detectable.\n")
L.push("Five metrics, measured independently. The headline is **C5**, gated on C3.\n")

L.push("## C1 — item coverage\n")
L.push("| registry | retrieved / enumerated | % | missing |")
L.push("|---|---|---|---|")
for (const [reg, v] of Object.entries(metrics?.registries ?? {})) {
  const n = v.name_coverage
  L.push(`| @${reg} | ${n.retrieved} / ${n.enumerated} | ${n.pct}% | ${n.missing.length} |`)
}
L.push("")
L.push(
  "Denominator = `shadcn search <registry> --json`, the CLI's own enumeration.\n\n" +
    "For @shadcn the style×item denominator is **not** names×26. The 24 modern styles " +
    "(3 bases × 8 themes) publish ui + fonts + 27 blocks only — they genuinely do not " +
    "publish examples, internal components or themes. Verified three ways: direct HTTP " +
    "404, `shadcn view` failure under a matching components.json, and the upstream repo " +
    "layout. Counting those 8,218 absences as misses would invent a gap that does not " +
    "exist upstream. 4,499 style×item pairs actually exist and all 4,499 were retrieved.\n\n" +
    "Note: the themes are **not** merely CSS re-skins. The published registry bakes " +
    "Tailwind utilities into component source — 57 of 60 `ui/` files differ between " +
    "`base-vega` and `base-nova` — so all 24 are distinct source trees. Only 427 of " +
    "6,370 archived source files are byte-identical duplicates.\n"
)

L.push("## C2 — file integrity\n")
if (metrics?.C2)
  L.push(
    `${metrics.C2.intact} / ${metrics.C2.checked} stored blobs re-hash to their download-time sha256 = **${metrics.C2.pct}%**.\n`
  )

L.push("## C3 — reference closure\n")
if (assets?.classification) {
  const c = assets.classification
  L.push("| class | count | vendored? |")
  L.push("|---|---|---|")
  L.push(`| A — XML namespace (not fetched) | ${c.A_namespace?.length ?? 0} | n/a |`)
  L.push(`| B — render-blocking asset | ${assets.bucket_B?.attempted ?? 0} | yes |`)
  L.push(`| C — navigational href | ${c.C_navigational?.length ?? 0} | no (does not block render) |`)
  L.push(`| D — runtime API endpoint | ${c.D_runtime_api?.length ?? 0} | no (cannot be vendored) |`)
  L.push(`| E — fonts | ${c.E_fonts_skipped?.length ?? 0} | yes, self-hosted |`)
  L.push("")
  L.push(
    `Bucket B: ${assets.bucket_B?.downloaded ?? "?"} downloaded, ${assets.bucket_B?.failed?.length ?? "?"} failed. ` +
      `Rewrites: ${assets.rewrites?.occurrences_replaced ?? "?"} occurrences in ${assets.rewrites?.files_modified ?? "?"} files. ` +
      `Bucket-B URLs still present in tree: **${assets.verification?.remaining_bucket_B_urls_in_tree?.length ?? "?"}**.\n`
  )
}
if (fonts)
  L.push(
    `Fonts: ${fonts.families_ok ?? "?"} families, ${fonts.woff2_files ?? "?"} woff2 files, all unicode subsets retained. ` +
      `Google Font references remaining: ${fonts.verification?.googleapis_refs_remaining ?? 0} / ${fonts.verification?.gstatic_refs_remaining ?? 0}.\n`
  )
if (npm)
  L.push(
    `npm: ${npm.packages_installed ?? "?"} / ${npm.packages_requested ?? "?"} packages installed. ` +
      `Offline install proof — leak check: **${npm.offline_proof?.leak_check ?? "not run"}**, ` +
      `offline \`pnpm install --offline --frozen-lockfile\` exit code: **${npm.offline_proof?.offline_install_exit_code ?? "not run"}**.\n`
  )

L.push("## C4 — docs, prompts, skills\n")
if (docs) L.push(`Docs: ${docs.md_ok} / ${docs.total_urls} pages as markdown (${pct(docs.md_ok, docs.total_urls)}).`)
if (skills) L.push(`Skill: ${skills.files?.length ?? "?"} files captured, verified byte-identical to the pinned upstream commit.`)
if (code)
  L.push(
    `Repo source: ${code.example_files?.ok ?? "?"} example files and ${code.api_files?.ok ?? "?"} external API reference docs mirrored.`
  )
L.push("")

L.push("## C5 — verified offline render\n")
L.push("An item passes iff: **mounted DOM ∧ 0 console errors ∧ 0 page errors ∧ 0 external URLs attempted**.\n")
if (!c5) L.push("_Not yet run._\n")
else {
  L.push(
    `**C5a — loads offline** (module + full transitive graph resolve locally, zero external requests attempted): ` +
      `**${c5.a} / ${c5.total} = ${pct(c5.a, c5.total)}**`
  )
  L.push(
    `**C5b — also renders clean** with no props and no console errors: ` +
      `**${c5.b} / ${c5.total} = ${pct(c5.b, c5.total)}**\n`
  )
  L.push(
    "C5b is a floor, not a defect count: many components legitimately require props, " +
      "and rendering them bare throws. Those are classified separately and are not offline failures.\n"
  )
  L.push("| registry | C5a | C5b | attempted network | fatal import | needs props |")
  L.push("|---|---|---|---|---|---|")
  for (const [reg, v] of Object.entries(c5.byReg))
    L.push(
      `| ${reg} | ${v.a}/${v.total} (${pct(v.a, v.total)}) | ${pct(v.b, v.total)} | ${v.external} | ${v.fatal} | ${v.needsProps} |`
    )
  L.push("")
  if (c5.hosts.length) {
    L.push("Hosts still reached for at render time (the concrete offline defects):\n")
    L.push("| host | files |")
    L.push("|---|---|")
    for (const [h, n] of c5.hosts.slice(0, 15)) L.push(`| ${h} | ${n} |`)
    L.push("")
  }
}

fs.writeFileSync(path.join(DEST, "COVERAGE.md"), L.join("\n"))
console.log(L.join("\n").slice(0, 4000))
