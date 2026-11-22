import { describe, expect, test } from "bun:test"
import {
  normalizePartQuery,
  TECHNICIAN_PART_QUERY_MAX_LENGTH,
  TECHNICIAN_PART_SELECT,
} from "./parts-search"

describe("TECHNICIAN_PART_SELECT", () => {
  test("maliyet ve tedarikçi alanlarını saha rollerine açmaz", () => {
    const keys = Object.keys(TECHNICIAN_PART_SELECT)
    for (const forbidden of [
      "purchasePrice",
      "supplier",
      "supplierId",
      "supplierName",
      "supplierPrices",
      "workshopId",
    ]) {
      expect(keys).not.toContain(forbidden)
    }
    expect(keys.some((k) => /purchase|cost|margin/i.test(k))).toBe(false)
  })
})

describe("normalizePartQuery", () => {
  test("boşlukları kırpar, boş değerde boş dize döner", () => {
    expect(normalizePartQuery("  fren balatası ")).toBe("fren balatası")
    expect(normalizePartQuery(undefined)).toBe("")
    expect(normalizePartQuery("   ")).toBe("")
  })

  test("dizi parametresinde ilk değeri alır", () => {
    expect(normalizePartQuery(["filtre", "yağ"])).toBe("filtre")
  })

  test("aşırı uzun sorguyu sınırlar", () => {
    expect(normalizePartQuery("a".repeat(500))).toHaveLength(TECHNICIAN_PART_QUERY_MAX_LENGTH)
  })
})
