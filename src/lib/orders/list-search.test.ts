import { describe, expect, test } from "bun:test"
import { buildOrderFilterSearch, buildOrderLoadMoreSearch, buildOrderSortSearch } from "./list-search"

const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null })

describe("buildOrderFilterSearch", () => {
  test("limit düşer, view korunur", () => {
    const out = buildOrderFilterSearch(new URLSearchParams("limit=300&view=%7B%7D&q=eski"), form({ q: "yeni" }))
    expect(out.get("limit")).toBeNull()
    expect(out.get("view")).toBe("{}")
    expect(out.get("q")).toBe("yeni")
  })
  test("delivery formdan okunur, boş seçim param'ı kaldırır", () => {
    expect(buildOrderFilterSearch(new URLSearchParams(), form({ delivery: "today" })).get("delivery")).toBe("today")
    expect(buildOrderFilterSearch(new URLSearchParams("delivery=today"), form({ delivery: "" })).has("delivery")).toBe(false)
  })
})

describe("buildOrderLoadMoreSearch", () => {
  test("limit set edilir, diğer param'lar korunur", () => {
    const out = buildOrderLoadMoreSearch(new URLSearchParams("limit=100&status=approved&view=%7B%7D&delivery=overdue"), 200)
    expect(out.get("limit")).toBe("200")
    expect(out.get("status")).toBe("approved")
    expect(out.get("view")).toBe("{}")
    expect(out.get("delivery")).toBe("overdue")
  })
})

describe("buildOrderSortSearch", () => {
  test("sort/dir yazılır, limit düşer, filtre ve view korunur", () => {
    const out = buildOrderSortSearch(new URLSearchParams("limit=300&status=approved&view=%7B%7D"), { column: "total", desc: true })
    expect(out.get("sort")).toBe("total")
    expect(out.get("dir")).toBe("desc")
    expect(out.has("limit")).toBe(false)
    expect(out.get("status")).toBe("approved")
    expect(out.get("view")).toBe("{}")
  })
  test("null sıralamayı temizler", () => {
    const out = buildOrderSortSearch(new URLSearchParams("sort=total&dir=asc&q=34"), null)
    expect(out.has("sort")).toBe(false)
    expect(out.has("dir")).toBe(false)
    expect(out.get("q")).toBe("34")
  })
})
