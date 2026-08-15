// Fetch SVGs for cdn.simpleicons.org references used in the registry.
// Source: the npm CDN, pinned per slug. Bootstrap must not depend on a package
// being pre-installed locally - a fresh clone has no node_modules.
// Fallback: a pinned legacy npm version (9.21.0, or 6.0.0 for `java`) fetched via the
// npm registry CDN (unpkg), for marks the current package has removed for trademark-policy
// reasons (microsoft, linkedin, twitter, java, css3, amazonaws, visualstudiocode, sonarqube).
// This is real, unmodified upstream SVG content -- not a fabricated stand-in.
import fs from "node:fs"
import path from "node:path"

const ARCHIVE = path.resolve(import.meta.dirname, "..")

const DEST = path.join(ARCHIVE, "assets/cdn.simpleicons.org")
fs.mkdirSync(DEST, { recursive: true })

const CURRENT = "15.5.0" // pinned release for slugs still published upstream

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

async function fetchIcon(slug, version) {
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
  // Every slug comes from the npm CDN. LEGACY pins the last release that still
  // carried a mark since removed upstream for trademark policy; everything else
  // uses the pinned CURRENT release so runs are reproducible.
  const version = LEGACY[slug] || CURRENT
  const r = await fetchIcon(slug, version)
  if (r.ok) {
    fs.writeFileSync(path.join(DEST, `${slug}.svg`), r.text)
    results.ok.push({ slug, source: `simple-icons@${version} (npm registry, via unpkg)`, url: r.url })
    if (LEGACY[slug])
      results.legacy_used.push({ slug, version, reason: "removed from current simple-icons package (trademark-policy purge)" })
  } else {
    results.failed.push({ slug, status: r.status, url: r.url })
  }
}

fs.writeFileSync(path.join(ARCHIVE, "bootstrap", "simpleicons-report.json"), JSON.stringify(results, null, 2))
console.log("ok:", results.ok.length, "failed:", results.failed.length, "legacy:", results.legacy_used.length)
console.log(JSON.stringify(results.failed, null, 2))
