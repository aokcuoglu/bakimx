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
    contractVersion: "1.1",
    sourceProductId: "gb-1001",
    id: "gb-1001",
    partNo: "GDB1330",
    manufacturerPartNumber: { value: "GDB1330", normalized: "GDB1330" },
    name: "Fren Balatası Ön Takım",
    brandName: "TRW",
    categoryName: "Fren Balatası",
    oemNumbers: ["77362261", "9948080"],
    references: [{ type: "OEM", value: "77362261", normalized: "77362261", brand: "FIAT" }],
    exactFitment: { requestedVehicleTypeId: null, status: "NOT_REQUESTED", matchedVehicleTypeIds: [] },
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
    contractVersion: "1.1",
    sourceProductId: "gb-1002",
    id: "gb-1002",
    partNo: "OC90",
    manufacturerPartNumber: { value: "OC90", normalized: "OC90" },
    name: "Yağ Filtresi",
    brandName: "Knecht",
    categoryName: "Yağ Filtresi",
    oemNumbers: ["55256470"],
    references: [{ type: "OEM", value: "55256470", normalized: "55256470", brand: null }],
    exactFitment: { requestedVehicleTypeId: null, status: "NOT_REQUESTED", matchedVehicleTypeIds: [] },
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
    contractVersion: "1.1",
    sourceProductId: "gb-1003",
    id: "gb-1003",
    partNo: "1K0615301AA",
    manufacturerPartNumber: { value: "1K0615301AA", normalized: "1K0615301AA" },
    name: "Fren Diski Ön",
    brandName: "Brembo",
    categoryName: "Fren Diski",
    oemNumbers: ["1K0615301AA"],
    references: [{ type: "OEM", value: "1K0615301AA", normalized: "1K0615301AA", brand: "VW" }],
    exactFitment: { requestedVehicleTypeId: null, status: "NOT_REQUESTED", matchedVehicleTypeIds: [] },
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
      return this.withFitment(MOCK_PRODUCTS.filter(
        (p) =>
          normalizeCode(p.partNo) === needle ||
          p.oemNumbers.some((code) => normalizeCode(code) === needle),
      ).slice(0, limit), input.vehicleTypeId)
    }

    const q = input.q?.trim()
    if (!q) return []

    return this.withFitment(MOCK_PRODUCTS.filter((p) => matches(p, q)).slice(0, limit), input.vehicleTypeId)
  }

  private withFitment(products: GetirbakimProduct[], vehicleTypeId?: number | null): GetirbakimProduct[] {
    return products.map((product) => ({
      ...product,
      exactFitment: vehicleTypeId == null
        ? { requestedVehicleTypeId: null, status: "NOT_REQUESTED", matchedVehicleTypeIds: [] }
        : { requestedVehicleTypeId: vehicleTypeId, status: "NOT_CONFIRMED", matchedVehicleTypeIds: [] },
    }))
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
