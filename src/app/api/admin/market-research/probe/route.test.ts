import { beforeEach, describe, expect, test } from "bun:test"
import type { MarketResearchProvider } from "@/lib/market-research/types"
import { handleProbe } from "./route"

let adminAllowed = true
let researchCalls = 0
let receivedOptions: { maxMonthlyRequests?: number } | undefined

const deps = () => ({
  authorize: async () => {
    if (!adminAllowed) throw new Error("NEXT_NOT_FOUND")
    return { id: "admin-1" }
  },
  provider: () => ({
    name: "anthropic",
    research: async (_input: unknown, options?: { maxMonthlyRequests?: number }) => {
      researchCalls += 1
      receivedOptions = options
      return {
        provider: "anthropic",
        suggestions: [
          { sources: [{ url: "https://Shop.Example/parca", title: "A", accessedAt: "2026-08-23T00:00:00Z" }] },
          { sources: [{ url: "https://other.example/urun", title: "B", accessedAt: "2026-08-23T00:00:00Z" }] },
          { sources: [{ url: "https://shop.example/baska", title: "C", accessedAt: "2026-08-23T00:00:00Z" }] },
        ],
        usage: { webSearches: 4, costMicroUsd: 42_500 },
      }
    },
  }) as MarketResearchProvider,
})

function request(body: unknown): Request {
  return new Request("https://app-dev.bakimx.com/api/admin/market-research/probe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  adminAllowed = true
  researchCalls = 0
  receivedOptions = undefined
})

describe("POST /api/admin/market-research/probe", () => {
  test("platform admin olmayan çağrıyı provider'a ulaşmadan reddeder", async () => {
    adminAllowed = false
    await expect(handleProbe(request({ query: "yağ filtresi" }), deps())).rejects.toThrow("NEXT_NOT_FOUND")
    expect(researchCalls).toBe(0)
  })

  test("tek aylık çağrı sınırıyla domain ve ölçülen maliyeti döndürür", async () => {
    const response = await handleProbe(request({ query: "yağ filtresi", vehicle: "Fiat Egea" }), deps())
    expect(response.status).toBe(200)
    expect(researchCalls).toBe(1)
    expect(receivedOptions).toEqual({ maxMonthlyRequests: 1 })
    expect(await response.json()).toEqual({
      success: true,
      domains: ["other.example", "shop.example"],
      webSearches: 4,
      costMicroUsd: 42_500,
    })
  })

  test("geçersiz sorguda dış çağrı yapmaz", async () => {
    const response = await handleProbe(request({ query: "x" }), deps())
    expect(response.status).toBe(400)
    expect(researchCalls).toBe(0)
  })
})
