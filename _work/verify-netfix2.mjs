import { chromium } from "playwright"
const files = [
  "/registry/ai-elements/registry/default/ai-elements/persona.tsx",
  "/registry/react-bits/GridScan/GridScan.tsx",
  "/registry/react-bits/GridScan/GridScan.jsx",
  "/registry/react-bits/ModelViewer/ModelViewer.tsx",
  "/registry/react-bits/ModelViewer/ModelViewer.jsx",
  "/registry/magicui/registry/example/backlight-video-demo.tsx",
]
for (const f of files) {
  const b = await chromium.launch({ args: [
    "--host-resolver-rules=MAP * ~NOTFOUND EXCLUDE 127.0.0.1",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu-sandbox",
  ] })
  const p = await b.newPage()
  const errs=[], ext=[]
  p.on("console", m => m.type()==="error" && errs.push(m.text().slice(0,200)))
  p.on("pageerror", e => errs.push("PAGEERR "+String(e.message).slice(0,200)))
  p.on("request", r => !/^(http:\/\/127\.0\.0\.1|data:|blob:|about:)/.test(r.url()) && ext.push(r.url().slice(0,140)))
  try {
    await p.goto(`http://127.0.0.1:5199/?file=${encodeURIComponent(f)}`, {waitUntil:"domcontentloaded", timeout:40000})
    await p.waitForFunction("window.__DONE__===true", null, {timeout:40000})
    const r = await p.evaluate(()=>window.__RESULT__)
    console.log(`\n${f}\n  fatal=${r.fatal}  exports=${r.exports.filter(e=>e.status!=="not-component").map(e=>e.name+":"+e.status).join(", ")||"(none)"}`)
  } catch(e){ console.log(`\n${f}\n  RUNNER FAIL: ${String(e.message).slice(0,300)}`) }
  console.log(`  consoleErrors=${errs.length} ${errs.slice(0,4).join(" | ")}`)
  console.log(`  external=${ext.length} ${ext.join(", ")}`)
  await b.close()
}
