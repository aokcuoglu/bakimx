import { expect, test } from "@playwright/test";

const carouselName = "BakımX servis yönetimi özellikleri";

test("landing hero is a desktop split with keyboard-operable controls", async ({
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

  const [headingBox, imageBox] = await Promise.all([
    heading.boundingBox(),
    activeSlide.locator("img").boundingBox(),
  ]);
  expect(headingBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(headingBox!.x + headingBox!.width).toBeLessThan(imageBox!.x);

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

test("landing hero is a mobile stack and reduced motion disables autoplay", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const carousel = page.getByRole("region", { name: carouselName });
  const activeSlide = carousel.locator('[aria-hidden="false"]');
  const heading = page.getByRole("heading", { level: 1 });
  const [headingBox, imageBox] = await Promise.all([
    heading.boundingBox(),
    activeSlide.locator("img").boundingBox(),
  ]);

  expect(headingBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(headingBox!.y + headingBox!.height).toBeLessThan(imageBox!.y);
  await expect(
    page.getByRole("button", {
      name: "Carousel otomatik geçişini başlat",
    }),
  ).toBeVisible();

  await page.waitForTimeout(7_250);
  await expect(
    page.getByRole("button", { name: /1\. slayta git/ }),
  ).toHaveAttribute("aria-current", "true");
});
