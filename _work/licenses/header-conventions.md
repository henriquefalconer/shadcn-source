# Per-file license header conventions: real examples

Research method: real source files and real specification/policy pages fetched via WebFetch
(raw GitHub URLs, spdx.dev, spdx.github.io, reuse.software, kernel.org, chromium.googlesource.com),
plus WebSearch for the "does anyone summarize permissions in a header" question. Not
reconstructed from memory. Companion to `conventions.md` (third-party notices *files*) and
`own-license-conventions.md` (root LICENSE scoping) — this file is about the **per-file comment
header** specifically, a different artifact from both.

---

## 1. Verbatim real headers

**Linux kernel**, `kernel/sched/core.c` (fetched from torvalds/linux, master):

```
// SPDX-License-Identifier: GPL-2.0-only
/*
 *  kernel/sched/core.c
 *
 *  Core kernel CPU scheduler code
 *
 *  Copyright (C) 1991-2002  Linus Torvalds
 *  Copyright (C) 1998-2024  Ingo Molnar, Red Hat
 */
```

Fields: SPDX identifier (own line, own comment style `//`), then a block comment with filename,
one-line description, and copyright lines. No warranty text, no license summary, no pointer
sentence to LICENSE — the SPDX identifier itself is the pointer.

**Kubernetes**, `pkg/kubelet/kubelet.go` (fetched from kubernetes/kubernetes, master) — the full
Apache-2.0 boilerplate, not SPDX-shortened:

```
/*
Copyright 2015 The Kubernetes Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
```

Fields: copyright line, one sentence naming the license, a URL to the canonical license text,
then the Apache §7 "AS IS" warranty-disclaimer boilerplate verbatim. 13 lines. No SPDX
identifier — this predates/coexists without the SPDX convention; the license is *named* in prose,
not tagged.

**Chromium**, `base/values.cc` (fetched from chromium/chromium, main):

```
// Copyright 2012 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
```

Three lines. Fields: copyright line, one sentence naming the license *by style* ("BSD-style"),
and an explicit pointer to the LICENSE file — no inlined terms, no SPDX identifier, no warranty
text repeated per file (it lives once in root LICENSE).

**REUSE specification's own example** (fetched from reuse.software/spec-3.3):

```
# SPDX-FileCopyrightText: 2016, 2018-2019 Jane Doe <jane@example.com>
# SPDX-FileCopyrightText: 2019 Example Organisation
#
# SPDX-License-Identifier: GPL-3.0-or-later
```

Two required tags only: `SPDX-FileCopyrightText` (copyright holder) and
`SPDX-License-Identifier` (license). Full license text lives once in a `LICENSES/` directory, not
per file.

### Summary of what fields actually appear, across all four

| Source | Copyright line | License identifier/name | Pointer to full text | Warranty/disclaimer text | Length |
|---|---|---|---|---|---|
| Linux kernel | yes | SPDX ID | implicit (SPDX ID *is* the pointer) | no | 8 lines |
| Kubernetes | yes | prose name | explicit URL | yes, full Apache §7 text | 13 lines |
| Chromium | yes | prose name ("BSD-style") | explicit ("found in the LICENSE file") | no | 3 lines |
| REUSE spec model | yes (tagged) | SPDX ID (tagged) | implicit (project's `LICENSES/` dir) | no | 4-5 lines |

None of the four inlines the full license text per file. None describes what the license
*permits* — each either names the license (prose or SPDX ID) or reproduces the literal
no-warranty clause of the license itself (Kubernetes), which is legal boilerplate *from* the
license, not a project-authored summary of its effect.

Headers are explicitly designed to be machine-readable: both the Linux kernel docs and the SPDX
spec state this as the reason SPDX identifiers replaced verbose boilerplate — see §4.

---

## 2. Q2 — does anyone put a permissions SUMMARY in a header?

**Finding: no positive example was located.** Searches targeting the specific phrasings the task
asked about — `"permits commercial use"`, `"free for commercial use"`, `"you may use this
commercially"`, `"this license permits"`, `"you are free to use this commercially"` — combined
with `SPDX-License-Identifier` or "source code file header comment example" returned:

- The SPDX/REUSE/OSI/Linux-kernel canonical pages themselves (already covered above — none of
  them contain such a summary).
- Generic license-text search results (MIT's own "Permission is hereby granted..." grant clause,
  the CPOL, a "LICENSE_FAQ.md" for a non-commercial license) — these are license *texts and FAQs*
  quoting their own grant language, not a third project's *per-file header comment* summarizing a
  vendored or original license's effect.
- No hit from Linux, Kubernetes, Chromium, or any infrastructure project's actual `.go`/`.cc`/`.c`
  source tree matched any commercial-use-summary phrasing in a header comment.

So: **across the projects surveyed (Linux kernel, Kubernetes, Chromium, plus general web search),
no real per-file header was found that summarizes what the license permits ("free for commercial
use" etc.).** This is a genuine absence, not a search failure masked as one — every hit returned
was either a license's own canonical grant text or unrelated.

**Explicit guidance found on this exact question**, from the FSFE REUSE FAQ (fetched from
reuse.software/faq/):

> "Marking all individual files with `SPDX-License-Identifier` tags goes a long way towards
> unambiguously communicating the license information of your project, but it helps to
> communicate the license information in natural language as well. In the README of your
> project, feel free to provide a summary of the licensing information."

This is a direct, on-point answer: **REUSE's own guidance places natural-language license
summaries in the README, explicitly not in the per-file header.** The header's job is the
machine-readable identifier; the human-readable "what does this mean" summary is scoped to
project-level documentation, one level up from individual files.

Consistent with this, the SPDX spec (Annex E, fetched from spdx.github.io) states the header's
purpose is narrowly to identify, not describe:

> "Identifying the license for open source software is critical for both reporting purposes and
> license compliance." ... "If using SPDX short identifiers in individual files, it is recommended
> to reproduce the full license in the project's LICENSE file and indicate that SPDX short
> identifiers are being used to refer to it."

And the Linux kernel's own rationale for adopting SPDX (kernel.org, `process/license-rules.rst`):

> "the common way of expressing the license of a source file is to add the matching boilerplate
> text into the top comment of the file. Due to formatting, typos etc. these 'boilerplates' are
> hard to validate for tools."

i.e., the entire reason SPDX headers exist is to get *away* from free-text prose in headers
(which is unparseable and error-prone) — a permissions-summary sentence is exactly the kind of
free text this convention was created to eliminate. The direction of travel across all the
guidance found is header = terse machine-readable tag; description/summary = elsewhere (README,
LICENSE, or a NOTICES file).

**Verdict for Q2: not found in the wild, and actively counter-recommended by the one piece of
explicit guidance (REUSE FAQ) that addresses the question directly.**

---

## 3. Q3 — do projects inject headers into VENDORED files?

**Chromium — explicit policy against modifying vendored source, found in
`docs/adding_to_third_party.md`** (fetched from chromium.googlesource.com):

> "Do not reformat or apply Chromium-style formatting to any code within the dependency `src`
> directory. Maintaining the original formatting is essential for generating clean diffs against
> upstream versions."

The stated reason is explicitly diffability: keeping vendored code byte-identical to upstream is
what makes it possible to generate clean diffs when re-vendoring or applying upstream security
patches. Chromium's mechanism for attribution is *not* a header injected into each vendored file
— it's the separate `README.chromium` metadata file per package (documented already in
`conventions.md` §"Pattern C"), which points at the upstream `LICENSE` file rather than touching
the vendored source at all.

**Kubernetes — no explicit "do not modify" sentence was found** in the vendor-verification
tooling itself (`hack/verify-vendor.sh`), but the *mechanism* is the same conclusion by
construction: `vendor/` is regenerated wholesale from `go.mod`/`go.sum` via standard Go tooling
(`go mod vendor`), and `hack/verify-vendor.sh` exists specifically to fail CI if the checked-in
`vendor/` tree doesn't match what regenerating from the module graph would produce. A tree that
is verified-equal to a fresh `go mod vendor` output cannot contain injected per-file headers
without failing that check — the enforcement is automated/structural rather than a written policy
sentence, but it has the identical practical effect as Chromium's rule. Kubernetes' attribution
mechanism is, as found in `own-license-conventions.md`, a `LICENSES/vendor/<import-path>/LICENSE`
tree that mirrors the module graph — again, metadata alongside, not headers injected into, the
vendored `.go` files.

**Tooling-level confirmation — `google/addlicense`** (fetched from the project's own README): the
canonical usage example for excluding a directory from header-injection is:

```
-ignore **/*.go -ignore vendor/**
```

The tool's own documentation uses `vendor/**` as *the* worked example of what to exclude — i.e.
the maintainers of the standard Go-ecosystem license-header-injection tool treat "never run this
against your vendor directory" as obvious enough to be the canonical example, not an edge case
requiring explanation. Separately, addlicense "avoids adding a license header to any file that
already has one" — a second, independent safeguard against double-stamping vendored files that
already carry an upstream header.

**Verdict for Q3:** across every project examined (Chromium by explicit written policy,
Kubernetes by enforced tooling invariant, the addlicense tool by its own canonical usage
example), the practice is uniform: **vendored/third-party files are left byte-identical to
upstream; no project injects its own header into them.** Provenance and license attribution are
recorded in a side-channel — a per-package metadata file (Chromium's `README.chromium`), a
license-file tree that mirrors the dependency graph (Kubernetes' `LICENSES/vendor/`), or a
flat notices file (per `conventions.md`) — never as a header written into the vendored file
itself. The stated reason, where given (Chromium), is diffability against upstream for future
re-vendoring and patching.

No counter-example — a project that *does* inject its own header into vendored files — was found
in this research.

---

## 4. SPDX / REUSE recommended minimal header, quoted

**REUSE spec 3.3** (fetched, reuse.software/spec-3.3):

```
# SPDX-FileCopyrightText: 2016, 2018-2019 Jane Doe <jane@example.com>
# SPDX-FileCopyrightText: 2019 Example Organisation
#
# SPDX-License-Identifier: GPL-3.0-or-later
```

Two tags: one or more `SPDX-FileCopyrightText` lines (copyright holder + optional years), then
one `SPDX-License-Identifier` line with a valid SPDX license expression. Full license text is
kept once, centrally, in a `LICENSES/` directory — never reproduced per file.

**SPDX spec proper (Annex E)** — the bare single-line form, no copyright tag required by SPDX
itself (REUSE adds the copyright-tag requirement on top of plain SPDX):

```
SPDX-License-Identifier: <SPDX License Expression>
```

on its own line, "generally as part of a comment," with the recommendation to "reproduce the full
license in the project's LICENSE file and indicate that SPDX short identifiers are being used to
refer to it."

Both converge on the same minimal shape: **who + which-license-by-ID**, nothing else, with the
actual legal text kept exactly once at the project level.

---

## 5. Recommended header for this project's vendored-UI-component tree

Context (from `own-license-conventions.md`): 5 upstream UI component libraries under MIT,
Apache-2.0, and MIT+Commons-Clause, vendored into this archive.

Given §3's finding — **no real project injects headers into vendored files; they stay
byte-identical to upstream** — the correct action for the actual vendored component source files
is: **add nothing to them.** Preserve them exactly as fetched, so they remain diffable against
upstream for re-vendoring/updates, matching Chromium's explicit rationale and Kubernetes'
enforced-identical-to-upstream invariant.

Attribution and licensing for the vendored tree belongs in the side-channel metadata this archive
already has a home for — the `THIRD-PARTY-NOTICES.md` skeleton recommended in `conventions.md` §8
— using the SPDX-minimal field set from §4 above per entry, e.g. (illustrative structure, not
copied from any one project):

```
---
<component-library-name> <version>
<upstream repo URL>
SPDX-License-Identifier: MIT

Copyright <year> <upstream copyright holder>
---
```

For the MIT+Commons-Clause library, per `conventions.md` §5's Kafka-derived recommendation, the
restriction is named explicitly in the entry's own sentence — SPDX has no identifier for the
Commons Clause add-on, so the license field there should be prose ("MIT, with the Commons
Clause"), not a fabricated SPDX ID, and the entry should state in plain language what the clause
restricts (selling the software or a product whose value derives substantially from it), per
Commons Clause's own text, with a pointer to the upstream `LICENSE` file.

If this archive's *own* original files (build scripts, generated index files) get per-file
headers at all, the SPDX-minimal form from §4 is the evidenced-best-practice shape:

```
// SPDX-FileCopyrightText: <year> <holder>
// SPDX-License-Identifier: <this-project's-own-license-id>
```

No permissions-summary sentence, per the Q2 finding: REUSE explicitly places that kind of
human-readable summary in the README, not in the file header.

---

## 6. Sources fetched

- `torvalds/linux` — `kernel/sched/core.c` (raw GitHub)
- `kubernetes/kubernetes` — `pkg/kubelet/kubelet.go` (raw GitHub)
- `chromium/chromium` — `base/values.cc` (raw GitHub, mirror)
- `chromium.googlesource.com/chromium/src/+/HEAD/docs/adding_to_third_party.md`
- `spdx.dev/learn/handling-license-info/`
- `spdx.github.io/spdx-spec/v2.3/using-SPDX-short-identifiers-in-source-files/`
- `reuse.software/spec-3.3/`
- `reuse.software/faq/`
- `kernel.org/doc/html/v4.16/process/license-rules.html`
- `github.com/google/addlicense` — README (raw GitHub)
- `kubernetes/kubernetes` — `hack/verify-vendor.sh` (via GitHub blob view)
- WebSearch: `"permits commercial use" OR "free for commercial use" ... SPDX-License-Identifier`
  (no genuine per-file-header hit)
- WebSearch: `addlicense tool skip vendor directory "do not modify" third-party files license
  header`
- Attempted, not usable: `nodejs/node` `deps/README.md` (404 — path does not exist at that
  location in the current tree; Node.js vendoring conventions were not independently re-verified
  here, see `own-license-conventions.md` §1 "Node.js" for the already-researched root-LICENSE
  scoping sentence, which is a different question than this file's per-file-header question).
