import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/api/auth/dev-login?email=admin@bakimx.com&redirect=/admin/health")
  await expect(page.getByRole("heading", { name: "Sistem Sağlığı" })).toBeVisible()
})

test("admin probe sonucunda maliyet ve kaynak domainlerini gösterir", async ({ page }) => {
  await page.route("**/api/admin/market-research/probe", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().postDataJSON()).toEqual({
      query: "Corolla ön fren balatası",
      vehicle: "Toyota Corolla 2020 1.6",
    })
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        domains: ["hanparca.com", "otoyedpar.com.tr"],
        webSearches: 3,
        costMicroUsd: 12840,
      }),
    })
  })

  await page.getByLabel("Aranacak parça").fill("Corolla ön fren balatası")
  await page.getByLabel("Araç bilgisi (isteğe bağlı)").fill("Toyota Corolla 2020 1.6")
  await page.getByRole("button", { name: "Tek keşfi başlat" }).click()

  await expect(page.getByRole("heading", { name: "Keşif tamamlandı" })).toBeVisible()
  await expect(page.getByText("$0.012840")).toBeVisible()
  await expect(page.getByRole("link", { name: /hanparca\.com/ })).toBeVisible()
  await expect(page.getByRole("button", { name: "Keşif tamamlandı" })).toBeDisabled()
})

test("probe hatasını açıklar ve yeniden denemeye izin verir", async ({ page }) => {
  await page.route("**/api/admin/market-research/probe", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Bu ay için keşif çağrısı zaten kullanıldı." }),
    })
  })

  await page.getByLabel("Aranacak parça").fill("Fren balatası")
  await page.getByRole("button", { name: "Tek keşfi başlat" }).click()

  await expect(page.getByRole("alert")).toHaveText("Bu ay için keşif çağrısı zaten kullanıldı.")
  await expect(page.getByRole("button", { name: "Tek keşfi başlat" })).toBeEnabled()
})
