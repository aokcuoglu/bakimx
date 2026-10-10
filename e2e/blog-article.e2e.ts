import { expect, test } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { getAllPosts } from "../src/lib/blog/posts"
import { SITE_URL } from "../src/lib/seo"

const post = getAllPosts()[0]
const path = `/blog/${post.slug}`

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`article layout and accessibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(path)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(post.title)
    await expect(page.locator("main")).not.toContainText(post.description)
    await expect(page.locator("main")).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const heading = page.getByRole("heading", { level: 1 })
    expect(await heading.evaluate((el) => getComputedStyle(el).fontSize)).toBe(width >= 1024 ? "50px" : "30px")
    const toc = page.getByRole("navigation", { name: "İçindekiler", exact: true })
    const link = toc.getByRole("link").last()
    const hash = await link.getAttribute("href")
    await link.focus()
    await page.keyboard.press("Enter")
    await expect(page).toHaveURL(new RegExp(`${hash}$`))
    await expect(link).toHaveAttribute("aria-current", "location")
    await expect.poll(async () => page.locator(hash!).evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(100)
    if (width >= 1024) {
      const sticky = await toc.locator("..").boundingBox()
      expect(sticky!.y).toBeGreaterThanOrEqual(99)
      expect(sticky!.y).toBeLessThanOrEqual(101)
    }
    await expect(page.getByRole("region", { name: "Demo talebi" }).getByRole("link", { name: "Demo talep et", exact: true })).toHaveAttribute("href", "/demo")
    await page.screenshot({ path: `artifacts/blog-article/${width}.png`, fullPage: true })
    const results = await new AxeBuilder({ page }).include("main").analyze()
    expect(results.violations).toEqual([])
  })
}

test("canonical shares, direct hash, related links and list regression", async ({ page }) => {
  await page.goto(path)
  const url = `${SITE_URL}${path}`
  for (const [name, param] of [["X’te paylaş", "url"], ["LinkedIn’de paylaş", "url"], ["E-posta ile paylaş", "body"]]) {
    const href = await page.getByRole("link", { name, exact: true }).getAttribute("href")
    expect(new URL(href!).searchParams.get(param)).toBe(url)
  }
  const hash = await page.getByRole("navigation", { name: "İçindekiler", exact: true }).getByRole("link").last().getAttribute("href")
  await page.goto(`${path}${hash}`)
  await expect(page.locator(`nav a[href="${hash}"]`)).toHaveAttribute("aria-current", "location")
  expect(await page.locator(hash!).evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(100)
  const related = page.getByRole("region", { name: "İlgili yazılar" }).getByRole("link")
  expect(await related.count()).toBeLessThanOrEqual(3)
  for (const href of await related.evaluateAll((links) => links.map((el) => el.getAttribute("href")))) expect(href).not.toBe(path)
  await page.goto("/blog")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.locator(`a[href="${path}"]`).first()).toBeVisible()
  await expect(page.locator("main img").first()).toBeVisible()
})

test("content and anchors remain usable without JavaScript and with reduced motion", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce", viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(`http://localhost:${process.env.PLAYWRIGHT_PORT || "3001"}${path}`)
  await expect(page.locator("[data-blog-content]")).toBeVisible()
  const link = page.getByRole("navigation", { name: "İçindekiler", exact: true }).getByRole("link").last()
  const hash = await link.getAttribute("href")
  await link.click()
  await expect(page).toHaveURL(new RegExp(`${hash}$`))
  expect(await page.locator(hash!).evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(100)
  await context.close()
})

for (const article of getAllPosts()) {
  test(`shared template and SEO: ${article.slug}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto(`/blog/${article.slug}`)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(article.title)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE_URL}/blog/${article.slug}`)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", article.description)
    const data = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(data.map((value) => JSON.parse(value)).find((value) => value["@type"] === "BlogPosting")).toMatchObject({ headline: article.title, datePublished: article.publishedAt })
    const links = page.getByRole("navigation", { name: "İçindekiler", exact: true }).getByRole("link")
    for (const href of await links.evaluateAll((items) => items.map((item) => item.getAttribute("href")))) await expect(page.locator(`[id="${href!.slice(1)}"]`)).toHaveCount(1)
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.getByRole("heading", { level: 1 })).toBeInViewport()
    await page.screenshot({ path: `artifacts/blog-article/${article.slug}-reduced-motion.png`, fullPage: true })
  })
}
