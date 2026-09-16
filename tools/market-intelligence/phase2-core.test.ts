import { describe, expect, test } from "bun:test"
import { createApifyApi } from "./apify"
import { googleInput, normalizeSearchDataset, phase2ChargeCap, PHASE2_QUERIES } from "./phase2-core"

describe("Phase 2 budget and input", () => {
  test("one page per query, no costly add-ons or HTML snapshots", () => {
    expect(googleInput()).toMatchObject({ maxPagesPerQuery: 1, countryCode: "tr", languageCode: "tr", focusOnPaidAds: false, saveHtml: false, saveHtmlToKeyValueStore: false, websiteContentScraper: { enable: false }, aiModeSearch: { enableAiMode: false } })
    expect(googleInput().queries.split("\n")).toHaveLength(7)
  })
  test("Actor minimum and both budgets block an unsafe run", () => {
    expect(phase2ChargeCap(0.1, 0.1, 5, 0.5, 0.5)).toBeCloseTo(0.5)
    expect(phase2ChargeCap(0.1, 0.1, 5, 0.5, 0.51)).toBe(0)
    expect(phase2ChargeCap(4.1, 4.1, 5, 0.5, 0.5)).toBe(0)
    expect(phase2ChargeCap(1.01, 0.52, 5, 0.5, 0.5)).toBe(0)
  })
  test("research run cannot exceed $0.50 cap", async () => {
    let calls = 0
    const mockedFetch: typeof fetch = async () => { calls++; return new Response("{}") }
    const api = createApifyApi("secret-token", mockedFetch)
    await expect(api.startResearchRun("apify~google-search-scraper", googleInput(), 0.51)).rejects.toThrow("Unsafe")
    expect(calls).toBe(0)
  })
  test("Actor metadata and input validation use header token and make no run", async () => {
    const paths: string[] = []
    const mockedFetch: typeof fetch = async (input, init) => {
      paths.push(String(input))
      expect(String(input)).not.toContain("secret-token")
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer secret-token")
      if (String(input).includes("validate-input")) return new Response(JSON.stringify({ valid: true }), { status: 200 })
      return new Response(JSON.stringify({ data: { pricingInfos: [{ minimalMaxTotalChargeUsd: 0.5 }] } }), { status: 200 })
    }
    const api = createApifyApi("secret-token", mockedFetch)
    expect(await api.actorMinimumCharge("apify~google-search-scraper")).toBe(0.5)
    await api.validateActorInput("apify~google-search-scraper", googleInput())
    expect(paths).toHaveLength(2)
    expect(paths.every((url) => !url.includes("/runs"))).toBe(true)
  })
})

describe("Google dataset normalization", () => {
  test("empty dataset", () => { expect(normalizeSearchDataset([], "run-1")).toEqual({ pages: [], malformedItems: 0 }) })
  test("malformed and unexpected query items are skipped", () => {
    expect(normalizeSearchDataset([null, { searchQuery: { term: "other", page: 1 }, organicResults: [] }], "run-1")).toEqual({ pages: [], malformedItems: 2 })
  })
  test("valid result fields normalize, unsafe URL and HTML are discarded", () => {
    const item = { searchQuery: { term: PHASE2_QUERIES[0], page: 1, url: "https://www.google.com/search?q=PADOK" }, organicResults: [{ title: "PADOK", url: "https://hayatyazilim.com/", description: "Servis" }, { title: "Bad", url: "javascript:alert(1)" }], html: "not saved" }
    expect(normalizeSearchDataset([item], "run-1", "2026-09-16T00:00:00.000Z").pages[0]).toEqual({ query: PHASE2_QUERIES[0], page: 1, searchUrl: item.searchQuery.url, organicResults: [{ position: 1, title: "PADOK", url: "https://hayatyazilim.com/", description: "Servis" }], fetchedAt: "2026-09-16T00:00:00.000Z", actorRunId: "run-1" })
  })
})
