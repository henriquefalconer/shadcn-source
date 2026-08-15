import { chromium } from "playwright"
const files = [
  "/registry/magicui/registry/example/marquee-logos.tsx",
  "/registry/magicui/registry/example/icon-cloud-demo.tsx",
  "/registry/magicui/registry/example/blur-fade-demo.tsx",
  "/registry/magicui/registry/example/dotted-map-demo.tsx",
  "/registry/ai-elements/registry/default/ai-elements/examples/model-selector.tsx",
  "/registry/ai-elements/registry/default/examples/model-selector.tsx",
  "/registry/ai-elements/registry/default/examples/demo-grok.tsx",
  "/registry/ai-elements/registry/default/examples/prompt-input-cursor.tsx",
  "/registry/ai-elements/registry/default/examples/prompt-input.tsx",
  "/registry/ai-elements/registry/default/examples/queue-prompt-input.tsx",
  "/registry/ai-elements/registry/default/ai-elements/persona.tsx",
  "/registry/react-bits/GridScan/GridScan.tsx",
  "/registry/react-bits/GridScan/GridScan.jsx",
  "/registry/react-bits/ModelViewer/ModelViewer.tsx",
  "/registry/react-bits/ModelViewer/ModelViewer.jsx",
  "/registry/magicui/registry/example/backlight-video-demo.tsx",
]
const b = await chromium.launch({ args: ["--host-resolver-rules=MAP * ~NOTFOUND EXCLUDE 127.0.0.1","--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"] })
const p = await b.newPage()
for (const f of files) {
  const errs=[], ext=[]
  const onConsole = m => m.type()==="error" && errs.push(m.text().slice(0,200))
  const onPageErr = e => errs.push("PAGEERR "+String(e.message).slice(0,200))
  const onReq = r => !/^(http:\/\/127\.0\.0\.1|data:|blob:|about:)/.test(r.url()) && ext.push(r.url().slice(0,120))
  p.on("console", onConsole)
  p.on("pageerror", onPageErr)
  p.on("request", onReq)
  try {
    await p.goto(`http://127.0.0.1:5199/?file=${encodeURIComponent(f)}`, {waitUntil:"domcontentloaded", timeout:40000})
    await p.waitForFunction("window.__DONE__===true", null, {timeout:40000})
    const r = await p.evaluate(()=>window.__RESULT__)
    console.log(`\n${f}\n  fatal=${r.fatal}  exports=${r.exports.filter(e=>e.status!=="not-component").map(e=>e.name+":"+e.status).join(", ")||"(none)"}`)
  } catch(e){ console.log(`\n${f}\n  RUNNER FAIL: ${String(e.message).slice(0,200)}`) }
  console.log(`  consoleErrors=${errs.length} ${errs.slice(0,3).join(" | ")}`)
  console.log(`  external=${ext.length} ${ext.join(", ")}`)
  p.removeListener("console", onConsole)
  p.removeListener("pageerror", onPageErr)
  p.removeListener("request", onReq)
}
await b.close()
