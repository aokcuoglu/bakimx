import { expect, test } from "@playwright/test";

const carouselName = "BakımX öne çıkan servis özellikleri";

test("hero leads with registration reading and exposes keyboard-operable feature banners", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const carousel = page.getByRole("region", { name: carouselName });
  const activeSlide = carousel.locator('[aria-hidden="false"]');
  const heading = page.getByRole("heading", {
    level: 1,
    name: /Ruhsatı okutun\. Aracı ilk temasta tanıyın\./,
  });

  await expect(carousel).toBeVisible();
  await expect(heading).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(activeSlide).toHaveAttribute(
    "data-hero-slide",
    "digital-intake",
  );
  await expect(activeSlide.getByText("Telefondan ruhsat okuma")).toBeVisible();

  const [carouselBox, imageBox] = await Promise.all([
    carousel.boundingBox(),
    activeSlide.locator("img").boundingBox(),
  ]);
  expect(carouselBox).not.toBeNull();
  expect(imageBox).not.toBeNull();
  expect(imageBox!.x).toBeLessThanOrEqual(carouselBox!.x + 1);
  expect(imageBox!.width).toBeGreaterThanOrEqual(carouselBox!.width - 2);

  const next = page.getByRole("button", { name: "Sonraki slayt" });
  await next.focus();
  await page.keyboard.press("Enter");

  await expect(activeSlide).toHaveAttribute(
    "data-hero-slide",
    "compatible-parts",
  );
  await expect(
    activeSlide.getByText("Araca uygun parça sonuçları"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Carousel otomatik geçişini başlat" }),
  ).toBeVisible();
});

test("reduced-motion keeps autoplay stopped while manual carousel navigation works on mobile", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const carousel = page.getByRole("region", { name: carouselName });
  const firstIndicator = page.getByRole("button", {
    name: /1\. slayta git/,
  });
  const secondIndicator = page.getByRole("button", {
    name: /2\. slayta git/,
  });

  await expect(
    page.getByRole("button", { name: "Carousel otomatik geçişini başlat" }),
  ).toBeVisible();
  await expect(firstIndicator).toHaveAttribute("aria-current", "true");
  await page.waitForTimeout(7_250);
  await expect(firstIndicator).toHaveAttribute("aria-current", "true");

  await secondIndicator.click();
  await expect(secondIndicator).toHaveAttribute("aria-current", "true");
  await expect(carousel.locator('[aria-hidden="false"]')).toHaveAttribute(
    "data-hero-slide",
    "compatible-parts",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});
