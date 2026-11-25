import { expect, test } from "bun:test"

import {
  DELIVERY_OVERDUE,
  DELIVERY_TODAY,
  resolveDeliveryFilter,
  type DeliveryFilterWhere,
} from "@/lib/orders/delivery-filter"
import { IN_SERVICE_ORDER_STATUSES } from "@/lib/orders/status-filter"

/**
 * "Bugün" Türkiye günüdür (#874). Beklentiler sabit UTC anlarıyla yazılır; dosya
 * sürecin `TZ`'sinden bağımsız geçmeli:
 *   TZ=UTC bun test src/lib/orders/delivery-filter.test.ts
 *   TZ=America/New_York bun test src/lib/orders/delivery-filter.test.ts
 */

// TR 23.11.2026 00:15:30
const NOW = new Date("2026-11-22T21:15:30.000Z")

/** Prisma `estimatedDeliveryAt` koşulunu tek bir ana uygular. */
function matchesDelivery(where: DeliveryFilterWhere, at: Date): boolean {
  if (!("estimatedDeliveryAt" in where)) return true
  const range = where.estimatedDeliveryAt
  if ("gte" in range && at < range.gte) return false
  return at < range.lt
}

test("bugün teslim: Türkiye gün başından ertesi gün başına, yalnız açık emirler", () => {
  expect(resolveDeliveryFilter(DELIVERY_TODAY, NOW)).toEqual({
    value: "today",
    where: {
      status: { in: IN_SERVICE_ORDER_STATUSES },
      estimatedDeliveryAt: {
        gte: new Date("2026-11-22T21:00:00.000Z"),
        lt: new Date("2026-11-23T21:00:00.000Z"),
      },
    },
  })
})

test("geciken teslim: Türkiye gün başından önceki tahmini teslim, yalnız açık emirler", () => {
  expect(resolveDeliveryFilter(DELIVERY_OVERDUE, NOW)).toEqual({
    value: "overdue",
    where: {
      status: { in: IN_SERVICE_ORDER_STATUSES },
      estimatedDeliveryAt: { lt: new Date("2026-11-22T21:00:00.000Z") },
    },
  })
})

test("ay sonunda ertesi gün bir sonraki ayın ilk günüdür", () => {
  // TR 30.11.2026 09:00
  const where = resolveDeliveryFilter(DELIVERY_TODAY, new Date("2026-11-30T06:00:00.000Z")).where
  expect(where).toMatchObject({
    estimatedDeliveryAt: {
      gte: new Date("2026-11-29T21:00:00.000Z"),
      lt: new Date("2026-11-30T21:00:00.000Z"),
    },
  })
})

test("regresyon #874: TR 00:30'da aynı gün 00:10 teslimi bugündür, gecikmiş değil", () => {
  // TR 26.11.2026 00:30 — UTC'de hâlâ 25.11.
  const now = new Date("2026-11-25T21:30:00.000Z")
  // TR 26.11.2026 00:10
  const estimatedDeliveryAt = new Date("2026-11-25T21:10:00.000Z")

  expect(matchesDelivery(resolveDeliveryFilter(DELIVERY_TODAY, now).where, estimatedDeliveryAt)).toBe(true)
  expect(matchesDelivery(resolveDeliveryFilter(DELIVERY_OVERDUE, now).where, estimatedDeliveryAt)).toBe(false)

  // TR 25.11.2026 23:50 — önceki Türkiye günü, artık gecikmiş.
  const yesterdayLate = new Date("2026-11-25T20:50:00.000Z")
  expect(matchesDelivery(resolveDeliveryFilter(DELIVERY_TODAY, now).where, yesterdayLate)).toBe(false)
  expect(matchesDelivery(resolveDeliveryFilter(DELIVERY_OVERDUE, now).where, yesterdayLate)).toBe(true)
})

test("teslim edilmiş ve iptal edilmiş emirler sayılmaz", () => {
  expect(IN_SERVICE_ORDER_STATUSES).not.toContain("delivered")
  expect(IN_SERVICE_ORDER_STATUSES).not.toContain("cancelled")
})

test("boş ve tanınmayan değer filtresiz hâle düşer", () => {
  expect(resolveDeliveryFilter("", NOW)).toEqual({ value: "", where: {} })
  expect(resolveDeliveryFilter(undefined, NOW)).toEqual({ value: "", where: {} })
  expect(resolveDeliveryFilter("yarin", NOW)).toEqual({ value: "", where: {} })
  expect(resolveDeliveryFilter(" today ", NOW).value).toBe("today")
})
