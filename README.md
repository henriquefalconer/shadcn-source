# shadcn-source

Bootstrappable shadcn resources library for designing projects you own.

One command pulls the shadcn/ui registry and four community registries onto your
machine — 2,098 components, blocks and examples across 27 styles, plus the fonts,
images and docs they need — so an AI assistant can read the real source instead
of recalling it.

Nothing is stored in this repository. `bootstrap.sh` fetches everything directly
from each project's own distribution, so what you get is current and comes from
the people who publish it.

## Setup

```bash
git clone https://github.com/henriquefalconer/shadcn-source shadcn
cd shadcn
./bootstrap.sh
```

First run takes a few minutes and about 200 MB. Later runs hash what you already
have and exit immediately when nothing has changed.

```bash
./bootstrap.sh --check    # report status, write nothing
./bootstrap.sh --force    # refetch regardless
```

Requires `node` and, for the first run, a network connection.

## What you get

| path | contents |
| --- | --- |
| `registry/shadcn/<style>/` | 27 style trees: 3 component bases × 8 themes, plus 3 legacy |
| `registry/{react-bits,magicui,animate-ui,ai-elements}/` | four community registries |
| `assets/` | self-hosted fonts, images, icons and media the components reference |
| `docs/` | per-component documentation |
| `INDEX.tsv`, `INDEX.json` | searchable index: name, type, description, dependencies, file paths |

## Using it

Point your assistant at `skills/shadcn/SKILL.md`, or paste it into a prompt. It
covers finding a component, choosing a style, and copying it out correctly.

The short version: `grep` `INDEX.tsv` to find something, read the file it names,
and copy it — along with everything in its `registryDependencies`.

## Styles

27 styles = **3 component bases × 8 themes**, plus 3 legacy styles.

- **Bases** (different primitive library): `radix`, `base` (Base UI), `aria` (React Aria)
- **Themes**: `vega nova maia lyra mira luma sera rhea`
- **Legacy**: `new-york`, `default` (Tailwind v3 era), `new-york-v4`

Both axes change the source — Tailwind utilities are baked into each component,
so 57 of 60 `ui/` files differ between two themes of the same base. Use the style
your project declares in `components.json`; otherwise `new-york-v4`, the only one
carrying the complete example set.

## Licensing

This repository is MIT (see `LICENSE`) and contains no third-party material.

What `bootstrap.sh` fetches keeps its own license. Most is MIT or Apache-2.0; the
fonts are SIL OFL. **React Bits and Animate UI are MIT with a Commons Clause that
forbids redistributing their components** — using them in something you build is
expressly allowed, including commercially, but republishing the components
themselves is not. Bootstrap writes a `NOTICE` file into each directory recording
the terms that apply to it.
