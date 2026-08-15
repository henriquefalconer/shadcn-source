// Fetch SVGs for cdn.simpleicons.org references used in the registry.
// Primary source: the locally installed `simple-icons` npm package (current release).
// Fallback: a pinned legacy npm version (9.21.0, or 6.0.0 for `java`) fetched via the
// npm registry CDN (unpkg), for marks the current package has removed for trademark-policy
// reasons (microsoft, linkedin, twitter, java, css3, amazonaws, visualstudiocode, sonarqube).
// This is real, unmodified upstream SVG content -- not a fabricated stand-in.
import fs from "node:fs"
import path from "node:path"

const ARCHIVE = path.resolve(import.meta.dirname, "..")

const DEST = path.join(ARCHIVE, "assets/cdn.simpleicons.org")
fs.mkdirSync(DEST, { recursive: true })

const CURRENT_ICONS_DIR = path.join(ARCHIVE, "node_modules/simple-icons/icons")

// slug -> legacy npm version to pull from (only for slugs missing in current package)
const LEGACY = {
  microsoft: "9.21.0",
  linkedin: "9.21.0",
  twitter: "9.21.0",
  java: "6.0.0",
  css3: "9.21.0",
  amazonaws: "9.21.0",
  visualstudiocode: "9.21.0",
  sonarqube: "9.21.0",
}

const NEEDED = [
  // marquee-logos.tsx
  "microsoft", "apple", "google", "linkedin", "twitter",
  // icon-cloud-demo.tsx
  "typescript", "javascript", "dart", "java", "react", "flutter", "android",
  "html5", "css3", "nodedotjs", "express", "nextdotjs", "prisma", "amazonaws",
  "postgresql", "firebase", "nginx", "vercel", "testinglibrary", "jest",
  "cypress", "docker", "git", "jira", "github", "gitlab", "visualstudiocode",
  "androidstudio", "sonarqube", "figma",
]

const results = { ok: [], failed: [], legacy_used: [] }

async function fetchLegacy(slug, version) {
  const url = `https://unpkg.com/simple-icons@${version}/icons/${slug}.svg`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) return { ok: false, status: res.status, url }
      const text = await res.text()
      return { ok: true, text, url }
    } catch (e) {
      if (attempt === 2) return { ok: false, status: "ERR:" + e.message, url }
    }
  }
}

for (const slug of NEEDED) {
  const localFile = path.join(CURRENT_ICONS_DIR, `${slug}.svg`)
  if (fs.existsSync(localFile) && !LEGACY[slug]) {
    const svg = fs.readFileSync(localFile, "utf8")
    fs.writeFileSync(path.join(DEST, `${slug}.svg`), svg)
    results.ok.push({ slug, source: "simple-icons@current(node_modules)" })
    continue
  }
  if (LEGACY[slug]) {
    const r = await fetchLegacy(slug, LEGACY[slug])
    if (r.ok) {
      fs.writeFileSync(path.join(DEST, `${slug}.svg`), r.text)
      results.ok.push({ slug, source: `simple-icons@${LEGACY[slug]} (npm registry, via unpkg)`, url: r.url })
      results.legacy_used.push({ slug, version: LEGACY[slug], reason: "removed from current simple-icons package (trademark-policy purge)" })
    } else {
      results.failed.push({ slug, status: r.status, url: r.url })
    }
    continue
  }
  results.failed.push({ slug, status: "not found in current package and no legacy pin configured" })
}

fs.writeFileSync(path.join(ARCHIVE, "_work/simpleicons-report.json"), JSON.stringify(results, null, 2))
console.log("ok:", results.ok.length, "failed:", results.failed.length, "legacy:", results.legacy_used.length)
console.log(JSON.stringify(results.failed, null, 2))
