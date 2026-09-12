import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("editorial hero: responsive composition, accessibility, scroll motion and server content", async ({
  page,
  browser,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => scrollTo(0, 0));
  const window = page.locator('[data-product-window="parts"]');
  await expect
    .poll(() => window.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe("none");
  const before = await window.evaluate((el) => getComputedStyle(el).transform);
  await page.evaluate(() => scrollTo(0, 700));
  await expect
    .poll(() => window.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe(before);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => scrollTo(0, 0));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Servisiniz büyüsün.\s*Kontrol sizde kalsın./,
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('#hero a[href="/fiyatlar#lite"]')).toBeVisible();
    await expect(page.locator("#hero").getByRole("button", { name: "Birlikte inceleyelim" })).toBeVisible();
    await expect(page.locator("[data-product-window]")).toHaveCount(3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    for (const window of await page.locator("[data-product-window]").all()) {
      await expect(window).toBeVisible();
      expect(
        await window.evaluate((el) => getComputedStyle(el).transform),
      ).toBe("none");
    }
    const results = await new AxeBuilder({ page })
      .include("#hero")
      .include("#ozellikler")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations, `${width}px accessibility`).toEqual([]);
  }
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJs.newPage();
  await staticPage.goto(
    "http://localhost:" + (process.env.PLAYWRIGHT_PORT || "3000") + "/",
  );
  await expect(staticPage.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    staticPage.locator('#hero a[href="/fiyatlar#lite"]'),
  ).toBeVisible();
  await expect(
    staticPage.locator('[data-product-window="dashboard"]'),
  ).toBeVisible();
  await noJs.close();
});
