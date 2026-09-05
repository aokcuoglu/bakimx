import { expect, test } from "@playwright/test";

for (const width of [360, 1440]) {
  test(`registration photo and demo results agree at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#ruhsat-demo");
    const section = page.locator("#ruhsat-demo");
    const photo = section.locator("img");
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await section.getByRole("button", { name: "Örnek ruhsatı okut" }).click();
    for (const value of ["34 LKN 123", "HONDA", "PCX 125", "2024", "Benzin", "RLHJK05A8RY123456"]) {
      await expect(section.getByText(value, { exact: true })).toBeVisible();
    }
    for (const value of ["JK05", "L3", "JF81E-1234567", "125 cm³", "9.2 kW", "118 kg", "268 kg", "0.078 kW/kg", "20240515123456789012", "e13*168/2013*00127*00"]) {
      await expect(section.getByText(value, { exact: true })).toBeVisible();
    }
    await expect(section.locator("dt")).toHaveCount(26);
    await expect(section.locator("dd")).toHaveCount(26);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(section.getByText("Şase eşleşti — araca uygun parçalar")).toHaveCount(0);
    await section.getByRole("button", { name: "Yeniden oynat" }).click();
    await expect(section.getByRole("button", { name: "Örnek ruhsatı okut" })).toBeVisible();
    await expect(section.getByText("PCX 125", { exact: true })).toHaveCount(0);
  });
}
