/**
 * Marka bazlı CSV içe aktarımın SAF çekirdeği — BAK-34 / GitHub #211.
 * Prisma yok, React yok: başlık eşlemesi, hücre ayrıştırma ve "ne olacak"
 * planı burada üretilir ve tamamı birim testlidir. DB'ye dokunan parça
 * `src/lib/catalog/bakimx-import.ts`'te.
 *
 * ÜÇ KURAL
 * 1. **Ortak yazma yolu.** Plan `BakimxProductWriteInput` üretir; yazan taraf
 *    `bakimxProductWriteData` ile kaydeder. İçe aktarılan ürün, admin
 *    ekranından girilenle AYNI `searchKey`'i alır — aksi hâlde CSV'den gelen
 *    ürünler sessizce aranamaz olurdu.
 * 2. **Boş hücre "sil" demek değildir.** Dosyada olmayan kolon ve boş bırakılan
 *    hücre, mevcut üründe o alana DOKUNMAZ; yeni üründe varsayılana düşer.
 *    Zorunlu alanın boş kalması satır hatasıdır.
 * 3. **Sessiz uygulama yok.** Her satır ya `create`/`update` ya `skip` ya da
 *    `error`'dur; hatalı satır partiyi düşürmez, satır numarasıyla raporlanır.
 */

import { normalizePartSearchTerm } from "@/lib/tr-search"
import { netFromGrossKurus, parseTRYToKurus, percentToBps } from "@/lib/money"
import { generateCSV } from "@/lib/reports/export"
import {
  BAKIMX_CATEGORIES,
  isBakimxCategoryKey,
  parseOemNumbers,
  type BakimxProductWriteInput,
} from "@/lib/catalog/bakimx-catalog"
import type { CsvRow } from "@/lib/catalog/csv-parse"

// ---------------------------------------------------------------------------
// Sınırlar ve varsayılanlar
// ---------------------------------------------------------------------------

/** Tek dosyada kabul edilen en fazla veri satırı. */
export const IMPORT_MAX_ROWS = 20_000
/** Yüklenebilecek en büyük dosya — 20.000 satırlık bir fiyat listesi ~3 MB. */
export const IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024
/** `errorsJson`'a yazılan en fazla satır hatası (JSON şişmesin). */
export const IMPORT_MAX_REPORTED_ERRORS = 500
/** Ön izlemede kullanıcıya gösterilen örnek satır sayısı (kategori başına). */
export const IMPORT_PREVIEW_SAMPLE = 50

export const DEFAULT_VAT_RATE_BPS = 2000
export const DEFAULT_UNIT = "adet"

/** `BakimxImportMode` enum'unun saf karşılığı — bu modül Prisma'ya bağlı değil. */
export type CatalogImportMode = "upsert" | "price_stock_only"

export const CATALOG_IMPORT_MODE_LABELS: Record<CatalogImportMode, string> = {
  upsert: "Tam ürün kartı (yeni ekle + güncelle)",
  price_stock_only: "Yalnız fiyat ve stok güncelle",
}

// ---------------------------------------------------------------------------
// Şablon kolonları
// ---------------------------------------------------------------------------

export type ImportField =
  | "sku"
  | "name"
  | "brandName"
  | "categoryKey"
  | "oemNumbers"
  | "crossReferences"
  | "barcode"
  | "unit"
  | "workshopPrice"
  | "vatRate"
  | "stockQty"
  | "lowStockQty"
  | "leadTimeDays"
  | "description"
  | "imageUrl"
  | "isActive"

export interface ImportColumn {
  field: ImportField
  /** Şablonda ve ekranda görünen başlık. */
  label: string
  /** Kabul edilen eşanlamlılar (katlanmış hâlleriyle eşleştirilir). */
  synonyms: readonly string[]
  /** Şablonun örnek satırındaki değer. */
  example: string
  hint?: string
}

/**
 * Tek sabit şablon + başlık adına göre ESNEK eşleme. Başlıklar `searchKey` ile
 * aynı katlamadan (`normalizePartSearchTerm`) geçtiği için "Ürün Kodu",
 * "urun kodu", "ÜRÜN KODU" ve "Ürün-Kodu" aynı anahtara iner; eşleşme TAM
 * anahtar üzerindedir, alt-dize değil ("Fiyat (KDV Dahil)" kazara "Fiyat"a
 * düşmez).
 */
export const CATALOG_IMPORT_COLUMNS: readonly ImportColumn[] = [
  {
    field: "sku",
    label: "Ürün Kodu",
    synonyms: ["ürün kodu", "urun kodu", "stok kodu", "malzeme kodu", "parça kodu", "sku", "kod", "code", "product code", "wunder_no"],
    example: "MTL-60AH",
    hint: "Zorunlu — idempotensi anahtarı. Aynı kod ikinci kez yüklenirse ürün güncellenir.",
  },
  {
    field: "name",
    label: "Ürün Adı",
    synonyms: ["ürün adı", "urun adi", "ad", "adı", "isim", "ürün", "açıklama adı", "name", "product name", "malzeme adı"],
    example: "Mutlu Akü 60Ah 540A",
    hint: "Tam ürün kartı modunda zorunlu.",
  },
  {
    field: "brandName",
    label: "Marka",
    synonyms: ["marka", "brand", "üretici", "uretici", "marka adı"],
    example: "Mutlu",
    hint: "İsteğe bağlı — dolu ise ekranda seçilen markayla aynı olmalıdır.",
  },
  {
    field: "categoryKey",
    label: "Kategori",
    synonyms: ["kategori", "category", "grup", "ürün grubu", "urun grubu", "cinsi"],
    example: "aku",
    hint: "İç taksonomi anahtarı ya da etiketi. Tanınmayan değer boş bırakılır.",
  },
  {
    field: "oemNumbers",
    label: "OEM No",
    synonyms: ["oem no", "oem", "oem numarası", "oem numaraları", "oe no", "muadil no", "cross reference"],
    example: "1234567, 7654321",
    hint: "Virgülle çoklu girilebilir.",
  },
  {
    field: "crossReferences",
    label: "Cross Reference",
    synonyms: ["cross reference", "cross-reference", "cross references", "muadil kod", "muadil kodları", "hengst_no", "mann", "mahle"],
    example: "E3950LC-2, CUK23005-2, LAK1156/S",
    hint: "Virgülle çoklu girilebilir; OEM numaralarından ayrı saklanır.",
  },
  {
    field: "barcode",
    label: "Barkod",
    synonyms: ["barkod", "barcode", "ean", "gtin"],
    example: "8690000000001",
  },
  {
    field: "unit",
    label: "Birim",
    synonyms: ["birim", "unit", "ölçü birimi", "olcu birimi"],
    example: "adet",
    hint: `Boşsa "${DEFAULT_UNIT}".`,
  },
  {
    field: "workshopPrice",
    label: "Fiyat (KDV hariç)",
    synonyms: [
      "fiyat (kdv hariç)",
      "fiyat kdv hariç",
      "fiyat",
      "birim fiyat",
      "liste fiyatı",
      "net fiyat",
      "alış fiyatı",
      "price",
      "unit price",
      "fiyat_tl",
    ],
    example: "1.234,56",
    hint: "Zorunlu. Ondalık ayracı virgül de nokta da olabilir.",
  },
  {
    field: "vatRate",
    label: "KDV Oranı",
    synonyms: ["kdv oranı", "kdv orani", "kdv", "kdv %", "vergi oranı", "vat", "vat rate", "tax rate"],
    example: "20",
    hint: "Boşsa %20.",
  },
  {
    field: "stockQty",
    label: "Stok",
    synonyms: ["stok", "stok adedi", "stok miktarı", "adet", "miktar", "stock", "quantity", "qty"],
    example: "25",
    hint: "Zorunlu. Tam sayı.",
  },
  {
    field: "lowStockQty",
    label: "Kritik Stok",
    synonyms: ["kritik stok", "minimum stok", "min stok", "kritik seviye", "low stock", "min stock"],
    example: "5",
  },
  {
    field: "leadTimeDays",
    label: "Tedarik Süresi (gün)",
    synonyms: ["tedarik süresi (gün)", "tedarik süresi", "tedarik suresi", "termin", "termin süresi", "lead time", "lead time days"],
    example: "3",
  },
  {
    field: "description",
    label: "Açıklama",
    synonyms: ["açıklama", "aciklama", "detay", "description", "not"],
    example: "12V 60Ah 540A marş akümülatörü",
  },
  {
    field: "imageUrl",
    label: "Görsel URL",
    synonyms: ["görsel url", "gorsel url", "görsel", "resim", "resim url", "image", "image url", "foto", "image_url"],
    example: "https://ornek.com/aku.jpg",
  },
  {
    field: "isActive",
    label: "Aktif",
    synonyms: ["aktif", "durum", "yayında", "active", "status", "is active"],
    example: "Evet",
    hint: "Boşsa aktif kabul edilir.",
  },
]

/** Kolon başına eşanlamlı → alan indeksi (çakışmalar modül yüklenirken görünür). */
const FIELD_BY_FOLDED_HEADER = new Map<string, ImportField>()
for (const column of CATALOG_IMPORT_COLUMNS) {
  for (const synonym of [column.label, ...column.synonyms]) {
    const folded = normalizePartSearchTerm(synonym)
    if (folded) FIELD_BY_FOLDED_HEADER.set(folded, column.field)
  }
}

/**
 * "Fiyat (KDV Dahil)" gibi başlıklar fiyat kolonuna eşlenir ama KDV DAHİL
 * geldiklerini söylerler. Kullanıcı "KDV dahil" kutusunu işaretlemediyse
 * dosya sessizce %20 şişmiş fiyatlarla yüklenirdi — bu ipucu onu hataya çevirir.
 */
const VAT_INCLUDED_PRICE_HEADERS = new Set(
  ["fiyat (kdv dahil)", "kdv dahil fiyat", "fiyat kdv dahil", "brüt fiyat", "gross price"].map((h) =>
    normalizePartSearchTerm(h),
  ),
)
for (const header of VAT_INCLUDED_PRICE_HEADERS) FIELD_BY_FOLDED_HEADER.set(header, "workshopPrice")

const COLUMN_BY_FIELD = new Map<ImportField, ImportColumn>(CATALOG_IMPORT_COLUMNS.map((c) => [c.field, c]))

export function importColumnLabel(field: ImportField): string {
  return COLUMN_BY_FIELD.get(field)?.label ?? field
}

// ---------------------------------------------------------------------------
// Dosya düzeyi kontroller
// ---------------------------------------------------------------------------

/** Excel çalışma kitabı (.xlsx = ZIP, .xls = OLE2) imzaları. */
const XLSX_MAGIC = [0x50, 0x4b, 0x03, 0x04]
const XLS_MAGIC = [0xd0, 0xcf, 0x11, 0xe0]

function startsWithMagic(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, index) => bytes[index] === byte)
}

/**
 * Desteklenmeyen dosya için KULLANICIYA NE YAPACAĞINI söyleyen hata; desteklenen
 * dosya için `null`.
 *
 * Excel kitabı sessizce başarısız olmamalı: `.xlsx` aslında bir ZIP'tir, UTF-8
 * olarak çözülünce anlamsız bir tek satır olur ve "0 geçerli satır" gibi görünür.
 * Hem uzantıya hem SİHİRLİ BAYTLARA bakılır — kullanıcının `.csv` diye
 * adlandırdığı bir kitap da yakalanır (BAK-30: `.xlsx` desteği kapsam dışı).
 */
export function describeUnsupportedImportFile(fileName: string, bytes: Uint8Array): string | null {
  const excelHelp =
    "Bu dosya Excel formatında. Excel'de Farklı Kaydet → CSV UTF-8 ile kaydedip tekrar yükleyin."
  const lower = fileName.toLowerCase()

  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm") || lower.endsWith(".xls")) return excelHelp
  if (startsWithMagic(bytes, XLSX_MAGIC) || startsWithMagic(bytes, XLS_MAGIC)) return excelHelp
  if (bytes.byteLength === 0) return "Dosya boş."
  if (bytes.byteLength > IMPORT_MAX_FILE_BYTES) {
    return `Dosya çok büyük (en fazla ${Math.round(IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB).`
  }
  return null
}

/**
 * Dosyayı UTF-8 olarak çözer. Kayıp karakter (U+FFFD) varsa dosya büyük
 * olasılıkla Windows-1254'tür: mojibake'i kataloğa yazmak yerine kullanıcıyı
 * doğru kaydetmeye yönlendiririz.
 */
export function decodeImportFile(bytes: Uint8Array): { text: string } | { error: string } {
  const text = new TextDecoder("utf-8").decode(bytes)
  if (text.includes("�")) {
    return {
      error:
        "Dosyanın karakter kodlaması UTF-8 değil (Türkçe harfler bozuk okunuyor). Excel'de Farklı Kaydet → CSV UTF-8 ile kaydedip tekrar yükleyin.",
    }
  }
  return { text }
}

// ---------------------------------------------------------------------------
// Başlık eşlemesi
// ---------------------------------------------------------------------------

export interface ImportHeaderMapping {
  /** Alan → başlıktaki kolon indeksi. */
  byField: Partial<Record<ImportField, number>>
  /** Tanınmayan başlıklar — hata değil, bilgi (kullanıcı yanlış dosyayı fark etsin). */
  unknownHeaders: string[]
  /** Aynı alana eşlenen ikinci ve sonraki başlıklar; ilki kazanır. */
  duplicateHeaders: string[]
  /** Fiyat başlığı açıkça "KDV dahil" diyorsa true. */
  priceHeaderIncludesVat: boolean
  /** Birden çok üretici kolonu (örn. hengst_no/mann/mahle) birlikte okunur. */
  crossReferenceIndexes: number[]
  /** Wunder dışa aktarımında ad ve stok kaynak SKU/varsayılandan türetilir. */
  sourceKind: "generic" | "wunder"
}

export function mapImportHeaders(header: readonly string[]): ImportHeaderMapping {
  const byField: Partial<Record<ImportField, number>> = {}
  const unknownHeaders: string[] = []
  const duplicateHeaders: string[] = []
  let priceHeaderIncludesVat = false
  const crossReferenceIndexes: number[] = []
  const sourceKind = header.some((raw) => normalizePartSearchTerm(raw) === normalizePartSearchTerm("wunder_no"))
    ? "wunder"
    : "generic"

  header.forEach((raw, index) => {
    const folded = normalizePartSearchTerm(raw)
    if (!folded) return
    const field = FIELD_BY_FOLDED_HEADER.get(folded)
    if (!field) {
      unknownHeaders.push(raw.trim())
      return
    }
    if (field === "crossReferences") {
      crossReferenceIndexes.push(index)
      if (byField.crossReferences === undefined) byField.crossReferences = index
      return
    }
    if (byField[field] !== undefined) {
      duplicateHeaders.push(raw.trim())
      return
    }
    byField[field] = index
    if (field === "workshopPrice" && VAT_INCLUDED_PRICE_HEADERS.has(folded)) priceHeaderIncludesVat = true
  })

  // Wunder'ın `marka` alanı ürün üreticisi değil araç markasıdır; bilerek yok sayılır.
  if (sourceKind === "wunder") delete byField.brandName

  return { byField, unknownHeaders, duplicateHeaders, priceHeaderIncludesVat, crossReferenceIndexes, sourceKind }
}

/** Moda göre başlıkta BULUNMASI ZORUNLU kolonlar. */
export function requiredImportFields(mode: CatalogImportMode): ImportField[] {
  return mode === "upsert" ? ["sku", "name", "workshopPrice", "stockQty"] : ["sku"]
}

/**
 * Dosya düzeyinde (satırlara bakmadan) tespit edilebilen hatalar. Boş dizi
 * dönmüyorsa ön izleme hiç çalıştırılmaz: eksik kolonla üretilen bir "0 hata"
 * raporu kullanıcıyı yanıltır.
 */
export function validateImportHeader(
  mapping: ImportHeaderMapping,
  options: { mode: CatalogImportMode; pricesIncludeVat: boolean },
): string[] {
  const errors: string[] = []

  const required = requiredImportFields(options.mode).filter(
    (field) => mapping.sourceKind !== "wunder" || (field !== "name" && field !== "stockQty"),
  )
  const missing = required.filter((field) => mapping.byField[field] === undefined)
  if (missing.length > 0) {
    errors.push(`Dosyada zorunlu kolon eksik: ${missing.map(importColumnLabel).join(", ")}.`)
  }

  if (options.mode === "price_stock_only" && mapping.byField.workshopPrice === undefined && mapping.byField.stockQty === undefined) {
    errors.push("Yalnız fiyat ve stok modunda dosyada en az “Fiyat (KDV hariç)” veya “Stok” kolonu olmalıdır.")
  }

  if (mapping.priceHeaderIncludesVat && !options.pricesIncludeVat) {
    errors.push(
      "Fiyat kolonunun başlığı KDV dahil olduğunu söylüyor. “Fiyatlar KDV dahil” seçeneğini işaretleyin, aksi hâlde katalog KDV oranı kadar şişer.",
    )
  }

  return errors
}

// ---------------------------------------------------------------------------
// Hücre ayrıştırma
//
// Sözleşme: `null` = hücre BOŞ (alana dokunulmaz), `undefined` = değer
// GEÇERSİZ (satır hatası). İkisini ayırmak zorunlu, çünkü boş hücre meşrudur.
// ---------------------------------------------------------------------------

function cellAt(row: CsvRow, index: number | undefined): string {
  if (index === undefined) return ""
  return (row.cells[index] ?? "").trim()
}

/**
 * Para hücresi → KURUŞ. Ayraç kuralı `parseTRYToKurus` ile ORTAK: en sağdaki
 * ayraç ondalık kabul edilir, soldakiler binlik olarak silinir. Böylece
 * "1.234,56" (TR Excel) ve "1234.56" (dışa aktarım) aynı 123456 kuruşa iner;
 * "₺" ve "TL" de tolere edilir.
 */
export function parseMoneyCell(raw: string): number | null | undefined {
  const text = raw.trim()
  if (!text) return null
  if (!/\d/.test(text)) return undefined
  const kurus = parseTRYToKurus(text)
  if (kurus === null || kurus < 0) return undefined
  return kurus
}

/**
 * Yüzde hücresi → bps. Para ayrıştırıcısının aynısına dayanır (aynı ondalık
 * kuralı), yalnız "%" işareti düşürülür: "%20" / "20" / "18,00" → 2000 / 1800.
 */
export function parsePercentCell(raw: string): number | null | undefined {
  const text = raw.replace(/%/g, "").trim()
  if (!text) return null
  const kurus = parseMoneyCell(text)
  if (kurus === undefined) return undefined
  if (kurus === null) return null
  const percent = kurus / 100
  if (percent < 0 || percent > 100) return undefined
  return percentToBps(percent)
}

/**
 * Tam sayı hücresi. Binlik ayracı ("1.250" / "1,250" / "1 250") temizlenir;
 * ondalıklı değer HATA verir — yarım adet stok sessizce yuvarlanmamalı.
 */
export function parseIntegerCell(raw: string): number | null | undefined {
  const text = raw.replace(/\s/g, "")
  if (!text) return null
  const grouped = /^-?\d{1,3}([.,]\d{3})+$/.test(text) ? text.replace(/[.,]/g, "") : text
  if (!/^-?\d+$/.test(grouped)) return undefined
  const value = Number(grouped)
  if (!Number.isSafeInteger(value)) return undefined
  return value
}

const TRUE_CELLS = new Set(["evet", "e", "var", "aktif", "acik", "true", "yes", "y", "1", "x", "dogru"].map(normalizePartSearchTerm))
const FALSE_CELLS = new Set(["hayir", "h", "yok", "pasif", "kapali", "false", "no", "n", "0", "yanlis"].map(normalizePartSearchTerm))

export function parseBooleanCell(raw: string): boolean | null | undefined {
  const folded = normalizePartSearchTerm(raw)
  if (!folded) return null
  if (TRUE_CELLS.has(folded)) return true
  if (FALSE_CELLS.has(folded)) return false
  return undefined
}

/** Kategori hücresi: anahtar ("aku") ya da etiket ("Akü") kabul edilir. */
const CATEGORY_BY_FOLDED = new Map<string, string>()
for (const category of BAKIMX_CATEGORIES) {
  CATEGORY_BY_FOLDED.set(normalizePartSearchTerm(category.key), category.key)
  CATEGORY_BY_FOLDED.set(normalizePartSearchTerm(category.label), category.key)
}
for (const [source, key] of Object.entries({
  KABIN: "polen-filtresi",
  MAZOT: "yakit-filtresi",
  BENZIN: "yakit-filtresi",
  HAVA: "hava-filtresi",
  YAG: "yag-filtresi",
})) {
  CATEGORY_BY_FOLDED.set(normalizePartSearchTerm(source), key)
}

export function parseCategoryCell(raw: string): string | null | undefined {
  const folded = normalizePartSearchTerm(raw)
  if (!folded) return null
  const key = CATEGORY_BY_FOLDED.get(folded)
  if (key && isBakimxCategoryKey(key)) return key
  return undefined
}

// ---------------------------------------------------------------------------
// Satır → yama (patch)
// ---------------------------------------------------------------------------

/** Ürün kartının içe aktarımla yazılabilen alanları. */
type ProductPatch = Partial<Omit<BakimxProductWriteInput, "brandId">>

export interface ImportRowValues {
  line: number
  sku: string
  /** Yalnız dosyada DOLU gelen alanlar. */
  patch: ProductPatch
  /**
   * Fiyat KDV DAHİL geldiyse ham (brüt) kuruş değeri. Hariçe çevirme, efektif
   * KDV oranı (satırın kendi oranı → mevcut ürünün oranı → %20) bilindiği
   * yerde — `mergeImportRow` içinde — yapılır.
   */
  grossPriceKurus: number | null
  errors: string[]
}

export interface ParseImportRowOptions {
  mode: CatalogImportMode
  /** Ekranda seçilen marka; dosyadaki "Marka" kolonu bununla tutarlı olmalıdır. */
  brandName: string
  pricesIncludeVat: boolean
}

/**
 * Tek satırı doğrular. Hiçbir hata satırı diğer satırları etkilemez; dönen
 * `errors` doluysa satır plana `error` olarak girer.
 */
export function parseImportRow(
  row: CsvRow,
  mapping: ImportHeaderMapping,
  options: ParseImportRowOptions,
): ImportRowValues {
  const { byField } = mapping
  const errors: string[] = []
  const patch: ProductPatch = {}
  let grossPriceKurus: number | null = null

  const sku = cellAt(row, byField.sku)
  if (!sku) errors.push("Ürün kodu boş.")
  else if (sku.length > 60) errors.push("Ürün kodu 60 karakteri aşıyor.")
  else patch.sku = sku

  const name = cellAt(row, byField.name)
  if (name) {
    if (name.length > 200) errors.push("Ürün adı 200 karakteri aşıyor.")
    else patch.name = name
  } else if (options.mode === "upsert" && mapping.sourceKind === "wunder" && sku) {
    patch.name = sku
  } else if (options.mode === "upsert" && byField.name !== undefined) {
    errors.push("Ürün adı boş.")
  }

  // Dosyadaki marka, ekranda seçilenden farklıysa büyük olasılıkla yanlış dosya
  // seçilmiştir; "Bosch" listesini "Mutlu" altına yazmak sessiz bir felakettir.
  const brandCell = cellAt(row, byField.brandName)
  if (brandCell && normalizePartSearchTerm(brandCell) !== normalizePartSearchTerm(options.brandName)) {
    errors.push(`Satırdaki marka (${brandCell}) seçilen markadan (${options.brandName}) farklı.`)
  }

  if (byField.categoryKey !== undefined) {
    const category = parseCategoryCell(cellAt(row, byField.categoryKey))
    if (category === undefined) errors.push(`Kategori tanınmadı: ${cellAt(row, byField.categoryKey)}`)
    else if (category !== null) patch.categoryKey = category
  }

  if (byField.oemNumbers !== undefined) {
    const oems = parseOemNumbers(cellAt(row, byField.oemNumbers))
    if (oems.length > 50) errors.push("En fazla 50 OEM numarası girilebilir.")
    else if (oems.length > 0) patch.oemNumbers = oems
  }

  if (mapping.crossReferenceIndexes.length > 0) {
    const references = parseOemNumbers(
      mapping.crossReferenceIndexes.map((index) => cellAt(row, index)).filter(Boolean).join(","),
    )
    if (references.length > 100) errors.push("En fazla 100 cross-reference kodu girilebilir.")
    else if (references.length > 0) patch.crossReferences = references
  }

  const barcode = cellAt(row, byField.barcode)
  if (barcode) {
    if (barcode.length > 60) errors.push("Barkod 60 karakteri aşıyor.")
    else patch.barcode = barcode
  }

  const unit = cellAt(row, byField.unit)
  if (unit) {
    if (unit.length > 20) errors.push("Birim 20 karakteri aşıyor.")
    else patch.unit = unit
  }

  if (byField.workshopPrice !== undefined) {
    const rawPrice = cellAt(row, byField.workshopPrice)
    const price = parseMoneyCell(rawPrice)
    if (price === undefined) errors.push(`Fiyat okunamadı: ${rawPrice}`)
    else if (price === null) {
      if (options.mode === "upsert") errors.push("Fiyat boş.")
    } else if (options.pricesIncludeVat) grossPriceKurus = price
    else patch.workshopPriceKurus = price
  }

  if (byField.vatRate !== undefined) {
    const rawVat = cellAt(row, byField.vatRate)
    const vat = parsePercentCell(rawVat)
    if (vat === undefined) errors.push(`KDV oranı okunamadı: ${rawVat}`)
    else if (vat !== null) patch.vatRateBps = vat
  }

  if (byField.stockQty !== undefined) {
    const rawStock = cellAt(row, byField.stockQty)
    const stock = parseIntegerCell(rawStock)
    if (stock === undefined) errors.push(`Stok okunamadı: ${rawStock}`)
    else if (stock === null) {
      if (options.mode === "upsert") errors.push("Stok boş.")
    } else if (stock < 0) errors.push("Stok negatif olamaz.")
    else patch.stockQty = stock
  } else if (options.mode === "upsert" && mapping.sourceKind === "wunder") {
    patch.stockQty = 0
  }

  if (byField.lowStockQty !== undefined) {
    const rawLow = cellAt(row, byField.lowStockQty)
    const low = parseIntegerCell(rawLow)
    if (low === undefined) errors.push(`Kritik stok okunamadı: ${rawLow}`)
    else if (low !== null && low < 0) errors.push("Kritik stok negatif olamaz.")
    else if (low !== null) patch.lowStockQty = low
  }

  if (byField.leadTimeDays !== undefined) {
    const rawLead = cellAt(row, byField.leadTimeDays)
    const lead = parseIntegerCell(rawLead)
    if (lead === undefined) errors.push(`Tedarik süresi okunamadı: ${rawLead}`)
    else if (lead !== null && (lead < 0 || lead > 365)) errors.push("Tedarik süresi 0-365 gün aralığında olmalıdır.")
    else if (lead !== null) patch.leadTimeDays = lead
  }

  const description = cellAt(row, byField.description)
  if (description) {
    if (description.length > 2000) errors.push("Açıklama 2000 karakteri aşıyor.")
    else patch.description = description
  }

  const imageUrl = cellAt(row, byField.imageUrl)
  if (imageUrl) {
    if (!/^https?:\/\/\S+$/.test(imageUrl)) errors.push("Görsel adresi geçerli bir http(s) adresi değil.")
    else if (imageUrl.length > 500) errors.push("Görsel adresi 500 karakteri aşıyor.")
    else patch.imageUrl = imageUrl
  }

  if (byField.isActive !== undefined) {
    const rawActive = cellAt(row, byField.isActive)
    const active = parseBooleanCell(rawActive)
    if (active === undefined) errors.push(`“Aktif” kolonu okunamadı: ${rawActive}`)
    else if (active !== null) patch.isActive = active
  }

  return { line: row.line, sku, patch, grossPriceKurus, errors }
}

// ---------------------------------------------------------------------------
// Yama + mevcut ürün → tam yazma girdisi
// ---------------------------------------------------------------------------

/** Plan kurulurken DB'den okunan mevcut ürün (yazılabilir alanlar + kimlik). */
export interface ExistingCatalogProduct extends BakimxProductWriteInput {
  id: string
  /** Ürünün ŞU ANKİ markasının adı — başka markaya ait SKU'yu raporlamak için. */
  brandName: string
}

function stripProductId(product: ExistingCatalogProduct): BakimxProductWriteInput {
  const { id: _id, brandName: _brandName, ...rest } = product
  return rest
}

/** Yeni ürünün, dosyada verilmeyen alanları için varsayılanlar. */
function defaultWriteInput(sku: string, brandId: string): BakimxProductWriteInput {
  return {
    sku,
    name: "",
    brandId,
    categoryKey: null,
    barcode: null,
    unit: DEFAULT_UNIT,
    description: null,
    imageUrl: null,
    oemNumbers: [],
    crossReferences: [],
    workshopPriceKurus: 0,
    vatRateBps: DEFAULT_VAT_RATE_BPS,
    costPriceKurus: null,
    stockQty: 0,
    lowStockQty: 0,
    backorderable: false,
    leadTimeDays: null,
    isActive: true,
    tecdocCategoryId: null,
  }
}

/**
 * Mevcut ürün (varsa) + satır yaması → TAM `BakimxProductWriteInput`.
 *
 * Dosyada olmayan alan mevcut değerini korur (kural 2). KDV dahil gelen fiyat
 * burada hariçe çevrilir: efektif oran satırın kendi KDV kolonu, yoksa mevcut
 * ürünün oranı, o da yoksa %20'dir — dönüşümü satır ayrıştırmasında yapmak
 * mevcut ürünün %18'ini görmezden gelirdi.
 */
export function mergeImportRow(
  existing: ExistingCatalogProduct | null,
  values: ImportRowValues,
  context: { brandId: string; brandName: string },
): BakimxProductWriteInput {
  // `id` KASITLI olarak düşürülür: dönen nesne doğrudan `bakimxProductWriteData`
  // üzerinden Prisma'ya `data` olarak gider, kimlik oraya sızmamalı.
  const base: BakimxProductWriteInput = existing
    ? { ...stripProductId(existing), brandId: context.brandId }
    : defaultWriteInput(values.sku, context.brandId)

  const merged: BakimxProductWriteInput = { ...base, ...values.patch, sku: values.sku, brandId: context.brandId }

  if (values.grossPriceKurus !== null) {
    const vatBps = values.patch.vatRateBps ?? base.vatRateBps ?? DEFAULT_VAT_RATE_BPS
    merged.workshopPriceKurus = netFromGrossKurus(values.grossPriceKurus, vatBps)
  }

  return merged
}

// ---------------------------------------------------------------------------
// Plan (dry-run)
// ---------------------------------------------------------------------------

export type ImportEntryAction = "create" | "update" | "skip" | "error"

export interface ImportPlanEntry {
  line: number
  sku: string
  /** Ekranda gösterilecek ad — yeni üründe dosyadan, güncellemede mevcut karttan. */
  name: string
  action: ImportEntryAction
  /** `update` ise güncellenecek ürünün kimliği. */
  productId: string | null
  /** `create` / `update` ise yazılacak tam girdi. */
  input: BakimxProductWriteInput | null
  /** `skip` / `error` gerekçesi. */
  messages: string[]
}

export interface ImportRowIssue {
  line: number
  sku: string
  message: string
}

export interface ImportPlanCounts {
  total: number
  created: number
  updated: number
  skipped: number
  error: number
}

export interface ImportPlan {
  entries: ImportPlanEntry[]
  counts: ImportPlanCounts
  issues: ImportRowIssue[]
}

export interface BuildImportPlanInput {
  rows: readonly CsvRow[]
  mapping: ImportHeaderMapping
  mode: CatalogImportMode
  brand: { id: string; name: string }
  pricesIncludeVat: boolean
  /** SKU → mevcut ürün. Çağıran DB'den okur; saf fonksiyon DB'yi bilmez. */
  existingBySku: ReadonlyMap<string, ExistingCatalogProduct>
}

/**
 * Satırları uygulanmadan ÖNCE yeni / güncellenecek / atlanacak / hatalı diye
 * ayırır. Aynı SKU dosyada ikinci kez geçerse ikinci satır hatadır: hangi
 * satırın kazandığını sessizce seçmek, kullanıcının kopyala-yapıştır hatasını
 * gizler.
 */
export function buildImportPlan(input: BuildImportPlanInput): ImportPlan {
  const entries: ImportPlanEntry[] = []
  const issues: ImportRowIssue[] = []
  const counts: ImportPlanCounts = { total: 0, created: 0, updated: 0, skipped: 0, error: 0 }
  const seenSkus = new Map<string, number>()

  const fail = (line: number, sku: string, messages: string[], name = "") => {
    entries.push({ line, sku, name, action: "error", productId: null, input: null, messages })
    for (const message of messages) issues.push({ line, sku, message })
    counts.error++
  }

  for (const row of input.rows) {
    counts.total++

    const values = parseImportRow(row, input.mapping, {
      mode: input.mode,
      brandName: input.brand.name,
      pricesIncludeVat: input.pricesIncludeVat,
    })

    if (values.errors.length > 0) {
      fail(values.line, values.sku, values.errors, values.patch.name ?? "")
      continue
    }

    const firstLine = seenSkus.get(values.sku)
    if (firstLine !== undefined) {
      fail(values.line, values.sku, [`Bu ürün kodu ${firstLine}. satırda da var.`], values.patch.name ?? "")
      continue
    }
    seenSkus.set(values.sku, values.line)

    const existing = input.existingBySku.get(values.sku) ?? null

    // `sku` GLOBAL unique: aynı kod başka bir markanın ürününde duruyorsa bu
    // dosya büyük olasılıkla yanlış markaya yükleniyor. Ürünü sessizce başka
    // markaya taşımak yerine satırı raporlarız; marka değişimi ürün ekranının işi.
    if (existing && existing.brandId !== input.brand.id) {
      fail(
        values.line,
        values.sku,
        [`Bu ürün kodu katalogda başka bir markaya ait (${existing.brandName}). İçe aktarma marka değiştirmez.`],
        existing.name,
      )
      continue
    }

    if (input.mode === "price_stock_only") {
      if (!existing) {
        entries.push({
          line: values.line,
          sku: values.sku,
          name: values.patch.name ?? "",
          action: "skip",
          productId: null,
          input: null,
          messages: ["Katalogda bu ürün kodu yok — yalnız fiyat/stok modunda yeni ürün açılmaz."],
        })
        counts.skipped++
        continue
      }
      const touchesPrice = values.patch.workshopPriceKurus !== undefined || values.grossPriceKurus !== null
      const touchesStock = values.patch.stockQty !== undefined || values.patch.lowStockQty !== undefined
      if (!touchesPrice && !touchesStock && values.patch.vatRateBps === undefined) {
        entries.push({
          line: values.line,
          sku: values.sku,
          name: existing.name,
          action: "skip",
          productId: existing.id,
          input: null,
          messages: ["Fiyat ve stok hücreleri boş — güncellenecek değer yok."],
        })
        counts.skipped++
        continue
      }
    }

    const merged = mergeImportRow(existing, values, { brandId: input.brand.id, brandName: input.brand.name })

    if (!merged.name) {
      fail(values.line, values.sku, ["Ürün adı boş."])
      continue
    }

    entries.push({
      line: values.line,
      sku: values.sku,
      name: merged.name,
      action: existing ? "update" : "create",
      productId: existing?.id ?? null,
      input: merged,
      messages: [],
    })
    if (existing) counts.updated++
    else counts.created++
  }

  return { entries, counts, issues }
}

// ---------------------------------------------------------------------------
// Şablon
// ---------------------------------------------------------------------------

export const IMPORT_TEMPLATE_FILE_NAME = "bakimx-urun-sablonu.csv"

/**
 * İndirilebilir şablon. TR Excel çift tıklamayla açtığında kolonların ayrılması
 * için ayraç `;` ve dosyanın başında `sep=;` yönergesi var; BOM olmadan Excel
 * Türkçe karakterleri bozar. Kendi ayrıştırıcımız üçünü de tanır, yani şablonu
 * indirip doldurup geri yüklemek çalışır (bkz. product-import.test.ts).
 */
export function buildImportTemplateCsv(): string {
  const headers = CATALOG_IMPORT_COLUMNS.map((c) => c.label)
  const example = CATALOG_IMPORT_COLUMNS.map((c) => c.example)
  return `sep=;\n${generateCSV(headers, [example], ";")}\n`
}
