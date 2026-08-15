---
name: shadcn-archive
description: Work with shadcn/ui and four community registries from the local archive at shadcn/ — 2,098 items across 27 styles, with source, docs, and assets on disk. Use whenever the task involves finding, adding, composing, or customizing shadcn components.
---

# shadcn, from the local archive

`shadcn/` holds a complete copy of the shadcn registry plus four community
registries (`react-bits`, `magicui`, `animate-ui`, `ai-elements`). Treat it as
the source of truth for shadcn work.

If `registry/` is empty, run `./bootstrap.sh` to generate it.

The official shadcn skill is archived at `skills/shadcn-ui/`. It is worth
reading for *concepts* — composition rules, theming, base-vs-radix
differences. Its CLI and MCP instructions do not apply here; use the lookups
below instead.

## Finding a component

`INDEX.tsv` is the fast path — one line per item, tab-separated
`name<TAB>type<TAB>description`, 2,098 rows:

```bash
grep -i "calendar" INDEX.tsv
grep -P "^@shadcn/\S+\tblock" INDEX.tsv     # all shadcn blocks
cut -f1 INDEX.tsv | cut -d/ -f1 | sort -u   # which registries exist
```

`INDEX.json` has the full record per item — type, description, npm
`dependencies`, `registryDependencies`, and the path of every file:

```bash
jq '.items[] | select(.name=="button" and .style=="new-york-v4")' INDEX.json
```

## Getting the code

Read the archived file. Do not reconstruct a component from memory — the archive
is pinned, and recall of these components is usually a version or two behind
what is on disk.

```
registry/shadcn/<style>/ui/<name>.tsx
registry/shadcn/<style>/blocks/<name>/...
registry/shadcn/new-york-v4/examples/<name>.tsx
registry/animate-ui/registry/components/...
registry/ai-elements/registry/default/ai-elements/...
registry/magicui/registry/magicui/...
registry/react-bits/<Component>/...
```

Docs: `docs/docs/components/<name>.md`

## Choosing a style

27 styles = **3 component bases × 8 themes**, plus 3 legacy styles.

- **Bases** (different primitive library): `radix`, `base` (Base UI), `aria` (React Aria)
- **Themes**: `vega nova maia lyra mira luma sera rhea`
- **Legacy**: `new-york`, `default` (Tailwind v3 era), `new-york-v4`

**Both axes change the actual source.** Tailwind utilities are baked into each
component, so 57 of 60 `ui/` files differ between two themes of the same base.
Never assume a component can be reused across styles — read the one matching the
style the project declares in its `components.json`.

`new-york-v4` is the only style carrying the complete set of examples, internal
components and themes. The 24 modern styles ship ui + fonts + 27 blocks. That is
upstream's actual shape, not a hole in the archive.

## Rules

1. **Read before writing.** The archived source is ground truth.
2. **Check `registryDependencies`** in `INDEX.json` before copying a component —
   they must be copied too, and they are all present in the archive.
3. **Images and fonts** live in `assets/`; reference those paths.
4. **`COVERAGE.md`** has the measured numbers. Don't invent your own.
