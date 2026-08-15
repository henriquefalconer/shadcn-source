# Stage 2: assets/ regeneration — results

`assets/` was wiped and fully regenerated from upstream sources by
`_work/bootstrap/fetch-assets.mjs`. This document records the validation run
performed after finishing the script.

## Bugs found and fixed in `_work/fetch-static-assets.mjs`

Both were caught by per-subdirectory hash comparison against the pre-wipe
baseline (`_work/bootstrap/assets-baseline.json`), not by eyeballing.

1. **`raw.githack.com`/hdri: only 1 of 8 files was being fetched, into the
   wrong path.** `ModelViewer.tsx` (`registry/react-bits/ModelViewer/`)
   defines 8 HDRI presets (`HDRI_FILES`) all served from
   `/assets/raw.githack.com/hdri/`, but the script only downloaded
   `forest_slope_1k.hdr` and wrote it directly under `raw.githack.com/`
   (no `hdri/` subdir). Fixed to fetch all 8 presets into the correct
   `hdri/` subdirectory.

2. **`face-api-weights`: shard filenames were missing the `.bin`
   extension, and didn't match their own manifest.** Upstream
   (`jsdelivr/gh/justadudewhohacks/face-api.js@0.22.2`, a pinned/immutable
   tag) genuinely serves `tiny_face_detector_model-shard1` etc. with no
   extension — confirmed by fetching the manifest directly from jsdelivr
   today; its `paths` field also says `"...-shard1"`, no `.bin`. The
   pre-wipe baseline had renamed these to `...-shard1.bin` and patched the
   manifest's `paths` entry to match (a local convention, likely because
   static hosts often misidentify the Content-Type of an extension-less
   binary file). This isn't fetchable verbatim from upstream; the script
   now reproduces the rename + manifest patch deterministically so the
   pair (`manifest` ↔ `shard file`) stays internally consistent and
   byte-identical to the baseline.

Both fixes are in the current `_work/fetch-static-assets.mjs` and are
exercised by every run.

## Per-subdirectory comparison (24 subdirs)

Run via `node _work/bootstrap/test-assets.mjs` (compares live `assets/`
against `_work/bootstrap/assets-manifest.json`, the new post-fix truth).
20 of 24 MATCH exactly; the remaining 4 (+ `videos.pexels.com`, which
matches the *manifest* but is expected to differ from the *old baseline*)
are allow-listed as unverifiable — see below.

| Subdirectory | vs new manifest | vs pre-wipe baseline |
|---|---|---|
| avatar.vercel.sh | MATCH | MATCH |
| avatars.githubusercontent.com | MATCH | MATCH |
| cdn.jsdelivr.net | MATCH | MATCH |
| cdn.magicui.design | MATCH | MATCH |
| cdn.simpleicons.org | MATCH | MATCH |
| ejiidnob33g9ap1r.public.blob.vercel-storage.com | MATCH | MATCH |
| face-api-weights | MATCH | MATCH (after fix) |
| flagcdn.com | MATCH | MATCH |
| fonts | MATCH | MATCH |
| github.com | MATCH | MATCH |
| i.pravatar.cc | MATCH | MATCH |
| images.pexels.com | MATCH | MATCH |
| images.unsplash.com | MATCH | DIFFERS — unverifiable (CDN re-encodes per request) |
| models.dev | MATCH | MATCH |
| pbs.twimg.com | MATCH | MATCH |
| picsum.photos | MATCH | DIFFERS — unverifiable (random image per seed) |
| placehold.co | MATCH | MATCH |
| plus.unsplash.com | MATCH | DIFFERS — unverifiable (CDN re-encodes per request) |
| preview-v0me-…vusercontent.net | MATCH | DIFFERS — unverifiable (live v0 preview deploy) |
| raw.githack.com | MATCH | MATCH (after fix) |
| startup-template-sage.vercel.app | MATCH | MATCH |
| unpkg.com | MATCH | MATCH |
| videos.pexels.com | MATCH | DIFFERS — **expected**, originals not transcodes |
| www.youtube.com | MATCH | DIFFERS — unverifiable (embed HTML has per-request tokens) |

All 24 subdirectories present. No MISSING, no EXTRA (beyond the top-level
`NOTICE` file, which `gen-notices.mjs` writes and is outside `subdirHashes`'
directory-only walk).

## Unverifiable list (documented in `test-assets.mjs`, allow-listed by name)

- **`videos.pexels.com`** — explicit product decision: fetch upstream
  originals, no ffmpeg transcode. Baseline held locally transcoded copies
  (~4.7MB); current holds originals (112MB). Originals are the new truth.
  Re-fetches of the originals themselves ARE expected to be byte-stable
  (confirmed: MATCH against `assets-manifest.json` across cold + warm runs).
- **`images.unsplash.com`**, **`plus.unsplash.com`** — Unsplash's image CDN
  re-encodes JPEGs per request (`?q=&w=&auto=format`); dimensions/content
  are stable but bytes are not.
- **`picsum.photos`** — picsum serves a randomly-chosen source photo per
  request for a given seed/size; the seed pins a pool, not one image.
- **`www.youtube.com`** — embed HTML contains per-request nonces/tokens;
  never byte-identical between fetches.
- **`preview-v0me-kzml7zc6fkcvbyhzrf47.vusercontent.net`** — a live v0
  preview deployment; its `index.html` is server-regenerated, not a
  versioned static artifact.

None of these are gated by `test-assets.mjs` (it still prints their
DIFFERS/MATCH status every run) — they're allow-listed by name with the
reasons above, not silently ignored.

## Timings

| Run | Wall clock | Notes |
|---|---|---|
| Cold (assets/ empty) | **67.1s** | media 38.6s (120 files), fonts 16.9s, icons 0.4s, static 10.6s, notices 0.4s |
| Warm re-run (idempotent) | **13.6s** | media 0.0s (all 120 already present, skipped), fonts 12.8s (still re-fetches Google Fonts CSS per family to determine current subsetting, but skips all binary woff2 downloads — 0 new files written), icons 0.4s, static 0.1s (all files present, skipped), notices 0.2s |

Confirmed idempotent: per-subdirectory hashes taken immediately before and
after the warm re-run are identical for all 24 subdirectories (verified
programmatically, not just by inspection).

## Final size

- **374 files**, **152MB** total in `assets/`.
- Pre-wipe baseline was 374 files / 45MB — the ~107MB delta is entirely
  `videos.pexels.com` (originals vs. the baseline's ffmpeg-transcoded
  copies), matching the ~112MB vs ~5.9MB expectation from the task brief
  almost exactly (112MB measured here).

## Deliverables

- `_work/bootstrap/fetch-assets.mjs` — orchestrator (unchanged logic, still
  composes the 5 steps; exports `subdirHashes`)
- `_work/fetch-static-assets.mjs` — fixed (hdri + face-api-weights bugs above)
- `_work/bootstrap/test-assets.mjs` — new; per-subdir MATCH/DIFFERS/MISSING/EXTRA
  against a manifest, exits non-zero on any unexpected difference, allow-lists
  the 5 unverifiable subdirs above by name with inline reasons
- `_work/bootstrap/assets-manifest.json` — new; post-fix per-subdirectory
  hashes, the new truth
- This file
