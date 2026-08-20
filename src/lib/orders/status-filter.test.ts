import { expect, test } from "bun:test"

import {
  ACTIVE_ORDER_FILTER,
  ACTIVE_ORDER_STATUSES,
  resolveOrderStatusFilter,
} from "@/lib/orders/status-filter"

test("aktif filtresi kart sayımındaki tüm açık iş emri statülerini kapsar", () => {
  expect(resolveOrderStatusFilter(ACTIVE_ORDER_FILTER)).toEqual({
    value: "active",
    where: { status: { in: ACTIVE_ORDER_STATUSES } },
  })
  expect(ACTIVE_ORDER_STATUSES).toEqual([
    "draft",
    "waiting_approval",
    "approved",
    "in_progress",
    "waiting_parts",
  ])
})

test("tekil ve boş durum filtreleri çözülür", () => {
  expect(resolveOrderStatusFilter("delivered")).toEqual({
    value: "delivered",
    where: { status: "delivered" },
  })
  expect(resolveOrderStatusFilter("")).toEqual({ value: "", where: {} })
  expect(resolveOrderStatusFilter("tanimsiz")).toEqual({ value: "", where: {} })
})
