import { expect, test } from "@playwright/test";

const carouselName = "BakımX servis yönetimi özellikleri";

test("landing hero uses a full-bleed background with keyboard-operable controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const carousel = page.getByRole("region", { name: carouselName });
  const heading = page.getByRole("heading", {
    level: 1,
    name: /Oto servisinizde iş emri açmak/,
  });
  const activeSlide = carousel.locator('[aria-hidden="false"]');

  await expect(carousel).toBeVisible();
  await expect(heading).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  const [carouselBox, imageBox] = await Promise.all([
    carousel.boundingBox(),
    activeSlide.locator("img").boundingBox(),
  ]);
  expect(carouselBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(imageBox!.x).toBeLessThanOrEqual(carouselBox!.x + 1);
  expect(imageBox!.width).toBeGreaterThanOrEqual(carouselBox!.width - 2);
  await expect(
    page.getByRole("button", {
      name: "Carousel otomatik geçişini duraklat",
    }),
  ).toBeVisible();

  const next = page.getByRole("button", { name: "Sonraki slayt" });
  await expect(next).toBeEnabled();
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: /2\. slayta git/ }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page.getByRole("button", {
      name: "Carousel otomatik geçişini başlat",
    }),
  ).toBeVisible();
});

test("landing hero stays full-bleed on mobile and autoplay starts active", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const carousel = page.getByRole("region", { name: carouselName });
  const activeSlide = carousel.locator('[aria-hidden="false"]');
  const heading = page.getByRole("heading", { level: 1 });
  const [carouselBox, imageBox] = await Promise.all([
    carousel.boundingBox(),
    activeSlide.locator("img").boundingBox(),
  ]);

  await expect(heading).toBeVisible();
  expect(carouselBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(imageBox!.x).toBeLessThanOrEqual(carouselBox!.x + 1);
  expect(imageBox!.width).toBeGreaterThanOrEqual(carouselBox!.width - 2);
  await expect(
    page.getByRole("button", {
      name: "Carousel otomatik geçişini duraklat",
    }),
  ).toBeVisible();

  await page.waitForTimeout(7_250);
  await expect(
    page.getByRole("button", { name: /2\. slayta git/ }),
  ).toHaveAttribute("aria-current", "true");
});
