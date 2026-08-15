// C5 harness. One route per source file (?file=<repo-relative path>).
// Dynamically imports the module, introspects EVERY export, and renders each
// component export with no props inside an isolated error boundary.
// Runtime introspection is ground truth - no static regex guessing.
import React from "react"

const modules = import.meta.glob("/registry/**/*.{tsx,jsx}")

type Status = "ok" | "error" | "not-component"
type ExportResult = { name: string; status: Status; error?: string }

class Boundary extends React.Component<
  { onError: (e: Error) => void; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(e: Error) {
    this.props.onError(e)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

// A React component is a function, or an object carrying a React $$typeof
// (memo / forwardRef / lazy). Anything else is data and is not rendered.
function isComponent(v: unknown): boolean {
  if (typeof v === "function") return true
  if (v && typeof v === "object" && "$$typeof" in (v as object)) {
    const t = String((v as { $$typeof: symbol }).$$typeof)
    return /memo|forward_ref|lazy/i.test(t)
  }
  return false
}

declare global {
  interface Window {
    __RESULT__?: unknown
    __DONE__?: boolean
  }
}

export default function App() {
  const file = new URLSearchParams(location.search).get("file") || ""
  const [results, setResults] = React.useState<ExportResult[] | null>(null)
  const [fatal, setFatal] = React.useState<string | null>(null)
  const [mod, setMod] = React.useState<Record<string, unknown> | null>(null)

  React.useEffect(() => {
    const loader = modules[file]
    if (!loader) {
      setFatal(`no such module in glob: ${file}`)
      return
    }
    loader()
      .then((m) => setMod(m as Record<string, unknown>))
      .catch((e) => setFatal(`import failed: ${e?.message || String(e)}`))
  }, [file])

  React.useEffect(() => {
    if (fatal) {
      window.__RESULT__ = { file, fatal, exports: [] }
      window.__DONE__ = true
    }
  }, [fatal, file])

  const errors = React.useRef(new Map<string, string>())

  React.useEffect(() => {
    if (!mod) return
    // Let the tree paint + effects settle before declaring the verdict.
    const t = setTimeout(() => {
      const out: ExportResult[] = Object.keys(mod).map((name) => {
        if (!isComponent(mod[name])) return { name, status: "not-component" }
        const err = errors.current.get(name)
        return err ? { name, status: "error", error: err } : { name, status: "ok" }
      })
      setResults(out)
      window.__RESULT__ = { file, fatal: null, exports: out }
      window.__DONE__ = true
    }, 350)
    return () => clearTimeout(t)
  }, [mod, file])

  if (fatal) return <pre data-testid="fatal">{fatal}</pre>
  if (!mod) return <div data-testid="loading">loading</div>

  return (
    <div data-testid="harness">
      {Object.entries(mod).map(([name, value]) => {
        if (!isComponent(value)) return null
        const C = value as React.ComponentType
        return (
          <div key={name} data-export={name} style={{ padding: 8 }}>
            <Boundary onError={(e) => errors.current.set(name, e.message)}>
              <React.Suspense fallback={null}>
                <C />
              </React.Suspense>
            </Boundary>
          </div>
        )
      })}
      {results && <script data-testid="done" />}
    </div>
  )
}
