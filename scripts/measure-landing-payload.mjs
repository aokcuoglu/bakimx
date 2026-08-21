// Landing/public route payload ölçümü (BAK-165).
// `next start` ayaktayken çalışır: sayfanın HTML'ini çeker, ilk yüklemede
// indirilen script/CSS varlıklarını toplar ve brotli/gzip transfer boyutunu ölçer.
import { gzipSync, brotliCompressSync } from "node:zlib";

const BASE = process.env.MEASURE_BASE_URL ?? "http://127.0.0.1:3000";
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : ["/"];

async function fetchAsset(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function collectAssets(html) {
  const urls = new Set();
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) urls.add(m[1]);
  for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)) urls.add(m[1]);
  return [...urls].filter((u) => u.startsWith("/_next/"));
}

const results = [];
for (const route of ROUTES) {
  const html = await (await fetch(BASE + route)).text();
  const assets = collectAssets(html);
  let js = 0, jsBr = 0, css = 0, cssBr = 0;
  const perAsset = [];
  for (const a of assets) {
    const buf = await fetchAsset(BASE + a);
    const br = brotliCompressSync(buf).length;
    if (a.endsWith(".css")) { css += buf.length; cssBr += br; }
    else { js += buf.length; jsBr += br; }
    perAsset.push({ asset: a, raw: buf.length, br });
  }
  const htmlBuf = Buffer.from(html);
  results.push({
    route,
    htmlRaw: htmlBuf.length,
    htmlGzip: gzipSync(htmlBuf).length,
    assetCount: assets.length,
    jsRaw: js, jsBr,
    cssRaw: css, cssBr,
    perAsset: perAsset.sort((a, b) => b.br - a.br),
  });
}

for (const r of results) {
  const kb = (n) => (n / 1024).toFixed(1) + " kB";
  console.log(`\n${r.route}`);
  console.log(`  HTML          ${kb(r.htmlRaw)} raw / ${kb(r.htmlGzip)} gzip`);
  console.log(`  JS  (${String(r.assetCount).padStart(2)} varlık) ${kb(r.jsRaw)} raw / ${kb(r.jsBr)} br`);
  console.log(`  CSS           ${kb(r.cssRaw)} raw / ${kb(r.cssBr)} br`);
  console.log(`  En ağır 6 chunk (br):`);
  for (const a of r.perAsset.slice(0, 6)) console.log(`    ${kb(a.br).padStart(9)}  ${a.asset}`);
}
console.log("\nJSON:", JSON.stringify(results.map(({ perAsset: _perAsset, ...r }) => r)));
