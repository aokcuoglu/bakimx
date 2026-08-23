import { beforeEach, describe, expect, test } from "bun:test"
import type { MarketResearchProvider } from "@/lib/market-research/types"
import { handleMarketResearch } from "./route"

let featureEnabled = true
let providerName: "mock" | "anthropic" = "anthropic"
let researchCalls = 0
let rateLimitExempt = false
let limitAllowed = true
let limitCalls = 0
let providerError: Error | null = null
let credentialApiKey: string | null = null
let receivedApiKey: string | undefined
let receivedFundingSource: string | undefined

const workshop = {
  id: "workshop-1",
  planTier: "premium",
  subscriptionStatus: "active",
  approvalStatus: "approved",
  trialEndsAt: null,
  currentPeriodEnd: null,
}

function deps() {
  return {
    authorize: async () => ({
      user: { id: "user-1", email: "owner@example.com", workshopId: "workshop-1" },
      workshop,
    }) as never,
    featureEnabled: async () => featureEnabled,
    provider: (apiKey?: string) => {
      receivedApiKey = apiKey
      return ({
      name: providerName,
      research: async (_input, options) => {
        researchCalls += 1
        receivedFundingSource = options?.workshop?.fundingSource
        if (providerError) throw providerError
        return {
          provider: providerName,
          suggestions: [{
            name: "Fren balatası",
            brand: "Örnek",
            partNumber: "ABC-1",
            priceText: "₺1.000",
            notes: null,
            sources: [{ url: "https://example.com/parca", title: "Satıcı", accessedAt: "2026-08-23T00:00:00Z" }],
          }],
        }
      },
    }) as MarketResearchProvider
    },
    credential: async () => credentialApiKey ? { apiKey: credentialApiKey } : null,
    rateLimitExempt: async () => rateLimitExempt,
    limit: async () => {
      limitCalls += 1
      return { allowed: limitAllowed, retryAfterMs: 60_000 }
    },
  }
}

function request(body: unknown) {
  return new Request("https://app.bakimx.com/api/market-research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  featureEnabled = true
  providerName = "anthropic"
  researchCalls = 0
  rateLimitExempt = false
  limitAllowed = true
  limitCalls = 0
  providerError = null
  credentialApiKey = null
  receivedApiKey = undefined
  receivedFundingSource = undefined
})

describe("POST /api/market-research", () => {
  test("Premium kapısı kapalıysa sağlayıcıya ulaşmaz", async () => {
    featureEnabled = false
    const response = await handleMarketResearch(request({ query: "fren balatası" }), deps())
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe("feature_locked")
    expect(researchCalls).toBe(0)
  })

  test("kaynaklı sonuçları Premium üyeye döndürür", async () => {
    const response = await handleMarketResearch(request({ query: "fren balatası", vehicle: "Tesla Model Y" }), deps())
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.suggestions[0].sources[0].url).toBe("https://example.com/parca")
    expect(researchCalls).toBe(1)
  })

  test("sağlayıcı kapalıysa altyapı adını kullanıcıya sızdırmaz", async () => {
    providerName = "mock"
    const response = await handleMarketResearch(request({ query: "fren balatası" }), deps())
    expect(response.status).toBe(503)
    const payload = await response.json()
    expect(payload.code).toBe("service_unavailable")
    expect(payload.error).not.toContain("Anthropic")
    expect(researchCalls).toBe(0)
  })

  test("geçersiz sorguda dış çağrı yapmaz", async () => {
    const response = await handleMarketResearch(request({ query: "x" }), deps())
    expect(response.status).toBe(400)
    expect(researchCalls).toBe(0)
  })

  test("normal Premium kullanıcı saatlik limite tabidir", async () => {
    limitAllowed = false
    const response = await handleMarketResearch(request({ query: "fren balatası" }), deps())
    expect(response.status).toBe(429)
    expect(limitCalls).toBe(1)
    expect(researchCalls).toBe(0)
  })

  test("developer/platform yöneticisi hız sınırını kullanmaz", async () => {
    rateLimitExempt = true
    limitAllowed = false
    const response = await handleMarketResearch(request({ query: "fren balatası" }), deps())
    expect(response.status).toBe(200)
    expect(limitCalls).toBe(0)
    expect(researchCalls).toBe(1)
  })

  test("şirket anahtarı varsa customer-funded sağlayıcı bağlamını kullanır", async () => {
    credentialApiKey = "sk-ant-company-secret"
    const response = await handleMarketResearch(request({ query: "fren balatası" }), deps())
    expect(response.status).toBe(200)
    expect(receivedApiKey).toBe(credentialApiKey)
    expect(receivedFundingSource).toBe("customer")
  })

  test("sağlayıcı timeout'unu ayırt edilebilir 504 yanıtına çevirir", async () => {
    providerError = new Error("Request was aborted.")
    const response = await handleMarketResearch(request({ query: "fren balatası" }), deps())
    expect(response.status).toBe(504)
    const payload = await response.json()
    expect(payload.code).toBe("upstream_timeout")
    expect(payload.error).toContain("zaman aşımına")
  })
})
