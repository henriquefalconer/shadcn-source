# shadcn-source

Bootstrappable shadcn resources library for designing projects you own.

## Setup

```bash
git clone https://github.com/henriquefalconer/shadcn-source shadcn
cd shadcn
./bootstrap.sh
```

The first run takes a few minutes and loads shadcn resources locally. Nothing is
stored in this repo; the script downloads it all from the upstream projects.

```bash
./bootstrap.sh --check   # anything missing or stale?
./bootstrap.sh --force   # refetch regardless
```

Re-running is cheap. It hashes what you already have and exits if nothing
changed. Needs node.

## What you end up with

```
registry/shadcn/<style>/    components, blocks and examples
registry/react-bits/        also magicui, animate-ui, ai-elements
assets/                     fonts, images, icons, media
docs/                       per-component docs
INDEX.tsv, INDEX.json       searchable index of everything
```

## Styles

3 bases (`radix`, `base`, `aria`) x 8 themes (`vega`, `nova`, `maia`, `lyra`,
`mira`, `luma`, `sera`, `rhea`), plus `new-york`, `default` and `new-york-v4`.

Both axes change the source. Tailwind classes are baked into each file, so
`base-vega` and `base-nova` differ in 57 of their 60 `ui/` components. Match
whatever your project's `components.json` declares, or use `new-york-v4`.

## Using it with an AI assistant

Point it at `skills/shadcn-source/SKILL.md`, or paste that file into a prompt.

The gist: grep `INDEX.tsv`, open the file it points to, copy that plus anything
listed in its `registryDependencies`. The point is to read the real source rather
than write it from memory, which tends to be a version or two stale.

## License

MIT. There is no third-party code in this repo.

What you download keeps its own license. Mostly MIT and Apache-2.0; the fonts are
OFL. React Bits and Animate UI add a Commons Clause: you can use their components
in what you build, including commercially, but you cannot republish the
components themselves. `bootstrap.sh` drops a NOTICE in every directory it
creates and writes a THIRD-PARTY.md listing all of it.
