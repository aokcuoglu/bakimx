import { expect, test } from "@playwright/test";

// The standalone public upload UI was retired. API safety remains covered by
// src/app/api/demo-ocr/route.test.ts; the home page must no longer invoke it.
test("home does not initialize the retired OCR upload and keeps the demo request available", async ({ page }) => {
  const calls: string[] = [];
  await page.route("**/api/demo-ocr", async (route) => {
    calls.push(route.request().method());
    await route.fulfill({ json: { status: "ready", siteKey: "test-site-key" } });
  });
  await page.goto("/#ruhsat-demo");
  await expect(page.locator("#hero")).toHaveAttribute("style", /--text/);
  await expect(page.locator('main input[type="file"]')).toHaveCount(0);
  await page.locator("#hero").getByRole("link", { name: "Sizi arayalım ›", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Sizi arayalım" })).toBeVisible();
  expect(calls).toEqual([]);
});
