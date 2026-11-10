/**
 * Landing mock app turunu GIF olarak kaydeder.
 *
 *   bun run scripts/record-mock-app-gif.mjs
 *
 * Önkoşul: `bun run dev` (localhost:3001)
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { GIFEncoder, quantize, applyPalette } from "gifenc";

const BASE = process.env.MEASURE_BASE_URL || "http://localhost:3001";
const OUT = join(process.cwd(), "public/landing/screens/mock-app-tour.gif");
const FRAME_MS = 280;
const DURATION_MS = 10000;
const SCALE = 0.55;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 980, height: 700 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("#ozellikler").scrollIntoViewIfNeeded();
  await page.waitForSelector("[data-mock-app-demo]", { timeout: 15000 });
  await page.waitForTimeout(500);

  // Mac pencere çerçevesi + mock app (computer-use tarzı)
  const target = page.locator('[data-product-window="dashboard"]');
  const box = await target.boundingBox();
  if (!box) throw new Error("Dashboard penceresi bulunamadı");

  const frames = [];
  const started = Date.now();
  while (Date.now() - started < DURATION_MS) {
    const buf = await page.screenshot({
      type: "png",
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: box.width,
        height: box.height,
      },
    });
    frames.push(buf);
    await page.waitForTimeout(FRAME_MS);
  }

  await browser.close();

  // PNG → RGBA via sharp (project dependency)
  const sharp = (await import("sharp")).default;
  const rgbaFrames = [];
  let width = 0;
  let height = 0;
  for (const png of frames) {
    const img = sharp(png).ensureAlpha();
    const meta = await img.metadata();
    const resized = img.resize({
      width: Math.round((meta.width || 1) * SCALE),
      height: Math.round((meta.height || 1) * SCALE),
      fit: "inside",
    });
    const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true });
    width = info.width;
    height = info.height;
    rgbaFrames.push(data);
  }

  const gif = GIFEncoder();
  for (const data of rgbaFrames) {
    const palette = quantize(data, 48);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, width, height, {
      palette,
      delay: Math.round(FRAME_MS / 10), // gifenc delay in centiseconds
    });
  }
  gif.finish();

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, Buffer.from(gif.bytes()));
  console.log(`Wrote ${OUT} (${rgbaFrames.length} frames, ${width}x${height})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
