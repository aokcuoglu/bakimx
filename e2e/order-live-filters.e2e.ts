import { expect, test } from "@playwright/test"

for (const width of [390, 1440]) {
  test(`live order search and filters keep the toolbar mounted at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/api/auth/dev-login?redirect=/orders")
    const search = page.getByRole("textbox", { name: "Araç kabulü ara", exact: true })
    const results = page.getByLabel("Araç kabul sonuçları", { exact: true })
    await expect(search).toBeVisible()
    await page.getByRole("button", { name: "Filtreler", exact: false }).click()
    await search.evaluate((input) => { input.dataset.mountMarker = "original" })
    let documentRequests = 0
    page.on("request", (request) => {
      if (request.resourceType() === "document") documentRequests++
    })

    // Hold an RSC response so the local loading boundary can be inspected.
    let releaseResponse!: () => void
    const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve })
    await page.route("**/orders?**", async (route) => {
      if (new URL(route.request().url()).searchParams.get("q") === "no-match-live-724") await responseGate
      await route.continue()
    })
    await search.fill("no-match-live-724")
    await expect(results).toHaveAttribute("aria-busy", "true")
    await expect(results.getByRole("status", { name: "Araç kabulleri yükleniyor…" })).toBeVisible()
    await expect(results.getByRole("status", { name: "Araç kabulleri yükleniyor…" })).toBeInViewport()
    await expect(search).toBeFocused()
    await expect(search).toHaveAttribute("data-mount-marker", "original")
    await page.screenshot({ path: test.info().outputPath(`orders-${width}-loading.png`) })
    releaseResponse()
    await expect(page).toHaveURL(/q=no-match-live-724/)
    await expect(results).toHaveAttribute("aria-busy", "false")
    await expect(page.getByText("Filtrelere uyan araç kabulü bulunamadı", { exact: true })).toBeVisible()

    // No Enter: the server must actually return matching rows as text changes.
    await search.fill("34")
    await expect(page).toHaveURL(/q=34/)
    await expect(results).toHaveAttribute("aria-busy", "false")
    await expect(page.locator('a[href^="/orders/"][href*="returnTo="]:visible').first()).toBeVisible()

    for (const [name, option, query] of [
      ["Tüm Durumlar", "Aktif", "status=active"],
      ["Tüm Ödemeler", "Ödenmedi", "payment=unpaid"],
      ["Tüm Ustalar", "Atanmamış", "technician=none"],
      ["Tüm Faturalar", "Fatura kesilmedi", "invoice=without"],
    ]) {
      await page.getByRole("combobox", { name, exact: true }).click()
      await page.getByRole("option", { name: option, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(query))
      await expect(results).toHaveAttribute("aria-busy", "false")
      await expect(search).toHaveValue("34")
      await expect(search).toHaveAttribute("data-mount-marker", "original")
    }
    await page.getByRole("link", { name: "Temizle", exact: true }).click()
    await expect(page).toHaveURL(/\/orders$/)
    await expect(search).toHaveValue("")
    await expect(search).toHaveAttribute("data-mount-marker", "original")
    await page.goBack()
    await expect(search).toHaveValue("34")
    expect(documentRequests).toBe(0)
  })
}

test("a pending search does not restore old text or erase a newer filter selection", async ({ page }) => {
  await page.goto("/api/auth/dev-login?redirect=/orders")
  const search = page.getByRole("textbox", { name: "Araç kabulü ara", exact: true })
  await expect(search).toBeVisible()
  await page.getByRole("button", { name: "Filtreler", exact: false }).click()
  let releaseResponse!: () => void
  const responseGate = new Promise<void>((resolve) => { releaseResponse = resolve })
  await page.route("**/orders?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("q") === "old-search-724") await responseGate
    await route.continue()
  })
  await search.fill("old-search-724")
  await expect(page.getByLabel("Araç kabul sonuçları", { exact: true })).toHaveAttribute("aria-busy", "true")
  await search.fill("34")
  releaseResponse()
  await expect(page).toHaveURL(/q=34/)
  await expect(search).toHaveValue("34")
  // Select while a new debounce is scheduled: both current values must be sent.
  await search.fill("no-match-final-724")
  await page.getByRole("combobox", { name: "Tüm Ödemeler", exact: true }).click()
  await page.getByRole("option", { name: "Ödenmedi", exact: true }).click()
  await expect(page).toHaveURL(/q=no-match-final-724/)
  await expect(page).toHaveURL(/payment=unpaid/)
  await expect(search).toHaveValue("no-match-final-724")
  await expect(page.getByText("Filtrelere uyan araç kabulü bulunamadı", { exact: true })).toBeVisible()
  await search.fill("pending-clear-724")
  await page.getByRole("link", { name: "Temizle", exact: true }).click()
  await expect(page).toHaveURL(/\/orders$/)
  // Let the former debounce deadline pass; it must not reapply the cleared query.
  await page.waitForTimeout(400)
  await expect(page).toHaveURL(/\/orders$/)
  await expect(search).toHaveValue("")
})
