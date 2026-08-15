---
name: shadcn-source
description: Read real shadcn/ui component source from the local shadcn/ library instead of writing it from memory — 2,098 components, blocks and examples across 27 styles, plus four community registries, docs and assets. Use whenever the task involves adding, building, composing, styling or customizing any shadcn component, block or UI element, or when a project has a components.json.
---

# shadcn

`shadcn/` holds the shadcn/ui registry plus four community registries
(`react-bits`, `magicui`, `animate-ui`, `ai-elements`). Use it as the source of
truth for shadcn work.

**If `shadcn/` is missing**, clone and bootstrap it — the fetch takes a few
minutes and only needs to happen once:

```bash
git clone https://github.com/henriquefalconer/shadcn-source shadcn
cd shadcn && ./bootstrap.sh && cd ..
```

If `shadcn/` exists but `shadcn/registry/` is empty, run `shadcn/bootstrap.sh`.
Later runs exit immediately when nothing has changed.

## Before writing any component

1. **Find it** — `grep -i "<thing>" shadcn/INDEX.tsv` (2,098 items: name / type / description)
2. **Inspect it** — gives npm deps, `registryDependencies`, and the path of every file:

   ```bash
   jq '.items[] | select(.name=="button" and .style=="new-york-v4")' shadcn/INDEX.json
   ```

3. **Read that file.** Do not write shadcn components from memory — your recall
   of them is usually a version or two behind what is on disk.
4. **Docs** — `shadcn/docs/docs/components/<name>.md`

## Paths

```
shadcn/registry/shadcn/<style>/ui/<name>.tsx
shadcn/registry/shadcn/<style>/blocks/<name>/...
shadcn/registry/shadcn/new-york-v4/examples/<name>.tsx
shadcn/registry/{react-bits,magicui,animate-ui,ai-elements}/...
```

## Choosing a style

27 styles = **3 bases** (`radix`, `base` = Base UI, `aria` = React Aria) **× 8
themes** (`vega nova maia lyra mira luma sera rhea`), plus legacy `new-york`,
`default` and `new-york-v4`.

Both axes change the source: Tailwind utilities are baked into each component, so
57 of 60 `ui/` files differ between `base-vega` and `base-nova`. Use the style the
project declares in its `components.json`; otherwise `new-york-v4`, the only one
carrying the complete example set.

## Rules

1. **Read before writing.** The file on disk is ground truth; your memory is not.
2. **Copy `registryDependencies` too** — check them in `INDEX.json` before
   copying a component. They are all present locally.
3. **Reference `shadcn/assets/`** for images and fonts. Never reintroduce a
   remote URL that was replaced with a local path.
4. **Check the registry's `NOTICE`** before reusing components in something you
   publish. React Bits and Animate UI allow use in what you build, including
   commercially, but not republishing the components themselves.
