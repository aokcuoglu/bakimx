import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 1440, height: 900 } })

test("settings navigation responds before slow route data finishes", async ({ page }) => {
  await page.goto("/api/auth/dev-login?redirect=/settings/account")
  await expect(page).toHaveURL(/\/settings\/account$/)

  const session = await page.context().newCDPSession(page)
  await session.send("Network.enable")
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 1200,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })

  await page.getByRole("link", { name: "Genel", exact: true }).click()
  await expect(page.getByRole("status", { name: "Ayarlar yükleniyor" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Ana menüye dön" })).toBeVisible()
  await expect(page).toHaveURL(/\/settings\/general$/)
  await expect(page.getByRole("heading", { name: "Genel" }).last()).toBeVisible()
  await session.detach()
})
