import { describe, expect, test } from "bun:test"

import { matchesColumnFilter, ORDER_LIST_DATA_COLUMN_ORDER } from "./list-columns"

describe("order list columns", () => {
  test("technician is the last data column", () => {
    expect(ORDER_LIST_DATA_COLUMN_ORDER.at(-1)).toBe("technician")
    expect(ORDER_LIST_DATA_COLUMN_ORDER.indexOf("dates")).toBeLessThan(
      ORDER_LIST_DATA_COLUMN_ORDER.indexOf("technician"),
    )
  })

  test("filter matches Turkish text without case", () => {
    expect(matchesColumnFilter("Ali Teknisyen", "ali")).toBe(true)
    expect(matchesColumnFilter("İş emri", "İŞ")).toBe(true)
    expect(matchesColumnFilter("34 HMK 434", "hmk")).toBe(true)
    expect(matchesColumnFilter("Taslak", "iptal")).toBe(false)
    expect(matchesColumnFilter("Taslak", "  ")).toBe(true)
  })
})
