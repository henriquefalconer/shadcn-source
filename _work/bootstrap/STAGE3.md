# Stage 3: index regeneration — results

## What was built

- **`_work/bootstrap/build-indexes.mjs`** — new generator (see "why a new
  script" below). Regenerates all four root index files from the archive's
  own current contents.
- **`_work/bootstrap/test-indexes.mjs`** — acceptance test. Runs the
  generator twice, diffs sha256 of all four outputs (idempotency), reloads
  `INDEX.json`/`INDEX-compact.json`/`INDEX.tsv`/`manifest.json` and checks
  item counts, then walks every `files[]` entry in `INDEX.json` and confirms
  the file exists on disk and its `bytes`/`sha256` match the actual content.
  Exits non-zero on any failure.

Both scripts are plain `node` (no deps beyond core modules), run from
anywhere, and only ever write the four files at the archive root.

## Why a new script instead of fixing `_work/index-build.mjs`

The old `_work/index-build.mjs` reads three things that don't survive a
fresh checkout: `_work/raw/**` (gitignored), `_work/fileindex.json`
(gitignored, itself derived from `_work/raw` by `_work/extract.mjs`), and
implicitly trusts both. None of that exists until someone reruns the old,
now-retired `fetch → extract → flatten` pipeline by hand. Stage 1
(`_work/bootstrap/fetch-registry.mjs`) already re-implements that whole
pipeline against its own cache at `_work/bootstrap/raw/`, so I pointed the
new generator there instead of trying to reconcile two overlapping raw
caches. Keeping the generator in `_work/bootstrap/` alongside the script
that produces its input, rather than patching the old one in place, keeps
the dependency direction obvious: `fetch-registry.mjs` → `raw/` →
`build-indexes.mjs` → root index files.

## Source-of-truth decisions

1. **Metadata** (type, description, `dependencies`, `registryDependencies`,
   each file's registry-relative `path`) comes from
   `_work/bootstrap/raw/<reg>/[<style>/]<name>.json` — stage 1's fetch
   cache, present in any checkout that has run stages 1–2.
2. **`bytes`/`sha256` for every file entry are read from the actual file on
   disk under `registry/`, never from the raw JSON's embedded `content` and
   never from any previously-cached hash.** The on-disk path for each raw
   file entry is *derived* deterministically from `(registry, style,
   file.path)` using the same extract+flatten rule stage 1 uses to write
   `registry/` (`localPathFor()` in the generator) — only the resulting path
   is trusted; the hash is always freshly computed. This directly defuses
   trap 1: the committed `INDEX.json` had 490 file entries with stale
   sha256 because 51 `react-bits/` files were re-baselined against upstream
   after the old index was generated. Re-hashing from disk on every run
   makes "matches the current `registry/` tree" true by construction,
   immune to any future re-baseline, rather than something that can drift.
3. **`manifest.json`'s per-item `{url, sha256, bytes}`** come from
   `_work/bootstrap/manifest.jsonl`, stage 1's resumable fetch log (one line
   per `(reg, style, name)` job, appended as fetches complete), deduped to
   the last record per job key. This is the sha256/bytes of the *raw
   registry-item JSON as fetched*, which is a different (and correctly
   different) quantity from `INDEX.json`'s per-file hashes — `manifest.json`
   pins what came over the wire, `INDEX.json` describes what's on disk now.
4. Found and fixed along the way: `_work/bootstrap/raw/` was incomplete when
   I started (4,938 of 6,126 files — all 8 `aria-*` shadcn styles were
   missing, apparently from an earlier run that hit `fetch-registry.mjs`'s
   circuit breaker). I reran `node _work/bootstrap/fetch-registry.mjs`
   (defaults to `OUT=_work/bootstrap/tmp-registry`, per its own guardrail
   against writing to the real `registry/`) to top up the cache — it's
   resumable, so only the missing 3,995 jobs were fetched (~78s), the rest
   served from cache. Confirmed `raw/` now holds exactly 6,126 items / 7,080
   files, matching the target counts. `tmp-registry/` was deleted afterward
   since it's scratch output, not a stage 3 deliverable.

## Timestamp decision (trap 2)

- **`INDEX.json`'s old `generated: "<ISO timestamp>"` field is DROPPED.**
  It was purely informational and directly blocks byte-reproducibility. It
  added no information that isn't already better captured elsewhere (git
  commit history, `manifest.json`'s pin date).
- **`manifest.json`'s `pinned_at` is kept, but frozen to a constant**
  (`PINNED_AT = "2026-08-12T22:51:26.522Z"` in `build-indexes.mjs`, the
  value already recorded in the archive's first pinned manifest). This
  field's actual meaning is "when was this archive pinned to upstream
  pinned", not "when was the index file last rebuilt" — those
  are different events, and conflating them by stamping wall-clock time on
  every regeneration would be the same bug in a different field. Re-pinning
  to a new upstream commit is a deliberate, rare action; when it happens,
  `PINNED_AT` should be updated by hand (or the constant promoted to a
  proper `_work/bootstrap/pin.json` if this needs to happen more than
  once — not done here since it hasn't come up).
- Also fixed while regenerating: the old `manifest.json` hardcoded
  `"@shadcn": {"styles": 26}`; the archive actually has 27 shadcn styles (3
  legacy + 3 bases × 8 themes, confirmed against both `registry/shadcn/*`
  on disk and the unique style set observed in the raw items). The new
  generator computes this from the regenerated data instead of carrying a
  stale literal forward.

## Verification

Ran `node _work/bootstrap/test-indexes.mjs`. Full output:

```
== idempotency: running generator twice ==
INDEX.json          6126 style-resolved entries, 7080 file entries
INDEX-compact.json  2098 unique items
INDEX.tsv           2098 lines
manifest.json       6126 items, 27 shadcn styles
INDEX.json          6126 style-resolved entries, 7080 file entries
INDEX-compact.json  2098 unique items
INDEX.tsv           2098 lines
manifest.json       6126 items, 27 shadcn styles
OK:   INDEX.json byte-identical across two runs (bbdd08bba13b)
OK:   INDEX.tsv byte-identical across two runs (315ffdadb6c1)
OK:   INDEX-compact.json byte-identical across two runs (daddeb16ed02)
OK:   manifest.json byte-identical across two runs (f4851a6d76f8)

== counts ==
OK:   INDEX-compact.json: 2098 unique items
OK:   INDEX.tsv: 2098 data rows
OK:   INDEX.json: 6126 style-resolved entries
OK:   INDEX.json: 7080 file entries
OK:   manifest.json: 6126 items

== file existence + sha256 verification ==
checked 7080 file entries: 7080 match, 0 missing, 0 sha256/bytes mismatch
OK:   all 7080 files[].local exist on disk with matching sha256

RESULT: PASS
```

Exit code: `0`.

## Counts (final)

| File | Count |
|---|---|
| `INDEX.tsv` | 2,098 data rows (+ 1 header) |
| `INDEX.json` | 6,126 style-resolved item entries, 7,080 file entries |
| `INDEX-compact.json` | 2,098 unique items |
| `manifest.json` | 6,126 items, 27 `@shadcn` styles |

All match the acceptance criteria exactly (2,098 / 6,126 / 7,080).

## Timing

| Step | Wall clock |
|---|---|
| Topping up `_work/bootstrap/raw/` (missing `aria-*`, 3,995 jobs, mostly cache hits) | ~78s (one-time; not part of steady-state regeneration) |
| `build-indexes.mjs`, single run (steady state, `raw/` already complete) | ~0.9s |
| `test-indexes.mjs` (runs the generator twice + full verification) | ~1.5s |

## What's NOT byte-reproducible, and why (honesty check)

Nothing left over. Both known non-determinism traps were resolved:
`INDEX.json`'s `generated` timestamp is gone; `manifest.json`'s `pinned_at`
is a fixed constant. Two consecutive runs of `build-indexes.mjs` produce
byte-identical output for all four files, verified above by sha256, not
just by eyeballing.

One caveat worth recording explicitly: byte-reproducibility as verified
here is conditional on `registry/`, `docs/docs/components/*.md`,
`_work/enum/*.json`, and `_work/bootstrap/raw/` + `manifest.jsonl` being
unchanged between runs — which is the correct scope (the generator is
supposed to react to changes in those, e.g. a future react-bits
re-baseline). It is not claiming reproducibility against a *different*
`registry/` tree, only against the same one, run twice.

## Constraints honored

- Did not modify `registry/`, `assets/`, `_work/bootstrap/reference.json`,
  `_work/bootstrap/assets-baseline/`, or `_work/bootstrap/assets-manifest.json`.
- Only wrote: `INDEX.tsv`, `INDEX.json`, `INDEX-compact.json`,
  `manifest.json` (all four at the archive root, all four in scope), plus
  the two new scripts and this doc under `_work/bootstrap/`, plus topping up
  `_work/bootstrap/raw/` (a regenerable cache, not a protected path) and
  briefly creating then deleting `_work/bootstrap/tmp-registry/` (stage 1's
  own scratch output directory, guarded by `fetch-registry.mjs` itself
  against ever being pointed at the real `registry/`).
