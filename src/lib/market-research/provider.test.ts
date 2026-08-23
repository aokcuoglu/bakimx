import { beforeEach, describe, expect, test } from "bun:test"
import { getMarketResearchProvider, parseAnthropicMarketResearchConfig, parseSourcedSuggestions, resetMarketResearchProvider } from "./provider"

const env = (values: Record<string, string | undefined>) => (name: string) => values[name]

beforeEach(resetMarketResearchProvider)

test("mock varsayılandır ve dış servis yapılandırması istemez", async () => {
  const provider = getMarketResearchProvider(env({}))
  expect(provider.name).toBe("mock")
  expect(await provider.research({ query: "yağ filtresi" })).toEqual({ provider: "mock", suggestions: [] })
})

test("anthropic anahtarı yoksa sessizce mock'a düşer", () => {
  expect(getMarketResearchProvider(env({ MARKET_RESEARCH_PROVIDER: "anthropic" })).name).toBe("mock")
})

describe("anthropic fail-closed sınırları", () => {
  test("onaylı max_uses yoksa açılmaz", () => {
    expect(() => parseAnthropicMarketResearchConfig(env({ ANTHROPIC_API_KEY: "key" }))).toThrow("MAX_USES")
  })

  test("izinli domain listesi yoksa açılmaz", () => {
    expect(() => parseAnthropicMarketResearchConfig(env({ ANTHROPIC_API_KEY: "key", MARKET_RESEARCH_MAX_USES: "2", MARKET_RESEARCH_MONTHLY_BUDGET_USD: "5" }))).toThrow("ALLOWED_DOMAINS")
  })

  test("aylık bütçe tavanı olmadan açılmaz", () => {
    expect(() => parseAnthropicMarketResearchConfig(env({
      ANTHROPIC_API_KEY: "key",
      MARKET_RESEARCH_MAX_USES: "10",
      MARKET_RESEARCH_ALLOWED_DOMAINS: "example.com",
    }))).toThrow("bütçe")
  })

  test("domainsiz keşif yalnız exact app-dev URL'inde açılır", () => {
    expect(parseAnthropicMarketResearchConfig(env({
      APP_URL: "https://app-dev.bakimx.com",
      ANTHROPIC_API_KEY: "key",
      MARKET_RESEARCH_MAX_USES: "10",
      MARKET_RESEARCH_MONTHLY_BUDGET_USD: "5",
      MARKET_RESEARCH_DISCOVERY_MODE: "true",
    }))).toMatchObject({ discoveryMode: true, allowedDomains: [] })
    expect(() => parseAnthropicMarketResearchConfig(env({
      APP_URL: "https://app.bakimx.com",
      ANTHROPIC_API_KEY: "key",
      MARKET_RESEARCH_MAX_USES: "10",
      MARKET_RESEARCH_MONTHLY_BUDGET_USD: "5",
      MARKET_RESEARCH_DISCOVERY_MODE: "true",
    }))).toThrow("app-dev")
    expect(() => parseAnthropicMarketResearchConfig(env({
      APP_URL: "https://app-dev.bakimx.com.evil.example",
      ANTHROPIC_API_KEY: "key",
      MARKET_RESEARCH_MAX_USES: "10",
      MARKET_RESEARCH_MONTHLY_BUDGET_USD: "5",
      MARKET_RESEARCH_DISCOVERY_MODE: "true",
    }))).toThrow("app-dev")
  })

  test("yalnız açıkça verilen değerleri kabul eder", () => {
    expect(parseAnthropicMarketResearchConfig(env({
      ANTHROPIC_API_KEY: "key",
      MARKET_RESEARCH_MAX_USES: "2",
      MARKET_RESEARCH_MONTHLY_BUDGET_USD: "5",
      MARKET_RESEARCH_ALLOWED_DOMAINS: "example.com, shop.example",
    }))).toMatchObject({ maxUses: 2, monthlyBudgetMicroUsd: 5_000_000, allowedDomains: ["example.com", "shop.example"] })
  })
})

test("kaynaksız ve geçersiz URL'li önerileri eler", () => {
  const suggestions = parseSourcedSuggestions(JSON.stringify([
    { name: "Kaynaksız" },
    { name: "Bozuk", sources: [{ url: "javascript:alert(1)", title: "x" }] },
    { name: "Geçerli", sources: [{ url: "https://example.com/parca", title: "Ürün" }] },
  ]), "2026-08-22T00:00:00.000Z")
  expect(suggestions).toHaveLength(1)
  expect(suggestions[0].name).toBe("Geçerli")
  expect(suggestions[0].sources[0].accessedAt).toBe("2026-08-22T00:00:00.000Z")
})
