import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { bakimxProductSearchTerms } from "./bakimx-search-key"
import { normalizePartNo } from "./suggestions"
import { resolveWorkshopPrice } from "./bakimx-price"

/**
 * BakımX ürün kataloğunun ATÖLYE (okuma) tarafı — BAK-33.
 *
 * TENANT İZOLASYONU: `bakimx_products` global bir tablodur, `workshopId`
 * TAŞIMAZ; her atölye aynı satırları görür. Bu yüzden buradaki izolasyon
 * "sorguda workshopId" değil, **public DTO**'dur: iç maliyet (`costPriceKurus`),
 * iç stok eşiği, içe aktarım/denetim izi ve yayın alanları atölye yüzeyine ASLA
 * çıkmaz. Tek savunma hattı bu dosyadır — atölye tarafındaki her okuma
 * `BAKIMX_PRODUCT_SUMMARY_SELECT` üzerinden geçmeli, `prisma.bakimxProduct`'a
 * doğrudan `select`'siz dokunulmamalıdır (bkz. bakimx-catalog.test.ts).
 *
 * FİYAT SÖZLEŞMESİ: `workshopPriceKurus` = atölyenin BakımX'ten **alış** fiyatı,
 * **KDV hariç**, kuruş (bkz. src/lib/money.ts). KDV oranı ayrı: `vatRateBps`.
 * Kaleme yazılırken `purchasePriceKurus`'a gider, `unitPrice`'a DEĞİL — atölye
 * satış fiyatını kendi marjıyla belirler (bkz. BAK-35).
 */

/**
 * Atölyeye dönen ürün alanları. Prisma `select`'i olarak kullanıldığı için
 * listede olmayan kolon sorgudan hiç dönmez — DTO eşlemesi de bu satırdan
 * beslenir, dolayısıyla "unuttum" diye maliyet sızdırmak mümkün değil.
 */
export const BAKIMX_PRODUCT_SUMMARY_SELECT = {
  id: true,
  sku: true,
  name: true,
  brandId: true,
  brandName: true,
  categoryKey: true,
  barcode: true,
  unit: true,
  description: true,
  imageUrl: true,
  oemNumbers: true,
  workshopPriceKurus: true,
  vatRateBps: true,
  currency: true,
  stockQty: true,
  backorderable: true,
  leadTimeDays: true,
} as const satisfies Prisma.BakimxProductSelect

type BakimxProductSummaryRow = Prisma.BakimxProductGetPayload<{
  select: typeof BAKIMX_PRODUCT_SUMMARY_SELECT
}>

/** Atölye yüzeyine çıkan public ürün özeti. Maliyet/tedarik alanı içermez. */
export interface BakimxProductSummary {
  id: string
  sku: string
  name: string
  brandId: string
  brandName: string
  categoryKey: string | null
  /**
   * `categoryKey`'in iç taksonomideki okunur karşılığı; kategorisiz üründe null.
   * Türetilmiş alan — atölye yüzeyinin taksonomiyi yeniden yazmaması için burada
   * hesaplanır (kalem `category` metnini de bu besler, bkz. bakimx-item.ts).
   */
  categoryLabel: string | null
  barcode: string | null
  unit: string
  description: string | null
  imageUrl: string | null
  oemNumbers: string[]
  /** Atölyenin BakımX'ten ALIŞ fiyatı — KDV HARİÇ, kuruş. */
  workshopPriceKurus: number
  /** Atölyenin iskontolu fiyatı — KDV HARİÇ, kuruş (BAK-47). */
  displayPriceKurus: number
  /** `workshopPriceKurus` üzerine uygulanacak KDV oranı (bps; 2000 = %20). */
  vatRateBps: number
  currency: string
  /** BakımX'in global stoğu — Faz 1'de yalnız bilgilendirme, rezervasyon yok. */
  stockQty: number
  /** Stok 0 iken de siparişe açık mı. */
  backorderable: boolean
  leadTimeDays: number | null
}

export function toBakimxProductSummary(
  row: BakimxProductSummaryRow,
  discountBps: number = 0,
): BakimxProductSummary {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    brandId: row.brandId,
    brandName: row.brandName,
    categoryKey: row.categoryKey,
    categoryLabel: row.categoryKey ? bakimxCategoryLabel(row.categoryKey) : null,
    barcode: row.barcode,
    unit: row.unit,
    description: row.description,
    imageUrl: row.imageUrl,
    oemNumbers: row.oemNumbers,
    workshopPriceKurus: row.workshopPriceKurus,
    displayPriceKurus: resolveWorkshopPrice(row.workshopPriceKurus, discountBps),
    vatRateBps: row.vatRateBps,
    currency: row.currency,
    stockQty: row.stockQty,
    backorderable: row.backorderable,
    leadTimeDays: row.leadTimeDays,
  }
}

export const BAKIMX_SEARCH_DEFAULT_LIMIT = 20
export const BAKIMX_SEARCH_MAX_LIMIT = 50

/**
 * Atölyenin BakımX iskontosunu (bps) okur — BAK-47'nin TEK okuma noktası.
 *
 * İskonto İSTEMCİDEN GELMEZ: her okuma yolu atölye kaydından okur, böylece
 * fiyat istemci tarafından manipüle edilemez. `workshopId` yoksa (atölye
 * bağlamı olmayan çağrı) iskonto uygulanmaz.
 */
async function resolveWorkshopDiscountBps(workshopId?: string | null): Promise<number> {
  if (!workshopId) return 0
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { bakimxDiscountBps: true },
  })
  return workshop?.bakimxDiscountBps ?? 0
}

/**
 * Atölyeye görünen ürünün koşulu — arama ve taksonomi AYNI filtreyi kullanmalı,
 * aksi hâlde ağaçta görünen kategori boş liste döndürür.
 *
 * `fitmentScope = universal`: Faz 1'de yalnız araçtan bağımsız ürünler
 * listelenir; `vehicle_linked` ürünler araç eşleştirmesi geldiğinde (Faz 2)
 * açılacak. Markanın `isActive`'i de kapı: bir markayı tek anahtarla
 * pasifleştirmek ürünlerini de listeden düşürür.
 */
const VISIBLE_PRODUCT: Prisma.BakimxProductWhereInput = {
  isActive: true,
  fitmentScope: "universal",
  brand: { isActive: true },
}

export interface BakimxProductSearchInput {
  q?: string | null
  brandId?: string | null
  categoryKey?: string | null
  limit?: number | null
  workshopId?: string | null
}

/**
 * Katalog araması. Terimler `searchKey` kolonunda AND'lenir: sorgu da ürün de
 * `normalizePartSearchTerm`'den geçtiği için "aku" → "Akü ..." bulunur (bkz.
 * bakimx-search-key.ts). Boş `q` meşrudur: parça seçicide bir kategoriye
 * tıklandığında o dalın tamamı listelenir.
 *
 * `workshopId` sağlanırsa, atölyenin BakımX iskontosunu ürün fiyatlarına uygular
 * (BAK-47). Boşsa iskonto yoktur (0%).
 */
export async function searchBakimxProducts(
  input: BakimxProductSearchInput = {},
): Promise<BakimxProductSummary[]> {
  const terms = bakimxProductSearchTerms(input.q ?? "")
  const limit = clampSearchLimit(input.limit)
  const discountBps = await resolveWorkshopDiscountBps(input.workshopId)

  const rows = await prisma.bakimxProduct.findMany({
    where: {
      ...VISIBLE_PRODUCT,
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.categoryKey ? { categoryKey: input.categoryKey } : {}),
      ...(terms.length > 0 ? { AND: terms.map((term) => ({ searchKey: { contains: term } })) } : {}),
    },
    select: BAKIMX_PRODUCT_SUMMARY_SELECT,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit,
  })

  return rows.map((row) => toBakimxProductSummary(row, discountBps))
}

/** TecDoc kategori köprüsüne bağlı, atölyeye görünür BakımX ürünleri (BAK-45). */
export async function listBakimxProductsByTecdocCategory(
  tecdocCategoryId: number,
  workshopId?: string | null,
): Promise<BakimxProductSummary[]> {
  const discountBps = await resolveWorkshopDiscountBps(workshopId)

  const rows = await prisma.bakimxProduct.findMany({
    where: { ...VISIBLE_PRODUCT, tecdocCategoryId },
    select: BAKIMX_PRODUCT_SUMMARY_SELECT,
    orderBy: [{ brandName: "asc" }, { name: "asc" }],
  })
  return rows.map((row) => toBakimxProductSummary(row, discountBps))
}

/**
 * Tek ürünü ATÖLYE GÖRÜNÜRLÜĞÜ filtresiyle okur — kalem yazan yol (BAK-35) bunu
 * kullanır. İstemcinin gönderdiği ad/fiyat/kategori GÜVENİLMEZ: kalem alanları
 * buradan dönen satırdan türetilir (bkz. bakimx-item.ts), böylece pasifleşmiş
 * ürün eklenemez ve fiyat istemciden uydurulamaz.
 *
 * `workshopId` sağlanırsa, atölyenin BakımX iskontosunu ürün fiyatına uygular (BAK-47).
 */
export async function getVisibleBakimxProduct(
  id: string,
  workshopId?: string | null,
): Promise<BakimxProductSummary | null> {
  const discountBps = await resolveWorkshopDiscountBps(workshopId)

  const row = await prisma.bakimxProduct.findFirst({
    where: { ...VISIBLE_PRODUCT, id },
    select: BAKIMX_PRODUCT_SUMMARY_SELECT,
  })
  return row ? toBakimxProductSummary(row, discountBps) : null
}

/** İstemci sınırı ÖNERİR, server kırpar (güvenilmez girdi). */
export function clampSearchLimit(limit: number | null | undefined): number {
  if (limit == null || !Number.isFinite(limit) || limit < 1) return BAKIMX_SEARCH_DEFAULT_LIMIT
  return Math.min(Math.floor(limit), BAKIMX_SEARCH_MAX_LIMIT)
}

/** Parça seçicinin "BakımX Ürünleri" dalındaki bir yaprak. */
export interface BakimxCategoryNode {
  key: string
  label: string
  productCount: number
}

/**
 * İÇ taksonomi etiketleri — TecDoc ağacından bağımsız, `bakimx_products
 * .category_key` değerlerinin insan okunur karşılığı. Listede olmayan anahtar
 * hata değildir: içe aktarım yeni bir yaprak açabilir, o zaman
 * {@link humanizeCategoryKey} devreye girer ve etiket eklenene kadar ürün yine
 * de ağaçta görünür.
 */
export const BAKIMX_CATEGORY_LABELS: Record<string, string> = {
  aku: "Akü",
  "yag-filtresi": "Yağ filtresi",
  "hava-filtresi": "Hava filtresi",
  "polen-filtresi": "Polen filtresi",
  "yakit-filtresi": "Yakıt filtresi",
  "motor-yagi": "Motor yağı",
  "sanziman-yagi": "Şanzıman yağı",
  antifriz: "Antifriz",
  "fren-hidroligi": "Fren hidroliği",
  "fren-balatasi": "Fren balatası",
  "fren-diski": "Fren diski",
  buji: "Buji",
  "triger-seti": "Triger seti",
  silecek: "Silecek",
  ampul: "Ampul",
  lastik: "Lastik",
}

/** "far-ampulu" → "Far ampulu". Etiketi olmayan yaprak için okunur karşılık. */
export function humanizeCategoryKey(key: string): string {
  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("tr") + word.slice(1))
    .join(" ")
}

export function bakimxCategoryLabel(key: string): string {
  return BAKIMX_CATEGORY_LABELS[key] ?? humanizeCategoryKey(key)
}

/**
 * TecDoc `articleNo` ile BakımX ürünlerini eşleştir — Faz 2'de TecDoc satırında
 * fiyat rozeti göstermek için. `articleNumbers` sağlanırsa, her biri `sku` ya da
 * `oemNumbers` içinde (normalize edilerek) eşleşip eşleşmediğine bakılır.
 *
 * Yanıt `{ articleNo → BakimxProductSummary }` haritasıdır; eşleşmeyen
 * `articleNo` haritaya girmez.
 *
 * `workshopId` sağlanırsa, atölyenin BakımX iskontosunu ürün fiyatlarına uygular (BAK-47).
 */
export async function matchBakimxProductsByPartNumbers(
  articleNumbers: string[],
  workshopId?: string | null,
): Promise<Record<string, BakimxProductSummary>> {
  if (articleNumbers.length === 0) return {}

  const normalized = articleNumbers.map(normalizePartNo).filter(Boolean)
  if (normalized.length === 0) return {}

  const discountBps = await resolveWorkshopDiscountBps(workshopId)

  const rows = await prisma.bakimxProduct.findMany({
    where: {
      ...VISIBLE_PRODUCT,
      OR: [
        { sku: { in: normalized } },
        { oemNumbers: { hasSome: normalized } },
      ],
    },
    select: BAKIMX_PRODUCT_SUMMARY_SELECT,
  })

  const result: Record<string, BakimxProductSummary> = {}
  for (const row of rows) {
    const product = toBakimxProductSummary(row, discountBps)
    const match = articleNumbers.find((no) => {
      const noNorm = normalizePartNo(no)
      if (noNorm === normalizePartNo(row.sku)) return true
      return row.oemNumbers.some((oem) => noNorm === normalizePartNo(oem))
    })
    if (match) result[match] = product
  }

  return result
}

/**
 * Parça seçicinin "BakımX Ürünleri" dalını dolduran taksonomi: yalnız ATÖLYEYE
 * GÖRÜNEN ürünü olan kategoriler, ürün sayısıyla. Kategorisi boş (`null`)
 * ürünler ağaçta yaprak açmaz — onlara arama üzerinden erişilir.
 */
export async function listBakimxCategories(): Promise<BakimxCategoryNode[]> {
  const groups = await prisma.bakimxProduct.groupBy({
    by: ["categoryKey"],
    where: { ...VISIBLE_PRODUCT, categoryKey: { not: null } },
    _count: { _all: true },
  })

  return groups
    .flatMap((group) =>
      group.categoryKey == null
        ? []
        : [
            {
              key: group.categoryKey,
              label: bakimxCategoryLabel(group.categoryKey),
              productCount: group._count._all,
            },
          ],
    )
    .sort((a, b) => a.label.localeCompare(b.label, "tr"))
}
