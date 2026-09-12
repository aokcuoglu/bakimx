const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://localhost:3100");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `artifacts/issue-635/after-${width}.png`,
    fullPage: true,
  });
  await page.screenshot({ path: `artifacts/issue-635/hero-${width}.png` });
  for (const selector of ["#hero", "#ozellikler"]) {
    for (const [index, tab] of (
      await page.locator(selector).getByRole("tab").all()
    ).entries()) {
      await tab.click();
      await page.locator(selector).screenshot({
        path: `artifacts/issue-635/${selector.slice(1)}-${index}-${width}.png`,
      });
    }
  }
}
await browser.close();
