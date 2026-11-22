import { expect, test } from "@playwright/test";

for (const width of [360, 1440]) {
  test(`retired standalone registration demo stays removed at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#ruhsat-demo");
    await expect(page.locator("#hero")).toHaveAttribute("style", /--text/);
    await expect(page.locator("#ruhsat-demo")).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Kendi ruhsatını dene" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Örnek ruhsatı okut" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}
