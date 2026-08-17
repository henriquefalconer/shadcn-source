#!/usr/bin/env node
// Shared machinery for stages 6 and 7.
//
// Both the bundle build and its validation need the same three things: the
// dependency set the registry declares, the shims that let browser-less
// imports resolve, and the esbuild invocation itself. Keeping them here means
// stage 7 can import them without stage 6's side effects -- importing a script
// that builds 27 bundles on load is not a library.
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { builtinModules } from "node:module"

export const BOOTSTRAP = path.resolve(import.meta.dirname)
export const ARCHIVE = path.resolve(BOOTSTRAP, "..")
export const REGISTRY = path.join(ARCHIVE, "registry")
export const DIST = path.join(ARCHIVE, "dist")

export function stylesWithUi() {
  const root = path.join(REGISTRY, "shadcn")
  if (!fs.existsSync(root)) return []
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, e.name, "ui")))
    .map((e) => e.name).sort()
}


// ---- dependencies ------------------------------------------------------------
export function declaredDependencies(indexPath) {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"))
  const names = new Set()
  for (const item of index.items) {
    if (item.registry !== "@shadcn") continue
    for (const dep of item.dependencies || []) {
      // "recharts@2.15.4" -> "recharts", "@radix-ui/react-slot" -> unchanged
      const at = dep.lastIndexOf("@")
      names.add(at > 0 ? dep.slice(0, at) : dep)
    }
  }
  return [...names].sort()
}



// ---- shared build pieces -------------------------------------------------------
// Resolve bare imports the browser cannot: React comes from the host page, the
// JSX runtime is reconstructed, and Next.js primitives that only the demos
// touch degrade to plain elements.
export function shimPlugin() {
  return {
    name: "shim",
    setup(b) {
      b.onResolve({ filter: /icon-placeholder$/ }, () => ({ path: "icon", namespace: "s" }))
      b.onResolve({ filter: /^next\// }, (a) => ({ path: a.path, namespace: "next" }))
      b.onLoad({ filter: /.*/, namespace: "next" }, (a) => {
        if (a.path === "next/font/google")
          return { loader: "js", contents: "module.exports=new Proxy({},{get:()=>()=>({className:'',variable:'',style:{}})})" }
        if (a.path === "next/image")
          return {
            loader: "js",
            contents:
              "var R=window.React;module.exports={__esModule:true,default:function(p){var q=Object.assign({},p);delete q.priority;delete q.fill;return R.createElement('img',q)}}",
          }
        return {
          loader: "js",
          contents:
            "var R=window.React;module.exports={__esModule:true,default:function(p){var q=Object.assign({},p);q.href=p.href||'#';return R.createElement('a',q,p.children)}}",
        }
      })
      b.onResolve({ filter: /^react\/jsx-(dev-)?runtime$/ }, () => ({ path: "jsx", namespace: "s" }))
      b.onResolve({ filter: /^react$/ }, () => ({ path: "react", namespace: "s" }))
      b.onResolve({ filter: /^react-dom(\/client)?$/ }, () => ({ path: "react-dom", namespace: "s" }))
      b.onLoad({ filter: /.*/, namespace: "s" }, (a) => {
        if (a.path === "icon") return { loader: "js", contents: ICON_PLACEHOLDER }
        if (a.path === "react") return { loader: "js", contents: "module.exports=window.React" }
        if (a.path === "react-dom") return { loader: "js", contents: "module.exports=window.ReactDOM" }
        return {
          loader: "js",
          contents: `var R=window.React;
            function jsx(t,p,k){var o={},c;for(var x in p){if(x==="children"){c=p[x]}else{o[x]=p[x]}}
            if(k!==undefined)o.key=k;return c===undefined?R.createElement(t,o):R.createElement(t,o,c)}
            exports.jsx=jsx;exports.jsxs=jsx;exports.jsxDEV=jsx;exports.Fragment=R.Fragment;`,
        }
      })
    },
  }
}

// `@/registry/<style>` is mapped for EVERY style, not just the one being
// built: the `default` style imports `@/registry/new-york/ui/button`, so a
// per-style alias alone leaves it unresolvable.
export function aliasFor(styleDir, allStyles) {
  const root = path.dirname(styleDir)
  const alias = {
    "@/lib/utils": path.join(styleDir, "lib/utils.ts"),
    "@/lib": path.join(styleDir, "lib"),
    "@/hooks": path.join(styleDir, "hooks"),
  }
  for (const s of allStyles) alias[`@/registry/${s}`] = path.join(root, s)
  return alias
}

// The 24 modern styles import IconPlaceholder from `@/app/(create)/...`, a
// shadcn.com site-internal module that is not part of the registry and so is
// not in the archive. It is a placeholder glyph in the create flow; a neutral
// square keeps the component tree intact and renders nothing surprising.
export const ICON_PLACEHOLDER = `var R=window.React;
exports.IconPlaceholder=function(p){
  return R.createElement("span",Object.assign({"data-slot":"icon-placeholder",
    "aria-hidden":"true",style:{display:"inline-block",width:"1em",height:"1em",
    borderRadius:"2px",background:"currentColor",opacity:.25}},p));
};`

// Self-installing stylesheet, so the consumer copies one file rather than two.
export function cssBanner(cssPath) {
  if (!fs.existsSync(cssPath)) return ""
  const css = fs.readFileSync(cssPath, "utf8")
  return `(function(){if(typeof document==="undefined"||document.getElementById("shadcn-ui-css"))return;
var s=document.createElement("style");s.id="shadcn-ui-css";s.textContent=${JSON.stringify(css)};
(document.head||document.documentElement).appendChild(s);})();`
}

export async function bundle({ esbuild, entryContents, entryDir, styleDir, outfile, globalName, css, allStyles }) {
  const entry = path.join(entryDir, `entry-${globalName}.ts`)
  fs.writeFileSync(entry, entryContents)
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    globalName,
    outfile,
    minify: true,
    logLevel: "silent",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    absWorkingDir: BOOTSTRAP,
    nodePaths: [path.join(BOOTSTRAP, "node_modules")],
    alias: aliasFor(styleDir, allStyles),
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: "var React=window.React,ReactDOM=window.ReactDOM;" + (css ? cssBanner(css) : "") },
    plugins: [shimPlugin()],
  })
  return fs.statSync(outfile).size
}

// package "fs", and "fs" IS published on npm by a third party -- so a missing
// builtin would otherwise npm-install a stranger's code.
const BUILTINS = new Set(builtinModules)

export function npmPackageName(spec) {
  if (!spec) return null
  if (spec.startsWith(".") || spec.startsWith("/")) return null
  if (spec.startsWith("@/") || spec.startsWith("#")) return null // path alias / subpath import
  if (spec.startsWith("node:")) return null
  if (BUILTINS.has(spec.split("/")[0])) return null
  const parts = spec.split("/")
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
}

export function unresolvedPackages(errors) {
  const out = new Set()
  for (const e of errors || []) {
    const m = /Could not resolve "([^"]+)"/.exec(e.text || "")
    const name = m && npmPackageName(m[1])
    if (name) out.add(name)
  }
  return [...out]
}

// Confirm the derived name is actually a published package before handing it
// to npm. One registry request each, only on the repair path. A 404 means the
// archive references something unpublishable -- report it, do not install
// whatever else happens to own that name.
export async function existsOnNpm(name) {
  try {
    const r = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`, { method: "HEAD" })
    return r.status === 200
  } catch {
    return false
  }
}

// ---- trust gate ----------------------------------------------------------------
// When esbuild reports an unresolved bare import, the question is not "is this
// package popular?" but "did something we already trust ask for it?".
//
// Popularity is not a usable gate. The squatted `fs` package takes ~1.4M
// downloads a week -- more than left-pad -- so any threshold permissive enough
// for a niche but legitimate peer also lets `fs` through. Download counts
// measure traffic, including mistakes and mirrors, not legitimacy.
//
// Provenance is deterministic instead. Everything in node_modules got there
// because INDEX.json declared it, or because npm pulled it in transitively. If
// one of those manifests names the missing package in its own dependency
// fields, we have an unbroken chain from the registry's own declaration to
// this install, plus the exact range the requiring package wants.
//
// Nothing outside that chain is installed. An import no installed manifest
// asks for is reported as a gap, never fetched.
const DEP_FIELDS = ["dependencies", "peerDependencies", "optionalDependencies"]

export function resolveFromTree(name, nodeModules = path.join(BOOTSTRAP, "node_modules")) {
  if (!fs.existsSync(nodeModules)) return null
  const found = []
  const visit = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue
      if (e.name.startsWith("@")) {
        visit(path.join(dir, e.name))
        continue
      }
      const pj = path.join(dir, e.name, "package.json")
      if (!fs.existsSync(pj)) continue
      try {
        const manifest = JSON.parse(fs.readFileSync(pj, "utf8"))
        for (const field of DEP_FIELDS) {
          const range = manifest[field]?.[name]
          if (range) found.push({ by: `${manifest.name}@${manifest.version}`, field, range })
        }
      } catch {
        /* unreadable manifest is not a vote */
      }
    }
  }
  visit(nodeModules)
  if (!found.length) return null
  // Prefer a hard dependency over a peer when both exist.
  found.sort((a, b) => DEP_FIELDS.indexOf(a.field) - DEP_FIELDS.indexOf(b.field))
  return found[0]
}

// Context for the report only -- never a gate. See the note above.
export async function weeklyDownloads(name) {
  try {
    const r = await fetch(`https://api.npmjs.org/downloads/point/last-week/${name.replace("/", "%2F")}`)
    if (!r.ok) return null
    return (await r.json()).downloads ?? null
  } catch {
    return null
  }
}
