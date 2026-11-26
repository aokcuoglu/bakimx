import { describe, expect, test } from "bun:test"
import { PRICE_NOT_ENTERED, compactRowDetail, formatCompactQuantity } from "./compact-row"
import { formatTRY } from "@/lib/format"

describe("compactRowDetail (#968)", () => {
  test("parça: adet, birim ve birim fiyat", () => {
    expect(compactRowDetail({ type: "part", quantity: 2, unit: "adet", unitPrice: 50000 }))
      .toBe(`2 adet × ${formatTRY(50000)}`)
  })

  test("bölünebilir birimde ondalık miktar virgülle yazılır", () => {
    expect(compactRowDetail({ type: "part", quantity: 1.5, unit: "litre", unitPrice: 12000 }))
      .toBe(`1,5 litre × ${formatTRY(12000)}`)
  })

  test("Türkçe birim etiketi küçük harfe doğru çevrilir (Takım -> takım)", () => {
    expect(compactRowDetail({ type: "part", quantity: 1, unit: "takim", unitPrice: 100 }))
      .toStartWith("1 takım ×")
  })

  test("birim boş ya da bilinmiyorsa adet", () => {
    expect(compactRowDetail({ type: "part", quantity: 3, unit: null, unitPrice: 100 })).toStartWith("3 adet ×")
    expect(compactRowDetail({ type: "part", quantity: 3, unit: "yok", unitPrice: 100 })).toStartWith("3 adet ×")
  })

  test("işçilikte birim yoktur: adet", () => {
    expect(compactRowDetail({ type: "labor", quantity: 2, unit: "litre", unitPrice: 100 })).toStartWith("2 adet ×")
    expect(compactRowDetail({ type: "external_labor", quantity: 1, unit: null, unitPrice: 100 })).toStartWith("1 adet ×")
  })

  test("fiyat yoksa ya da sıfırsa Fiyat girilmedi", () => {
    expect(compactRowDetail({ type: "part", quantity: 2, unit: "adet", unitPrice: null })).toBe(PRICE_NOT_ENTERED)
    expect(compactRowDetail({ type: "labor", quantity: 1, unit: null, unitPrice: 0 })).toBe(PRICE_NOT_ENTERED)
    expect(PRICE_NOT_ENTERED).toBe("Fiyat girilmedi")
  })

  test("miktar binlik ayraçsız ve en çok üç ondalık", () => {
    expect(formatCompactQuantity(999)).toBe("999")
    expect(formatCompactQuantity(0.125)).toBe("0,125")
  })
})
