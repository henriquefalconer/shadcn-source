# shadcn/ — the shadcn component archive

`shadcn/` is a complete local copy of the shadcn registry plus four community
registries. It is the source of truth for shadcn work here.

Run `./bootstrap.sh` first — it generates `registry/`, `assets/` and the index
files from upstream. Re-runs exit immediately when the tree already matches.

## Before writing any shadcn component

1. **Find it:** `grep -i "<thing>" INDEX.tsv` — 2,098 items, one per
   line: name / type / description
2. **Inspect it:**
   `jq '.items[] | select(.name=="button" and .style=="new-york-v4")' INDEX.json`
   — gives type, npm `dependencies`, `registryDependencies`, and the path of
   every file
3. **Read the actual source** at that path. Do not reconstruct components from
   memory — the archive is pinned, and recall of these components is often a
   version or two behind what is on disk.
4. **Docs:** `docs/docs/components/<name>.md`

## Style selection

`registry/shadcn/<style>/...` — 27 styles = 3 bases × 8 themes + 3 legacy.

- Bases (different primitive library): `radix`, `base` (Base UI), `aria` (React Aria)
- Themes: `vega nova maia lyra mira luma sera rhea`
- Legacy: `new-york`, `default` (Tailwind v3), `new-york-v4`

**Both axes change the source.** Tailwind utilities are baked into each
component — 57 of 60 `ui/` files differ between `base-vega` and `base-nova`. Use
the style the target project declares in its `components.json`; if none, default
to `new-york-v4` (the only style carrying the full example set).

Community registries: `registry/{react-bits,magicui,animate-ui,ai-elements}/`

## Rules

- Copy `registryDependencies` too — they are all present in the archive.
- Images and fonts live in `assets/`; reference those paths.
- `COVERAGE.md` has the measured numbers. Don't invent your own.
