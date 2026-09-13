import { describe, expect, test } from "bun:test"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { INDEXABLE_ROUTES, publicPageMetadata, SITE_URL } from "@/lib/seo"

describe("SEO route policy", () => {
  test("sitemap contains each canonical public route exactly once", () => {
    const entries = sitemap()
    const urls = entries.map((entry) => entry.url)
    for (const path of INDEXABLE_ROUTES) {
      expect(urls).toContain(new URL(path, SITE_URL).toString())
    }
    expect(urls.some((url) => url.includes("/blog/"))).toBe(true)
    expect(new Set(urls).size).toBe(urls.length)
  })

  test("robots advertises the sitemap and blocks private route families", () => {
    const result = robots()
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`)
    expect(result.host).toBe(SITE_URL)
    expect(result.rules).toEqual(
      expect.objectContaining({
        userAgent: "*",
        allow: "/",
        disallow: expect.arrayContaining(["/admin/", "/api/", "/p/", "/s/", "/invite/"]),
      }),
    )
  })

  test("public page metadata is self-canonical with matching social copy", () => {
    const result = publicPageMetadata({ path: "/demo", title: "Demo", description: "Açıklama" })
    expect(result.alternates?.canonical).toBe("/demo")
    expect(result.openGraph).toEqual(expect.objectContaining({ title: "Demo | BakımX", description: "Açıklama", url: "/demo" }))
    expect(result.twitter).toEqual(expect.objectContaining({ title: "Demo | BakımX", description: "Açıklama" }))
  })
})
