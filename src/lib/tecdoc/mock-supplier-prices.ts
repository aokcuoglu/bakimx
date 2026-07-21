/**
 * Mock tedarikçi fiyat karşılaştırma verisi — BakımX.
 *
 * ŞU AN MOCK: lansman/satış demolarında "tedarikçi fiyat karşılaştırması"
 * özelliğini müşteriye göstermek için üretilmiş ÖRNEK ver/ demo verisidir.
 * Gerçek tedarikçi entegrasyonu geldiğinde yalnız `getMockSupplierPrices`
 * gövdesi (veya çağıran katman) değişir; tüketiciler (`SupplierPriceDialog`)
 * aynı tipe bağlı kalır.
 *
 * Determinizm: `Math.random`/`Date.now` KULLANMAZ. Tüm değerler parça no'dan
 * (yoksa addan) türetilen basit bir string hash'ten üretilir → aynı parça her
 * zaman aynı sonucu verir (demo tutarlılığı + workflow/script determinizmi).
 *
 * Para birimi: `priceKurus` her zaman KURUŞ (money.ts kontratı). 1 TL = 100 kuruş.
 */

export type SupplierStock = "in_stock" | "low_stock" | "orderable"

export type SupplierOffer = {
  supplierName: string
  brandName: string
  brandKind: "oem" | "aftermarket"
  articleNo: string
  priceKurus: number
  stock: SupplierStock
  /** low_stock için "son N adet" göstergesi. */
  stockQty?: number
  deliveryLabel: string
}

export type SupplierPriceResult = {
  /** Fiyata göre ARTAN sıralı. */
  offers: SupplierOffer[]
  /** En ucuz teklifin indexi (sıralı olduğu için her zaman 0). */
  cheapestIndex: number
  isMock: true
}

// Sabit tedarikçi paleti — gerçekçi TR oto yedek parça dağıtıcı/pazar isimleri.
// `oem`: OEM/orijinal sunan bayi; `aftermarket`: muadil sunan pazar.
const SUPPLIERS: Array<{ name: string; brand: string; kind: "oem" | "aftermarket" }> = [
  { name: "Doğuş Oto Yedek Parça", brand: "Orijinal (OEM)", kind: "oem" },
  { name: "ParçaPazarı", brand: "Bosch", kind: "aftermarket" },
  { name: "OtoYedek.com", brand: "Valeo", kind: "aftermarket" },
  { name: "Başaran Otomotiv", brand: "Febi Bilstein", kind: "aftermarket" },
  { name: "Yıldız Parça Ticaret", brand: "Mahle", kind: "aftermarket" },
]

const DELIVERY_LABELS = ["Bugün kargo", "Yarın kapında", "1-2 iş günü", "2-3 iş günü"]

/** FNV-1a benzeri deterministik 32-bit string hash (pozitif). */
function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    // 32-bit taşmayı koru
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Hash'i tohum alan deterministik sözde-rastgele üreteç (mulberry32). */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Bir parça için deterministik mock tedarikçi teklifleri döndürür.
 * `sku` varsa onu, yoksa `name`'i tohum olarak kullanır.
 */
export function getMockSupplierPrices(part: {
  sku?: string | null
  name: string
  brand?: string | null
}): SupplierPriceResult {
  const seedKey = (part.sku?.trim() || part.name.trim() || "parça").toLowerCase()
  const rng = makeRng(hashString(seedKey))

  // Taban fiyat: parçaya özgü, 150–1600 TL bandında (kuruş).
  const baseLira = 150 + Math.floor(rng() * 1450)

  const offers: SupplierOffer[] = SUPPLIERS.map((s, idx) => {
    // Her tedarikçi tabana göre -%12 … +%28 sapar → gerçekçi fiyat dağılımı.
    const spreadPct = -12 + Math.floor(rng() * 40)
    const priceLira = Math.max(1, Math.round((baseLira * (100 + spreadPct)) / 100))
    const priceKurus = priceLira * 100

    const stockRoll = rng()
    let stock: SupplierStock
    let stockQty: number | undefined
    if (stockRoll < 0.55) {
      stock = "in_stock"
    } else if (stockRoll < 0.82) {
      stock = "low_stock"
      stockQty = 1 + Math.floor(rng() * 4) // son 1-4 adet
    } else {
      stock = "orderable"
    }

    const deliveryLabel = DELIVERY_LABELS[Math.floor(rng() * DELIVERY_LABELS.length)]

    // Tedarikçi parça no'su: OEM ise gerçek sku'yu, muadil ise türetilmiş bir no.
    const articleNo =
      s.kind === "oem" && part.sku?.trim()
        ? part.sku.trim()
        : `${s.brand.split(" ")[0].slice(0, 3).toUpperCase()}-${(hashString(seedKey + idx) % 900000 + 100000)}`

    return {
      supplierName: s.name,
      brandName: s.brand,
      brandKind: s.kind,
      articleNo,
      priceKurus,
      stock,
      stockQty,
      deliveryLabel,
    }
  })

  offers.sort((a, b) => a.priceKurus - b.priceKurus)

  return { offers, cheapestIndex: 0, isMock: true }
}
