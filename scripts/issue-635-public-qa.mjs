import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "artifacts/issue-635/public-site";
mkdirSync(out, { recursive: true });
const routes = [
  ["Ana sayfa", "/", "home"],
  ["Oto servis programı", "/oto-servis-programi", "service"],
  ["İş emri", "/is-emri-programi", "order"],
  ["Araç kabul", "/dijital-arac-kabul", "intake"],
  ["Karşılaştırma", "/karsilastir/defter-excel-oto-servis-programi", "compare"],
  ["Araç kabul rehberi", "/rehber/arac-kabul-formu", "guide-intake"],
  [
    "İş emri rehberi",
    "/rehber/oto-servis-is-emri-nasil-hazirlanir",
    "guide-order",
  ],
  ["Fiyatlar", "/fiyatlar", "pricing"],
  ["Demo", "/demo", "demo"],
  ["Gizlilik", "/privacy", "privacy"],
  ["Sistem durumu", "/status", "status"],
];
const browser = await chromium.launch();
try {
  for (const [title, route, slug] of routes) {
    const page = await browser.newPage({
      reducedMotion: "reduce",
      javaScriptEnabled: route === "/",
    });
    await page.goto(`http://localhost:3100${route}`);
    if (route === "/") {
      // Local dev navigation occasionally stalls before hydration.
      // Retry navigation for capture only; never capture a non-interactive modal.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page
            .locator("[data-public-ready=true]")
            .waitFor({ timeout: 5000 });
          break;
        } catch (error) {
          if (attempt === 2) throw error;
          console.log("Retrying dev hydration");
          await page.reload();
        }
      }
    }
    await page.evaluate(() => {
      for (const image of document.images) image.loading = "eager";
    });
    await page.waitForLoadState("networkidle");
    if (route === "/")
      await page.addStyleTag({
        content: "nextjs-portal { display: none !important; }",
      });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `${out}/${slug}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      if (route === "/") {
        await page
          .locator("#hero")
          .getByRole("button", { name: "Birlikte inceleyelim" })
          .click();
        await page.getByRole("dialog").waitFor();
        await page.screenshot({
          path: `${out}/modal-${width}.png`,
          animations: "disabled",
        });
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
      }
    }
    console.log(title);
    await page.close();
  }
} finally {
  await browser.close();
}
writeFileSync(
  `${out}/index.html`,
  `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BakımX — Public site tasarım karşılaştırması</title><style>body{margin:40px auto;padding:0 20px;max-width:1200px;font:16px system-ui;color:#17202d;background:#fafafa}h1{font-size:40px;letter-spacing:-2px}h2{margin-top:48px}a{color:#145dc0}section{display:grid;grid-template-columns:1fr 280px;gap:24px;align-items:start}img{width:100%;border:1px solid #ddd;border-radius:8px}figure{margin:0}figcaption{margin:12px 0} @media(max-width:700px){section{grid-template-columns:1fr}}</style><h1>BakımX · Attio tasarım denemesi</h1><p>12 Eylül 2026 · Masaüstü 1440×900 / Mobil 390×900. Tam sayfa görüntüleri. Hareket azaltma açık; alt sayfalarda sunucuda üretilen görünüm kaydedildi. Animasyonlar ve etkileşimler canlı önizlemede test edilir.</p><p><a href="http://localhost:3100">Canlı önizleme</a> · <a href="../index.html">İlk tasarımın önce/sonra görüntüleri</a> · <a href="../attio/index.html">Önceki Attio revizyonu</a></p><h2>Demo modalı</h2><section><img src="modal-1440.png" alt="Masaüstü demo modalı"><img src="modal-390.png" alt="Mobil demo modalı"></section>${routes.map(([title, route, slug]) => `<h2>${title}</h2><p><a href="http://localhost:3100${route}">Sayfayı aç</a></p><section><figure><a href="${slug}-1440.png"><img loading="lazy" src="${slug}-1440.png" alt="${title} masaüstü"></a><figcaption>1440 px</figcaption></figure><figure><a href="${slug}-390.png"><img loading="lazy" src="${slug}-390.png" alt="${title} mobil"></a><figcaption>390 px</figcaption></figure></section>`).join("")}</html>`,
);
