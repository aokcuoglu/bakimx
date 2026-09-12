import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const out = "artifacts/issue-635/attio";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    await page.goto("http://localhost:3100");
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    await page.screenshot({ path: `${out}/hero-${width}.png` });
    await page
      .locator("#ozellikler")
      .screenshot({ path: `${out}/product-${width}.png` });
    await page.screenshot({ path: `${out}/full-${width}.png`, fullPage: true });
    await page.close();
  }
} finally {
  await browser.close();
}
