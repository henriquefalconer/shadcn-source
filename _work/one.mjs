import { chromium } from "playwright"
const b = await chromium.launch({ args:["--host-resolver-rules=MAP * ~NOTFOUND EXCLUDE 127.0.0.1","--use-gl=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"] })
const p = await b.newPage()
const ext=[]; p.on("request", r => !/^(http:\/\/127\.0\.0\.1|data:|blob:|about:)/.test(r.url()) && ext.push(r.url()))
for (const f of process.argv.slice(2)) {
  try {
    await p.goto(`http://127.0.0.1:5199/?file=${encodeURIComponent(f)}`,{waitUntil:"domcontentloaded",timeout:40000})
    await p.waitForFunction("window.__DONE__===true",null,{timeout:40000})
    const r = await p.evaluate(()=>window.__RESULT__)
    console.log(`  ${r.fatal?"FAIL":"OK  "} ${f.split("/").pop()}  external=${ext.length}`)
  } catch(e){ console.log(`  ERR  ${f.split("/").pop()}: ${String(e.message).slice(0,80)}`) }
  ext.length=0
}
await b.close()
