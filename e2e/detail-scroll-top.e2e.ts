import { expect, test } from "@playwright/test"

// #892 — read-only: yalnız gezinir ve kaydırma konumunu okur.
const LISTS = [
  { path: "/customers", detail: /^\/customers\/[^/?]+$/ },
  { path: "/vehicles", detail: /^\/vehicles\/[^/?]+$/ },
  { path: "/orders", detail: /^\/orders\/[^/?]+(\?.*)?$/ },
]

for (const width of [390, 1440]) {
  for (const { path, detail } of LISTS) {
    test(`${path} → detay en üstten açılır, geri listenin konumunu korur (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(`/api/auth/dev-login?redirect=${path}`)
      await expect(page).toHaveURL(new RegExp(`${path}$`))

      await page.waitForLoadState("networkidle")
      const hrefs = await page.locator("main a[href]").evaluateAll((links) =>
        links.filter((a) => (a as HTMLElement).offsetParent !== null).map((a) => a.getAttribute("href") ?? ""),
      )
      const candidates = hrefs.filter((h) => detail.test(h) && !h.includes("/new"))
      test.skip(candidates.length === 0, "listede kayıt yok")
      const href = candidates[Math.min(candidates.length - 1, 8)]
      const link = page.locator(`main a[href="${href}"]:visible`).first()

      await link.scrollIntoViewIfNeeded()
      await page.evaluate(() => window.scrollBy(0, 150))
      const listScroll = await page.evaluate(() => window.scrollY)

      await link.click()
      await expect(page).toHaveURL(new RegExp(href.split("?")[0] + "(\\?.*)?$"))
      // loading → içerik geçişi bitsin; konum hiçbir aşamada 0'dan ayrılmamalı.
      await page.waitForLoadState("networkidle")
      expect(await page.evaluate(() => window.scrollY)).toBe(0)

      await page.goBack()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      if (listScroll > 0) {
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
      }
    })
  }
}

