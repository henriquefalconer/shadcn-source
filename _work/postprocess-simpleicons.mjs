// Two output flavors, matching the two URL shapes used in the registry:
//  - /slug/000/fff  (marquee-logos.tsx)   -> recolor to black-on-white / white-on-black via CSS,
//    matching the convention already used by the pre-existing facebook_000_fff.svg asset.
//  - /slug/slug     (icon-cloud-demo.tsx) -> plain brand-color icon (the upstream CDN's own
//    color-param parsing would reject "slug" as a hex color and fall back to default anyway).
import fs from "node:fs"
import path from "node:path"

const ARCHIVE = path.resolve(import.meta.dirname, "..")

const DIR = path.join(ARCHIVE, "assets/cdn.simpleicons.org")

const MARQUEE_SLUGS = ["microsoft", "apple", "google", "linkedin", "twitter"]
const CLOUD_SLUGS = [
  "typescript", "javascript", "dart", "java", "react", "flutter", "android",
  "html5", "css3", "nodedotjs", "express", "nextdotjs", "prisma", "amazonaws",
  "postgresql", "firebase", "nginx", "vercel", "testinglibrary", "jest",
  "cypress", "docker", "git", "jira", "github", "gitlab", "visualstudiocode",
  "androidstudio", "sonarqube", "figma",
]

const STYLE = `<style>path{fill:#000} @media (prefers-color-scheme:dark){path{fill:#fff}}</style>`

for (const slug of MARQUEE_SLUGS) {
  const src = fs.readFileSync(path.join(DIR, `${slug}.svg`), "utf8")
  const withStyle = /<title>/.test(src)
    ? src.replace(/(<title>[^<]*<\/title>)/, `$1${STYLE}`)
    : src.replace(/(<svg[^>]*>)/, `$1${STYLE}`)
  fs.writeFileSync(path.join(DIR, `${slug}_000_fff.svg`), withStyle)
}

// Cloud icons keep their plain filenames (already written by fetch-simpleicons.mjs).
for (const slug of CLOUD_SLUGS) {
  if (!fs.existsSync(path.join(DIR, `${slug}.svg`))) throw new Error(`missing ${slug}`)
}

console.log("done")
