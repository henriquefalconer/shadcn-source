import { chromium } from "playwright"
const f = "/registry/ai-elements/registry/default/ai-elements/persona.tsx"
const b = await chromium.launch({ args: [
  "--host-resolver-rules=MAP * ~NOTFOUND EXCLUDE 127.0.0.1",
  "--use-gl=swiftshader",
  "--enable-unsafe-swiftshader",
  "--no-sandbox",
  "--disable-dev-shm-usage",
] })
const p = await b.newPage()
p.on("console", m => console.log("CONSOLE", m.type(), m.text().slice(0,300)))
p.on("pageerror", e => console.log("PAGEERR", String(e.message).slice(0,300)))
p.on("request", r => console.log("REQ", r.url().slice(0,140)))
p.on("requestfailed", r => console.log("REQFAIL", r.url().slice(0,140), r.failure()?.errorText))
p.on("response", r => { if(r.status()>=400) console.log("RESP", r.status(), r.url().slice(0,140)) })
try {
  await p.goto(`http://127.0.0.1:5199/?file=${encodeURIComponent(f)}`, {waitUntil:"domcontentloaded", timeout:40000})
  await p.waitForFunction("window.__DONE__===true", null, {timeout:60000})
  const r = await p.evaluate(()=>window.__RESULT__)
  console.log("RESULT", JSON.stringify(r).slice(0,500))
} catch(e){ console.log("RUNNER FAIL:", String(e.message).slice(0,400)) }
await b.close()
