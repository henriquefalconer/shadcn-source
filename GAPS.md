# Gaps

Everything this archive does **not** fully cover, or covers by adaptation.
Read this before relying on any number in `COVERAGE.md`.

## 1. Dropped registry: Aceternity (paywalled)

160 of 276 Aceternity items — all of its blocks — return:

```
HTTP 401  {"error":"Unauthorized - Please provide a valid API token or sign in"}
```

The free tier exposes 116 components. Reaching 100% requires a paid API token.
Dropped from the archive by decision, not silently omitted. If you obtain a
token, `_work/fetch.mjs` will pick the registry up again unchanged.

Also **not enumerable at all** via the shadcn CLI, and therefore excluded from
consideration as substitutes: `@cult-ui` (6.0k stars), `@motion-primitives`
(5.9k), `@neobrutalism` (5.3k). Popular, but no reliable denominator exists for
them, so no honest coverage claim could be made.

## 2. Upstream packaging bug: `icon-placeholder`

1,856 references across shipped `sidebar-*` blocks import:

```
@/app/(create)/components/icon-placeholder
```

That file lives in shadcn's **website app**
(`apps/v4/app/(app)/(create)/components/icon-placeholder.tsx`), not in the
registry. It is never published as a registry item, so those blocks cannot
compile from registry files alone. This is an upstream packaging defect, not a
hole in this mirror.

The real component switches between five icon libraries via a `nuqs`
search-param provider that requires a Next.js router. Reproducing it faithfully
would pull four extra icon packages and a router in purely to draw placeholders.

**Adaptation:** `_verify/src/shims/icon-placeholder.tsx` keeps the exact prop
contract and mirrors upstream's own `SquareIcon` Suspense fallback. Blocks render
faithfully offline, but this is a shim, not upstream code.

## 3. Assets — final state after the vendoring pass

Of 197 distinct remote URLs found in component source, 134 were render-blocking.
**All but the cases in section 10 were vendored.** An earlier pass left several
open; they were subsequently closed and are recorded here for accuracy:

- `cdn.simpleicons.org` (65 refs) — originally 403 (Cloudflare bot challenge).
  Closed via the `simple-icons` npm package. 8 icons (microsoft, linkedin,
  twitter, java, css3, amazonaws, visualstudiocode, sonarqube) had been *removed
  from current simple-icons for trademark reasons* and were pulled from the last
  npm versions that still carried them (9.21.0 / 6.0.0).
- `picsum.photos`, `flagcdn.com` — dynamic templates, but the id/seed/country
  sets were **bounded within each file**, so the exact combinations were fetched
  and the templates rewritten to build local paths. Semantics preserved.
- `models.dev` — **reclassified**. Initially assumed a data API; verified by
  request to be a static SVG logo host. 14 provider logos vendored. The prop is
  free-form, so an out-of-set provider name still 404s locally — a residual, not
  a hidden failure.
- `cdn.jsdelivr.net` / `unpkg.com` — face-api.js ML model weights and Rive's wasm
  runtime, both vendored. The weight shards had to be renamed with a `.bin`
  extension because Vite's dev server otherwise ran extension-less files through
  its JS transform pipeline.
- `raw.githack.com` — drei's `<Environment preset>` ignores a `path` override
  when `preset` is set, so the components were switched to explicit `files=`,
  with all 8 HDRI presets vendored (not only the sampled default).

Total vendored: ~152 MB across images, video, fonts, HDRIs, wasm and ML weights.

## 4. Runtime API endpoints (cannot be vendored)

Live data endpoints called at runtime cannot be mirrored — see section 10 for the
exact per-file list and counts. Components depending on them **render** offline
but cannot **function** offline. This is inherent: an AI chat component with no
model endpoint has nothing to talk to, and a GitHub star count has no offline
value. Render coverage is measured; functional coverage against live services is
not claimed anywhere in this archive.

## 5. Navigational links left intact

53 URLs are `href` targets or appear in comments/plaintext (react.dev, github.com,
twitter.com, aws.amazon.com, …). They are **not fetched during render** and do
not affect offline capability, so they were deliberately not rewritten. They are
dead links if clicked offline.

## 6. Docs

`https://ui.shadcn.com/docs/v0` is listed in upstream's own `llms.txt` but
returns 404 both as `.md` and as HTML. The page was removed upstream; the link is
stale. 108 of 109 pages captured — the denominator includes a page that no longer
exists.

`ui.shadcn.com` serves no `sitemap.xml` and no `llms-full.txt` (both 404), so
`llms.txt` was the only enumerable source of doc URLs. If a doc page is not
linked from `llms.txt`, it is not in this archive. The full upstream repo clone
in `upstream/` (312 MDX files) is the mitigation.

4 external API reference pages 404'd because shadcn's own `index.json` links are
stale: `base-ui.com/react/components/{hover-card,label,radio-group}.md` and
`embla-carousel.com/get-started/react`.

## 7. The official skill needs network

`skills/shadcn-ui/` is captured verbatim and is byte-identical to upstream — but
61 of its instructions tell an agent to run `shadcn search` / `shadcn view` /
`shadcn docs`, use the MCP server, or fetch `ui.shadcn.com` and
`raw.githubusercontent.com`. **All of those fail here.**

Use `skills/shadcn-archive/SKILL.md` instead, which maps every one of those
commands to a local file lookup. The original is kept for its conceptual content.

## 8. Dependency substitutions

- `@base-ui-components/react` is deprecated upstream (renamed to `@base-ui/react`).
  16 archived files still import the old name. Resolved via a pnpm alias **plus**
  a Vite alias — the pnpm `npm:` alias alone does not create a
  `node_modules/@base-ui-components/` directory, so bare-specifier resolution
  fails without the Vite mapping.
- `three` bumped `^0.180.0` → `^0.182.0` to satisfy
  `@react-three/postprocessing@3.0.5`'s peer requirement (a caret range on a 0.x
  version cannot reach it).
- `recharts` pinned to `^3.8.0` over a conflicting `2.15.4` request from another
  registry. **This is a real compatibility gap:** any component written against
  the recharts 2.x API may behave differently.
- `strict-peer-dependencies=false` — the archive mixes React 18 and React 19 peer
  ranges across registries.

## 9. What C5 does and does not prove

C5 is split because a single number would be misleading:

- **C5a — loads offline.** Module and its entire transitive import graph resolve
  from local disk, and the page attempted **zero** external requests. This is the
  offline claim.
- **C5b — renders clean.** Additionally renders with no props and zero console
  errors.

C5b is strictly lower and **understates** quality: many components legitimately
require props, and rendering them bare throws `Cannot read properties of
undefined`. Those are classified separately (`needsPropsExports`) and are not
offline failures. C5b is a floor, not a defect count.

Verification runs headless Chromium with SwiftShader. A component requiring true
GPU may fail here yet work on real hardware.

---

## 10. The exact 30 files that fail C5a (of 6,370)

Final measured state. Nothing here is rounded or inferred.

**@shadcn: 0 failures — 5,079/5,079 = 100.00%.**

### Live data APIs — 25 files, inherently unfixable offline

These call a remote API for *data* at render time. There is nothing to vendor: a
GitHub star count or a link preview has no offline equivalent, and fabricating
one would make the archive lie.

| host | files | what it does |
| --- | --- | --- |
| `api.microlink.io` | 8 | link-preview cards (`preview-link-card`, all 3 bases + demos) |
| `api.github.com` | 6 | live star counts (`github-stars`, `github-stars-wheel`) |
| `react-tweet.vercel.app` | 3 | per-tweet data API (`tweet-card-*`, magicui) |
| `skills.sh` | 1 | live iframe preview embed (`v0-clone.tsx`) |
| `pbs.twimg.com` | 7 | avatar images that **404 upstream** — verified deleted |

The 7 `pbs.twimg.com` cases are dead upstream URLs. No placeholder was
substituted: faking a real person's avatar would hide a genuine defect.

### Missing upstream content — 5 files

- `animate-ui/**/headless/tabs/index.tsx` (3 files) — depends on a
  `primitives/headless/tabs` component that exists in **neither** the registry
  nor the upstream repo. Upstream ships a broken reference.
- `react-bits/Lanyard.{jsx,tsx}` (2 files) — needs a binary `card.glb` 3D model
  that is not published in any registry item or repo we could reach.

### Renderer limitation — 1 file (inconclusive, not a failure of the archive)

- `ai-elements/persona.tsx` — its network dependency **is** fixed (Rive's wasm is
  vendored and it attempts zero external requests). It crashes the *software*
  renderer once the wasm initializes. This was previously masked: the network
  call used to fail instantly, so the crash never happened. Likely works on real
  GPU hardware; unverifiable here. Counted as a failure rather than assumed to pass.

## 11. Verification faults found in this harness (and fixed)

Recorded because they invalidate results silently, and anyone re-running this
should know to check for them:

1. **Browser instability logged as component failure.** Under 4-way parallelism
   the renderer became unstable; the runner recorded 6,259 untested files as
   failures, producing a confident, precise, entirely wrong **1.74%**. Caught by
   running a "failing" file in isolation and watching it pass. The runner now
   retries on a fresh context and only records `renderer-crash` after three
   consecutive crashes.
2. **Vite prebundle keyed by specifier string.** The scoped TanStack v9 plugin
   caused Vite to prebundle v9 under the shared `@tanstack/react-table` key,
   silently breaking **every v8 consumer**. Fixed by excluding only the colliding
   specifier and giving v9 its own prebundle entry.
3. **Path-based version discrimination over-matched.** Selecting v9 consumers by
   file path also caught the legacy `default`/`new-york` files, which sit at the
   same path but use the v8 API. Now discriminated by file *content*.
4. **Non-idempotent replay rewrite.** An `old_string` that was a prefix of its own
   `new_string` duplicated text on every replay. Caught by an
   `extract → reapply` round trip checked byte-for-byte, not by inspection.
5. **Re-running `extract.mjs` reverts all offline rewrites.** It restores pristine
   upstream content. Always follow with `flatten.mjs` + `reapply-rewrites.mjs`.
