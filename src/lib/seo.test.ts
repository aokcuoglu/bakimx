import { describe, expect, test } from "bun:test"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { INDEXABLE_ROUTES, publicPageMetadata, SITE_URL } from "@/lib/seo"

describe("SEO route policy", () => {
  test("sitemap contains each canonical public route exactly once", () => {
    const entries = sitemap()
    expect(entries.map((entry) => entry.url)).toEqual(
      INDEXABLE_ROUTES.map((path) => new URL(path, SITE_URL).toString()),
    )
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length)
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
    expect(result.openGraph).toEqual(expect.objectContaining({ title: "Demo", description: "Açıklama", url: "/demo" }))
    expect(result.twitter).toEqual(expect.objectContaining({ title: "Demo", description: "Açıklama" }))
  })
})
