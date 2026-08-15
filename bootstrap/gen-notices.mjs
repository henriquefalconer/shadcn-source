// Generate a NOTICE file at each provenance boundary, so the terms travel with
// the files instead of living only in THIRD-PARTY.md at the root.
//
// Follows the per-directory convention used by Chromium (README.chromium) and
// Kubernetes (LICENSES/). Additive only: no vendored file is modified, and
// extract.mjs never deletes, so these survive a re-extract.
import fs from "node:fs"
import path from "node:path"

const ARCHIVE = path.resolve(import.meta.dirname, "..")
const count = (d) => {
  try {
    let n = 0
    const walk = (p) => {
      for (const e of fs.readdirSync(p, { withFileTypes: true })) {
        if (e.name === "NOTICE") continue
        e.isDirectory() ? walk(path.join(p, e.name)) : n++
      }
    }
    walk(path.join(ARCHIVE, d))
    return n
  } catch {
    return 0
  }
}

const rule = "─".repeat(70)
const head = (title, home) => `${title}\n${home}\n\n`
const foot = (depth) => `\nFull third-party inventory: ${"../".repeat(depth)}THIRD-PARTY.md\n`

const COMMONS = (verb) => `
This is a MODIFIED MIT license, not MIT plus a rider. The grant itself is
narrowed — it permits distribution only "as part of an application, website,
or product", and drops MIT's rights to sell and sublicense. A Commons Clause
restriction is then added on top:

  You may use this Software, including for any commercial purpose, so long
  as you do not ${verb}

Using these components in an application, website or product — including a
commercial one — is permitted. Redistributing the components as components
is not.
`

const notices = {
  "registry/shadcn": {
    depth: 2,
    body:
      head("shadcn/ui", "https://ui.shadcn.com") +
      "MIT License\nCopyright (c) 2023 shadcn\n",
  },
  "registry/magicui": {
    depth: 2,
    body: head("Magic UI", "https://magicui.design") + "MIT License\nCopyright (c) Magic UI\n",
  },
  "registry/ai-elements": {
    depth: 2,
    body:
      head("AI Elements", "https://ai-sdk.dev/elements") +
      "Apache License, Version 2.0\nCopyright 2023 Vercel, Inc.\n\n" +
      "Full license text: ../../licenses/Apache-2.0.txt\n",
  },
  "registry/react-bits": {
    depth: 2,
    body:
      head("React Bits", "https://reactbits.dev") +
      "MIT License with the Commons Clause License Condition v1.0\n" +
      "Copyright (c) 2026 David Haz\n" +
      COMMONS(
        "sell, sublicense, or redistribute the components\n  themselves—whether alone, in a bundle, or as a ported version."
      ),
  },
  "registry/animate-ui": {
    depth: 2,
    body:
      head("Animate UI", "https://animate-ui.com") +
      "MIT License with the Commons Clause License Condition\n" +
      "Copyright (c) 2025 Elliot Sutton\n" +
      COMMONS(
        "sell or redistribute the components themselves\n  in their original form—whether alone or in a bundle."
      ),
  },
  docs: {
    depth: 1,
    body:
      head("shadcn/ui documentation", "https://ui.shadcn.com/docs") +
      "MIT License\nCopyright (c) 2023 shadcn\n\n" +
      "Mirrored from the shadcn/ui documentation site as markdown.\n",
  },
  "skills/shadcn-ui": {
    depth: 2,
    body:
      head("shadcn/ui Agent Skill", "https://ui.shadcn.com/docs/skills") +
      "MIT License\nCopyright (c) 2023 shadcn\n\n" +
      "Reproduced verbatim. Do not edit — this copy is kept byte-identical to\n" +
      "upstream. Archive-specific guidance lives in skills/shadcn-archive/.\n",
  },
  "assets/fonts": {
    depth: 2,
    body:
      head("Fonts", "https://fonts.google.com") +
      "27 families are licensed under the SIL Open Font License, Version 1.1.\n" +
      "Roboto Slab is licensed under the Apache License, Version 2.0.\n\n" +
      "Seven families carry a Reserved Font Name, which restricts redistributing\n" +
      "a MODIFIED version under that name: IBM Plex Mono and IBM Plex Sans\n" +
      '("Plex"), Lora, Merriweather, Playfair Display, Raleway, Source Sans 3\n' +
      '("Source").\n\n' +
      "  Full OFL text ......... ../../licenses/OFL-1.1.txt\n" +
      "  Full Apache text ...... ../../licenses/Apache-2.0.txt\n" +
      "  Per-family copyright .. ../../licenses/fonts-copyright.txt\n",
  },
  assets: {
    depth: 1,
    body:
      head("Images, video and other media", "") .replace("\n\n\n", "\n\n") +
      "Retrieved from third-party sources and served locally so component demos\n" +
      "work as written. Not part of the component source. Each source keeps its\n" +
      "own terms; the notable ones:\n\n" +
      "  Unsplash ......... does not permit compiling photos to replicate a\n" +
      "                     similar or competing service\n" +
      "  Unsplash+ ........ paid-subscription license, tied to the subscriber;\n" +
      "                     narrower than the standard Unsplash License\n" +
      "  Pexels ........... does not permit redistributing the photos and videos\n" +
      "                     on other stock platforms\n" +
      "  Simple Icons ..... icons are CC0, but CC0 does not waive trademark\n" +
      "                     rights; brand guidelines still apply\n" +
      "  Profile photos ... photographs of identifiable individuals, retained by\n" +
      "                     their owners; no license grant accompanies them\n" +
      "  Poly Haven ....... CC0 1.0\n" +
      "  face-api.js / Rive  MIT\n\n" +
      "Fonts have their own notice in fonts/NOTICE.\n",
  },
  licenses: {
    depth: 1,
    body:
      "Third-party license texts\n\n" +
      "Full license texts reproduced here because the licenses require that they\n" +
      "accompany redistribution of the material they cover. These are the\n" +
      "licensors' texts, not this project's.\n",
  },
}

let written = 0
for (const [dir, { depth, body }] of Object.entries(notices)) {
  const target = path.join(ARCHIVE, dir)
  if (!fs.existsSync(target)) {
    console.log(`  SKIP (missing): ${dir}`)
    continue
  }
  const n = count(dir)
  const text = `${rule}\n${body}${foot(depth)}${rule}\n${n} files in this directory.\n`
  fs.writeFileSync(path.join(target, "NOTICE"), text)
  console.log(`  ${dir}/NOTICE  (${n} files)`)
  written++
}

// ---------------------------------------------------------------------------
// THIRD-PARTY.md — a single inventory of everything bootstrap fetched, composed
// from the same data as the NOTICE files so the two cannot drift. Generated,
// never committed: the repository itself distributes none of this.
// ---------------------------------------------------------------------------
const inventory = `# Third-party notices

Everything listed here was downloaded by \`bootstrap.sh\` from each project's own
distribution. None of it is stored in this repository. Each directory also has a
\`NOTICE\` file repeating the terms that apply to its contents.

These notices are provided for information. The licenses themselves govern.

## Component libraries

| project | license | covers |
| --- | --- | --- |
| [shadcn/ui](https://ui.shadcn.com) | MIT — Copyright (c) 2023 shadcn | \`registry/shadcn/\`, \`docs/\` |
| [Magic UI](https://magicui.design) | MIT — Copyright (c) Magic UI | \`registry/magicui/\` |
| [AI Elements](https://ai-sdk.dev/elements) | Apache-2.0 — Copyright 2023 Vercel, Inc. | \`registry/ai-elements/\` |
| [React Bits](https://reactbits.dev) | MIT **+ Commons Clause** — Copyright (c) 2026 David Haz | \`registry/react-bits/\` |
| [Animate UI](https://animate-ui.com) | MIT **+ Commons Clause** — Copyright (c) 2025 Elliot Sutton | \`registry/animate-ui/\` |

React Bits and Animate UI use a **modified** MIT license: the grant permits
distribution only "as part of an application, website, or product", and a Commons
Clause forbids selling, sublicensing or redistributing the components themselves,
alone or in a bundle. Using them in something you build — including commercially
— is expressly allowed. Republishing the components is not.

## Fonts

\`assets/fonts/\` holds 28 families from Google Fonts. Twenty-seven are under the
SIL Open Font License 1.1; Roboto Slab is Apache-2.0. Seven carry a Reserved Font
Name, which restricts redistributing a *modified* version under that name:
IBM Plex Mono, IBM Plex Sans ("Plex"), Lora, Merriweather, Playfair Display,
Raleway, and Source Sans 3 ("Source").

## Icons, models and media

- **Simple Icons** — CC0 1.0. The icons depict third-party brands; CC0 does not
  waive trademark rights, and some marks are withdrawn from upstream releases at
  the holder's request.
- **Poly Haven** HDRIs — CC0 1.0.
- **face-api.js** model weights and the **Rive** WebAssembly runtime — MIT.
- **Unsplash**, **Unsplash+**, **Pexels**, **Lorem Picsum** — demo imagery under
  each service's own license. Unsplash does not permit compiling photos to
  replicate a competing service; Pexels does not permit redistributing them on
  other stock platforms. Unsplash+ is a paid tier licensed to the subscriber.
- **Profile photographs** in \`assets/\` depict identifiable individuals and carry
  no license grant; rights of privacy and publicity may apply.
`
fs.writeFileSync(path.join(ARCHIVE, "THIRD-PARTY.md"), inventory)
console.log("  THIRD-PARTY.md")

console.log(`\nwrote ${written} NOTICE files`)
