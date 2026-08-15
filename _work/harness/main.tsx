import React from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./globals.css"

// Surface unhandled rejections to the runner (they are otherwise invisible to
// console listeners and would let a broken component pass C5 silently).
window.addEventListener("unhandledrejection", (e) => {
  console.error(`unhandledrejection: ${e.reason?.message || String(e.reason)}`)
})

createRoot(document.getElementById("root")!).render(<App />)
