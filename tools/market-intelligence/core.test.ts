import { describe, expect, test } from "bun:test"
import { createApifyApi } from "./apify"
import { SITES, actorInput, assessBudget, ensureSucceeded, normalizeDataset, readBudgetConfig, requireToken, reservedRunAllowance } from "./core"

const config = { monthlyCreditUsd: 5, pilotBudgetUsd: 0.5 }

describe("Apify pilot safety", () => {
  test("missing APIFY_API_TOKEN blocks connectivity and Actor runs", () => {
    expect(() => requireToken(undefined)).toThrow("APIFY_API_TOKEN is missing")
    expect(() => createApifyApi("")).toThrow("APIFY_API_TOKEN is missing")
  })
  test("monthly usage at $4.50 blocks new runs", () => {
    expect(assessBudget(4.5, 4.5, config)).toMatchObject({ allowed: false, reason: "Apify free credit safety limit reached. No scraping executed." })
  })
  test("remaining credit under $0.50 blocks new runs", () => {
    expect(assessBudget(4.49, 4.49, { monthlyCreditUsd: 4.9, pilotBudgetUsd: 0.5 }).allowed).toBe(false)
  })
  test("pilot spend at $0.50 blocks another run", () => {
    expect(assessBudget(1.5, 1, config)).toMatchObject({ allowed: false, pilotSpend: 0.5 })
  })
  test("run cap stays under $0.12 and remaining pilot/monthly headroom", () => {
    expect(assessBudget(4.46, 4.4, config).maxRunChargeUsd).toBeCloseTo(0.04)
    expect(assessBudget(1.49, 1, config).maxRunChargeUsd).toBeCloseTo(0.01)
  })
  test("reserved run caps protect budget even while monthly usage is delayed", () => {
    const budget = assessBudget(0, 0, config)
    expect(reservedRunAllowance(budget, 0, config, 0.48)).toBeCloseTo(0.02)
    expect(reservedRunAllowance(budget, 0, config, 0.5)).toBe(0)
    const nearMonthly = assessBudget(4.49, 4.49, config)
    expect(reservedRunAllowance(nearMonthly, 4.49, config, 0.01)).toBe(0)
  })
  test("env overrides cannot raise hard budget ceilings", () => {
    expect(() => readBudgetConfig({ APIFY_PILOT_BUDGET_USD: "0.51" })).toThrow()
    expect(() => readBudgetConfig({ APIFY_MONTHLY_CREDIT_USD: "6" })).toThrow()
  })
  test("actor failure is surfaced without automatic retry", () => {
    expect(() => ensureSucceeded("FAILED")).toThrow("No automatic retry")
    expect(() => ensureSucceeded("SUCCEEDED")).not.toThrow()
  })
  test("input locks Cheerio, domain page cap, robots, and paid extras", () => {
    expect(actorInput(SITES[0])).toMatchObject({ crawlerType: "cheerio", maxCrawlPages: 8, maxResults: 8, maxCrawlDepth: 2, useSitemaps: false, respectRobotsTxtFile: true, summarize: false, saveFiles: false, proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: [] } })
  })
})

describe("dataset normalization", () => {
  test("empty dataset produces no pages", () => {
    expect(normalizeDataset([], SITES[0], "run-1")).toEqual({ pages: [], malformedItems: 0 })
  })
  test("malformed and off-domain items are skipped", () => {
    expect(normalizeDataset([null, { url: "not-url" }, { url: "https://other.example" }], SITES[0], "run-1")).toEqual({ pages: [], malformedItems: 3 })
  })
  test("official crawler item fields normalize successfully", () => {
    const item = { url: "https://bakimx.com/ozellikler", crawl: { loadedUrl: "https://bakimx.com/ozellikler", loadedTime: "2026-09-16T12:00:00.000Z", depth: 1 }, metadata: { title: "Özellikler", description: "Servis yönetimi", languageCode: "tr" }, text: "İş emri", markdown: "# İş emri", html: "<h1>not saved</h1>" }
    expect(normalizeDataset([item], SITES[0], "run-1").pages[0]).toEqual({ competitor: "bakimx", sourceUrl: item.url, loadedUrl: item.url, pageTitle: "Özellikler", metaDescription: "Servis yönetimi", language: "tr", crawlDepth: 1, markdown: "# İş emri", text: "İş emri", fetchedAt: "2026-09-16T12:00:00.000Z", actorRunId: "run-1" })
  })
})

test("Apify connectivity is mocked and token stays in Authorization header", async () => {
  let called = 0
  const mockedFetch: typeof fetch = async (input, init) => {
    called++
    expect(String(input)).not.toContain("secret-token")
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer secret-token")
    return new Response(JSON.stringify({ data: { totalUsageCreditsUsdAfterVolumeDiscount: 0.125 } }), { status: 200 })
  }
  const api = createApifyApi("secret-token", mockedFetch)
  expect(await api.monthlyUsage()).toBe(0.125)
  expect(called).toBe(1)
})
