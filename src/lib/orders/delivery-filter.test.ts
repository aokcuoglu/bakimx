import { expect, test } from "bun:test"

import {
  DELIVERY_OVERDUE,
  DELIVERY_TODAY,
  resolveDeliveryFilter,
  startOfLocalDay,
} from "@/lib/orders/delivery-filter"
import { IN_SERVICE_ORDER_STATUSES } from "@/lib/orders/status-filter"

const NOW = new Date(2026, 10, 22, 21, 15, 30)

test("bugün teslim: yerel gün başından ertesi gün başına, yalnız açık emirler", () => {
  expect(resolveDeliveryFilter(DELIVERY_TODAY, NOW)).toEqual({
    value: "today",
    where: {
      status: { in: IN_SERVICE_ORDER_STATUSES },
      estimatedDeliveryAt: { gte: new Date(2026, 10, 22), lt: new Date(2026, 10, 23) },
    },
  })
})

test("geciken teslim: bugünden önceki tahmini teslim, yalnız açık emirler", () => {
  expect(resolveDeliveryFilter(DELIVERY_OVERDUE, NOW)).toEqual({
    value: "overdue",
    where: {
      status: { in: IN_SERVICE_ORDER_STATUSES },
      estimatedDeliveryAt: { lt: new Date(2026, 10, 22) },
    },
  })
})

test("ay sonunda ertesi gün bir sonraki ayın ilk günüdür", () => {
  const where = resolveDeliveryFilter(DELIVERY_TODAY, new Date(2026, 10, 30, 9)).where
  expect(where).toMatchObject({
    estimatedDeliveryAt: { gte: new Date(2026, 10, 30), lt: new Date(2026, 11, 1) },
  })
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

test("gün başı saat bilgisini sıfırlar", () => {
  expect(startOfLocalDay(NOW)).toEqual(new Date(2026, 10, 22, 0, 0, 0, 0))
})
