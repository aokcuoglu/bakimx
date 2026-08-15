/**
 * BakımX ürün kataloğunun (admin tarafı) saf yardımcıları — Prisma/React yok,
 * hepsi birim testli. Yazma yolları (`/admin/catalog` server action'ları) ve
 * ileride içe aktarım (BAK-34) aynı fonksiyonları çağırır; böylece "searchKey
 * yeniden üretilir", "fiyat kuruşta yuvarlanır", "denetim kaydı yazılır"
 * kuralları tek yerde durur.
 */

import { buildBakimxProductSearchKey } from "@/lib/parts/bakimx-search-key"
import { bpsToPercent, formatKurus, mulDivRound, percentToBps } from "@/lib/money"
import { FOLD_FROM, FOLD_TO } from "@/lib/tr-search"

// ---------------------------------------------------------------------------
// İç taksonomi
// ---------------------------------------------------------------------------

/**
 * `bakimx_products.category_key` için iç taksonomi. TecDoc ağacından bağımsız
 * (o köprü `tecdocCategoryId` ile Faz 2'de kurulacak): burada yalnız BakımX'in
 * kendi kataloğunu gruplayan sabit bir yaprak listesi var. Anahtarlar slug
 * biçiminde ve KALICI — etiketi değiştirmek serbest, anahtarı değiştirmek
 * kayıtlı ürünleri kategorisiz bırakır.
 */
export const BAKIMX_CATEGORIES = [
  { key: "aku", label: "Akü" },
  { key: "amortisor", label: "Amortisör" },
  { key: "ates-buji", label: "Buji & Ateşleme" },
  { key: "antifriz", label: "Antifriz & Soğutma" },
  { key: "fren-balatasi", label: "Fren Balatası" },
  { key: "fren-diski", label: "Fren Diski" },
  { key: "hava-filtresi", label: "Hava Filtresi" },
  { key: "kayis-triger", label: "Kayış & Triger" },
  { key: "lastik", label: "Lastik" },
  { key: "motor-yagi", label: "Motor Yağı" },
  { key: "polen-filtresi", label: "Polen Filtresi" },
  { key: "sarf-malzeme", label: "Sarf Malzeme" },
  { key: "silecek", label: "Silecek" },
  { key: "yag-filtresi", label: "Yağ Filtresi" },
  { key: "yakit-filtresi", label: "Yakıt Filtresi" },
  { key: "diger", label: "Diğer" },
] as const

export type BakimxCategoryKey = (typeof BAKIMX_CATEGORIES)[number]["key"]

const CATEGORY_LABELS = new Map<string, string>(BAKIMX_CATEGORIES.map((c) => [c.key, c.label]))

export function isBakimxCategoryKey(key: string | null | undefined): key is BakimxCategoryKey {
  return !!key && CATEGORY_LABELS.has(key)
}

/** Bilinmeyen (ör. elle DB'den girilmiş) anahtar için anahtarın kendisi döner — satır kaybolmaz. */
export function bakimxCategoryLabel(key: string | null | undefined): string {
  if (!key) return "—"
  return CATEGORY_LABELS.get(key) ?? key
}

// ---------------------------------------------------------------------------
// Marka slug'ı
// ---------------------------------------------------------------------------

/**
 * Marka adından URL/dosya güvenli slug. `normalizePartSearchTerm` BURADA
 * KULLANILAMAZ: o ayraçları tamamen siler ("Petrol Ofisi" → "petrolofisi") ve
 * okunabilir bir slug üretmez. Katlama tablosu (FOLD_FROM/FOLD_TO) ortak, yani
 * "Bosch Türkiye" → "bosch-turkiye".
 */
export function bakimxBrandSlug(name: string): string {
  // "İ" (U+0130) küçük harfe inerken "i" + BİRLEŞEN NOKTA (U+0307) üretir.
  // `normalizePartSearchTerm` bu işareti sildiği için orada sorun çıkmaz; burada
  // silmezsek [^a-z0-9] süzgeci onu ayraca çevirir ve "ŞİŞECAM" → "si-secam"
  // olur. NFD + birleşen işaret temizliği bunu keser.
  const lowered = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  let folded = ""
  for (const ch of lowered) {
    const i = FOLD_FROM.indexOf(ch)
    folded += i === -1 ? ch : FOLD_TO[i]
  }
  return folded
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * `slug` kolonu UNIQUE. Ad farklı ama slug'ı aynı olan ikinci marka
 * ("Mutlu Akü" ↔ "Mutlu-Akü") kayıt anında P2002 ile patlamasın diye sonuna
 * sayaç eklenir. `taken` çağıranın DB'den okuduğu mevcut slug kümesidir.
 */
export function uniqueBakimxBrandSlug(name: string, taken: Iterable<string>): string {
  const base = bakimxBrandSlug(name) || "marka"
  const used = new Set(taken)
  if (!used.has(base)) return base
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`
    if (!used.has(candidate)) return candidate
  }
  return `${base}-${used.size + 1}`
}

// ---------------------------------------------------------------------------
// Fiyat
// ---------------------------------------------------------------------------

/**
 * Toplu yüzdesel fiyat güncellemesi. Yüzde önce bps'e çevrilir (%2,5 → 250),
 * fark `mulDivRound` ile kuruşta yuvarlanır (yarım yukarı, sıfırdan uzağa) ve
 * sonuç asla negatife inmez. Yüzde negatif olabilir (indirim).
 */
export function applyPricePercent(priceKurus: number, percent: number): number {
  const base = Math.trunc(priceKurus)
  const delta = mulDivRound(base, percentToBps(percent), 10000)
  return Math.max(0, base + delta)
}

/** Toplu stok güncellemesinin üç kipi; sonuç negatife inmez. */
export type StockUpdateMode = "set" | "increase" | "decrease"

export function applyStockUpdate(currentQty: number, mode: StockUpdateMode, quantity: number): number {
  const current = Math.trunc(currentQty)
  const qty = Math.max(0, Math.trunc(quantity))
  if (mode === "set") return qty
  if (mode === "increase") return current + qty
  return Math.max(0, current - qty)
}

// ---------------------------------------------------------------------------
// Stok durumu (liste rozeti)
// ---------------------------------------------------------------------------

export type BakimxStockStatus = "out_of_stock" | "low_stock" | "in_stock"

/** `lowStockQty = 0` iken "kritik" eşiği yoktur; yalnız stok bitince uyarılır. */
export function bakimxStockStatus(product: { stockQty: number; lowStockQty: number }): BakimxStockStatus {
  if (product.stockQty <= 0) return "out_of_stock"
  if (product.lowStockQty > 0 && product.stockQty <= product.lowStockQty) return "low_stock"
  return "in_stock"
}

// ---------------------------------------------------------------------------
// Yazma verisi (searchKey tek yerden üretilir)
// ---------------------------------------------------------------------------

export interface BakimxProductWriteInput {
  sku: string
  name: string
  brandId: string
  categoryKey: string | null
  tecdocCategoryId: number | null
  barcode: string | null
  unit: string
  description: string | null
  imageUrl: string | null
  oemNumbers: string[]
  workshopPriceKurus: number
  vatRateBps: number
  costPriceKurus: number | null
  stockQty: number
  lowStockQty: number
  backorderable: boolean
  leadTimeDays: number | null
  isActive: boolean
}

/**
 * Ürün kartının DB'ye yazılacak alan kümesi. TEK giriş noktası: `searchKey`
 * burada üretildiği için hiçbir çağıran onu elle set etmez ve bayat kalamaz
 * (issue kuralı: "yazma yollarında searchKey yeniden üretilir").
 * `brandName` denormalize kolondur — markanın o anki adı ürün kartına kopyalanır.
 */
export function bakimxProductWriteData(input: BakimxProductWriteInput, brandName: string) {
  return {
    sku: input.sku,
    name: input.name,
    brandId: input.brandId,
    brandName,
    categoryKey: input.categoryKey,
    tecdocCategoryId: input.tecdocCategoryId,
    barcode: input.barcode,
    unit: input.unit,
    description: input.description,
    imageUrl: input.imageUrl,
    oemNumbers: input.oemNumbers,
    workshopPriceKurus: input.workshopPriceKurus,
    vatRateBps: input.vatRateBps,
    costPriceKurus: input.costPriceKurus,
    stockQty: input.stockQty,
    lowStockQty: input.lowStockQty,
    backorderable: input.backorderable,
    leadTimeDays: input.leadTimeDays,
    isActive: input.isActive,
    searchKey: buildBakimxProductSearchKey({
      name: input.name,
      brandName,
      sku: input.sku,
      oemNumbers: input.oemNumbers,
    }),
  }
}

// ---------------------------------------------------------------------------
// Denetim kaydı (BakimxCatalogAudit)
// ---------------------------------------------------------------------------

export type CatalogAuditAction = "create" | "update" | "price_change" | "stock_change"

/**
 * Denetim kaydına giren ürün alanları. `searchKey` KASITLI olarak dışarıda:
 * türetilmiş bir kolon (ad/marka/sku/oem'den üretilir), değişimi zaten
 * kaynak alanların değişiminden okunur ve JSON'u gereksiz şişirir.
 */
export const AUDITED_PRODUCT_FIELDS = [
  "sku",
  "name",
  "brandId",
  "brandName",
  "categoryKey",
  "tecdocCategoryId",
  "barcode",
  "unit",
  "description",
  "imageUrl",
  "oemNumbers",
  "workshopPriceKurus",
  "vatRateBps",
  "costPriceKurus",
  "stockQty",
  "lowStockQty",
  "backorderable",
  "leadTimeDays",
  "isActive",
] as const

/** Bir ürün satırından denetlenen alanları seçer (fazlası yazılmaz, azı değil). */
export function productAuditSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {}
  for (const field of AUDITED_PRODUCT_FIELDS) {
    if (field in row) snapshot[field] = row[field]
  }
  return snapshot
}

const PRICE_FIELDS = ["workshopPriceKurus", "vatRateBps", "costPriceKurus", "currency"] as const
const STOCK_FIELDS = ["stockQty", "lowStockQty", "backorderable", "leadTimeDays"] as const

/**
 * Değişen alanları çıkarır. Diziler (oemNumbers) sıra duyarlı karşılaştırılır;
 * ürün kartında sıra kullanıcının girdiği sıradır ve anlamlıdır.
 */
export function diffCatalogFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { keys: string[]; before: Partial<T>; after: Partial<T> } {
  const keys: string[] = []
  const beforeChanged: Partial<T> = {}
  const afterChanged: Partial<T> = {}

  for (const key of Object.keys(after) as (keyof T & string)[]) {
    const a = before[key]
    const b = after[key]
    const same = Array.isArray(a) && Array.isArray(b)
      ? a.length === b.length && a.every((v, i) => v === b[i])
      : a === b
    if (same) continue
    keys.push(key)
    beforeChanged[key] = a
    afterChanged[key] = b
  }

  return { keys, before: beforeChanged, after: afterChanged }
}

/**
 * Denetim satırının `action` değeri. Bir güncelleme aynı anda hem fiyat hem
 * stok değiştirebilir; kolon tek değer tuttuğu için öncelik
 * fiyat > stok > diğer (durum/kart alanları). Değişen alanların TAMAMI yine
 * `beforeJson`/`afterJson`'a yazıldığı için bilgi kaybı olmaz.
 * Hiçbir alan değişmediyse `null` döner — boş denetim satırı yazılmaz.
 */
export function catalogAuditAction(changedKeys: readonly string[]): CatalogAuditAction | null {
  if (changedKeys.length === 0) return null
  if (changedKeys.some((k) => (PRICE_FIELDS as readonly string[]).includes(k))) return "price_change"
  if (changedKeys.some((k) => (STOCK_FIELDS as readonly string[]).includes(k))) return "stock_change"
  return "update"
}

/** Denetim kaydındaki teknik alan adlarının ekranda gösterilen karşılıkları. */
const AUDIT_FIELD_LABELS: Record<string, string> = {
  sku: "Ürün kodu",
  name: "Ürün adı",
  brandId: "Marka",
  brandName: "Marka adı",
  categoryKey: "BakımX kategorisi",
  tecdocCategoryId: "TecDoc kategorisi",
  barcode: "Barkod",
  unit: "Birim",
  description: "Açıklama",
  imageUrl: "Görsel",
  oemNumbers: "OEM numaraları",
  workshopPriceKurus: "Fiyat (KDV hariç)",
  vatRateBps: "KDV oranı",
  costPriceKurus: "İç maliyet",
  stockQty: "Stok",
  lowStockQty: "Kritik stok eşiği",
  backorderable: "Siparişe açık",
  leadTimeDays: "Tedarik süresi",
  isActive: "Durum",
  logoUrl: "Logo",
  slug: "Slug",
  percent: "Uygulanan yüzde",
  mode: "Stok işlemi",
  reason: "Gerekçe",
}

const KURUS_FIELDS = new Set(["workshopPriceKurus", "costPriceKurus"])

function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—"
  if (typeof value === "boolean") {
    return field === "isActive" ? (value ? "Aktif" : "Pasif") : value ? "Evet" : "Hayır"
  }
  if (typeof value === "number") {
    if (KURUS_FIELDS.has(field)) return formatKurus(value)
    if (field === "vatRateBps") return `%${bpsToPercent(value)}`
    return String(value)
  }
  return String(value)
}

/**
 * Denetim satırının `beforeJson`/`afterJson`'ını "Alan: eski → yeni" satırlarına
 * çevirir. `create` kayıtlarında `before` yoktur; o zaman yalnız yeni değer yazılır.
 * Bilinmeyen alanlar teknik adıyla gösterilir — satır kaybolmaz.
 */
export function formatCatalogAuditChanges(before: unknown, after: unknown): string[] {
  const beforeBag = (before ?? {}) as Record<string, unknown>
  const afterBag = (after ?? {}) as Record<string, unknown>
  const fields = [...new Set([...Object.keys(afterBag), ...Object.keys(beforeBag)])]

  return fields.map((field) => {
    const label = AUDIT_FIELD_LABELS[field] ?? field
    const hasBefore = field in beforeBag
    const newValue = formatAuditValue(field, afterBag[field])
    if (!hasBefore) return `${label}: ${newValue}`
    return `${label}: ${formatAuditValue(field, beforeBag[field])} → ${newValue}`
  })
}

/**
 * Kullanıcının serbest yazdığı OEM listesini ("1234, 5678" / satır satır)
 * normalize eder: kırpar, boşları ve tekrarları atar, sırayı korur.
 */
export function parseOemNumbers(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[\n,;]/)) {
    const value = part.trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}
