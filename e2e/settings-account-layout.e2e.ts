import { expect, test } from "@playwright/test"

test("hesap profili Attio genişliğinde, mobilde tek sütunda kalır", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/api/auth/dev-login?redirect=/settings/account")
  await expect(page).toHaveURL(/\/settings\/account$/)

  const profile = page.getByRole("region", { name: "Profil bilgileri" })
  const firstName = page.getByRole("textbox", { name: "Ad", exact: true })
  const lastName = page.getByRole("textbox", { name: "Soyad" })
  await expect(profile).toBeVisible()
  await expect(page.getByRole("heading", { name: "Şifre", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Kopyala" })).toBeVisible()

  const desktop = await profile.boundingBox()
  const firstDesktop = await firstName.boundingBox()
  const lastDesktop = await lastName.boundingBox()
  expect(desktop?.width).toBeLessThanOrEqual(768)
  expect(firstDesktop?.y).toBe(lastDesktop?.y)
  expect(lastDesktop!.x).toBeGreaterThan(firstDesktop!.x + firstDesktop!.width)

  await page.setViewportSize({ width: 390, height: 844 })
  const firstMobile = await firstName.boundingBox()
  const lastMobile = await lastName.boundingBox()
  expect(lastMobile!.y).toBeGreaterThan(firstMobile!.y)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test("bütün ayar sayfaları ortak içerik sütununu kullanır", async ({ page }) => {
  test.setTimeout(90_000)
  const routes = [
    "account", "general", "branding", "communication", "working-hours",
    "appointment-rules", "pdf-templates", "team", "notifications",
    "calendar", "security", "plans", "billing",
  ]

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/api/auth/dev-login?redirect=/settings/account")
  for (const route of routes) {
    await page.goto(`/settings/${route}`)
    const content = page.locator("[data-settings-content]")
    await expect(content).toHaveCount(1)
    await expect(content).toBeVisible()
    await expect(page.locator("header").first().locator("h1:visible svg")).toBeVisible()
    const box = await content.boundingBox()
    const main = await page.locator("main").last().boundingBox()
    expect(box!.width, route).toBeLessThanOrEqual(768)
    expect(Math.abs(box!.x - (main!.x + (main!.width - box!.width) / 2)), route).toBeLessThan(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth), route).toBeLessThanOrEqual(1440)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  for (const route of ["account", "general", "team", "plans", "billing"]) {
    await page.goto(`/settings/${route}`)
    const content = page.locator("[data-settings-content]")
    await expect(content).toHaveCount(1)
    await expect(content).toBeVisible()
    const box = await content.boundingBox()
    expect(box!.x, route).toBe(16)
    expect(box!.width, route).toBe(358)
    expect(await page.evaluate(() => document.documentElement.scrollWidth), route).toBeLessThanOrEqual(390)
  }
})

test("ayarlar ve dashboard aynı kenar çubuğu genişliğini kullanır", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    window.localStorage.setItem("bakimx-sidebar-width", "320")
    window.localStorage.setItem("bakimx-settings-sidebar-width", "275")
  })
  await page.goto("/api/auth/dev-login?redirect=/settings/account")

  const header = page.locator('[data-sidebar="header"]')
  const back = header.getByRole("link", { name: "Ana menüye dön" })
  const title = header.getByText("Ayarlar", { exact: true })
  const search = page.getByRole("textbox", { name: "Ayarlarda ara" })
  await expect(title).toBeVisible()
  await expect(back).toBeVisible()
  await expect(back).toHaveText("")
  await expect(title).toHaveCSS("font-size", "16px")
  await expect(title).toHaveCSS("font-weight", "600")
  await expect(title).toHaveCSS("line-height", "20px")
  await expect(title).toHaveCSS("letter-spacing", "-0.16px")
  await expect.poll(() => page.locator('[data-slot="sidebar-wrapper"]').evaluate((el) => getComputedStyle(el).getPropertyValue("--sidebar-width"))).toBe("320px")
  await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("width", "320px")

  const headerBox = await header.boundingBox()
  const backBox = await back.boundingBox()
  const titleBox = await title.boundingBox()
  const searchBox = await search.boundingBox()
  expect(headerBox!.height).toBe(49)
  expect(backBox!.width).toBe(28)
  expect(backBox!.height).toBe(28)
  expect(titleBox!.x - (backBox!.x + backBox!.width)).toBe(12)
  expect(searchBox!.y - (headerBox!.y + headerBox!.height)).toBe(10)
  expect(searchBox!.height).toBe(28)

  await back.click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect.poll(() => page.locator('[data-slot="sidebar-wrapper"]').evaluate((el) => getComputedStyle(el).getPropertyValue("--sidebar-width"))).toBe("320px")
  await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("width", "320px")
  await expect(page.locator("header").first().locator("h1:visible svg")).toBeVisible()

  await page.goto("/settings/general")
  await expect(page.locator('[data-slot="sidebar-gap"]')).toHaveCSS("width", "320px")
  await expect(page.locator("header").first().locator("h1:visible svg")).toBeVisible()
})
