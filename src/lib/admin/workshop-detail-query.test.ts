import { describe, expect, test } from "bun:test"
import {
  hasWorkshopOrderFilters,
  normalizeWorkshopOrderPage,
  ORDER_FILTER_PARAMS,
  parseWorkshopDateRange,
  parseWorkshopOrderFilters,
  replaceWorkshopDetailFilterParams,
  USAGE_FILTER_PARAMS,
  WORKSHOP_ORDER_PAGE_SIZE,
} from "@/lib/admin/workshop-detail-query"

describe("iş yeri detay filtreleri", () => {
  test("geçerli sipariş enumlarını kabul eder, geçersizleri varsayılana döndürür", () => {
    expect(parseWorkshopOrderFilters({
      orderStatus: "confirmed",
      orderPlan: "premium",
      orderCycle: "yearly",
    })).toMatchObject({ status: "confirmed", plan: "premium", cycle: "yearly" })

    expect(parseWorkshopOrderFilters({
      orderStatus: "paid",
      orderPlan: "enterprise",
      orderCycle: "weekly",
    })).toMatchObject({ status: "", plan: "", cycle: "" })
  })

  test("eksik tarih sınırını açık uçlu aralık olarak korur", () => {
    expect(parseWorkshopDateRange("2026-08-26", undefined)).toEqual({
      from: "2026-08-26",
      to: "",
      range: { gte: new Date("2026-08-25T21:00:00.000Z") },
    })
    expect(parseWorkshopDateRange(undefined, "2026-08-26")).toEqual({
      from: "",
      to: "2026-08-26",
      range: { lt: new Date("2026-08-26T21:00:00.000Z") },
    })
  })

  test("geçersiz ve ters tarih aralıklarını temizler", () => {
    expect(parseWorkshopDateRange("2026-02-31", "nope")).toEqual({ from: "", to: "" })
    expect(parseWorkshopDateRange("2026-08-27", "2026-08-26")).toEqual({ from: "", to: "" })
  })

  test("aynı günü kabul eder ve bitiş gününü sorguya dahil eder", () => {
    expect(parseWorkshopDateRange("2026-08-26", "2026-08-26")).toEqual({
      from: "2026-08-26",
      to: "2026-08-26",
      range: {
        gte: new Date("2026-08-25T21:00:00.000Z"),
        lt: new Date("2026-08-26T21:00:00.000Z"),
      },
    })
  })

  test("geçersiz sayfayı bire, taşan sayfayı son sayfaya sıkıştırır", () => {
    expect(parseWorkshopOrderFilters({ orderPage: "0" }).requestedPage).toBe(1)
    expect(parseWorkshopOrderFilters({ orderPage: "2x" }).requestedPage).toBe(1)
    expect(parseWorkshopOrderFilters({ orderPage: "2" }).requestedPage).toBe(2)
    expect(normalizeWorkshopOrderPage(99, WORKSHOP_ORDER_PAGE_SIZE + 1)).toBe(2)
  })

  test("yalnız gerçek sipariş filtrelerini etkin sayar", () => {
    expect(hasWorkshopOrderFilters(parseWorkshopOrderFilters({ orderPage: "3" }))).toBe(false)
    expect(hasWorkshopOrderFilters(parseWorkshopOrderFilters({ orderStatus: "confirmed" }))).toBe(true)
  })

  test("filtre grupları yalnız kendi URL parametrelerini değiştirir", () => {
    const initial = "from=2026-08-01&to=2026-08-02&orderStatus=confirmed&orderPage=3&view=compact"
    const usageUpdated = replaceWorkshopDetailFilterParams(initial, USAGE_FILTER_PARAMS, {
      from: "2026-08-10",
      to: "2026-08-11",
    })
    expect(usageUpdated).toContain("orderStatus=confirmed")
    expect(usageUpdated).toContain("orderPage=3")
    expect(usageUpdated).toContain("view=compact")

    const ordersCleared = replaceWorkshopDetailFilterParams(usageUpdated, ORDER_FILTER_PARAMS)
    expect(ordersCleared).toContain("from=2026-08-10")
    expect(ordersCleared).toContain("to=2026-08-11")
    expect(ordersCleared).toContain("view=compact")
    expect(ordersCleared).not.toContain("orderStatus")
    expect(ordersCleared).not.toContain("orderPage")
  })
})
