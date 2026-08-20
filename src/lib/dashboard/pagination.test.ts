import { describe, expect, test } from "bun:test"
import { computeDashboardPage } from "@/lib/dashboard/pagination"

describe("computeDashboardPage", () => {
  test("splits items into pages of the given size", () => {
    const items = Array.from({ length: 12 }, (_, i) => i)
    const result = computeDashboardPage(items, 0, 5)
    expect(result.pageCount).toBe(3)
    expect(result.pageItems).toEqual([0, 1, 2, 3, 4])
  })

  test("returns the requested page's slice", () => {
    const items = Array.from({ length: 12 }, (_, i) => i)
    const result = computeDashboardPage(items, 1, 5)
    expect(result.page).toBe(1)
    expect(result.pageItems).toEqual([5, 6, 7, 8, 9])
  })

  test("clamps an out-of-range page to the last page", () => {
    const items = Array.from({ length: 7 }, (_, i) => i)
    const result = computeDashboardPage(items, 5, 5)
    expect(result.page).toBe(1)
    expect(result.pageItems).toEqual([5, 6])
  })

  test("treats an empty list as a single empty page", () => {
    const result = computeDashboardPage<number>([], 0, 5)
    expect(result.pageCount).toBe(1)
    expect(result.page).toBe(0)
    expect(result.pageItems).toEqual([])
  })

  test("returns all items when they fit on one page", () => {
    const items = [1, 2, 3]
    const result = computeDashboardPage(items, 0, 5)
    expect(result.pageCount).toBe(1)
    expect(result.pageItems).toEqual(items)
  })
})
