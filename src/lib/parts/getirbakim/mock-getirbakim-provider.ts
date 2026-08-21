import {
  clampGetirbakimLimit,
  type GetirbakimProduct,
  type GetirbakimProvider,
  type GetirbakimSearchInput,
  type GetirbakimExactOfferResult,
} from "./types"

/**
 * Demo sağlayıcı — VARSAYILAN (BAK-183).
 *
 * Hiçbir ağ çağrısı yapmaz. Anahtar tanımlanana kadar bütün ortamlar buradan
 * okur; böylece özelliği geliştirmek, gözden geçirmek ve test etmek GetirBakım
 * ortamına erişim gerektirmez.
 *
 * Veri KASITLI olarak çeşitli: stoklu, stoksuz-ama-tedarik-edilebilir ve
 * fiyatsız birer satır var — yüzeyin üç durumu da elle denenebilsin.
 */

const MOCK_PRODUCTS: GetirbakimProduct[] = [
  {
    id: "gb-1001",
    partNo: "GDB1330",
    name: "Fren Balatası Ön Takım",
    brandName: "TRW",
    categoryName: "Fren Balatası",
    oemNumbers: ["77362261", "9948080"],
    imageUrl: null,
    listPriceKurus: 189000,
    b2bPriceKurus: 160650,
    discountBps: 1500,
    vatRateBps: 2000,
    currency: "TRY",
    stockQty: 12,
    availability: "IN_STOCK",
    lastSyncedAt: "2026-08-20T06:00:00.000Z",
  },
  {
    id: "gb-1002",
    partNo: "OC90",
    name: "Yağ Filtresi",
    brandName: "Knecht",
    categoryName: "Yağ Filtresi",
    oemNumbers: ["55256470"],
    imageUrl: null,
    listPriceKurus: 24500,
    b2bPriceKurus: 20825,
    discountBps: 1500,
    vatRateBps: 2000,
    currency: "TRY",
    // Stok yok ama fiyatlı: GetirBakım tedarik edebilir, teslim süresi uzar.
    stockQty: 0,
    availability: "SUPPLYABLE",
    lastSyncedAt: "2026-08-20T06:00:00.000Z",
  },
  {
    id: "gb-1003",
    partNo: "1K0615301AA",
    name: "Fren Diski Ön",
    brandName: "Brembo",
    categoryName: "Fren Diski",
    oemNumbers: ["1K0615301AA"],
    imageUrl: null,
    // Fiyatsız satır: yüzey "fiyat sorulur" durumunu da göstermeli.
    listPriceKurus: null,
    b2bPriceKurus: null,
    discountBps: 0,
    vatRateBps: 2000,
    currency: "TRY",
    stockQty: 0,
    availability: "UNAVAILABLE",
    lastSyncedAt: null,
  },
]

function matches(product: GetirbakimProduct, term: string): boolean {
  const needle = term.toLocaleLowerCase("tr")
  return (
    product.name.toLocaleLowerCase("tr").includes(needle) ||
    product.partNo.toLocaleLowerCase("tr").includes(needle) ||
    product.brandName.toLocaleLowerCase("tr").includes(needle) ||
    product.oemNumbers.some((code) => code.toLocaleLowerCase("tr").includes(needle))
  )
}

/** Kod karşılaştırması için normalizasyon — GetirBakım `normalizeOem` ile aynı fikir. */
function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

class MockGetirbakimProvider implements GetirbakimProvider {
  readonly name = "mock" as const

  async search(input: GetirbakimSearchInput): Promise<GetirbakimProduct[]> {
    const limit = clampGetirbakimLimit(input.limit)

    const oem = input.oem?.trim()
    if (oem) {
      const needle = normalizeCode(oem)
      return MOCK_PRODUCTS.filter(
        (p) =>
          normalizeCode(p.partNo) === needle ||
          p.oemNumbers.some((code) => normalizeCode(code) === needle),
      ).slice(0, limit)
    }

    const q = input.q?.trim()
    if (!q) return []

    return MOCK_PRODUCTS.filter((p) => matches(p, q)).slice(0, limit)
  }

  async findOffersByPartNo(_partNo: string): Promise<GetirbakimExactOfferResult> {
    // Supplier modalında demo teklif gerçekmiş gibi gösterilmez.
    return { status: "no_match" }
  }
}

let _mock: MockGetirbakimProvider | null = null

export function getMockGetirbakimProvider(): GetirbakimProvider {
  if (!_mock) _mock = new MockGetirbakimProvider()
  return _mock
}
