import { describe, expect, test } from "bun:test"
import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { KILAVUZ_DESCRIPTION } from "@/lib/guide/kilavuz"
import { ARAC_KABUL_FORMU_DESCRIPTION } from "@/lib/landing/arac-kabul-formu"
import { DIJITAL_ARAC_KABUL_DESCRIPTION } from "@/lib/landing/dijital-arac-kabul"
import { IS_EMRI_PROGRAMI_DESCRIPTION } from "@/lib/landing/is-emri-programi"
import { IS_EMRI_REHBER_DESCRIPTION } from "@/lib/landing/oto-servis-is-emri-nasil-hazirlanir"
import {
  DEFAULT_OG_IMAGE,
  INDEXABLE_ROUTES,
  META_DESCRIPTION_MAX_LENGTH,
  ORGANIZATION_STRUCTURED_DATA,
  publicPageMetadata,
  SITE_URL,
  SOCIAL_PROFILE_URLS,
  TWITTER_HANDLE,
} from "@/lib/seo"

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

  // #780: the page-level openGraph replaces the layout's (shallow merge), so a
  // helper without images left 16 public pages with no share preview.
  test("public pages carry the default share image and the brand's X handle", () => {
    const result = publicPageMetadata({ path: "/demo", title: "Demo", description: "Açıklama" })
    expect(result.openGraph?.images).toEqual([DEFAULT_OG_IMAGE])
    expect(result.twitter).toEqual(expect.objectContaining({ site: TWITTER_HANDLE }))
  })

  test("a page image replaces the default share image", () => {
    const image = { url: "/illustrations/cover.webp", alt: "Kapak" }
    const result = publicPageMetadata({ path: "/blog/yazi", title: "Yazı", description: "Açıklama", image })
    expect(result.openGraph?.images).toEqual([image])
  })

  // Next fills twitter.images from openGraph.images only while twitter.images is
  // unset (resolve-metadata.js postProcessMetadata). Setting it here would pin
  // every blog post's X card to the generic image instead of its cover.
  test("twitter images stay unset so they follow the Open Graph image", () => {
    const result = publicPageMetadata({ path: "/demo", title: "Demo", description: "Açıklama" })
    expect(result.twitter && Object.hasOwn(result.twitter, "images")).toBe(false)
  })

  test("organization structured data links the brand's social profiles", () => {
    expect(ORGANIZATION_STRUCTURED_DATA).toEqual(
      expect.objectContaining({ "@type": "Organization", url: SITE_URL, sameAs: SOCIAL_PROFILE_URLS }),
    )
    expect(SOCIAL_PROFILE_URLS.length).toBeGreaterThan(0)
    for (const url of SOCIAL_PROFILE_URLS) expect(url).toStartWith("https://")
  })

  test("long-form meta descriptions fit Google's snippet", () => {
    for (const description of [
      DIJITAL_ARAC_KABUL_DESCRIPTION,
      IS_EMRI_PROGRAMI_DESCRIPTION,
      ARAC_KABUL_FORMU_DESCRIPTION,
      IS_EMRI_REHBER_DESCRIPTION,
      KILAVUZ_DESCRIPTION,
    ]) {
      expect(description.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_LENGTH)
    }
  })
})
