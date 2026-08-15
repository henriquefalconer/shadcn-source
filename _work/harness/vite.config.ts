import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

// This file is installed at <archive>/_verify/vite.config.ts and executed from
// there, so the archive root is its parent. SHADCN_ARCHIVE overrides if needed.
const ARCHIVE = process.env.SHADCN_ARCHIVE ?? path.resolve(import.meta.dirname, "..")
const R = (...p: string[]) => path.join(ARCHIVE, "registry", ...p)

export default defineConfig({
  // Root is the archive itself so import.meta.glob("/registry/**") resolves,
  // and /assets/** (vendored images + fonts) is served statically.
  root: ARCHIVE,
  publicDir: false,
  cacheDir: path.join(ARCHIVE, "_verify", ".vite"),
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5199,
    strictPort: true,
    fs: { allow: [ARCHIVE] },
    watch: { ignored: ["**/_work/**", "**/upstream/**", "**/.pnpm-store/**"] },
  },
  resolve: {
    // Order matters: longest/most-specific prefix first.
    alias: [
      { find: "@/app/(create)/components/icon-placeholder", replacement: path.join(ARCHIVE, "_verify/src/shims/icon-placeholder.tsx") },
      { find: "@/components/animate-ui", replacement: R("animate-ui", "registry") },
      { find: "@/components/ai-elements", replacement: R("ai-elements", "registry/default/ai-elements") },
      { find: "@/registry/magicui", replacement: R("magicui", "registry/magicui") },
      { find: "@/registry/example", replacement: R("magicui", "registry/example") },
      { find: "@/registry/default", replacement: R("ai-elements", "registry/default") },
      // shadcn: after flatten, `@/registry/<style>/ui/x` -> registry/shadcn/<style>/ui/x
      { find: "@/registry", replacement: R("shadcn") },
      { find: "@/components/ui", replacement: R("shadcn", "new-york-v4/ui") },
      { find: "@/hooks", replacement: path.join(ARCHIVE, "_verify/src/hooks") },
      { find: "@/lib", replacement: path.join(ARCHIVE, "_verify/src/lib") },
      { find: "@", replacement: path.join(ARCHIVE, "_verify/src") },
    ],
  },
  optimizeDeps: {
    // Prebundling reaches the network on a cache miss; the store is already local,
    // but keep the set explicit so an offline cold start is deterministic.
    include: ["react", "react-dom", "react/jsx-runtime"],
  },
  define: { "process.env.NODE_ENV": '"development"' },
})
