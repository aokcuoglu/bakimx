import { expect, test } from "@playwright/test"

for (const width of [320, 390, 768, 1440]) {
  test(`demo and summary fit ${width}px with one visible heading`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ["/demo", "/demo/ozet"]) {
      await page.goto(path)
      await expect(page.locator("h1")).toHaveCount(1)
      await expect(page.locator("h1")).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })
}

test("demo error preserves input; success emits only an opaque advertising ID", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true" || process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID !== "AW-123456789", "Run with the documented blocked-provider test configuration")
  // Block all providers: validation must never send real advertising conversions.
  await page.route(/googletagmanager|google-analytics|facebook\.net|facebook\.com/, route => route.fulfill({ body: "", contentType: "application/javascript" }))
  await page.addInitScript(() => {
    localStorage.setItem("bakimx.cookie-consent", JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), preferences: { necessary: true, performance: false, targeting: true, functional: false } }))
    ;(window as unknown as { demoEvents: unknown[] }).demoEvents = []
    window.addEventListener("bakimx:demo-conversion", event => (window as unknown as { demoEvents: unknown[] }).demoEvents.push((event as CustomEvent).detail))
  })
  let fail = true
  const requests: Record<string, unknown>[] = []
  await page.route("**/api/demo-request", async route => {
    requests.push(route.request().postDataJSON())
    await route.fulfill({ status: fail ? 500 : 200, json: fail ? { errors: { _general: "Test bağlantı hatası" } } : { success: true, eventId: "00000000-0000-0000-0000-000000000000" } })
  })
  await page.goto("/demo?utm_source=google&gclid=test-click")
  await page.getByLabel("Ad Soyad").fill("Test Demo")
  await page.getByLabel("Telefon", { exact: true }).fill("05551112233")
  await page.getByLabel("Servis adı").fill("Test Servis")
  await page.getByRole("combobox", { name: "Şehir" }).click()
  await page.getByRole("option", { name: "İstanbul", exact: true }).click()
  await page.getByRole("combobox", { name: "Aylık araç adedi" }).click()
  await page.getByRole("option", { name: "1 - 20", exact: true }).click()
  await page.getByRole("button", { name: "Demo İste", exact: true }).click()
  await expect(page.locator("#demo-form [role=alert]")).toContainText("Test bağlantı hatası")
  await expect(page.getByLabel("Ad Soyad")).toHaveValue("Test Demo")
  expect(await page.evaluate(() => (window as unknown as { demoEvents: unknown[] }).demoEvents)).toEqual([])
  fail = false
  await page.getByRole("button", { name: "Demo İste", exact: true }).click()
  await expect(page.locator("#demo-form[role=status]")).toBeFocused()
  const conversions = await page.evaluate(() => (window.dataLayer ?? []).map(value => Array.from(value as ArrayLike<unknown>)).filter(value => value[0] === "event" && value[1] === "conversion"))
  expect(conversions).toHaveLength(1)
  expect(conversions[0][2]).toEqual({ send_to: "AW-123456789/test_demo", transaction_id: "00000000-0000-0000-0000-000000000000", page_location: new URL(page.url()).origin + "/demo", page_referrer: "", user_data: null })
  expect(await page.evaluate(() => (window as unknown as { demoEvents: unknown[] }).demoEvents)).toEqual([{ eventId: "00000000-0000-0000-0000-000000000000" }])
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("bakimx:demo-conversion", { detail: { eventId: "00000000-0000-0000-0000-000000000000" } })))
  expect(await page.evaluate(() => (window.dataLayer ?? []).map(value => Array.from(value as ArrayLike<unknown>)).filter(value => value[1] === "conversion").length)).toBe(1)
  expect(requests.at(-1)?.targetingConsent).toBe(true)
  expect(requests.at(-1)?.attribution).toEqual({ campaignSource: "google", gclid: "test-click", landingPage: "/demo" })
})


test("performance-only consent never loads advertising SDK or stores click IDs", async ({ page }) => {
  const requests: string[] = []
  await page.route(/googletagmanager|google-analytics|facebook/, route => {
    requests.push(route.request().url())
    return route.fulfill({ body: "", contentType: "application/javascript" })
  })
  await page.addInitScript(() => localStorage.setItem("bakimx.cookie-consent", JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), preferences: { necessary: true, performance: true, targeting: false, functional: false } })))
  await page.goto("/demo?gclid=private-click")
  await expect(page.locator("h1")).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem("bakimx:demo-attribution"))).toBeNull()
  expect(requests.filter(url => url.includes("AW-") || url.includes("facebook"))).toEqual([])
})
