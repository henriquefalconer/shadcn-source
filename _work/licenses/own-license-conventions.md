# How projects scope their OWN LICENSE relative to vendored third-party material

Research method: real LICENSE / NOTICES / README files fetched via `curl`/WebFetch from
upstream GitHub repos (raw file URLs), not reconstructed from memory. Raw copies saved under
`_work/licenses/_raw2/`. This is a companion to `conventions.md` (which covers notices-file
*format*); this file covers a different question — how the project's own root LICENSE signals
its *scope* when the tree also contains third-party material.

---

## 1. Per-project findings

### Chromium

- **Root `LICENSE`** (fetched in full, 27 lines): a plain BSD-3-Clause template, copyright
  "The Chromium Authors" — nothing else. **No scope statement of any kind.** It does not say
  "this covers only Chromium's own code" or mention `third_party/` at all.
- **Where scope actually lives:** not in LICENSE — in a *separate convention*,
  `third_party/<pkg>/README.chromium`, one per vendored package (documented in
  `docs/adding_to_third_party.md`, fetched). That doc states the purpose plainly:
  > README.chromium files document "information about the project from which you're re-using code."
  and:
  > "Dependencies should not be added without a license file and license type, even if they are not shipped in a final product."
  and on restrictive licenses:
  > "When a dependency allows a choice of license, OWNERS should choose the least restrictive license that meets Chromium's needs and document only the chosen license(s)."
  For copyleft/GPL-family licenses specifically: "special approval processes apply before
  inclusion in the project" (paraphrased by the fetch, not a direct quote — flagged as such).
- **Structure:** one root LICENSE (covers Chromium's own code only, by omission/convention, not
  by explicit statement) **+** thousands of per-directory `README.chromium` metadata files, each
  pointing at (not inlining, per prior research) the actual upstream `LICENSE` file it ships
  alongside the code. Root LICENSE and per-package metadata are two totally separate mechanisms
  that never cross-reference each other in text.

### .NET runtime

- **Root `LICENSE.TXT`** (fetched in full, 21 lines): plain MIT, copyright ".NET Foundation and
  Contributors." **No scope statement.** Doesn't mention `THIRD-PARTY-NOTICES.TXT` or vendored
  code at all.
- **Scope statement location:** entirely inside the *separate* `THIRD-PARTY-NOTICES.TXT` file
  (documented already in `conventions.md`), not in LICENSE.TXT itself, not cross-referenced from
  it either. The two files exist side by side in the repo root with no pointer from one to the
  other.
- **Structure:** one root LICENSE.TXT + one root THIRD-PARTY-NOTICES.TXT. No per-directory files.

### VS Code

- **Root `LICENSE.txt`** (fetched in full, 21 lines): plain MIT, copyright "Microsoft
  Corporation." **No scope statement whatsoever** — no mention of `ThirdPartyNotices.txt`, no
  mention of the distinction between the open-source repo and the compiled product.
- **The actual scope statement lives in the README, not LICENSE**, and it is a *different* kind
  of scope statement than "third-party code is separate" — it's "open-source repo vs. branded
  product":
  > "This source code is available to everyone under the standard MIT license."
  > "Visual Studio Code is a distribution of the Code - OSS repository with Microsoft-specific customizations released under a traditional Microsoft product license."
  (fetched via WebFetch summary of the repo README — the two quoted sentences are the tool's
  extraction, treat as close-paraphrase rather than guaranteed character-exact; the underlying
  fact — repo MIT license vs. product trademark/branding license are explicitly distinguished in
  the README — is solid.)
- **Structure:** one root LICENSE.txt (repo code) + one root ThirdPartyNotices.txt (bundled
  deps) + a README-level statement carving out the *product build* (icons, Microsoft branding,
  telemetry) as under a separate, non-MIT license entirely. Three-way split, not two.

### Kubernetes

- **Root `LICENSE`** (fetched in full, 202 lines): the unmodified Apache-2.0 license template.
  **No scope statement** — nothing project-specific added to the boilerplate.
- **No prose scope statement anywhere found.** Instead, scope is expressed *structurally*: a
  `LICENSES/` directory containing `LICENSE` (top-level copy), `OWNERS`, and two subdirectories —
  `LICENSES/vendor/` and `LICENSES/third_party/` — confirmed via the GitHub contents API.
  `LICENSES/vendor/` mirrors the Go import-path hierarchy of every vendored module (e.g.
  `LICENSES/vendor/github.com/...`, `go.etcd.io/...`, `k8s.io/...` — 14 top-level entries
  confirmed), each containing that module's actual upstream license file. `LICENSES/third_party/`
  has 3 entries (`forked`, `gimme`, `multiarch`) for things that don't fit the Go-module model.
- **Structure:** root LICENSE (own code, Apache-2.0, unmodified boilerplate) + fully
  per-dependency license files under `LICENSES/vendor/<import-path>/LICENSE`, kept in sync by
  tooling (`hack/verify-licenses.sh` runs `go-licenses` against the module graph). This is the
  most "pure per-directory" pattern of anything examined — no flat notices file at all, just a
  license-file tree that mirrors the dependency tree, and it's machine-verified rather than
  hand-maintained prose.

### Node.js

- **Root `LICENSE`** (fetched in full, 2,946 lines) is the standout example of an **explicit,
  verbatim, project-authored scope sentence inside the LICENSE file itself** — the only one of
  the six projects examined where this exists:
  > "The Node.js license applies to all parts of Node.js that are not externally maintained libraries."
  This sentence sits right after the project's own MIT block and right before
  > "The externally maintained libraries used by Node.js are:"
  which introduces the dependency-by-dependency list (Acorn, c-ares, ..., each with its own
  "licensed as follows:" block, full text inlined).
- **The same pattern recurses for nested vendored projects.** Two bundled sub-projects that
  themselves vendor further code repeat the identical sentence structure at their own nesting
  level, confirmed at multiple line numbers in the fetched file:
  > "This license applies to all parts of libuv that are not externally maintained libraries." (libuv, inside the Node LICENSE)
  > "The Postject license applies to all parts of Postject that are not externally maintained libraries." (Postject, inside the Node LICENSE)
  > "This license applies to all parts of V8 that are not externally maintained libraries." (V8, inside the Node LICENSE)
  So the scoping sentence isn't a one-off — it's applied as a template, once per project boundary,
  all the way down the vendoring tree, inside one giant flat file.
- **Structure:** one root LICENSE file, no separate notices file — but internally structured as
  root-project-block → scope sentence → flat list of "externally maintained libraries," each with
  full inlined text, and the scope sentence repeats at each nested vendoring boundary.

---

## 2. The mostly-vendored / curated-collection case

### Font Awesome — split by *content category*, not by *provenance*

Font Awesome's tree is a mix of icons (SVG/JS), font files, and code, all **created by the Font
Awesome project itself** (not third-party vendored) — but it is the closest real analogue found
to "different license per material type within one project," and it's a genuinely different
scoping axis than every other example above (which all scope by *what's vendored vs. what's
ours*). Font Awesome's root `LICENSE.txt` (fetched in full, 34 lines):

> "# Icons: CC BY 4.0 License (https://creativecommons.org/licenses/by/4.0/)
> In the Font Awesome Free download, the CC BY 4.0 license applies to all icons packaged as SVG and JS file types."
>
> "# Fonts: SIL OFL 1.1 License (https://scripts.sil.org/OFL)
> In the Font Awesome Free download, the SIL OFL license applies to all icons packaged as web and desktop font files."
>
> "# Code: MIT License (https://opensource.org/licenses/MIT)
> In the Font Awesome Free download, the MIT license applies to all non-font and non-icon files."

Three license grants, one file, scoped by *file type* with an explicit catch-all ("all non-font
and non-icon files" — i.e., code gets whatever's left over, not an enumerated list). This is a
directly reusable pattern for "here's what governs each kind of thing in this tree."

### Nerd Fonts — a genuinely mostly-vendored curated collection

This is the real example of a **collection/curation project**: Nerd Fonts patches and
redistributes ~100+ open-source font families from other projects; the overwhelming majority of
the repository's bytes are other people's font files, not original Nerd Fonts work.

Its root `LICENSE` (fetched in full, 126 lines) opens with an explicit, hand-written scope
statement — closer in spirit to Node's than to Chromium's silence:

> "There are various sources used under various licenses:
>
> * Nerd Fonts source fonts, patched fonts, and folders with explict OFL SIL files are licensed under SIL OPEN FONT LICENSE Version 1.1 (see below).
> * Nerd Fonts original source code files (such as `.sh`, `.py`, `font-patcher` and others) are licensed under the MIT License (MIT) (see below).
> * Many other licenses are present in this project for even more detailed breakdown see: [License Audit](https://github.com/ryanoasis/nerd-fonts/blob/-/license-audit.md)."

Then the file itself inlines *both* the MIT text (for the project's own scripts) and the OFL-1.1
text (for the patched fonts) back to back, under headers:

> "## Source files not in folders containing an explicit license are using the MIT License (MIT)"
> "## Various Fonts, Patched Fonts, SVGs, Glyph Fonts, and any files in a folder with explicit SIL OFL 1.1 License"

A third, separate document (`license-audit.md`, fetched) exists specifically because the actual
license picture is messier than "MIT + OFL" — it lists ~12 distinct license types found across
the vendored font families (MIT, CC 4.0, CC BY-SA 4.0, Apache-2.0, Bitstream Vera, WTFPL, Go
License, Ubuntu Font License 1.0, etc.) with a one-line plain-English summary of each. This is
the collection-project answer to "one root LICENSE, one notices file, or both": **both, plus a
third document (an audit) when the vendored material's licenses are too heterogeneous for either
file alone to stay readable.**

### What happens when a license prohibits redistribution — two real, concrete conventions

**1. Exclude it from the collection.** Nerd Fonts' README (fetched) states, verbatim, right
before a list of fonts:

> "Non exhaustive list of fonts that would benefit from being patched but are not included in Nerd Fonts due to their license (proprietary, commercial, etc.):"

This is the direct, observed answer to "what do you do when a dependency's license won't allow
redistribution": **you don't redistribute it.** You name it, explain why it's absent, and move
on. No workaround, no special file, no exception process — just an exclusion list stated in
plain prose in the README, distinct from the LICENSE file itself.

**2. Fetch-at-install instead of bundling.** The `ttf-mscorefonts-installer` package (Debian/
Ubuntu; researched via secondary source, not a primary upstream file fetch — flagged as such,
weaker evidence than the other findings in this report) exists because Microsoft's EULA for its
core TrueType fonts explicitly forbids redistribution in modified or repackaged form. Rather than
vendor the font files into the package, the package downloads Microsoft's original, unmodified
installer files from Microsoft's own servers at install time and extracts them locally — the
package itself (MIT/permissive, its own original scripting) never contains the restricted font
bytes at all. The general pattern this illustrates: **when redistribution is prohibited but
*use* isn't, don't vendor — fetch from the original source at the point of use, and keep the
non-redistributable bytes entirely outside version control / the distributed package.**

No example of a project that vendors material *despite* a no-redistribution clause (e.g. via a
special exception, a paid license, or a "you must remove this before redistributing further"
disclaimer) turned up in this research. Both real conventions found are avoidance strategies
(don't include it), not "include it anyway with a warning."

---

## 3. Direct answers to the specific questions asked

**Is it standard practice to add your own LICENSE even when the tree is mostly third-party
material?**

Yes, and every example examined does it, including the one genuinely mostly-vendored project
(Nerd Fonts). The observed rationale is structural, not proportional: the LICENSE covers *what
the project itself authored* (however small a fraction of total bytes that is), regardless of
how much of the tree is someone else's. Nerd Fonts' own scripts are a tiny fraction of the
repository by file count next to ~100 vendored font families, and it still ships a root LICENSE
that leads with the vendored-material disclosure, not a small-print footnote. No example was
found of a mostly-vendored project that *omitted* a LICENSE file on the theory that "most of this
isn't ours anyway."

**Is there an established convention for licensing only the original additions (docs, build
scripts, generated indexes) while disclaiming the bundled material?**

Yes — Nerd Fonts is exactly this pattern in the wild: original `.sh`/`.py`/`font-patcher` tooling
under MIT, explicitly separated from the vendored/patched font files under OFL-1.1-or-whatever-
each-upstream-used, stated as a bulleted list at the top of the LICENSE file before either
license's full text appears. Node.js's "applies to all parts... that are not externally
maintained libraries" sentence is the same idea expressed as a single catch-all sentence instead
of a bullet list. Font Awesome's category split ("applies to all non-font and non-icon files")
is the same catch-all-by-exclusion phrasing pattern again. All three real examples use the same
underlying move: **name what the narrow/permissive grant does NOT cover, then point at where the
excluded material's own terms live** — none of them tries to positively enumerate every original
file.

**What's the dominant pattern overall, stated plainly?**

The root LICENSE, by itself, usually says nothing about scope at all (Chromium, .NET, VS Code,
Kubernetes: all four are unmodified license boilerplate with zero project-specific scope
language). Scope is instead communicated by *where else* the third-party material's terms live —
a separate notices file (.NET, VS Code), a per-directory metadata convention (Chromium, k8s), or,
least commonly but most explicitly, a hand-written sentence inside LICENSE itself naming what it
doesn't cover (Node.js, Nerd Fonts, Font Awesome). The explicit-sentence-inside-LICENSE approach
is the minority pattern among large infrastructure projects but is exactly what the two
real *collection-shaped* projects examined (Nerd Fonts, Font Awesome) both do — suggesting it's
the more natural convention specifically for projects whose own original contribution is a small
fraction of the tree, versus the separate-file convention favored by projects where "our code" is
still the majority of what's shipped.

---

## 4. Verbatim wordings that could be adapted

Three real sentences, quoted exactly, useful as models (not to be copied verbatim as someone
else's copyrighted text, but as structural models for original wording):

1. Node.js: *"The Node.js license applies to all parts of Node.js that are not externally
   maintained libraries."* — single catch-all sentence, no enumeration needed, scales to any
   number of vendored items because it's defined by exclusion.

2. Font Awesome: *"In the Font Awesome Free download, the MIT license applies to all non-font
   and non-icon files."* — same exclusion-based move, phrased around file *type* rather than
   provenance; useful when the original/vendored split lines up with file extensions or
   directories rather than "ours vs. not ours."

3. Nerd Fonts: *"Nerd Fonts original source code files (such as `.sh`, `.py`, `font-patcher` and
   others) are licensed under the MIT License (MIT)... Many other licenses are present in this
   project for even more detailed breakdown see: [License Audit]."* — a two-tier structure: a
   short bulleted scope statement in LICENSE itself, deferring the full enumeration to a separate
   audit document, used specifically because the vendored material's licenses were too
   heterogeneous (~12 distinct licenses) to responsibly summarize in one sentence.

---

## 5. Recommendation for a tree that is ~95% third-party (vendored UI component source, fonts,
images) and ~5% original (build scripts, generated index files, documentation)

This is closest in shape to Nerd Fonts (vendored assets dominate the byte count; a small amount
of original tooling glues it together) crossed with Font Awesome (multiple material *types* with
different license families: code vs. fonts vs. images, not just "ours vs. vendored").

Based on the observed conventions above (not legal advice — a documentation-practice
recommendation):

1. **Add a root `LICENSE` even though ~95% of the tree isn't yours.** No real precedent for
   omitting one; Nerd Fonts, the closest real analogue, has one and puts the scope disclosure
   first, not buried.

2. **Open the LICENSE with a short, bulleted, exclusion-based scope statement**, following the
   Nerd Fonts / Node.js model directly — name what your license covers (build scripts, generated
   index files, documentation — the ~5%) and state plainly that everything else keeps its
   original license. Adapt the structural pattern, e.g. (original wording, not copied from any
   source above):
   - "The license below applies to this project's own build scripts, generated index files, and
     documentation. It does not apply to the vendored component source, fonts, or images
     included in this repository, each of which remains under its original license — see
     [notices file] for the full list."

3. **Keep a separate third-party notices file** (per `conventions.md`'s Pattern A/B recommendation)
   for the actual per-component/per-font/per-image entries — don't try to cram hundreds of
   entries into LICENSE itself. This is what every project examined does once the vendored count
   goes past a handful (.NET, VS Code) and it's also what Nerd Fonts does via its separate
   `license-audit.md` once license *diversity* (not just count) got high.

4. **If the notices file's entries span genuinely different material types** (code libraries vs.
   fonts vs. images), group by type with one scope line per group, Font-Awesome-style, rather
   than one undifferentiated flat list — this was already `conventions.md`'s §8 recommendation
   independently, and the Font Awesome LICENSE.txt found here is direct real-world confirmation
   that "license applies to all files of type X" is an established, real phrasing for exactly
   this grouping.

5. **For anything whose license would prohibit redistribution outright** (not observed as
   relevant to shadcn's own vendored set, which is all permissive, but stated for completeness
   since the task asked): the two real conventions found are (a) exclude it from the archive
   entirely and name it in a "not included, here's why" list (Nerd Fonts' pattern), or (b) don't
   vendor the bytes at all — fetch from the canonical source at build/install time instead
   (`ttf-mscorefonts-installer` pattern, weaker-sourced). No real example of "vendor it anyway
   with a warning label" was found, so that is not a documented convention to fall back on.
