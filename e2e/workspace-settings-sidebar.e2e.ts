import { expect, test } from "@playwright/test"

test.describe("workspace and settings sidebar", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("workspace menu opens the secondary settings navigation", async ({ page }) => {
    await page.goto("/api/auth/dev-login?redirect=/dashboard")
    await expect(page).toHaveURL(/\/dashboard/)

    const workspace = page.getByRole("button", { name: /^Şube:/ })
    await workspace.click()
    const menu = page.getByRole("menu")
    await expect(menu.getByRole("menuitem", { name: "Hesap ayarları" })).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: "Çalışma alanı ayarları" })).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: "Üyeleri davet et" })).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: "Çıkış yap" })).toBeVisible()

    await menu.getByRole("menuitem", { name: "Hesap ayarları" }).click()
    await expect(page).toHaveURL(/\/settings\/account$/)
    await expect(page.getByRole("link", { name: "Ana menüye dön" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Paketler" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Faturalandırma" })).toBeVisible()

    const search = page.getByRole("textbox", { name: "Ayarlarda ara" })
    await search.fill("fatura")
    await expect(page.getByRole("link", { name: "Faturalandırma" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Paketler" })).toHaveCount(0)
    await search.clear()

    await page.getByRole("link", { name: "Paketler" }).click()
    await expect(page).toHaveURL(/\/settings\/plans$/)
    await page.getByRole("link", { name: "Ana menüye dön" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(workspace).toBeVisible()

    await workspace.click()
    await menu.getByRole("menuitem", { name: "Çalışma alanı ayarları" }).click()
    await expect(page).toHaveURL(/\/settings\/general$/)
    await expect(page.getByRole("link", { name: "Ana menüye dön" })).toBeVisible()
  })

  test("invite action opens the existing team invitation form", async ({ page }) => {
    await page.goto("/api/auth/dev-login?redirect=/dashboard")
    await page.getByRole("button", { name: /^Şube:/ }).click()
    await page.getByRole("menuitem", { name: "Üyeleri davet et" }).click()
    await expect(page).toHaveURL(/\/settings\/team\?invite=1$/)
    await expect(page.getByRole("button", { name: "Davet Gönder" })).toBeVisible()
  })
})

test("settings navigation is reachable from the mobile sidebar", async ({ page }) => {
  await page.goto("/api/auth/dev-login?redirect=/dashboard")
  await page.getByRole("button", { name: "Menüyü aç" }).click()
  await page.getByRole("button", { name: /^Şube:/ }).click()
  await page.getByRole("menuitem", { name: "Hesap ayarları" }).click()
  await expect(page).toHaveURL(/\/settings\/account$/)
  await page.getByRole("button", { name: "Menüyü aç" }).click()
  await expect(page.getByRole("link", { name: "Ana menüye dön" })).toBeVisible()
  await page.getByRole("link", { name: "Ana menüye dön" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('[data-mobile="true"]')).toBeHidden()
})
