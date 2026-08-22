import { describe, expect, test } from "bun:test"
import { parseJsonImport } from "./json-parse"

describe("parseJsonImport", () => {
  test("reads arrays and preserves fields appearing in later rows", () => {
    const result = parseJsonImport('[{"sku":"A"},{"sku":"B","stock":2}]', 20)
    expect("error" in result).toBe(false)
    if ("error" in result) return
    expect(result.header).toEqual(["sku", "stock"])
    expect(result.rows.map((row) => row.cells)).toEqual([["A", ""], ["B", "2"]])
  })

  test("reads numeric-key object exports in numeric order and enforces the row limit", () => {
    const result = parseJsonImport('{"10":{"sku":"C"},"2":{"sku":"B"},"0":{"sku":"A"}}', 2)
    expect("error" in result).toBe(false)
    if ("error" in result) return
    expect(result.rows.map((row) => row.cells[0])).toEqual(["A", "B"])
    expect(result.truncated).toBe(true)
  })

  test("rejects ambiguous roots and non-object rows", () => {
    expect(parseJsonImport('{"products":[]}', 20)).toEqual({
      error: "JSON kökü bir ürün dizisi veya sayısal anahtarlı ürün nesnesi olmalıdır.",
    })
    expect(parseJsonImport('["A"]', 20)).toEqual({ error: "JSON içindeki her ürün bir nesne olmalıdır." })
  })
})
