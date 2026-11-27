import { expect, test, type Page } from "@playwright/test"

// #996 — read-only: yalnız gezinir ve kaydırma konumunu okur.
// Başka sayfadan istemci geçişiyle (`router.push`) açılan `?tab=` / `#bölüm`
// bağlantıları bölüme inmeli.

declare global {
  interface Window {
    next: { router: { push: (href: string) => void } }
  }
}

async function firstOrderPath(page: Page): Promise<string | null> {
  await page.goto("/api/auth/dev-login?redirect=/orders")
  await page.waitForLoadState("networkidle")
  const hrefs = await page.locator("a[href^='/orders/']").evaluateAll((links) =>
    links.map((a) => a.getAttribute("href") ?? ""),
  )
  const match = hrefs.map((h) => h.split("?")[0]).find((h) => /^\/orders\/[^/]+$/.test(h) && h !== "/orders/new")
  return match ?? null
}

/** Bölümün görünür bloklarından biri üst kenara yakın mı. */
async function sectionAtTop(page: Page, id: string): Promise<boolean> {
  return page.evaluate((section) => {
    return [...document.querySelectorAll<HTMLElement>(`[data-section="${section}"]`)].some((el) => {
      if (el.getClientRects().length === 0) return false
      const top = el.getBoundingClientRect().top
      return top > -20 && top < 300
    })
  }, id)
}

async function clientPush(page: Page, href: string) {
  await page.evaluate((to) => window.next.router.push(to), href)
}

const CASES = [
  { suffix: "?tab=odeme", section: "odeme" },
  { suffix: "#odeme", section: "odeme" },
  { suffix: "#kalemler", section: "kalemler" },
]

for (const width of [390, 1440]) {
  for (const { suffix, section } of CASES) {
    test(`/dashboard → client geçişi ${suffix} bölüme iner (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      const path = await firstOrderPath(page)
      test.skip(path === null, "kayıtlı iş emri yok")

      await page.goto("/dashboard")
      await page.waitForLoadState("networkidle")
      await clientPush(page, `${path}${suffix}`)
      await expect(page).toHaveURL(new RegExp(`${path}`))
      await expect.poll(() => sectionAtTop(page, section), { timeout: 20_000 }).toBe(true)
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    })
  }

  test(`önbellekli ziyaretten sonra #odeme çift hash'e düşmez ve iner (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const path = await firstOrderPath(page)
    test.skip(path === null, "kayıtlı iş emri yok")

    await page.goto("/dashboard")
    await page.waitForLoadState("networkidle")
    await clientPush(page, `${path}#kalemler`)
    await expect.poll(() => sectionAtTop(page, "kalemler"), { timeout: 20_000 }).toBe(true)
    await clientPush(page, "/dashboard")
    await expect(page).toHaveURL(/\/dashboard$/)
    await clientPush(page, `${path}#odeme`)
    await expect.poll(() => sectionAtTop(page, "odeme"), { timeout: 20_000 }).toBe(true)
  })
}
