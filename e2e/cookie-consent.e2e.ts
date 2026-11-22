import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("cookie choices persist and cancelling preferences keeps the initial choice available", async ({
  page,
}) => {
  await page.goto("/");
  const banner = page.locator('[data-slot="cookie-consent-banner"]');
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Tercihler", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Çerez tercihleri",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("switch", { name: "Zorunlu Çerezler", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Reddet", exact: true }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await page
    .locator("footer")
    .getByRole("button", { name: "Çerez tercihleri", exact: true })
    .click();
  await expect(
    dialog.getByRole("switch", { name: "Performans Çerezleri", exact: true }),
  ).not.toBeChecked();
  await dialog
    .getByRole("switch", { name: "Performans Çerezleri", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Kaydet", exact: true }).click();
  const prefs = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("bakimx.cookie-consent")!).preferences,
  );
  expect(prefs).toEqual({
    necessary: true,
    performance: true,
    functional: false,
    targeting: false,
  });
  await page.goto("/privacy#cerezler");
  await expect(
    page.getByRole("heading", { level: 1, name: "Gizlilik Politikası" }),
  ).toBeVisible();
  await expect(page.locator("#cerezler")).toBeVisible();
});

test("bar blocks the page until a choice; Escape does not dismiss it", async ({
  page,
}) => {
  await page.goto("/");
  const banner = page.locator('[data-slot="cookie-consent-banner"]');
  await expect(banner).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(banner).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Giriş yap" }).first().click({ timeout: 1500 }),
  ).rejects.toThrow();
  await banner.getByRole("button", { name: "Reddet", exact: true }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("legal pages keep the bar but stay readable and scrollable", async ({
  page,
}) => {
  await page.goto("/privacy");
  const banner = page.locator('[data-slot="cookie-consent-banner"]');
  await expect(banner).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(banner).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Gizlilik Politikası" }),
  ).toBeVisible();
});
