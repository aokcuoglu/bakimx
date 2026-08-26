/**
 * Landing ekran görüntülerini GÜNCEL UI'dan yeniden yakalar.
 *
 * Landing'deki uygulama görselleri (public/landing/screens/*.png) gerçek ürün
 * ekranlarından gelir; arayüz değiştiğinde bu script ile tazelenir. Eski
 * görüntülerle kalan sayfalar: / (FeatureShowcase), /is-emri-programi,
 * /oto-servis-programi, /rehber/*.
 *
 * Kullanım:
 *   1. `bun run dev:tunnel` ile server + AWS DEV DB tünelini aç
 *   2. Aşağıdaki ORDER_ID / SHARE_TOKEN'ı dev DB'deki uygun kayıtlarla güncelle
 *      (tenant: admin@bakimx.com'un atölyesi; sipariş non-draft, katalog-bağlı
 *      araçlı; paylaşım linki aktif)
 *   3. bun --env-file=.env.local scripts/capture-landing-screens.ts
 *
 * Çıktılar mevcut PNG'lerin ÜZERİNE yazılır; @2x çekilir, sips ile 1x'e
 * düşülür: `sips --resampleWidth 1440 <dosya>` (telefon için 390).
 *
 * NOT: Script yalnız OKUMA yapar; tek yazma işlemi, takip sayfası görüntüsü
 * için aktif PublicShareLink oluşturmaktır — çekimden sonra
 * `isActive: false` ile kapatın (iz bırakmamak için).
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

// NOT: dev-login yalnız request host'u localhost iken yanıt verir — 127.0.0.1 değil.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ORDER_ID = process.env.ORDER_ID ?? "cmt08wn1w001401ad4dd1rslc";
const SHARE_TOKEN = process.env.SHARE_TOKEN ?? "landing-shot-mt88o09u";
const OUT_DIR = path.resolve("public/landing/screens");

mkdirSync(OUT_DIR, { recursive: true });

// Next.js dev indicator'ı (sol alttaki "N" rozeti) gizle — prod'da yok.
// addInitScript: her navigasyonda yeniden enjekte edilir (addStyleTag goto ile silinir).
const HIDE_DEV_TOOLS = `
  const style = document.createElement("style");
  style.textContent = "nextjs-portal { display: none !important; }";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
`;

const browser = await chromium.launch();

// ── 1. İş emri detayı (browser frame, 1440×900) ─────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await ctx.addInitScript(HIDE_DEV_TOOLS);
  const page = await ctx.newPage();
  await page.goto(
    `${BASE}/api/auth/dev-login?email=admin@bakimx.com&redirect=${encodeURIComponent(`/orders/${ORDER_ID}`)}`,
  );
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  // Olası yükleme iskeletleri bitene kadar başlık bekle
  await page.getByText("Parça & İşçilik").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "order-detail.png") });
  console.log("order-detail.png ok");

  // ── 2. Parça kataloğu picker ───────────────────────────────────────────────
  // Sekmeler `?tab=` ile URL-driven — doğrudan parça sekmesine git
  await page.goto(`${BASE}/orders/${ORDER_ID}?tab=parca`);
  await page.waitForLoadState("networkidle");
  // Composer'daki 🔍 butonu plain varyantta searchTitle'ı aria-label alır:
  // bağlı araçta "Katalogdan seç", bağlı değilse "BakımX ürünlerinden seç".
  const trigger = page
    .getByRole("button", { name: /Katalogdan seç|BakımX ürünlerinden seç/ })
    .first();
  await trigger.waitFor({ state: "attached", timeout: 30_000 });
  await trigger.click({ timeout: 30_000 });

  // Picker diyaloğu: kök arama kutusuna yaz, kategoriye inip parça listesini göster
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 30_000 });
  const search = dialog.getByLabel("Kategori, parça, marka veya OEM numarası ara");
  await search.waitFor({ timeout: 30_000 });
  await search.fill("filtre");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  // Kategori sonuçlarından "Yağ filtresi"ne gir — parça satırları marka/sku ile listelenir
  const category = dialog.getByRole("button", { name: /^Yağ filtresi/ }).first();
  await category.click({ timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "parts-catalog.png") });
  console.log("parts-catalog.png ok");
  await ctx.close();
}

// ── 3. Müşteri takip sayfası (phone frame, 390×844) ─────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(HIDE_DEV_TOOLS);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/s/${SHARE_TOKEN}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "public-tracking.png") });
  console.log("public-tracking.png ok");
  await ctx.close();
}

await browser.close();
