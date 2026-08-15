#!/usr/bin/env node
// Fetch Google Fonts CSS + woff2 files for self-hosting, offline.
import fs from "node:fs/promises"
import path from "node:path"

const ARCHIVE = path.resolve(import.meta.dirname, "..")

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const HEADERS = {
  "User-Agent": UA,
  Accept: "text/css,*/*;q=0.1",
  "Accept-Language": "en-US,en;q=0.9",
}

const OUT_DIR = path.join(ARCHIVE, "assets/fonts")
const REPORT_PATH = path.join(ARCHIVE, "_work/fonts-report.json")

const WEIGHT_LIST = "100;200;300;400;500;600;700;800;900"

// slug -> { googleFamily, query, notes }
// 26 families from apps/v4/registry/fonts.ts (FONT_DEFINITIONS), all provider "google",
// dependency @fontsource-variable/* (or @fontsource/instrument-serif for the static one).
// Plus 2 extra families found hardcoded in component source (react-bits):
//   IBM Plex Mono (ASCIIText), Roboto Flex (TextPressure / VariableProximity)
//   (Figtree is already covered by fonts.ts; CircularGallery's Figtree 400;700 request
//    is a subset of the full weight list we fetch anyway.)
const FAMILIES = [
  { slug: "geist", google: "Geist", query: "Geist:wght@100..900", origin: "fonts.ts" },
  { slug: "inter", google: "Inter", query: "Inter:wght@100..900", origin: "fonts.ts" },
  { slug: "noto-sans", google: "Noto Sans", query: "Noto+Sans:wght@100..900", origin: "fonts.ts" },
  { slug: "nunito-sans", google: "Nunito Sans", query: "Nunito+Sans:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "figtree", google: "Figtree", query: "Figtree:wght@" + WEIGHT_LIST, origin: "fonts.ts + react-bits" },
  { slug: "roboto", google: "Roboto", query: "Roboto:wght@100..900", origin: "fonts.ts" },
  { slug: "raleway", google: "Raleway", query: "Raleway:wght@100..900", origin: "fonts.ts" },
  { slug: "dm-sans", google: "DM Sans", query: "DM+Sans:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "public-sans", google: "Public Sans", query: "Public+Sans:wght@100..900", origin: "fonts.ts" },
  { slug: "outfit", google: "Outfit", query: "Outfit:wght@100..900", origin: "fonts.ts" },
  { slug: "oxanium", google: "Oxanium", query: "Oxanium:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "manrope", google: "Manrope", query: "Manrope:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "space-grotesk", google: "Space Grotesk", query: "Space+Grotesk:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "montserrat", google: "Montserrat", query: "Montserrat:wght@100..900", origin: "fonts.ts" },
  { slug: "ibm-plex-sans", google: "IBM Plex Sans", query: "IBM+Plex+Sans:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "source-sans-3", google: "Source Sans 3", query: "Source+Sans+3:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "instrument-sans", google: "Instrument Sans", query: "Instrument+Sans:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "jetbrains-mono", google: "JetBrains Mono", query: "JetBrains+Mono:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "geist-mono", google: "Geist Mono", query: "Geist+Mono:wght@100..900", origin: "fonts.ts" },
  { slug: "noto-serif", google: "Noto Serif", query: "Noto+Serif:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "roboto-slab", google: "Roboto Slab", query: "Roboto+Slab:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "merriweather", google: "Merriweather", query: "Merriweather:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "lora", google: "Lora", query: "Lora:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "playfair-display", google: "Playfair Display", query: "Playfair+Display:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "eb-garamond", google: "EB Garamond", query: "EB+Garamond:wght@" + WEIGHT_LIST, origin: "fonts.ts" },
  { slug: "instrument-serif", google: "Instrument Serif", query: "Instrument+Serif:wght@400", origin: "fonts.ts" },
  // Extras from component source (react-bits), not in fonts.ts
  { slug: "ibm-plex-mono", google: "IBM Plex Mono", query: "IBM+Plex+Mono:wght@" + WEIGHT_LIST, origin: "react-bits/ASCIIText" },
  {
    slug: "roboto-flex",
    google: "Roboto Flex",
    query: "Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000",
    origin: "react-bits/TextPressure + VariableProximity",
  },
]

async function fetchWithRetry(url, attempts = 4) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS })
      if (res.status === 200) {
        const text = await res.text()
        // Google's anti-bot JS challenge page comes back as HTML, not CSS.
        if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
          throw new Error("bot-challenge-html")
        }
        return { ok: true, status: res.status, text }
      }
      lastErr = new Error(`HTTP ${res.status}`)
      if (res.status === 400 || res.status === 404) {
        return { ok: false, status: res.status, text: await res.text().catch(() => "") }
      }
    } catch (e) {
      lastErr = e
    }
    await sleep(500 + i * 700)
  }
  return { ok: false, status: 0, error: String(lastErr) }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseFontFaces(cssText) {
  // Split into blocks, tracking preceding subset comment.
  const blocks = []
  const re = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g
  let m
  while ((m = re.exec(cssText))) {
    const subset = m[1] || "unknown"
    const body = m[2]
    const get = (prop) => {
      const mm = body.match(new RegExp(prop + "\\s*:\\s*([^;]+);"))
      return mm ? mm[1].trim() : null
    }
    const family = (get("font-family") || "").replace(/^['"]|['"]$/g, "")
    const style = get("font-style") || "normal"
    const weight = get("font-weight") || "400"
    const display = get("font-display") || "swap"
    const unicodeRange = get("unicode-range")
    const srcRaw = get("src") || ""
    const srcMatch = srcRaw.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\('([^']+)'\)/)
    if (!srcMatch) continue
    blocks.push({
      subset,
      family,
      style,
      weight,
      display,
      unicodeRange,
      url: srcMatch[1],
      format: srcMatch[2],
    })
  }
  return blocks
}

function slugFilenameFromUrl(url) {
  const u = new URL(url)
  return path.basename(u.pathname)
}

async function main() {
  const report = {
    families_required: [],
    families_ok: 0,
    families_failed: [],
    woff2_files: 0,
    total_bytes: 0,
    subsets_per_family: {},
    notes: [],
  }

  const cssParts = []
  let totalBytes = 0
  let totalFiles = 0
  const seenLocalPaths = new Set() // dedupe: variable fonts often reuse the same file for many weight labels

  for (const fam of FAMILIES) {
    report.families_required.push({ name: fam.google, slug: fam.slug, query: fam.query, origin: fam.origin })
    const url = `https://fonts.googleapis.com/css2?family=${fam.query}&display=swap`
    process.stderr.write(`Fetching ${fam.google} ...\n`)
    const res = await fetchWithRetry(url)
    await sleep(350)

    if (!res.ok) {
      report.families_failed.push({
        name: fam.google,
        reason: res.status ? `HTTP ${res.status}` : res.error || "unknown error",
      })
      continue
    }

    const faces = parseFontFaces(res.text)
    if (faces.length === 0) {
      report.families_failed.push({ name: fam.google, reason: "no @font-face blocks parsed from response" })
      continue
    }

    const famDir = path.join(OUT_DIR, fam.slug)
    await fs.mkdir(famDir, { recursive: true })

    const subsetsSeen = new Set()
    const localFaces = []

    for (const face of faces) {
      subsetsSeen.add(face.subset)
      const fname = slugFilenameFromUrl(face.url)
      const localPath = path.join(famDir, fname)
      const localWebPath = `/assets/fonts/${fam.slug}/${fname}`

      // Download (skip if already downloaded in a previous run, or already
      // fetched earlier in this run — variable fonts commonly reuse the same
      // underlying woff2 file across multiple declared weight labels).
      let bytes
      try {
        const stat = await fs.stat(localPath).catch(() => null)
        if (stat && stat.size > 0) {
          bytes = stat.size
        } else {
          const fres = await fetch(face.url, { headers: { "User-Agent": UA } })
          if (!fres.ok) throw new Error(`HTTP ${fres.status}`)
          const buf = Buffer.from(await fres.arrayBuffer())
          await fs.writeFile(localPath, buf)
          bytes = buf.length
        }
      } catch (e) {
        process.stderr.write(`  ! failed to download ${face.url}: ${e}\n`)
        continue
      }

      if (!seenLocalPaths.has(localPath)) {
        seenLocalPaths.add(localPath)
        totalBytes += bytes
        totalFiles += 1
      }

      localFaces.push({ ...face, localWebPath })
    }

    report.subsets_per_family[fam.google] = [...subsetsSeen].sort()

    // Build CSS block for this family
    cssParts.push(`/* ===== ${fam.google} (${fam.origin}) ===== */`)
    for (const face of localFaces) {
      cssParts.push(
        [
          `/* ${face.subset} */`,
          `@font-face {`,
          `  font-family: '${face.family}';`,
          `  font-style: ${face.style};`,
          `  font-weight: ${face.weight};`,
          `  font-display: ${face.display};`,
          `  src: url(${face.localWebPath}) format('${face.format}');`,
          face.unicodeRange ? `  unicode-range: ${face.unicodeRange};` : null,
          `}`,
        ]
          .filter(Boolean)
          .join("\n")
      )
    }
    cssParts.push("")

    report.families_ok += 1
  }

  report.woff2_files = totalFiles
  report.total_bytes = totalBytes

  await fs.writeFile(path.join(OUT_DIR, "fonts.css"), cssParts.join("\n") + "\n")

  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2))
  process.stderr.write(
    `\nDone. ${report.families_ok} ok, ${report.families_failed.length} failed, ${totalFiles} files, ${totalBytes} bytes\n`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
