import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("product tour works with the keyboard and core destinations remain available", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Serviste işler\s*yolunda\.\s*Kontrol sizde\./,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page
      .getByRole("link", { name: "Ücretsiz denemeye başlayın", exact: true })
      .first(),
  ).toHaveAttribute("href", "/register");

  const workOrder = page.getByRole("tab", { name: "İş emri", exact: true });
  await workOrder.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Araç kabul", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Araç kabul", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Müşteri takibi", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const productImage = page.getByRole("tabpanel", { name: "Müşteri takibi", exact: true }).locator("img").first();
  await expect(productImage).toBeVisible();
  await expect
    .poll(() =>
      productImage.evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);

  for (const id of ["ozellikler", "neden", "sss", "ruhsat-demo", "demo-form"]) {
    await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
  }
  await page
    .getByRole("link", { name: "Birlikte inceleyelim", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/#demo-form$/);
  await expect(page.getByLabel("Ad Soyad", { exact: true })).toBeInViewport();
  expect(errors).toEqual([]);
});

test("mobile navigation closes after choosing a section and page fits narrow screens", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Menüyü aç" }).click();
  await page
    .locator("#mobile-menu")
    .getByRole("link", { name: "Özellikler", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Menüyü aç" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page).toHaveURL(/#ozellikler$/);
  for (const width of [320, 360, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});

test("demo request validation and confirmation work without sending a real lead", async ({
  page,
}) => {
  let submissions = 0;
  await page.route("**/api/demo-request", async (route) => {
    submissions += 1;
    expect(route.request().postDataJSON()).toMatchObject({
      name: "Test Kullanıcı",
      businessName: "Test Servisi",
      city: "İstanbul",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
  await page.goto("/#demo-form");
  const form = page.locator("#demo-form");
  await form.getByRole("button", { name: "Demo İste", exact: true }).click();
  await expect(page.getByLabel("Ad Soyad", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(submissions).toBe(0);
  await page.getByLabel("Ad Soyad", { exact: true }).fill("Test Kullanıcı");
  await page.getByLabel("Telefon", { exact: true }).fill("05321234567");
  await page.getByLabel("Servis adı", { exact: true }).fill("Test Servisi");
  await page.getByRole("combobox", { name: "Şehir", exact: true }).click();
  await page.getByRole("option", { name: "İstanbul", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Aylık araç adedi", exact: true })
    .click();
  await page.getByRole("option", { name: "21 - 50", exact: true }).click();
  await form.getByRole("button", { name: "Demo İste", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Talebiniz alındı!" }),
  ).toBeVisible();
  await expect(page.locator("#demo-form")).toBeFocused();
  expect(submissions).toBe(1);
});

test("FAQ deep links and structured answers agree with the visible page", async ({
  page,
}) => {
  await page.goto("/#sss-stok-dusumu");
  await expect(
    page.locator("#sss-stok-dusumu").getByRole("button"),
  ).toHaveAttribute("aria-expanded", "true");
  const questions = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((scripts) =>
      scripts.flatMap((script) => {
        const data = JSON.parse(script.textContent || "{}");
        return (Array.isArray(data) ? data : [data])
          .filter((entry) => entry["@type"] === "FAQPage")
          .flatMap(
            (entry) =>
              entry.mainEntity as {
                name: string;
                acceptedAnswer: { text: string };
              }[],
          );
      }),
    );
  expect(questions.length).toBeGreaterThan(0);
  for (const question of questions) {
    const trigger = page.getByRole("button", {
      name: question.name,
      exact: true,
    });
    if ((await trigger.getAttribute("aria-expanded")) !== "true")
      await trigger.click();
    await expect(
      page.getByText(question.acceptedAnswer.text, { exact: true }),
    ).toBeVisible();
  }
});

test("landing is accessible and its primary content is available without JavaScript", async ({
  page,
  browser,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const noJsPage = await context.newPage();
  await noJsPage.goto(
    "http://localhost:" + (process.env.PLAYWRIGHT_PORT || "3000") + "/",
  );
  await expect(noJsPage.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    noJsPage
      .getByRole("link", { name: "Ücretsiz denemeye başlayın", exact: true })
      .first(),
  ).toBeVisible();
  await context.close();
});
