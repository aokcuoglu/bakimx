import { describe, expect, it, mock } from "bun:test"

/**
 * `POST /api/catalog/bakimx/match` — TecDoc articleNo ile BakımX ürünlerini toplu eşleştir (Faz 2).
 * Asıl test havuzu bakimx-catalog.test.ts'te; burada uç davranışı test edilir.
 */

let featureEnabled = true
let workshopId = "ws-0"

mock.module("@/lib/auth", () => ({
  getCurrentUserWithWorkshop: async () => ({
    user: { id: "user-1", workshopId },
    workshop: { id: workshopId, planTier: "starter" },
  }),
}))

mock.module("@/lib/features", () => ({
  resolveFeature: async () => featureEnabled,
}))

mock.module("@/lib/db", () => ({
  prisma: {
    // BAK-47: eşleştirme yolu da atölye iskontosunu okur (iskontosuz atölye).
    workshop: {
      findUnique: async () => ({ bakimxDiscountBps: 0 }),
    },
    bakimxProduct: {
      findMany: async () => [
        {
          id: "p-aku",
          sku: "C 27 125",
          name: "Akü",
          brandId: "brand-1",
          brandName: "Mutlu",
          categoryKey: "aku",
          oemNumbers: ["0 986 4B7 035"],
          barcode: null,
          unit: "adet",
          description: null,
          imageUrl: null,
          workshopPriceKurus: 248_000,
          vatRateBps: 2000,
          currency: "TRY",
          stockQty: 4,
          backorderable: false,
          leadTimeDays: null,
        },
      ],
    },
  },
}))

const { POST } = await import("./route")

function matchRequest(articleNumbers: string[]): Request {
  return new Request("https://app.bakimx.com/api/catalog/bakimx/match", {
    method: "POST",
    body: JSON.stringify({ articleNumbers }),
  })
}

describe("POST /api/catalog/bakimx/match", () => {
  it("kapı kapalıyken 403 + feature_locked döner", async () => {
    featureEnabled = false
    workshopId = "ws-locked"
    const res = await POST(matchRequest(["C 27 125"]))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "feature_locked" })
    featureEnabled = true
  })

  it("istemci sınırı uygulanır", async () => {
    workshopId = "ws-limit"
    const numbers = Array.from({ length: 201 }, (_, i) => `NO${i}`)
    const res = await POST(matchRequest(numbers))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("Çok fazla")
  })

  it("başarılı eşleştirme { articleNo → BakimxProductSummary } haritası döner", async () => {
    workshopId = "ws-success"
    const res = await POST(matchRequest(["C 27 125"]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.matches).toMatchObject({
      "C 27 125": { id: "p-aku", workshopPriceKurus: 248_000 },
    })
  })

  it("eşleşmeyen numara haritaya girmez", async () => {
    workshopId = "ws-partial"
    const res = await POST(matchRequest(["C 27 125", "YOKYOK"]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.matches).toHaveProperty("C 27 125")
    expect(body.matches).not.toHaveProperty("YOKYOK")
  })

  it("boş liste geçişte { } döner", async () => {
    workshopId = "ws-empty"
    const res = await POST(matchRequest([]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.matches).toEqual({})
  })
})
