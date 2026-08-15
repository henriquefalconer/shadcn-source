# Third-party notices

This archive incorporates third-party material listed below. Each entry names the
material, where it came from, and the license it is provided under. Longer license
texts are included in `licenses/`; shorter ones appear in full here.

These notices are provided for information. The licenses themselves govern.

Each directory holding third-party material also carries a `NOTICE` file
repeating the terms that apply to its contents.

---

## Component libraries

Source for these libraries is bundled under `registry/`.

### shadcn/ui — https://ui.shadcn.com

MIT License. Copyright (c) 2023 shadcn.

Covers `registry/shadcn/` (471 items across 27 styles), the documentation in `docs/`,
and the agent skill in `skills/shadcn-ui/`.

### Magic UI — https://magicui.design

MIT License. Copyright (c) Magic UI.

Covers `registry/magicui/` (247 items).

### AI Elements — https://ai-sdk.dev/elements

Apache License, Version 2.0. Copyright 2023 Vercel, Inc.

Covers `registry/ai-elements/` (136 items). Full text: `licenses/Apache-2.0.txt`.

### React Bits — https://reactbits.dev

A **modified** MIT License with the Commons Clause License Condition v1.0.
Copyright (c) 2026 David Haz.

Covers `registry/react-bits/` (664 items). The grant itself is narrowed — it permits
distribution only *as part of an application, website, or product*, and drops MIT's
rights to sell and sublicense. The Commons Clause then adds:

> You may use this Software, including for any commercial purpose, so long as you do
> not sell, sublicense, or redistribute the components themselves—whether alone, in a
> bundle, or as a ported version.

### Animate UI — https://animate-ui.com

A **modified** MIT License with the Commons Clause License Condition.
Copyright (c) 2025 Elliot Sutton.

Covers `registry/animate-ui/` (580 items). The grant itself is narrowed in the same
way. The Commons Clause then adds:

> You may use this Software, including for any commercial purpose, so long as you do
> not sell or redistribute the components themselves in their original form—whether
> alone or in a bundle.

### MIT License text

Applies to shadcn/ui and Magic UI, each under its own copyright line above. React
Bits and Animate UI use a modified form of this text — see their entries.

```
Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be included in all copies
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM OR OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

---

## Fonts

`assets/fonts/` contains 172 WOFF2 files covering 28 families, retrieved from Google
Fonts.

Twenty-seven families are licensed under the **SIL Open Font License, Version 1.1**:

DM Sans, EB Garamond, Figtree, Geist, Geist Mono, IBM Plex Mono, IBM Plex Sans,
Instrument Sans, Instrument Serif, Inter, JetBrains Mono, Lora, Manrope, Merriweather,
Montserrat, Noto Sans, Noto Serif, Nunito Sans, Outfit, Oxanium, Playfair Display,
Public Sans, Raleway, Roboto, Roboto Flex, Source Sans 3, Space Grotesk.

**Roboto Slab** is licensed under the Apache License, Version 2.0.
Copyright 2018 The Roboto Slab Project Authors.

Seven families carry a Reserved Font Name, which restricts redistribution of a
*modified* version under that name: IBM Plex Mono and IBM Plex Sans ("Plex"), Lora,
Merriweather, Playfair Display, Raleway, and Source Sans 3 ("Source").

- Full OFL text: `licenses/OFL-1.1.txt`
- Full Apache text: `licenses/Apache-2.0.txt`
- Verbatim per-family copyright notices: `licenses/fonts-copyright.txt`

---

## Icons, models and runtimes

- **Simple Icons** (`assets/cdn.simpleicons.org/`, 41 files) — icon set dedicated to the
  public domain under CC0 1.0. The icons depict third-party brands; **CC0 does not waive
  trademark rights**, and brand guidelines still apply to their use. Some icons are
  withdrawn from upstream releases over time at trademark holders' request, so a pinned
  copy such as this one may retain marks since withdrawn.
  https://simpleicons.org
- **Poly Haven HDRIs** (`assets/raw.githack.com/hdri/`, 8 files) — CC0 1.0.
  https://polyhaven.com
- **face-api.js model weights** (`assets/face-api-weights/`, 4 files) — MIT License,
  Copyright (c) 2018 Vincent Mühler.
- **Rive WebAssembly runtime** (`assets/unpkg.com/`, `assets/cdn.jsdelivr.net/`) — MIT
  License, Copyright (c) 2021 Rive.

---

## Images and video

`assets/` contains photographic and video material used by component demos, retrieved
from the sources below and served locally. It is included to make those demos work as
written; it is not part of the component source.

- **Unsplash** (`assets/images.unsplash.com/`, 30 files) — Unsplash License. The license
  permits free use but does not permit compiling photos "to replicate a similar or
  competing service". https://unsplash.com/license
- **Unsplash+** (`assets/plus.unsplash.com/`, 5 files) — Unsplash+ License, a separate
  paid-subscription license whose terms are narrower than the standard Unsplash License
  and are tied to the subscriber. https://unsplash.com/plus/license
- **Pexels** (`assets/images.pexels.com/`, `assets/videos.pexels.com/`, 4 files) — Pexels
  License, which does not permit redistributing the photos and videos on other stock
  platforms. The three video files have been re-encoded to a lower resolution.
  https://www.pexels.com/license/
- **Lorem Picsum** (`assets/picsum.photos/`, 34 files) — states no license of its own and
  re-serves Unsplash photography; the Unsplash License terms above apply.
  https://picsum.photos
- **Profile photographs** (`assets/pbs.twimg.com/`, `assets/avatars.githubusercontent.com/`,
  `assets/github.com/`, `assets/i.pravatar.cc/`, 27 files) — photographs of identifiable
  individuals, retained by their respective owners. No license grant accompanies them,
  and rights of privacy and publicity may apply in addition to copyright.
- **Brand and product imagery** (`assets/models.dev/`, `assets/cdn.magicui.design/`,
  `assets/flagcdn.com/`, `assets/avatar.vercel.sh/`, `assets/placehold.co/`, and remaining
  hosts) — third-party logos, marks and demo media, retained by their respective owners.

Attribution or removal requests for any material listed here are welcome.
