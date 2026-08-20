import { describe, expect, test } from "bun:test"
import { clampGetirbakimLimit, parseGetirbakimProduct, GETIRBAKIM_MAX_LIMIT, GETIRBAKIM_DEFAULT_LIMIT } from "./types"

describe("clampGetirbakimLimit", () => {
  test("geçersiz/eksik değer varsayılana düşer", () => {
    expect(clampGetirbakimLimit(null)).toBe(GETIRBAKIM_DEFAULT_LIMIT)
    expect(clampGetirbakimLimit(undefined)).toBe(GETIRBAKIM_DEFAULT_LIMIT)
    expect(clampGetirbakimLimit(0)).toBe(GETIRBAKIM_DEFAULT_LIMIT)
    expect(clampGetirbakimLimit(-5)).toBe(GETIRBAKIM_DEFAULT_LIMIT)
    expect(clampGetirbakimLimit(Number.NaN)).toBe(GETIRBAKIM_DEFAULT_LIMIT)
  })

  test("üst sınır sunucuda uygulanır", () => {
    expect(clampGetirbakimLimit(5)).toBe(5)
    expect(clampGetirbakimLimit(999)).toBe(GETIRBAKIM_MAX_LIMIT)
  })
})

describe("parseGetirbakimProduct — fiyat kuruş olarak taşınır", () => {
  test("kuruş alanları tam sayı olarak korunur", () => {
    const p = parseGetirbakimProduct({
      id: "1",
      name: "Balata",
      listPriceKurus: 189000,
      b2bPriceKurus: 160650,
      discountBps: 1500,
      vatRateBps: 2000,
    })
    expect(p?.listPriceKurus).toBe(189000)
    expect(p?.b2bPriceKurus).toBe(160650)
    expect(p?.discountBps).toBe(1500)
    expect(p?.vatRateBps).toBe(2000)
  })

  test("ondalık gelen fiyat kesilir — kuruş tam sayıdır", () => {
    const p = parseGetirbakimProduct({ id: "1", name: "Balata", b2bPriceKurus: 160650.7 })
    expect(p?.b2bPriceKurus).toBe(160650)
    expect(Number.isInteger(p?.b2bPriceKurus)).toBe(true)
  })

  test("fiyat alanı yoksa null döner, 0 DEĞİL", () => {
    // 0 kuruş "bedava" demek olurdu; fiyatsız ürün yüzeyde "fiyat sorulur".
    const p = parseGetirbakimProduct({ id: "1", name: "Balata" })
    expect(p?.listPriceKurus).toBeNull()
    expect(p?.b2bPriceKurus).toBeNull()
  })

  test("fiyat metin olarak gelirse kabul edilmez", () => {
    const p = parseGetirbakimProduct({ id: "1", name: "Balata", b2bPriceKurus: "160650" })
    expect(p?.b2bPriceKurus).toBeNull()
  })

  test("KDV oranı verilmezse %20 varsayılır", () => {
    expect(parseGetirbakimProduct({ id: "1", name: "Balata" })?.vatRateBps).toBe(2000)
  })
})

describe("parseGetirbakimProduct — dayanıklılık", () => {
  test("zorunlu alanı eksik satır null döner", () => {
    expect(parseGetirbakimProduct({ name: "id yok" })).toBeNull()
    expect(parseGetirbakimProduct({ id: "1" })).toBeNull()
    expect(parseGetirbakimProduct(null)).toBeNull()
    expect(parseGetirbakimProduct("metin")).toBeNull()
    expect(parseGetirbakimProduct({ id: "", name: "boş id" })).toBeNull()
  })

  test("negatif stok sıfıra çekilir", () => {
    expect(parseGetirbakimProduct({ id: "1", name: "X", stockQty: -3 })?.stockQty).toBe(0)
  })

  test("tanınmayan availability UNAVAILABLE'a düşer", () => {
    expect(parseGetirbakimProduct({ id: "1", name: "X", availability: "ŞEY" })?.availability).toBe(
      "UNAVAILABLE",
    )
    expect(parseGetirbakimProduct({ id: "1", name: "X", availability: "SUPPLYABLE" })?.availability).toBe(
      "SUPPLYABLE",
    )
  })

  test("oemNumbers metin olmayan öğeleri atar", () => {
    const p = parseGetirbakimProduct({ id: "1", name: "X", oemNumbers: ["A", 5, null, "B"] })
    expect(p?.oemNumbers).toEqual(["A", "B"])
  })

  test("oemNumbers dizi değilse boş listeye düşer", () => {
    expect(parseGetirbakimProduct({ id: "1", name: "X", oemNumbers: "A,B" })?.oemNumbers).toEqual([])
  })
})
