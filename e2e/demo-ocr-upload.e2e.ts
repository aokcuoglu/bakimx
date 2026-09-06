import { expect, test, type Page } from "@playwright/test";

async function mockTurnstile(page: Page) {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js**", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `(() => {
        const widgets = new Map(); let sequence = 0;
        window.turnstile = {
          render(element, options) {
            const id = String(++sequence);
            widgets.set(id, { element, options });
            element.textContent = "Güvenlik doğrulandı";
            queueMicrotask(() => options.callback("e2e-turnstile-token"));
            return id;
          },
          reset(id) { const w = widgets.get(id); if (w) queueMicrotask(() => w.options.callback("e2e-turnstile-token")); },
          remove(id) { const w = widgets.get(id); if (w) w.element.textContent = ""; widgets.delete(id); },
        };
      })();`,
    });
  });
}

async function openUpload(page: Page) {
  await page.goto("/#ruhsat-demo");
  await page.getByRole("tab", { name: "Kendi ruhsatını dene", exact: true }).click();
}

test("visitor uploads their registration once and sees the used state on return", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await mockTurnstile(page);
  let used = false;
  let scans = 0;
  await page.route("**/api/demo-ocr", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: used ? { status: "used", message: "Ücretsiz deneme hakkınızı kullandınız." } : { status: "ready", siteKey: "test-site-key" } });
    }
    scans++;
    expect(route.request().headers()["content-type"]).toContain("multipart/form-data");
    const body = route.request().postDataBuffer()!.toString("latin1");
    expect(body).toContain('name="image"');
    expect(body).toContain('name="consent"');
    expect(body).toContain("e2e-turnstile-token");
    used = true;
    return route.fulfill({ json: { success: true, fields: [
      { key: "plate", label: "Plaka", code: "A", value: "06 TEST 06" },
      { key: "brand", label: "Marka", code: "D.1", value: "TEST MARKA" },
      { key: "vin", label: "Şase no", code: "E", value: "OKUNAN-SASE", confidence: 0.5 },
    ] } });
  });
  await openUpload(page);
  await page.locator('#ruhsat-demo input[type="file"]').setInputFiles("public/landing/ruhsat-demo.png");
  await page.locator("#ruhsat-demo").getByRole("checkbox").check();
  await page.locator("#ruhsat-demo").getByRole("button", { name: "Ruhsatımı oku", exact: true }).click();
  await expect(page.getByText("06 TEST 06", { exact: true })).toBeVisible();
  await expect(page.getByText("TEST MARKA", { exact: true })).toBeVisible();
  await expect(page.getByText("34 LKN 123", { exact: true })).toHaveCount(0);
  expect(scans).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.reload();
  await page.getByRole("tab", { name: "Kendi ruhsatını dene", exact: true }).click();
  await expect(page.getByText("Ücretsiz deneme hakkınızı kullandınız.", { exact: true })).toBeVisible();
  await expect(page.locator('#ruhsat-demo input[type="file"]')).toHaveCount(0);
  expect(scans).toBe(1);
});

test("unsuccessful OCR lets the visitor retry without showing sample results", async ({ page }) => {
  await mockTurnstile(page);
  let scans = 0;
  await page.route("**/api/demo-ocr", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { status: "ready", siteKey: "test-site-key" } });
    scans++;
    if (scans === 1) return route.fulfill({ status: 422, json: { success: false, code: "ocr_failed", error: "Ruhsat okunamadı. Daha net bir fotoğrafla yeniden deneyin." } });
    return route.fulfill({ json: { success: true, fields: [{ key: "plate", label: "Plaka", code: "A", value: "35 TEST 35" }] } });
  });
  await openUpload(page);
  const section = page.locator("#ruhsat-demo");
  await section.locator('input[type="file"]').setInputFiles("public/landing/ruhsat-demo.png");
  await section.getByRole("checkbox").check();
  await section.getByRole("button", { name: "Ruhsatımı oku", exact: true }).click();
  await expect(section.getByRole("alert")).toContainText("Ruhsat okunamadı");
  await section.getByRole("button", { name: "Ruhsatımı oku", exact: true }).click();
  await expect(section.getByText("35 TEST 35", { exact: true })).toBeVisible();
  expect(scans).toBe(2);
});

test("unavailable and limited demos keep the sample accessible", async ({ page }) => {
  await page.route("**/api/demo-ocr", (route) => route.fulfill({ json: { status: "limited", message: "Bu bağlantının günlük deneme hakkı kullanıldı." } }));
  await openUpload(page);
  await expect(page.getByText("Bu bağlantının günlük deneme hakkı kullanıldı.", { exact: true })).toBeVisible();
  await expect(page.locator('#ruhsat-demo input[type="file"]')).toHaveCount(0);
  await page.getByRole("tab", { name: "Örnek ruhsat", exact: true }).click();
  await expect(page.getByRole("button", { name: "Örnek ruhsatı okut", exact: true })).toBeVisible();
});
