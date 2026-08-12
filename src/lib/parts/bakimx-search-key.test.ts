import { describe, expect, it } from "bun:test"
import {
  bakimxProductSearchKeyMatches,
  bakimxProductSearchTerms,
  buildBakimxProductSearchKey,
} from "./bakimx-search-key"
import { normalizePartSearchTerm } from "@/lib/tr-search"

const mutluAku = {
  name: "Akü 60Ah 540A",
  brandName: "Mutlu",
  sku: "C 27 125",
  oemNumbers: ["0 986 4B7 035"],
}

describe("buildBakimxProductSearchKey", () => {
  it("ad + marka + sku + OEM'i katlanmış hâlde tek anahtarda toplar", () => {
    expect(buildBakimxProductSearchKey(mutluAku)).toBe("aku60ah540a mutlu c27125 09864b7035")
  })

  it("aynı katlamayı kullanır (normalizePartSearchTerm ile birebir)", () => {
    const key = buildBakimxProductSearchKey({ name: "Yağ filtresi", brandName: "Mann", sku: "W712" })
    expect(key.split(" ")[0]).toBe(normalizePartSearchTerm("Yağ filtresi"))
  })

  it("tekrar eden parçaları bir kez yazar (sku == OEM)", () => {
    const key = buildBakimxProductSearchKey({
      name: "Akü",
      brandName: "Mutlu",
      sku: "C27125",
      oemNumbers: ["c-27-125"],
    })
    expect(key).toBe("aku mutlu c27125")
  })

  it("boş/eksik alanlar anahtarı bozmaz — sondaki boşluk kalmaz", () => {
    expect(buildBakimxProductSearchKey({ name: "Akü", brandName: "", sku: "", oemNumbers: null })).toBe("aku")
    expect(buildBakimxProductSearchKey({ name: "Akü", brandName: "Mutlu", sku: "-", oemNumbers: [] })).toBe(
      "aku mutlu",
    )
  })
})

describe("bakimxProductSearchTerms", () => {
  it("sorguyu anahtarla aynı alfabeye indirger", () => {
    expect(bakimxProductSearchTerms("Mutlu AKÜ")).toEqual(["mutlu", "aku"])
  })

  it("ayraçlı parça numarasını tek terime toplar", () => {
    expect(bakimxProductSearchTerms("C-27-125")).toEqual(["c27125"])
  })

  it("boş sorgu terim üretmez", () => {
    expect(bakimxProductSearchTerms("   ")).toEqual([])
  })
})

describe("bakimxProductSearchKeyMatches", () => {
  const key = buildBakimxProductSearchKey(mutluAku)

  it("'akü' ↔ 'aku' — Türkçe harf ASCII yazımla eşleşir", () => {
    expect(bakimxProductSearchKeyMatches(key, "akü")).toBe(true)
    expect(bakimxProductSearchKeyMatches(key, "aku")).toBe(true)
  })

  it("'C 27 125' ↔ 'c27125' — ayraç duyarsız", () => {
    expect(bakimxProductSearchKeyMatches(key, "C 27 125")).toBe(true)
    expect(bakimxProductSearchKeyMatches(key, "c27125")).toBe(true)
    expect(bakimxProductSearchKeyMatches(key, "C-27-125")).toBe(true)
  })

  it("OEM numarasıyla da bulunur", () => {
    expect(bakimxProductSearchKeyMatches(key, "0986 4B7 035")).toBe(true)
  })

  it("çok terimli sorguda sıra önemsizdir (VE mantığı)", () => {
    expect(bakimxProductSearchKeyMatches(key, "mutlu aku")).toBe(true)
    expect(bakimxProductSearchKeyMatches(key, "aku mutlu")).toBe(true)
  })

  it("terimlerden biri tutmuyorsa eşleşmez", () => {
    expect(bakimxProductSearchKeyMatches(key, "mutlu balata")).toBe(false)
  })

  it("iki parçanın sınırına taşan sorgu eşleşmez (boşluk ayracı)", () => {
    // "aku60ah540a" + "mutlu" bitişik yazılsaydı "540amutlu" eşleşirdi.
    expect(bakimxProductSearchKeyMatches(key, "540amutlu")).toBe(false)
  })

  it("boş sorgu her şeyle eşleşir", () => {
    expect(bakimxProductSearchKeyMatches(key, "")).toBe(true)
  })
})
