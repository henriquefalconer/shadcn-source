# Third-party attribution files: real-world conventions

Research base: actual files retrieved via `curl`/WebFetch (not reconstructed from memory).
Sources fetched in full and saved under `_work/licenses/_raw/`:

- VS Code — `ThirdPartyNotices.txt` (3,439 lines)
- .NET runtime — `THIRD-PARTY-NOTICES.TXT` (1,699 lines)
- Apache Kafka — `NOTICE` (15 lines)
- Elastic/Kibana — `NOTICE.txt` (300 lines)
- Chromium — `third_party/freetype/README.chromium` (per-package metadata file)

Attempted but 404/unavailable: Kubernetes `LICENSES/README.md`, Rust/Cargo `LICENSE-THIRD-PARTY`,
HashiCorp Terraform `NOTICE.txt`, GitHub Primer `LICENSE.md`. Grafana's `NOTICE.md` was reached
but turned out to be a two-line copyright notice, not a dependency list — noted below as a
counter-example of how *little* some projects actually put in this file.

---

## 1. Verbatim preambles

**Microsoft VS Code**, `ThirdPartyNotices.txt`:

> NOTICES
>
> This repository incorporates material as listed below or described in the code.

That's it — one sentence, then straight into entries.

**.NET runtime**, `THIRD-PARTY-NOTICES.TXT`:

> .NET Runtime uses third-party libraries or other resources that may be
> distributed under licenses different than the .NET Runtime software.
>
> In the event that we accidentally failed to list a required notice, please
> bring it to our attention. Post an issue or email us:
>
>            dotnet@microsoft.com
>
> The attached notices are provided for information only.

Notice the added "we might have missed one, tell us" line and an actual contact channel —
a hedge against the list being wrong, not a claim of completeness.

**Apache Kafka**, `NOTICE` (the Apache-2.0 `NOTICE` convention):

> Apache Kafka
> Copyright 2026 The Apache Software Foundation.
>
> This product includes software developed at
> The Apache Software Foundation (https://www.apache.org/).

Then, and only then, the handful of dependencies that need something beyond the standard
Apache attribution get a sentence each (see §5).

**Elastic/Kibana**, `NOTICE.txt`:

> Kibana source code with Kibana X-Pack source code
> Copyright 2012-2026 Elasticsearch B.V.

Also just a copyright line up top, then straight into a dash-delimited list of entries.

**Grafana**, `NOTICE.md` — for contrast, the *entire relevant content* is two lines:

> Copyright 2014-2021 Grafana Labs. This software is based on Kibana: Copyright 2012-2013
> Elasticsearch BV

No dependency list at all in that file (Grafana tracks licenses elsewhere, e.g. in build
tooling output). Evidence that a NOTICE file is not obligated to be exhaustive — some mature
projects keep it to a copyright-lineage statement only.

---

## 2. Dominant structural patterns

Two patterns cover essentially everything seen, plus a third for per-package repos.

### Pattern A — flat list, divider-separated, full text inlined
(VS Code, Kibana)

```
NOTICES / <preamble, 1-2 sentences>

---------------------------------------------------------

<package-name> <version>[, <version> - <license-name>]
<homepage/repo URL>

<full license text, verbatim>

---------------------------------------------------------

<next entry...>
```

- No table of contents, no grouping by license family — just document order (often
  alphabetical or build order).
- Some entries are one-liners with no inlined text when the obligation is trivial, e.g.
  Kibana's font entry:
  > This product uses Noto fonts that are licensed under the SIL Open Font License, Version 1.1.
  (no full OFL text, no version pin, no homepage — a single sentence pointer)
- Plain text, monospace, no markdown tables. Machine-generated feel: every code-library entry
  looks the same, because it *is* generated (from `npm`/`yarn`/`cargo` metadata) — but
  hand-written exceptions (the Noto line, zsh's multi-paragraph caveat) are tolerated inline.

### Pattern B — "License notice for X" sections
(.NET runtime)

```
<preamble>

License notice for <component name>
-------------------------------

<homepage / repo URL>

<copyright line>
<license name, then full text OR a one-line "Licensed under the MIT License (MIT)."
 + "Available at <url>" instead of inlining>
```

Functionally the same content as Pattern A, but each entry gets a human-readable heading
(`----` underline, Markdown-adjacent but plain text) instead of a divider bar, and — notably —
.NET frequently **does not inline the text**, just points at the canonical license URL:

> License notice for ASP.NET
> -------------------------------
> Copyright (c) .NET Foundation. All rights reserved.
> Licensed under the MIT License (MIT)
>
> Available at
> https://github.com/dotnet/aspnetcore/blob/main/LICENSE.txt

So inlining vs. pointing is a per-entry choice even within one file, not a hard rule. Pointing
is more common when the org already trusts the upstream repo/URL to be stable; inlining is used
when the license text is short or the upstream link is less durable.

### Pattern C — per-package metadata file
(Chromium's `README.chromium`, one file per vendored dependency, not one big file)

```
Name: <name>
URL: <homepage>
Version: <version>
Revision: <commit>
Update Mechanism: <how it's refreshed>
CPEPrefix: <CPE identifier>
License: <SPDX-ish license short name>
License File: <path to full text, not inlined>
Security Critical: yes|no
Shipped: yes|no
License Android Compatible: yes|no

Description:
<one paragraph>

Local Modifications:
<if any>
```

This is the most "database record" of the three — every field is a fixed key, license text is
always a pointer (never inlined), and it has a purpose-built field for flagging exactly the kind
of thing the task asked about: `License Android Compatible: no` (or similar bespoke flags) is how
Chromium marks a dependency whose license is *not* a plain attribution obligation but imposes a
distribution constraint. There's no free-text "WARNING" banner — the constraint is a structured
field, checked by tooling, not prose.

**Also seen: the Apache NOTICE-file convention itself** (Kafka) is really its own small pattern —
not a dependency list at all, but a short "extra facts a downstream re-distributor needs beyond
what's in LICENSE" note: bundled binary deps under a different license, code provenance
(donated modules, copied files), nothing more. It stays three paragraphs for the whole Kafka
project.

---

## 3. Recommended per-entry field set

Synthesizing what actually recurs across A/B/C (dropping fields that only Chromium-scale orgs
need, like CPEPrefix and Update Mechanism, which are for automated CVE scanning, not attribution):

- **Name** (+ version, when it matters — omitted in the shortest examples like the Noto line)
- **License name** (plain string: "MIT", "Apache-2.0", "SIL Open Font License 1.1" — none of the
  four flat-list examples used SPDX identifiers verbatim, though Chromium's is SPDX-adjacent)
- **Homepage / source URL**
- **Copyright line** (verbatim from upstream, not paraphrased)
- **License text: inline OR pointer** — pick one per project, not per entry, unless you have a
  reason (as .NET does) to mix
- Everything else (Security Critical, CPE, Update Mechanism, Local Modifications) is
  infrastructure for orgs doing automated compliance scanning at Chromium/Kubernetes scale —
  not something a small archive needs.

---

## 4. Disclaimer wording — an important correction

I searched all four full-text files for "informational purposes only" / "does not modify" /
"governs" to find how projects word their own disclaimer. **Every hit was the same one line**,
and it is not a disclaimer any of these projects wrote — it's Apache License 2.0 §4 boilerplate,
which shows up because these files *inline the full Apache-2.0 text* for each Apache-licensed
dependency they carry:

> The contents of the NOTICE file are for informational purposes only and do not modify the
> License. You may add Your own attribution notices within Derivative Works that You
> distribute...

This is the Apache Software Foundation's own instruction for how a *different* file (NOTICE)
should be read — it is not VS Code or .NET disclaiming their *own* THIRD-PARTY-NOTICES file.
None of the four real files examined contained a project-authored "this file is purely
informational, the actual licenses govern" disclaimer about themselves. The closest things to a
self-disclaimer that *were* found, both hand-written by the project:

> In the event that we accidentally failed to list a required notice, please bring it to our
> attention. Post an issue or email us: dotnet@microsoft.com
>
> The attached notices are provided for information only.
> — .NET runtime, `THIRD-PARTY-NOTICES.TXT`

So: real practice skews toward *no* elaborate disclaimer at all, or at most a one-line "this is
informational, tell us if it's wrong" plus a contact point — not a paragraph of legal hedging.

---

## 5. Handling a license with an unusual restriction

No example above had a genuinely restrictive license (e.g. non-commercial, source-available)
mixed into an otherwise permissive dependency list — mature projects mostly avoid taking on such
dependencies at all. What the research *did* surface as the real convention for "this one is
different, pay attention":

1. **Kafka's `NOTICE`** — when a dependency needs something beyond the standard blanket Apache
   attribution, it gets its own explicit prose sentence, e.g.:
   > This distribution has a binary dependency on jersey, which is available under the CDDL
   > License. The source code of jersey can be found at https://github.com/jersey/jersey/.
   The pattern: don't bury it in a generic entry — name the license by name, in a full sentence,
   at the top level of the file, not just inside a copyright block.
2. **Chromium's structured fields** — `License Android Compatible: no` is a dedicated Boolean
   field precisely so restriction-bearing dependencies are machine-flaggable rather than relying
   on someone reading prose. This is the more scalable convention but requires per-package files.

For a project of the scale this task is aimed at (a handful of UI libraries, not thousands of
vendored C++ deps), Kafka's approach — name the restriction in a plain sentence, right in the
entry, using the actual clause name if there is one (e.g. "Commons Clause") — is the appropriate
model, not a bespoke YAML flag.

---

## 6. Non-code assets (fonts, media)

Only one real, concrete example turned up: **Kibana's `NOTICE.txt`**, one line, no version, no
URL, no inlined license text:

> This product uses Noto fonts that are licensed under the SIL Open Font License, Version 1.1.

This is the load-bearing precedent for the font question: real projects do **not** give fonts
the same heavyweight treatment (full inlined text, per-family versioning) as code dependencies.
One sentence naming the family and the license is treated as sufficient, even in a NOTICE file
that otherwise inlines full MIT texts for its code dependencies a few lines above and below it.

No real example of icon/image attribution was found in the four sources (Chromium's
`README.chromium` pattern would in principle cover an icon set the same way it covers FreeType,
but no icon-specific instance was fetched).

---

## 7. Machine-generated feel vs. prose

Confirmed preference for the uniform-block style: VS Code's and .NET's files are visibly
generated from package-manager metadata (identical divider bars, identical field order,
hundreds of near-identical MIT blocks back to back). Hand-written prose is the *exception*,
reserved for: a genuinely unusual case (zsh's GPL-carve-out paragraph in VS Code's file), a
donation/provenance note (Kafka's streams-scala), or a one-line pointer for something that
doesn't fit the entry template (Kibana's Noto line). Nobody hand-wrote paragraphs explaining
*why* a normal MIT/Apache dependency is included — the block format itself carries that.

---

## 8. Concrete recommendation for this project's shape

**Inputs:** 5 UI component libraries (MIT / Apache-2.0 / MIT-with-Commons-Clause), 28 font
families (mostly OFL-1.1), third-party images/icons.

**Recommendation: one file, `THIRD-PARTY-NOTICES.md`, Pattern A (flat list, divider-separated),
pointer-style for fonts, inlined for code libraries.** Reasoning:

- 5 code libraries is small enough to inline full text (Pattern A/VS Code style) without the
  file becoming unwieldy — no need for .NET's URL-pointer style, which exists mainly to avoid
  ballooning a file with *hundreds* of entries.
- 28 fonts, almost all OFL-1.1: **do not inline the OFL text 28 times.** Follow Kibana's
  precedent — one shared statement that the OFL fonts are OFL-1.1, then a flat list of family
  names (+ copyright holder per family, since OFL requires preserving the Reserved Font Name /
  copyright holder even without full text duplication), and inline the OFL-1.1 text **once**,
  referenced by all of them.
- The one Commons-Clause library needs Kafka-style explicit-sentence treatment: name the
  restriction plainly in its entry, don't let it read like a plain MIT block.
- Images/icons: one short paragraph per source (à la Kibana's font line) is precedent-backed;
  don't invent a heavier format than the fonts get.

**Skeleton:**

```
THIRD-PARTY NOTICES

This project incorporates third-party material listed below. Each entry names the
component, its license, and a copyright or source line. Full license text is included
where short; OFL-1.1 fonts share one copy of the license text (see §Fonts).

## UI component libraries

---
<library> <version>
<homepage>
<license name>

<full license text — inline, short libs only>
---
... (repeat, 5 entries)
---
<library-with-commons-clause> <version>
<homepage>

Licensed under MIT with the Commons Clause. In addition to the MIT permissions below,
the Commons Clause restricts [selling a product whose value derives substantially from
this software / etc — state the actual restricted Value] without a separate agreement
with <licensor>. Full terms: <url>.

<full MIT text>
---

## Fonts

The following font families are licensed under the SIL Open Font License, Version 1.1.
The full OFL-1.1 text appears once, below.

- <Family 1> — Copyright <holder>
- <Family 2> — Copyright <holder>
... (28 entries, one line each)

<OFL-1.1 full text, once>

[If any font is NOT OFL — separate short entry, same style as UI libraries above.]

## Images and icons

<Source/set name>: <one-sentence license statement + URL>, in the style of the fonts
section above.
```

**What real projects include that this archive can justifiably skip:**

- Chromium-style structured metadata (CPEPrefix, Update Mechanism, Security Critical, Revision
  hashes) — that's automated-compliance-scanning infrastructure for orgs vendoring thousands of
  C/C++ packages; irrelevant at 5+28+icons scale.
- .NET's "please email us if we missed one" contact-channel line — nice but optional; only worth
  it if there's an actual monitored inbox/issue tracker behind it.
- A legal-hedge disclaimer paragraph — none of the real files examined had one beyond a single
  sentence at most ("provided for information only"); skip elaborate hedging language entirely.
- Per-entry version pinning for fonts/images — Kibana's own font entry skips versions; only the
  *code* library entries need a version number (so a consumer can map the notice back to a
  specific installed release).
- Grouping/sub-headers by license family — none of the flat-list examples bothered; document
  order (grouped by asset *type* — libraries / fonts / images — as above) is simpler and matches
  precedent closely enough while staying readable at this scale.
```
