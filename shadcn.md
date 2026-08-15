First run `shadcn/bootstrap.sh` to generate the component source (one-time; later runs exit immediately if nothing changed).

shadcn/ is a complete local copy of the shadcn registry plus four community
registries. Use it as the source of truth.

Before writing any component:
1. Find it:    grep -i "<thing>" shadcn/INDEX.tsv     (2,098 items: name/type/description)
2. Inspect it: jq '.items[] | select(.name=="button" and .style=="new-york-v4")' shadcn/INDEX.json
               → npm deps, registryDependencies, and the path of every file
3. READ that file. Do not write shadcn components from memory — the archive is
   pinned, and recall of these components is usually a version or two behind.
4. Docs: shadcn/docs/docs/components/<name>.md

Components: shadcn/registry/shadcn/<style>/ui/<name>.tsx
Styles: 3 bases (radix | base | aria) × 8 themes (vega nova maia lyra mira luma
sera rhea), plus legacy new-york, default, new-york-v4. Both axes change the
source — 57 of 60 ui files differ between base-vega and base-nova. Use the style
in the project's components.json; default to new-york-v4.
Also available: shadcn/registry/{react-bits,magicui,animate-ui,ai-elements}/

Copy registryDependencies too — all present in the archive. Images and fonts are
in shadcn/assets/; reference those paths.
