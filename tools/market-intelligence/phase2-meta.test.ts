import { describe, expect, test } from "bun:test"
import { createApifyApi } from "./apify"
import { metaInput, metaPageInput, metaSearchUrl, normalizeMetaDataset } from "./phase2-meta"

describe("Phase 2 Meta safety", () => {
  test("one bounded run contains three Turkish Ad Library searches and no enrichments", () => {
    const input = metaInput()
    expect(input.startUrls).toHaveLength(3)
    expect(input.resultsLimit).toBe(10)
    expect(input).toMatchObject({ onlyTotal: false, includeAboutPage: false, isDetailsPerAd: false, enrichWithEcommerceData: false })
    for (const { url } of input.startUrls) {
      const params = new URL(url).searchParams
      expect(params.get("country")).toBe("TR")
      expect(params.get("search_type")).toBe("keyword_unordered")
    }
  })
  test("targeted follow-up uses two known page URLs without repeating keywords", () => {
    const input = metaPageInput()
    expect(input.startUrls).toHaveLength(2)
    expect(input.resultsLimit).toBe(10)
    expect(input.startUrls.every(({ url }) => !new URL(url).searchParams.has("q"))).toBe(true)
  })
  test("empty and malformed items do not become ad claims", () => {
    expect(normalizeMetaDataset([], "run-1")).toEqual({ ads: [], summaries: [], malformedItems: 0, errorItems: 0 })
    expect(normalizeMetaDataset([{ error: "blocked", url: metaSearchUrl("PADOK") }, { inputUrl: metaSearchUrl("PADOK") }], "run-1")).toEqual({ ads: [], summaries: [], malformedItems: 1, errorItems: 1 })
  })
  test("zero-ad summary is coverage data, not a malformed ad", () => {
    const inputUrl = "https://www.facebook.com/Kursoft"
    expect(normalizeMetaDataset([{ inputUrl, pageInfo: { page: { id: "128005360587632", name: "Kursoft" } }, isResultComplete: true, results: [], totalCount: 0 }], "run-1")).toEqual({ ads: [], summaries: [{ inputUrl, totalCount: 0, isResultComplete: true, pageId: "128005360587632", pageName: "Kursoft" }], malformedItems: 0, errorItems: 0 })
  })
  test("official ad fields normalize without media or unrelated fields", () => {
    const item = { inputUrl: metaSearchUrl("PADOK"), adArchiveId: "123456789012345", pageId: "123", pageName: "Hayat Yazılım", startDateFormatted: "2026-09-01T00:00:00.000Z", isActive: true, snapshot: { body: { text: "Servis yönetimi" }, title: "PADOK", ctaText: "Learn more", linkUrl: "https://hayatyazilim.com/", pageProfileUri: "https://www.facebook.com/hayatyazilim/", videos: [{ url: "ignored" }] } }
    expect(normalizeMetaDataset([item], "run-1", "2026-09-16T00:00:00.000Z").ads[0]).toEqual({ competitor: "padok", searchUrl: item.inputUrl, adUrl: "https://www.facebook.com/ads/library/?id=123456789012345", adArchiveId: "123456789012345", pageId: "123", pageName: "Hayat Yazılım", pageUrl: "https://www.facebook.com/hayatyazilim/", advertiserMatchesBrand: true, startDate: "2026-09-01T00:00:00.000Z", endDate: null, isActive: true, headline: "PADOK", body: "Servis yönetimi", cta: "Learn more", linkUrl: "https://hayatyazilim.com/", linkDescription: null, fetchedAt: "2026-09-16T00:00:00.000Z", actorRunId: "run-1" })
  })
  test("unrelated page names are marked unverified", () => {
    const item = { inputUrl: metaSearchUrl("Kursoft"), adArchiveID: "123456789012345", pageName: "Other Company" }
    expect(normalizeMetaDataset([item], "run-1").ads[0]?.advertiserMatchesBrand).toBe(false)
  })
  test("page URL input can attribute a verified advertiser", () => {
    const item = { inputUrl: "https://www.facebook.com/Kursoft", adArchiveId: "123456789012345", pageName: "Kursoft Yazılım" }
    expect(normalizeMetaDataset([item], "run-1").ads[0]).toMatchObject({ competitor: "kursoft", advertiserMatchesBrand: true })
  })
  test("API validates Meta input and reads actor minimum without starting a run", async () => {
    const paths: string[] = []
    const mockedFetch: typeof fetch = async (input, init) => {
      paths.push(String(input))
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer secret-token")
      return new Response(JSON.stringify(String(input).includes("validate-input") ? { valid: true } : { data: { pricingInfos: [{ minimalMaxTotalChargeUsd: 0.0058 }] } }), { status: 200 })
    }
    const api = createApifyApi("secret-token", mockedFetch)
    expect(await api.actorMinimumCharge("apify~facebook-ads-scraper")).toBe(0.0058)
    await api.validateActorInput("apify~facebook-ads-scraper", metaInput())
    expect(paths.every((path) => !path.includes("/runs"))).toBe(true)
  })
})
