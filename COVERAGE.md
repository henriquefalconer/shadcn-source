# Coverage report

Snapshot pinned 2026-08-12T22:23:11.957Z.
Generated from upstream by `./bootstrap.sh`.

Five metrics, measured independently. The headline is **C5**, gated on C3.

## C1 — item coverage

| registry | retrieved / enumerated | % | missing |
|---|---|---|---|
| @shadcn | 471 / 471 | 100% | 0 |
| @react-bits | 664 / 664 | 100% | 0 |
| @magicui | 247 / 247 | 100% | 0 |
| @animate-ui | 580 / 580 | 100% | 0 |
| @ai-elements | 136 / 136 | 100% | 0 |

Denominator = `shadcn search <registry> --json`, the CLI's own enumeration.

For @shadcn the style×item denominator is **not** names×26. The 24 modern styles (3 bases × 8 themes) publish ui + fonts + 27 blocks only — they genuinely do not publish examples, internal components or themes. Verified three ways: direct HTTP 404, `shadcn view` failure under a matching components.json, and the upstream repo layout. Counting those 8,218 absences as misses would invent a gap that does not exist upstream. 4,499 style×item pairs actually exist and all 4,499 were retrieved.

Note: the themes are **not** merely CSS re-skins. The published registry bakes Tailwind utilities into component source — 57 of 60 `ui/` files differ between `base-vega` and `base-nova` — so all 24 are distinct source trees. Only 427 of 6,370 archived source files are byte-identical duplicates.

## C2 — file integrity

6126 / 6126 stored blobs re-hash to their download-time sha256 = **100%**.

## C3 — reference closure

| class | count | vendored? |
|---|---|---|
| A — XML namespace (not fetched) | 1 | n/a |
| B — render-blocking asset | 128 | yes |
| C — navigational href | 53 | no (does not block render) |
| D — runtime API endpoint | 5 | no (cannot be vendored) |
| E — fonts | 4 | yes, self-hosted |

Bucket B: 120 downloaded, 14 failed. Rewrites: 250 occurrences in 85 files. Bucket-B URLs still present in tree: **14**.

Fonts: 28 families, 172 woff2 files, all unicode subsets retained. Google Font references remaining: 0 / 0.

npm: 117 / 119 packages installed. Offline install proof — leak check: **BLOCKED**, offline `pnpm install --offline --frozen-lockfile` exit code: **0**.

## C4 — docs, prompts, skills

Docs: 108 / 109 pages as markdown (99.08%).
Skill: 25 files captured, verified byte-identical to the pinned upstream commit.
Repo source: 169 example files and 86 external API reference docs mirrored.

## C5 — verified offline render

An item passes iff: **mounted DOM ∧ 0 console errors ∧ 0 page errors ∧ 0 external URLs attempted**.

**C5a — loads offline** (module + full transitive graph resolve locally, zero external requests attempted): **6340 / 6370 = 99.53%**
**C5b — also renders clean** with no props and no console errors: **3858 / 6370 = 60.57%**

C5b is a floor, not a defect count: many components legitimately require props, and rendering them bare throws. Those are classified separately and are not offline failures.

| registry | C5a | C5b | attempted network | fatal import | needs props |
|---|---|---|---|---|---|
| ai-elements | 134/136 (98.53%) | 64.71% | 1 | 1 | 17 |
| animate-ui | 555/578 (96.02%) | 75.43% | 20 | 3 | 15 |
| magicui | 242/245 (98.78%) | 91.84% | 3 | 0 | 8 |
| react-bits | 330/332 (99.40%) | 88.86% | 0 | 2 | 24 |
| shadcn | 5079/5079 (100.00%) | 55.40% | 0 | 0 | 680 |

Hosts still reached for at render time (the concrete offline defects):

| host | files |
|---|---|
| api.microlink.io | 8 |
| pbs.twimg.com | 7 |
| api.github.com | 6 |
| react-tweet.vercel.app | 3 |
| skills.sh | 1 |
