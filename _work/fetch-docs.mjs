import fs from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(import.meta.dirname, "docs");
const ORIGIN = "https://ui.shadcn.com";
const CONCURRENCY = 12;
const TIMEOUT_MS = 30000;
const RETRIES = 2;
const UA = "shadcn-docs-mirror/1.0 (offline archive bot; contact: henrique+anthropic@falconer.com.br)";

async function fetchWithRetry(url, opts = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": UA },
        ...opts,
      });
      clearTimeout(t);
      return res;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

async function getText(url) {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function extractUrls(text) {
  const re = /https:\/\/ui\.shadcn\.com\/[^\s")<>]*/g;
  const found = text.match(re) || [];
  return found.map((u) => u.replace(/[.,;]+$/, ""));
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // 1. Download llms.txt
  console.log("Fetching llms.txt...");
  const llmsTxt = await getText(`${ORIGIN}/llms.txt`);
  await fs.writeFile(path.join(OUT_DIR, "llms.txt"), llmsTxt, "utf8");
  const llmsUrls = extractUrls(llmsTxt);
  console.log(`llms.txt: ${llmsUrls.length} urls`);

  // 2. sitemap.xml (and possible index variants)
  console.log("Fetching sitemap.xml...");
  let sitemapUrls = [];
  try {
    const sitemapXml = await getText(`${ORIGIN}/sitemap.xml`);
    await fs.writeFile(path.join(OUT_DIR, "sitemap.xml"), sitemapXml, "utf8");
    sitemapUrls = extractUrls(sitemapXml);

    // check if it's a sitemap index pointing to sub-sitemaps
    const subSitemaps = [...sitemapXml.matchAll(/<loc>([^<]+\.xml)<\/loc>/g)].map((m) => m[1]);
    for (const subUrl of subSitemaps) {
      try {
        console.log(`Fetching sub-sitemap ${subUrl}...`);
        const subXml = await getText(subUrl);
        const fname = subUrl.split("/").pop();
        await fs.writeFile(path.join(OUT_DIR, fname), subXml, "utf8");
        sitemapUrls = sitemapUrls.concat(extractUrls(subXml));
      } catch (e) {
        console.log(`  failed sub-sitemap ${subUrl}: ${e.message}`);
      }
    }
  } catch (e) {
    console.log(`sitemap.xml failed: ${e.message}`);
  }
  // also try common variant name directly in case index didn't list it
  for (const variant of ["sitemap-0.xml"]) {
    if (!sitemapUrls.length || !sitemapUrls.some((u) => u.includes(variant))) {
      try {
        const url = `${ORIGIN}/${variant}`;
        const xml = await getText(url);
        await fs.writeFile(path.join(OUT_DIR, variant), xml, "utf8");
        sitemapUrls = sitemapUrls.concat(extractUrls(xml));
        console.log(`Fetched extra variant ${variant}`);
      } catch (e) {
        // ignore, likely 404
      }
    }
  }
  console.log(`sitemap: ${sitemapUrls.length} urls`);

  // 3. Union unique URLs
  const allSet = new Set([...llmsUrls, ...sitemapUrls]);
  // Filter to actual page urls (drop the .xml/.txt/asset-like things, keep http pages)
  const urls = [...allSet].filter((u) => {
    try {
      const p = new URL(u);
      if (p.hostname !== "ui.shadcn.com") return false;
      if (/\.(xml|txt|png|jpg|jpeg|svg|ico|json|css|js|webmanifest)$/i.test(p.pathname)) return false;
      return true;
    } catch {
      return false;
    }
  });
  urls.sort();
  console.log(`Total unique candidate page urls: ${urls.length}`);

  const results = {
    total_urls: urls.length,
    md_ok: 0,
    md_404_html_fallback: 0,
    failed: [],
    sources: { llms_txt_count: llmsUrls.length, sitemap_count: sitemapUrls.length },
  };

  let idx = 0;
  async function worker() {
    while (idx < urls.length) {
      const myIdx = idx++;
      const url = urls[myIdx];
      const u = new URL(url);
      const pathname = u.pathname === "/" ? "/index" : u.pathname.replace(/\/$/, "");
      const mdUrl = `${u.origin}${pathname}.md`;
      const outPath = path.join(OUT_DIR, pathname.replace(/^\//, "") + ".md");

      try {
        const res = await fetchWithRetry(mdUrl);
        if (res.ok) {
          const text = await res.text();
          await fs.mkdir(path.dirname(outPath), { recursive: true });
          await fs.writeFile(outPath, text, "utf8");
          results.md_ok++;
          console.log(`OK  ${mdUrl}`);
          continue;
        } else if (res.status === 404) {
          // fallback to html
          const htmlRes = await fetchWithRetry(url);
          if (htmlRes.ok) {
            const html = await htmlRes.text();
            const htmlOutPath = path.join(OUT_DIR, "_html", pathname.replace(/^\//, "") + ".html");
            await fs.mkdir(path.dirname(htmlOutPath), { recursive: true });
            await fs.writeFile(htmlOutPath, html, "utf8");
            results.md_404_html_fallback++;
            console.log(`FALLBACK ${url}`);
          } else {
            results.failed.push({ url, status: htmlRes.status });
            console.log(`FAIL ${url} status=${htmlRes.status}`);
          }
        } else {
          results.failed.push({ url: mdUrl, status: res.status });
          console.log(`FAIL ${mdUrl} status=${res.status}`);
        }
      } catch (e) {
        results.failed.push({ url: mdUrl, status: `ERROR: ${e.message}` });
        console.log(`ERROR ${mdUrl}: ${e.message}`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  await fs.writeFile(path.join(OUT_DIR, "_report.json"), JSON.stringify(results, null, 2), "utf8");
  console.log("DONE", JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
