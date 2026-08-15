// Collapse the redundant nesting produced by extraction so the tree is browsable
// and so a SINGLE vite alias can resolve every upstream import.
//
//   registry/shadcn/<style>/registry/<style>/ui/button.tsx  ->  registry/shadcn/<style>/ui/button.tsx
//
// After this, `@/registry` -> registry/shadcn resolves `@/registry/base-vega/ui/button`
// exactly as upstream intends, for all 26 styles at once.
import fs from "node:fs"
import path from "node:path"

const DEST = path.resolve(import.meta.dirname, "..")
const SH = path.join(DEST, "registry", "shadcn")

let moved = 0,
  collisions = []

for (const style of fs.readdirSync(SH)) {
  const styleDir = path.join(SH, style)
  if (!fs.statSync(styleDir).isDirectory()) continue
  const nested = path.join(styleDir, "registry", style)
  if (!fs.existsSync(nested)) continue

  const move = (from, to) => {
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const src = path.join(from, e.name)
      const dst = path.join(to, e.name)
      if (e.isDirectory()) {
        fs.mkdirSync(dst, { recursive: true })
        move(src, dst)
      } else {
        if (fs.existsSync(dst)) {
          const a = fs.readFileSync(src)
          const b = fs.readFileSync(dst)
          if (!a.equals(b)) collisions.push(path.relative(DEST, dst))
          fs.rmSync(src)
        } else {
          fs.renameSync(src, dst)
          moved++
        }
      }
    }
  }
  move(nested, styleDir)
  fs.rmSync(path.join(styleDir, "registry"), { recursive: true, force: true })
}

console.log(`flattened: ${moved} files moved`)
console.log(`content collisions (differing files at same path): ${collisions.length}`)
if (collisions.length) console.log(collisions.slice(0, 20).join("\n"))
console.log("\nresulting style dirs:")
for (const s of fs.readdirSync(SH).slice(0, 3))
  console.log(" ", s, "->", fs.readdirSync(path.join(SH, s)).join(" "))
