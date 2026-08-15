# What a redistributor of these 172 .woff2 files must ship

Source: Google Fonts CSS API (fonts.googleapis.com / fonts.gstatic.com), which serves
files built from the `google/fonts` GitHub catalog. License text and copyright below
were pulled directly from that catalog (`ofl/<family>/OFL.txt`, `apache/robotoslab/LICENSE.txt`,
and each family's `METADATA.pb`), not guessed.

## Licenses in use

- **27 of 28 families: SIL Open Font License 1.1 (OFL-1.1)**
- **1 family — Roboto Slab — Apache License 2.0**, not OFL. (Plain "Roboto" itself
  was relicensed by Google from Apache-2.0 to OFL-1.1 in 2021 and is confirmed OFL-1.1
  in the current catalog; Roboto Slab was never relicensed and remains Apache-2.0.)

No UFL-licensed family is present in this set.

## OFL-1.1 obligation (applies to 27 families)

OFL-1.1 §2 requires: "Original or Modified Versions of the Font Software may be
bundled, redistributed and/or sold with any software, provided that **each copy
contains the above copyright notice and this license**."

Concretely, a redistributor must ship, for every OFL font it redistributes:

1. **The full OFL-1.1 license text** — saved here as `OFL-1.1.txt`. This text is
   byte-identical (module-for-module, aside from an `http`→`https` URL edit in some
   files and CRLF vs LF line endings — no wording differences) across all 27 families
   in this archive, confirmed by diffing normalized copies. **One shared copy of the
   OFL-1.1 text is legally sufficient** — it does not need to be duplicated per family.
2. **The per-family copyright notice(s), verbatim, individually** — the license text
   alone is not enough; each family's own copyright line (which sometimes includes a
   Reserved Font Name declaration) must also be preserved and attributed. These
   **do differ per family and must each be reproduced** — see `fonts.json` for the
   exact strings. A single generic "Copyright the respective font authors" line does
   NOT satisfy this; the verbatim per-family notice must appear.
3. Do not use any **Reserved Font Name** (see below) to name a Modified Version of
   that font, unless written permission is obtained. This project is only bundling
   the fonts unmodified (as delivered by Google Fonts), so RFNs are not a redistribution
   blocker here — they only matter if the font files themselves are altered and
   re-released under the same family name.

**Reserved Font Names declared in this set (7 of 28):**
| Family | Reserved Font Name |
|---|---|
| IBM Plex Mono | "Plex" |
| IBM Plex Sans | "Plex" |
| Lora | "Lora" |
| Merriweather | "Merriweather" |
| Playfair Display | "Playfair Display" |
| Raleway | "Raleway" |
| Source Sans 3 | "Source" |

## Apache-2.0 obligation (Roboto Slab only)

Apache License 2.0 §4 requires that any redistribution include: (a) a copy of the
Apache-2.0 license text (saved here as `Apache-2.0.txt`), and (b) retention of any
copyright, patent, trademark, and attribution notices from the Source form, normally
via a NOTICE file if one exists upstream. The `google/fonts` `apache/robotoslab/`
directory does not ship a separate NOTICE file — the copyright line lives only in
`METADATA.pb`: "Copyright 2018 The Roboto Slab Project Authors
(https://github.com/googlefonts/robotoslab)". That line should be reproduced in the
attribution file alongside the Apache-2.0 license text.

## Practical recipe for THIRD-PARTY.md

- Include `OFL-1.1.txt` once (shared, verbatim SIL text).
- Include `Apache-2.0.txt` once (shared, verbatim Apache text) for Roboto Slab.
- For every one of the 28 families, list: family name → license → verbatim
  copyright line (from `fonts.json`). Do not compress/paraphrase the copyright
  lines — OFL and Apache both condition the redistribution right on preserving
  them exactly.
- Optionally note the 7 Reserved Font Names, though this only matters if anyone
  ever modifies and re-releases the fonts under their original names — not a
  requirement for straight redistribution of the unmodified files.
