import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("public website shell, modal keyboard lifecycle and responsive routes", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("[data-public-ready=true]")).toBeVisible();
  const trigger = page
    .locator("#hero")
    .getByRole("button", { name: "Birlikte inceleyelim" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).not.toHaveURL(/#demo-form/);
  await expect(
    dialog.getByRole("button", { name: "Kapat", exact: true }),
  ).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByLabel("Ad Soyad", { exact: true }).fill("Deneme Kullanıcı");
  await dialog.getByLabel("Telefon", { exact: true }).fill("05321234567");
  await dialog.getByLabel("Servis adı", { exact: true }).fill("Deneme Servis");
  await dialog.getByRole("combobox", { name: "Şehir", exact: true }).click();
  await page.getByRole("option", { name: "İstanbul", exact: true }).click();
  await dialog
    .getByRole("combobox", { name: "Aylık araç adedi", exact: true })
    .click();
  await page.getByRole("option", { name: "21 - 50", exact: true }).click();
  let requests = 0;
  await page.route("**/api/demo-request", async (route) => {
    requests++;
    await route.fulfill({
      status: requests === 1 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        requests === 1
          ? { errors: { _general: "Lütfen tekrar deneyin." } }
          : { success: true },
      ),
    });
  });
  await dialog.getByRole("button", { name: "Demo İste", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Lütfen tekrar deneyin.",
  );
  await expect(dialog.getByLabel("Ad Soyad", { exact: true })).toHaveValue(
    "Deneme Kullanıcı",
  );
  await dialog.getByRole("button", { name: "Demo İste", exact: true }).click();
  await expect(dialog.getByRole("status")).toBeFocused();
  expect(requests).toBe(2);
  await page.keyboard.press("Escape");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await trigger.click();
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await dialog
      .getByRole("button", { name: "Demo İste", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      dialog.getByRole("button", { name: "Demo İste", exact: true }),
    ).toBeInViewport();
    await page.keyboard.press("Escape");
  }
  for (const route of [
    "/oto-servis-programi",
    "/is-emri-programi",
    "/dijital-arac-kabul",
    "/karsilastir/defter-excel-oto-servis-programi",
    "/rehber/arac-kabul-formu",
    "/rehber/oto-servis-is-emri-nasil-hazirlanir",
    "/fiyatlar",
    "/demo",
    "/privacy",
    "/terms",
    "/kvkk",
    "/acik-riza",
    "/status",
  ]) {
    console.info(`Checking public route: ${route}`);
    await page.goto(route);
    await expect(page.locator("[data-public-ready=true]")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
        `${route} at ${width}`,
      ).toBeLessThanOrEqual(1);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include("main")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ target, failureSummary }) => ({
          target,
          failureSummary,
        })),
      })),
      route,
    ).toEqual([]);
  }
});
