// Downloads the finite, concrete asset sets needed to close out the remaining
// dynamic-template network dependencies (picsum, flagcdn, models.dev logos,
// jsdelivr face-api weights + rive fallback wasm, unpkg rive.wasm, raw.githack hdr).
import fs from "node:fs"
import path from "node:path"

const ARCHIVE = path.resolve(import.meta.dirname, "..")

const ASSETS = path.join(ARCHIVE, "assets")
const report = { attempted: 0, ok: [], failed: [] }

async function dl(url, destAbs, { binary = true } = {}) {
  report.attempted++
  fs.mkdirSync(path.dirname(destAbs), { recursive: true })
  // Idempotent: skip a file that is already present and non-empty.
  if (fs.existsSync(destAbs) && fs.statSync(destAbs).size > 0) {
    report.ok.push({ url, localPath: destAbs.replace(ARCHIVE, ""), skipped: true })
    return true
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) {
      report.failed.push({ url, status: res.status })
      return false
    }
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(destAbs, buf)
    report.ok.push({ url, localPath: destAbs.replace(ARCHIVE, ""), bytes: buf.length })
    return true
  } catch (e) {
    report.failed.push({ url, status: "ERR:" + e.message })
    return false
  }
}

// ---- picsum.photos: blur-fade-demo.tsx (seed 1..9, alternating 800x600 / 600x800) ----
for (let i = 1; i <= 9; i++) {
  const landscape = (i - 1) % 2 === 0
  const w = landscape ? 800 : 600
  const h = landscape ? 600 : 800
  const url = `https://picsum.photos/seed/${i}/${w}/${h}`
  const dest = path.join(ASSETS, "picsum.photos", `blurfade_seed_${i}_${w}_${h}.jpg`)
  await dl(url, dest)
}

// ---- flagcdn.com: dotted-map-demo.tsx (kr, us) ----
for (const cc of ["kr", "us"]) {
  const url = `https://flagcdn.com/w80/${cc}.webp`
  const dest = path.join(ASSETS, "flagcdn.com", `w80_${cc}.webp`)
  await dl(url, dest)
}

// ---- models.dev logos: model-selector.tsx family (chefSlug set actually used in examples) ----
const CHEFSLUGS = [
  "alibaba", "amazon-bedrock", "anthropic", "cohere", "deepseek", "google",
  "llama", "mistral", "moonshotai", "openai", "perplexity", "v0", "xai",
  "cerebras",
]
for (const slug of CHEFSLUGS) {
  const url = `https://models.dev/logos/${slug}.svg`
  const dest = path.join(ASSETS, "models.dev", "logos", `${slug}.svg`)
  await dl(url, dest, { binary: false })
}

// ---- cdn.jsdelivr.net: rive_fallback.wasm (persona.tsx) ----
await dl(
  "https://cdn.jsdelivr.net/npm/@rive-app/webgl2@2.39.2/rive_fallback.wasm",
  path.join(ASSETS, "cdn.jsdelivr.net", "rive_fallback.wasm")
)

// ---- unpkg.com: rive.wasm (persona.tsx) ----
await dl(
  "https://unpkg.com/@rive-app/webgl2@2.39.2/rive.wasm",
  path.join(ASSETS, "unpkg.com", "rive.wasm")
)

// ---- raw.githack.com: hdri/*.hdr (ModelViewer) ----
// All 8 presets in HDRI_FILES (ModelViewer.tsx) are loaded from assets/raw.githack.com/hdri/,
// not just the one used as the component's default preset.
const HDRI_BASE = "https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri"
const HDRI_FILES = [
  "lebombo_1k.hdr",
  "potsdamer_platz_1k.hdr",
  "kiara_1_dawn_1k.hdr",
  "forest_slope_1k.hdr",
  "dikhololo_night_1k.hdr",
  "rooitou_park_1k.hdr",
  "studio_small_03_1k.hdr",
  "venice_sunset_1k.hdr",
]
for (const f of HDRI_FILES) {
  await dl(`${HDRI_BASE}/${f}`, path.join(ASSETS, "raw.githack.com", "hdri", f))
}

// ---- cdn.jsdelivr.net: face-api.js tiny model weights (GridScan) ----
// Upstream (pinned tag 0.22.2, immutable) serves the shard files and manifest
// "paths" entries WITHOUT a ".bin" extension. The archive renames the shard files
// to add ".bin" (many static hosts otherwise guess the wrong Content-Type for an
// extension-less binary file) and patches the corresponding manifest "paths" entry
// to match, so the pair stays internally consistent -- this is a deliberate local
// convention, not something upstream provides, so it can't be "fetched" verbatim.
const FACEAPI_BASE = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights"
const FACEAPI_MODELS = ["tiny_face_detector_model", "face_landmark_68_tiny_model"]
for (const model of FACEAPI_MODELS) {
  const manifestName = `${model}-weights_manifest.json`
  const manifestDest = path.join(ASSETS, "face-api-weights", manifestName)
  if (await dl(`${FACEAPI_BASE}/${manifestName}`, manifestDest, { binary: false })) {
    const text = fs.readFileSync(manifestDest, "utf8")
    fs.writeFileSync(manifestDest, text.replace(`${model}-shard1"`, `${model}-shard1.bin"`))
  }
  await dl(
    `${FACEAPI_BASE}/${model}-shard1`,
    path.join(ASSETS, "face-api-weights", `${model}-shard1.bin`),
    { binary: false }
  )
}

fs.writeFileSync(path.join(ARCHIVE, "bootstrap", "static-assets-report.json"), JSON.stringify(report, null, 2))
console.log(`attempted=${report.attempted} ok=${report.ok.length} failed=${report.failed.length}`)
console.log(JSON.stringify(report.failed, null, 2))
