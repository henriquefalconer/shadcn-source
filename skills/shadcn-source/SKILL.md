---
name: shadcn-source
description: Build UI from the real shadcn/ui source in the local shadcn/ library — up to 61 components in each of 27 styles, 27 blocks, 70 charts, 239 examples, four community registries, plus prebuilt browser bundles and compiled CSS. Never write shadcn from memory and never transcribe a colour, radius or height by hand; both are in the library. Use whenever the task involves adding, building, composing, styling or customizing any shadcn component, block or UI element, or when a project has a components.json.
---

# shadcn-source

## The contract

1. **Run the gate (§1) before writing any UI code.** If it fails, stop and tell
   the user. Do not fall back to memory silently.
2. **Never write a component from memory.** Open the file. Your recall is a
   version or two stale.
3. **Never type a value you did not read out of this library.** No hand-written
   `oklch(...)`, no guessed `36px`, no eyeballed radius. Every one of them is in
   `dist/`.
4. **Look before you design (§3).** Compose a block if one fits; assemble from
   `ui/` only when none does.
5. **Take the highest route that works (§2).** Route A is one copied file and
   gives you the real components.
6. **Decide nothing until a real target file exists.** "Study the library" is
   answered with what exists, not with a rendering strategy.
7. **End every deliverable with the provenance block (§7).** Unprompted.

Paths assume the library is at `shadcn/`. Reading this as the library's own
`CLAUDE.md`? Drop that prefix.

**No shell?** Most hosts give read/search tools instead — typically
`local_ls({path})`, `local_read({path, offset, limit})`,
`local_grep({pattern, path})`, and often `local_copy_to_project({files})`.
Every command below has an obvious equivalent. Search results cap around 100
matches, so anchor patterns: `^bg-primary\t` beats `bg-primary`.

## 1. Gate

```bash
ls shadcn/registry/shadcn | wc -l          # 28  (27 styles + NOTICE)
wc -l < shadcn/INDEX.tsv                   # ~2099
find shadcn/registry -type f | wc -l       # ~6600
cat shadcn/bootstrap/dist-status.json      # {"dist": "built", ...}
cat shadcn/bootstrap/bundles-status.json   # {"bundles": "built", ...}
```

Missing or absent → bootstrap it (needs node + network; it retries only the
stages that are missing). If `shadcn/` is not there at all:

```bash
git clone https://github.com/henriquefalconer/shadcn-source shadcn
cd shadcn && ./bootstrap.sh && cd ..
```

`./bootstrap.sh --check` is trustworthy — it hashes contents, not timestamps.

Stages 5 and 6 may fail alone, since they are the only ones needing npm. Read
the two status files precisely instead of declaring the library broken:

| status | still available |
|---|---|
| both `built` | everything; route A is one file |
| `bundles: skipped` | all source and CSS — routes B and C |
| `dist: skipped` | source only — say so; C cannot work either |

**If the gate fails outright, STOP and post this before writing any UI code:**

> ⚠️ **shadcn-source is unavailable** — `<actual error>`
>
> Nothing I write will come from the real registry: 61 components, 27 blocks,
> 70 charts and 239 examples are unreachable, so I would be writing shadcn from
> memory, which is typically a version or two stale.
>
> Fix: `cd shadcn && ./bootstrap.sh`. Proceed from memory anyway, clearly
> marked as such?

Then wait. Proceeding from memory is the user's call, not yours.

## 2. Route — pick by what the target can run

| target | route |
|---|---|
| has a React runtime (`window.React`, or loads one) | **A** — copy the bundle |
| static HTML, email, slide; no JS | **B** — copy the stylesheet |
| host mandates `style=""` and forbids classes | **C** — resolve via `map.tsv` |
| real project with a build step | **D** — add Tailwind, use source as-is |

Take the highest row that works, and say which one you took. "It isn't a React
project" does not justify skipping to the bottom: B, C and D all still read
real values out of the library.

## 3. Survey — before you design

Do not grep for component names you already remember; that is how a build ends
up as six primitives when a finished block was on disk.

```bash
ls shadcn/registry/shadcn/$STYLE/blocks          # whole pages and app shells
ls shadcn/registry/shadcn/$STYLE/ui              # primitives
ls shadcn/registry/shadcn/new-york-v4/charts     # 70 chart recipes
ls shadcn/registry/shadcn/new-york-v4/examples   # 239 usage examples
grep -i sidebar shadcn/INDEX.tsv                 # search by DOMAIN, not component
```

`sidebar-07` is a full app shell; `dashboard-01` is KPI cards + data table +
chart. For a whole app also skim `registry/{react-bits,magicui,animate-ui,ai-elements}/`
— motion, marketing and chat surfaces the core registry lacks.

## 4. Route A — copy the bundle (one file)

`dist/js/shadcn-ui.<style>.js` is every component in that style, prebuilt, with
its dependencies **and its stylesheet** inside it.

```
local_copy_to_project({files:[{src:"shadcn/dist/js/shadcn-ui.new-york-v4.js",
                               dest:"shadcn-ui.js"}]})
```

```html
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="./shadcn-ui.js"></script>
```

```js
const { Button, Card, CardHeader, CardTitle, Table, TableRow, TableCell } = ShadcnUI
// html`` works too where the host bundles htm — it builds React elements.
```

No CSS copy, no class strings to rebuild, nothing transcribed. React is read
from `window.React`, not bundled. ~1.3 MB, ~330 KB gzipped. Verified in
`dist/js/validation.json`: for `new-york-v4`, 257 of 266 blocks and examples
compile and all 257 mount in a real browser with the stylesheet applied.

- **One bundle per page.** Two duplicate every module, and a provider in one
  cannot serve a consumer in the other — `TooltipProvider` from bundle A leaves
  bundle B's `Tooltip` throwing. Pick one style.
- **Providers still apply.** `Tooltip` needs `TooltipProvider` above it.
  Packaging changed; component contracts did not.
- **Copy the bundle, not the `.tsx`.** Copy tools do not validate, so a `.tsx`
  lands intact and stays dead weight — nothing resolves `radix-ui` or
  `@/lib/utils`. Read `.tsx` to see how a component is composed; copy the
  bundle to run it.

## 5. Routes B, C, D

**B — stylesheet.** `dist/<style>.css` (265 KB), linked or inlined in `<style>`,
then the real class strings copied out of the source file:

```html
<link rel="stylesheet" href="./new-york-v4.css">
<button class="inline-flex items-center justify-center gap-2 rounded-md
  text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground">Save</button>
```

`dist/tokens.css` is 2 KB for the palette alone; `dist/<style>.full.css`
(467 KB) adds the community registries.

**C — the format forbids classes.** Check route A first: a host that rejects
`class` often still runs scripts, and the bundle sets its own classes from
inside. Where it genuinely cannot:

1. Inline `dist/<style>.vars.css` (~228 lines) — every custom property,
   including Tailwind's `--spacing`, `--text-*` and the `--tw-*` defaults that
   shadow and ring declarations need. Skip it and every `var()` below resolves
   to nothing.
2. Take the class string verbatim from the real component file.
3. Resolve each class against `dist/<style>.map.tsv` (~2,555 lines, one line
   per class):

   ```
   local_grep({pattern:"^h-9\t", path:"shadcn/dist/new-york-v4.map.tsv"})
   → h-9      height: calc(var(--spacing) * 9);
   ```

4. Concatenate the declarations into `style=""`.

Rows with a non-empty middle column are variants (`:hover`, `[data-state=open]`,
`@media …`); inline styles cannot express them, so use the base row. The result
is a port — label it as one in §7 — but every number in it came from the
compiled sheet. **If you are typing `oklch(...)` by hand, stop.** It is in
`vars.css` under a name, and `var(--muted-foreground)` is what belongs in the
attribute.

**D — Tailwind.** Add it and use the source unchanged. The Play CDN only helps
where an external `<script>` can load.

## 6. Style, source, tokens

**Style.** Use `components.json`'s `"style"` if the project declares one.
Otherwise choose on evidence — `diff` two `button.tsx` files rather than taking
the first name you saw — and fall back to `new-york-v4`. 3 bases (`radix`,
`base` = Base UI, `aria` = React Aria) × 8 themes (`vega nova maia lyra mira
luma sera rhea`), plus `new-york-v4`, `new-york`, `default`.

| style | ui | blocks | charts | examples |
|---|---|---|---|---|
| the 24 `{radix,base,aria}-{theme}` | 58–60 | 27 | — | — |
| `new-york-v4` | 61 | 27 | 70 | 239 |
| `new-york`, `default` (legacy) | 53 | 22 | 70 | 132 |

Blocks exist in every style; charts and examples do not — read those from
`new-york-v4` and port the classes.

**Source.** `INDEX.tsv` (2,098 names) to search, `INDEX.json` (6,126
style-resolved entries) for deps and paths, `docs/docs/components/<name>.md`
for usage.

```bash
jq --arg s "$STYLE" '.items[] | select(.name=="button" and .style==$s)' shadcn/INDEX.json
```

Follow `registryDependencies` recursively — they nest and cross registries, and
all of them are present locally.

**Tokens.** `dist/<style>.vars.css` is the complete set and the one to use.
`dist/tokens.css` is the shadcn palette alone. Tokens are colour, not geometry:
radius, density and shadow live in the Tailwind classes, so read those off the
component file.

**Assets.** `shadcn/assets/` — 374 files, 28 font families
(`assets/fonts/fonts.css`), Unsplash/Pexels media, icons. Never reintroduce a
remote URL that was replaced with a local path.

## 7. Report what you used

Every deliverable ends with this. Unprompted.

```
shadcn-source: base-nova  (chosen — no components.json; Base UI + tighter radius)
  route      A — bundle copied in, one file, CSS included
  composed   blocks/sidebar-07, blocks/dashboard-01
  read       ui/button.tsx, ui/badge.tsx, ui/table.tsx
```

Route C instead? Make the port auditable:

```
  route      C — host requires style="" attributes
  resolved   23 classes via dist/new-york-v4.map.tsv (0 unresolved)
  vars       dist/new-york-v4.vars.css inlined
```

Name the style **and why** when you chose it rather than read it. If the gate
failed, say that here in place of the list.

## You have failed if

Check the deliverable against this before reporting done. Each line is a real
failure that shipped:

- It contains a hand-written `oklch(...)`, hex, or px value — every one was
  available in `vars.css` or `map.tsv`.
- It has zero `class=` attributes and no `dist/` file behind it, i.e. the
  markup was reconstructed rather than sourced.
- You read `dist/new-york-v4.css` and then did not use it.
- Six primitives got hand-stacked while a finished block sat in `blocks/`.
- The summary says "visuals follow shadcn tokens" instead of naming files.
- You picked route C without first establishing that A and B were impossible.
- You chose a rendering strategy before a target file existed.

Before publishing anything built from `react-bits` or `animate-ui`, check the
registry `NOTICE`: their Commons Clause permits use in what you build,
including commercially, but not republishing the components themselves.
