import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("editorial hero: responsive composition, accessibility, interactive product stage", async ({
  page,
  browser,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator("#ozellikler").scrollIntoViewIfNeeded();

  await expect(page.locator("[data-product-window]")).toHaveCount(4);
  await expect(page.locator('[data-product-window="dashboard"]')).toBeVisible();
  await expect(page.locator('[data-product-window="workflow"]')).toBeVisible();
  await expect(page.locator("[data-mock-app-demo]")).toBeVisible();
  await expect(page.locator("[data-mock-app-demo]")).toContainText("Genel Bakış");

  // Mac trafik ışıkları + sürükleme: workflow penceresini taşı
  const workflow = page.locator('[data-product-window="workflow"]');
  const before = await workflow.boundingBox();
  expect(before).toBeTruthy();
  const bar = workflow.locator('[class*="bar"]').first();
  const barBox = await bar.boundingBox();
  expect(barBox).toBeTruthy();
  await page.mouse.move(barBox!.x + barBox!.width / 2, barBox!.y + barBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(barBox!.x + barBox!.width / 2 - 60, barBox!.y + barBox!.height / 2 - 30, {
    steps: 6,
  });
  await page.mouse.up();
  const after = await workflow.boundingBox();
  expect(after).toBeTruthy();
  expect(Math.abs((after!.x - before!.x) + (after!.y - before!.y))).toBeGreaterThan(20);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => scrollTo(0, 0));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /İş emri 10 saniyede\s*Şaseden parça listesi\s*Her kayıt yerinde/,
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('#hero a[href="/register"]')).toBeVisible();
    await expect(page.locator("#hero").getByRole("button", { name: "Birlikte inceleyelim" })).toBeVisible();
    await expect(page.locator("[data-product-window]")).toHaveCount(4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    for (const win of await page.locator("[data-product-window]").all()) {
      await expect(win).toBeVisible();
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
    staticPage.locator('#hero a[href="/register"]'),
  ).toBeVisible();
  await expect(
    staticPage.locator('[data-product-window="dashboard"]'),
  ).toBeVisible();
  await noJs.close();
});
