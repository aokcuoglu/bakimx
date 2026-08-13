import { describe, expect, test } from "bun:test"
import {
  applyPricePercent,
  applyStockUpdate,
  bakimxBrandSlug,
  bakimxCategoryLabel,
  bakimxProductWriteData,
  bakimxStockStatus,
  catalogAuditAction,
  diffCatalogFields,
  formatCatalogAuditChanges,
  isBakimxCategoryKey,
  parseOemNumbers,
  productAuditSnapshot,
  uniqueBakimxBrandSlug,
  BAKIMX_CATEGORIES,
  type BakimxProductWriteInput,
} from "@/lib/catalog/bakimx-catalog"
import { buildBakimxProductSearchKey } from "@/lib/parts/bakimx-search-key"

function writeInput(overrides: Partial<BakimxProductWriteInput> = {}): BakimxProductWriteInput {
  return {
    sku: "MUTLU-60AH",
    name: "Mutlu Akü 60 Ah",
    brandId: "brand_1",
    categoryKey: "aku",
    barcode: null,
    unit: "adet",
    description: null,
    imageUrl: null,
    oemNumbers: ["C 27 125"],
    workshopPriceKurus: 250000,
    vatRateBps: 2000,
    costPriceKurus: 200000,
    stockQty: 10,
    lowStockQty: 3,
    backorderable: false,
    leadTimeDays: null,
    isActive: true,
    ...overrides,
  }
}

describe("kategori taksonomisi", () => {
  test("anahtarlar slug biçiminde ve tekil", () => {
    const keys = BAKIMX_CATEGORIES.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) expect(key).toMatch(/^[a-z0-9-]+$/)
  })

  test("etiket çözümlemesi", () => {
    expect(bakimxCategoryLabel("aku")).toBe("Akü")
    expect(bakimxCategoryLabel(null)).toBe("—")
    // Bilinmeyen anahtar kaybolmaz, olduğu gibi gösterilir.
    expect(bakimxCategoryLabel("bilinmeyen")).toBe("bilinmeyen")
    expect(isBakimxCategoryKey("aku")).toBe(true)
    expect(isBakimxCategoryKey("bilinmeyen")).toBe(false)
    expect(isBakimxCategoryKey("")).toBe(false)
  })
})

describe("marka slug'ı", () => {
  test("Türkçe harfleri ASCII'ye indirir, ayraçları tireye çevirir", () => {
    expect(bakimxBrandSlug("Mutlu Akü")).toBe("mutlu-aku")
    expect(bakimxBrandSlug("Petrol Ofisi")).toBe("petrol-ofisi")
    expect(bakimxBrandSlug("  ŞİŞECAM  ")).toBe("sisecam")
    expect(bakimxBrandSlug("Bosch / Türkiye")).toBe("bosch-turkiye")
  })

  test("çakışan slug'a sayaç eklenir", () => {
    expect(uniqueBakimxBrandSlug("Mutlu Akü", [])).toBe("mutlu-aku")
    expect(uniqueBakimxBrandSlug("Mutlu-Akü", ["mutlu-aku"])).toBe("mutlu-aku-2")
    expect(uniqueBakimxBrandSlug("Mutlu Akü", ["mutlu-aku", "mutlu-aku-2"])).toBe("mutlu-aku-3")
  })

  test("hiç ASCII karakter üretmeyen ad boş slug bırakmaz", () => {
    expect(uniqueBakimxBrandSlug("!!!", [])).toBe("marka")
  })
})

describe("toplu fiyat güncelleme", () => {
  test("zam ve indirim kuruşta yuvarlanır", () => {
    expect(applyPricePercent(10000, 10)).toBe(11000)
    expect(applyPricePercent(10000, -10)).toBe(9000)
    // %2,5 → 250 bps; 9999 * 250 / 10000 = 249,975 → 250 (yarım sıfırdan uzağa)
    expect(applyPricePercent(9999, 2.5)).toBe(10249)
  })

  test("sonuç negatife inmez", () => {
    expect(applyPricePercent(100, -90)).toBe(10)
    expect(applyPricePercent(0, 50)).toBe(0)
  })
})

describe("toplu stok güncelleme", () => {
  test("üç kip", () => {
    expect(applyStockUpdate(10, "set", 4)).toBe(4)
    expect(applyStockUpdate(10, "increase", 4)).toBe(14)
    expect(applyStockUpdate(10, "decrease", 4)).toBe(6)
  })

  test("azaltma sıfırın altına inmez", () => {
    expect(applyStockUpdate(3, "decrease", 10)).toBe(0)
  })
})

describe("stok durumu", () => {
  test("eşik ve tükenme", () => {
    expect(bakimxStockStatus({ stockQty: 0, lowStockQty: 5 })).toBe("out_of_stock")
    expect(bakimxStockStatus({ stockQty: 5, lowStockQty: 5 })).toBe("low_stock")
    expect(bakimxStockStatus({ stockQty: 6, lowStockQty: 5 })).toBe("in_stock")
    // Eşik tanımlı değilse "kritik" durumu hiç oluşmaz.
    expect(bakimxStockStatus({ stockQty: 1, lowStockQty: 0 })).toBe("in_stock")
  })
})

describe("yazma verisi", () => {
  test("searchKey her yazmada yeniden üretilir", () => {
    const data = bakimxProductWriteData(writeInput(), "Mutlu")
    expect(data.searchKey).toBe(
      buildBakimxProductSearchKey({
        name: "Mutlu Akü 60 Ah",
        brandName: "Mutlu",
        sku: "MUTLU-60AH",
        oemNumbers: ["C 27 125"],
      }),
    )
    // Katlama gerçekten uygulanmış: "akü" → "aku", "C 27 125" → "c27125"
    expect(data.searchKey).toContain("mutluaku60ah")
    expect(data.searchKey).toContain("c27125")
  })

  test("marka adı denormalize kolona kopyalanır", () => {
    expect(bakimxProductWriteData(writeInput(), "Mutlu").brandName).toBe("Mutlu")
  })

  test("ad değişince arama anahtarı da değişir", () => {
    const before = bakimxProductWriteData(writeInput(), "Mutlu")
    const after = bakimxProductWriteData(writeInput({ name: "Mutlu Akü 72 Ah" }), "Mutlu")
    expect(after.searchKey).not.toBe(before.searchKey)
  })
})

describe("denetim kaydı", () => {
  test("değişen alanlar çıkarılır, diziler sıra duyarlı karşılaştırılır", () => {
    const before = { stockQty: 10, name: "A", oemNumbers: ["1", "2"] }
    const diff = diffCatalogFields(before, { stockQty: 12, name: "A", oemNumbers: ["1", "2"] })
    expect(diff.keys).toEqual(["stockQty"])
    expect(diff.before).toEqual({ stockQty: 10 })
    expect(diff.after).toEqual({ stockQty: 12 })

    const orderChanged = diffCatalogFields(before, { oemNumbers: ["2", "1"] })
    expect(orderChanged.keys).toEqual(["oemNumbers"])
  })

  test("action önceliği fiyat > stok > diğer", () => {
    expect(catalogAuditAction([])).toBeNull()
    expect(catalogAuditAction(["isActive"])).toBe("update")
    expect(catalogAuditAction(["stockQty", "isActive"])).toBe("stock_change")
    expect(catalogAuditAction(["workshopPriceKurus", "stockQty"])).toBe("price_change")
    expect(catalogAuditAction(["vatRateBps"])).toBe("price_change")
    expect(catalogAuditAction(["costPriceKurus"])).toBe("price_change")
  })

  test("snapshot yalnız denetlenen alanları alır (searchKey hariç)", () => {
    const data = bakimxProductWriteData(writeInput(), "Mutlu")
    const snapshot = productAuditSnapshot(data)
    expect(snapshot).not.toHaveProperty("searchKey")
    expect(snapshot.workshopPriceKurus).toBe(250000)
    expect(snapshot.isActive).toBe(true)
  })

  test("değişiklikler okunabilir satırlara çevrilir", () => {
    expect(formatCatalogAuditChanges({ workshopPriceKurus: 10000 }, { workshopPriceKurus: 11000 })).toEqual([
      "Fiyat (KDV hariç): ₺100,00 → ₺110,00",
    ])
    expect(formatCatalogAuditChanges({ isActive: true }, { isActive: false })).toEqual(["Durum: Aktif → Pasif"])
    expect(formatCatalogAuditChanges(null, { stockQty: 5 })).toEqual(["Stok: 5"])
    expect(formatCatalogAuditChanges({ vatRateBps: 2000 }, { vatRateBps: 1000 })).toEqual([
      "KDV oranı: %20 → %10",
    ])
    expect(formatCatalogAuditChanges(null, { costPriceKurus: null })).toEqual(["İç maliyet: —"])
  })
})

describe("OEM listesi", () => {
  test("kırpar, boşları ve tekrarları atar, sırayı korur", () => {
    expect(parseOemNumbers(" 1234 , 5678\n1234\n\n; 91011 ")).toEqual(["1234", "5678", "91011"])
    expect(parseOemNumbers("")).toEqual([])
  })
})
