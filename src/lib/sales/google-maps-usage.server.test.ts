import { beforeEach, describe, expect, mock, test } from "bun:test"

mock.module("server-only", () => ({}))

type Counter = {
  period: string
  sku: string
  reservedCount: number
  blockedCount: number
  lastReservedAt: Date | null
  lastBlockedAt: Date | null
}

const counters = new Map<string, Counter>()
let storeIsDown = false

function counterKey(period: string, sku: string): string {
  return `${period}:${sku}`
}

mock.module("@/lib/db", () => ({
  prisma: {
    $queryRaw: async (_sql: TemplateStringsArray, period: string, sku: string, limit: number) => {
      if (storeIsDown) throw new Error("ECONNREFUSED")
      const key = counterKey(period, sku)
      const row = counters.get(key)
      if (row && row.reservedCount >= limit) return []

      const next: Counter = row ?? {
        period,
        sku,
        reservedCount: 0,
        blockedCount: 0,
        lastReservedAt: null,
        lastBlockedAt: null,
      }
      next.reservedCount += 1
      next.lastReservedAt = new Date()
      counters.set(key, next)
      return [{
        reserved_count: next.reservedCount,
        blocked_count: next.blockedCount,
        last_reserved_at: next.lastReservedAt,
        last_blocked_at: next.lastBlockedAt,
      }]
    },
    $executeRaw: async (_sql: TemplateStringsArray, period: string, sku: string) => {
      if (storeIsDown) throw new Error("ECONNREFUSED")
      const row = counters.get(counterKey(period, sku))
      if (!row) return 0
      row.blockedCount += 1
      row.lastBlockedAt = new Date()
      return 1
    },
    googleMapsUsageCounter: {
      findMany: async ({ where }: { where: { period: string } }) => (
        [...counters.values()]
          .filter((row) => row.period === where.period)
          .map((row) => ({ ...row }))
      ),
    },
  },
}))

const { getGoogleMapsUsageSnapshot, reserveGoogleMapsUsage } = await import("./google-maps-usage.server")
const { GOOGLE_MAPS_SKU_POLICIES, googleMapsUtcPeriod } = await import("./google-maps-quota")

beforeEach(() => {
  counters.clear()
  storeIsDown = false
})

describe("Google Maps maliyet kapısı", () => {
  test("ücretsiz SKU sınırlarının yalnız %80'ini uygulamaya açar", () => {
    for (const policy of Object.values(GOOGLE_MAPS_SKU_POLICIES)) {
      expect(policy.hardMonthlyLimit).toBe(policy.freeMonthlyCap * 0.8)
      expect(policy.cloudDailyLimit * 31).toBeLessThan(policy.freeMonthlyCap)
    }
  })

  test("eşzamanlı rezervasyonlarda aylık sert sınırı aşmaz ve fazlayı bloklar", async () => {
    const period = "2026-08"
    counters.set(counterKey(period, "nearby_search_pro"), {
      period,
      sku: "nearby_search_pro",
      reservedCount: 3_998,
      blockedCount: 0,
      lastReservedAt: new Date("2026-08-29T08:00:00.000Z"),
      lastBlockedAt: null,
    })

    const results = await Promise.all([
      reserveGoogleMapsUsage("nearby_search_pro", new Date("2026-08-29T09:00:00.000Z")),
      reserveGoogleMapsUsage("nearby_search_pro", new Date("2026-08-29T09:00:00.000Z")),
      reserveGoogleMapsUsage("nearby_search_pro", new Date("2026-08-29T09:00:00.000Z")),
    ])

    expect(results.filter((result) => result.allowed)).toHaveLength(2)
    expect(results.filter((result) => !result.allowed)).toHaveLength(1)
    expect(counters.get(counterKey(period, "nearby_search_pro"))?.reservedCount).toBe(4_000)
    expect(counters.get(counterKey(period, "nearby_search_pro"))?.blockedCount).toBe(1)
  })

  test("sayaç deposu erişilemezse izin üretmez", async () => {
    storeIsDown = true
    await expect(
      reserveGoogleMapsUsage("dynamic_maps", new Date("2026-08-29T09:00:00.000Z")),
    ).rejects.toThrow("ECONNREFUSED")
  })

  test("UTC ayı değişince yeni dönem sayacı kullanır", async () => {
    await reserveGoogleMapsUsage("dynamic_maps", new Date("2026-08-31T23:59:59.000Z"))
    await reserveGoogleMapsUsage("dynamic_maps", new Date("2026-09-01T00:00:00.000Z"))

    expect(googleMapsUtcPeriod(new Date("2026-08-31T23:59:59.000Z"))).toBe("2026-08")
    expect(counters.get(counterKey("2026-08", "dynamic_maps"))?.reservedCount).toBe(1)
    expect(counters.get(counterKey("2026-09", "dynamic_maps"))?.reservedCount).toBe(1)
  })

  test("health özeti boş SKU'ları da sıfırla ve politika bilgisiyle gösterir", async () => {
    await reserveGoogleMapsUsage("place_details_essentials", new Date("2026-08-29T09:00:00.000Z"))

    const snapshot = await getGoogleMapsUsageSnapshot(new Date("2026-08-29T09:05:00.000Z"))

    expect(snapshot.period).toBe("2026-08")
    expect(snapshot.rows).toHaveLength(4)
    expect(snapshot.rows.find((row) => row.sku === "place_details_essentials")?.used).toBe(1)
    expect(snapshot.rows.find((row) => row.sku === "autocomplete_requests")?.used).toBe(0)
  })
})

