import { test, expect } from "bun:test"
import { parseCsv, UTF8_BOM } from "./csv-parse"
import { bakimxProductWriteData, type BakimxProductWriteInput } from "./bakimx-catalog"
import {
  buildImportPlan,
  buildImportTemplateCsv,
  CATALOG_IMPORT_COLUMNS,
  decodeImportFile,
  DEFAULT_UNIT,
  DEFAULT_VAT_RATE_BPS,
  describeUnsupportedImportFile,
  mapImportHeaders,
  mergeImportRow,
  parseBooleanCell,
  parseCategoryCell,
  parseImportRow,
  parseIntegerCell,
  parseMoneyCell,
  parsePercentCell,
  validateImportHeader,
  type ExistingCatalogProduct,
  type ImportPlan,
} from "./product-import"

const BRAND = { id: "brand_mutlu", name: "Mutlu" }

/** Gerçekçi bir TR Excel çıktısı: BOM + `;` ayraç + ondalık virgül + CRLF. */
const TR_EXCEL_CSV =
  `${UTF8_BOM}Ürün Kodu;Ürün Adı;Marka;Kategori;OEM No;Barkod;Birim;Fiyat (KDV hariç);KDV Oranı;Stok;Kritik Stok;Tedarik Süresi (gün);Açıklama;Görsel URL;Aktif\r\n` +
  `MTL-60AH;Mutlu Akü 60Ah 540A;Mutlu;Akü;1234567, 7654321;8690000000001;adet;1.234,56;20;25;5;3;"12V 60Ah, 540A";https://ornek.com/aku.jpg;Evet\r\n` +
  `MTL-72AH;Mutlu Akü 72Ah;Mutlu;aku;;;;2.499,90;20;10;;;;;Evet\r\n`

function planFrom(
  csv: string,
  options: {
    mode?: "upsert" | "price_stock_only"
    pricesIncludeVat?: boolean
    existing?: ExistingCatalogProduct[]
  } = {},
): ImportPlan {
  const doc = parseCsv(csv)
  const mapping = mapImportHeaders(doc.header)
  return buildImportPlan({
    rows: doc.rows,
    mapping,
    mode: options.mode ?? "upsert",
    brand: BRAND,
    pricesIncludeVat: options.pricesIncludeVat ?? false,
    existingBySku: new Map((options.existing ?? []).map((p) => [p.sku, p])),
  })
}

/** Planın `create` girdisini, DB'ye yazılmış bir ürün satırına çevirir. */
function asExisting(input: BakimxProductWriteInput, id: string, brandName = BRAND.name): ExistingCatalogProduct {
  return { ...input, id, brandName }
}

// ---------------------------------------------------------------------------
// Dosya düzeyi kontroller
// ---------------------------------------------------------------------------

test("an Excel workbook is refused with instructions, by extension or by magic bytes", () => {
  const xlsxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
  expect(describeUnsupportedImportFile("fiyat-listesi.xlsx", new Uint8Array([1, 2, 3]))).toContain("CSV UTF-8")
  // Kitabı ".csv" diye adlandırmak kurtarmaz — imzaya da bakılır.
  expect(describeUnsupportedImportFile("fiyat-listesi.csv", xlsxBytes)).toContain("CSV UTF-8")
  expect(describeUnsupportedImportFile("liste.xls", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toContain("CSV UTF-8")
})

test("an empty file is refused and a plain CSV passes", () => {
  expect(describeUnsupportedImportFile("bos.csv", new Uint8Array())).toBe("Dosya boş.")
  expect(describeUnsupportedImportFile("liste.csv", new TextEncoder().encode("Ürün Kodu;Stok\nA1;5\n"))).toBeNull()
})

test("decodeImportFile rejects non-UTF-8 bytes instead of importing mojibake", () => {
  // "Akü" Windows-1254'te: 0x41 0x6b 0xfc — UTF-8 çözücü 0xfc'yi U+FFFD yapar.
  const latin = new Uint8Array([0x41, 0x6b, 0xfc])
  const decoded = decodeImportFile(latin)
  expect("error" in decoded && decoded.error).toContain("UTF-8")

  const utf8 = decodeImportFile(new TextEncoder().encode("Akü"))
  expect("text" in utf8 && utf8.text).toBe("Akü")
})

// ---------------------------------------------------------------------------
// Başlık eşlemesi
// ---------------------------------------------------------------------------

test("mapImportHeaders folds Turkish headers and accepts synonyms", () => {
  const mapping = mapImportHeaders(["STOK KODU", "urun adi", "Liste Fiyatı", "Miktar", "Bilinmeyen Kolon"])
  expect(mapping.byField.sku).toBe(0)
  expect(mapping.byField.name).toBe(1)
  expect(mapping.byField.workshopPrice).toBe(2)
  expect(mapping.byField.stockQty).toBe(3)
  expect(mapping.unknownHeaders).toEqual(["Bilinmeyen Kolon"])
  expect(mapping.duplicateHeaders).toEqual([])
})

test("mapImportHeaders keeps the first column when a field repeats", () => {
  const mapping = mapImportHeaders(["Ürün Kodu", "SKU", "Ürün Adı"])
  expect(mapping.byField.sku).toBe(0)
  expect(mapping.duplicateHeaders).toEqual(["SKU"])
})

test("validateImportHeader reports missing required columns per mode", () => {
  const onlySku = mapImportHeaders(["Ürün Kodu"])
  expect(validateImportHeader(onlySku, { mode: "upsert", pricesIncludeVat: false })).toEqual([
    "Dosyada zorunlu kolon eksik: Ürün Adı, Fiyat (KDV hariç), Stok.",
  ])
  // Yalnız fiyat/stok modunda ürün adı istenmez ama güncellenecek bir kolon şart.
  expect(validateImportHeader(onlySku, { mode: "price_stock_only", pricesIncludeVat: false })).toHaveLength(1)
  expect(
    validateImportHeader(mapImportHeaders(["Ürün Kodu", "Stok"]), { mode: "price_stock_only", pricesIncludeVat: false }),
  ).toEqual([])
})

test("validateImportHeader refuses a KDV-dahil price column when the flag is off", () => {
  const mapping = mapImportHeaders(["Ürün Kodu", "Ürün Adı", "Fiyat (KDV Dahil)", "Stok"])
  expect(mapping.byField.workshopPrice).toBe(2)
  expect(mapping.priceHeaderIncludesVat).toBe(true)
  expect(validateImportHeader(mapping, { mode: "upsert", pricesIncludeVat: false })).toHaveLength(1)
  expect(validateImportHeader(mapping, { mode: "upsert", pricesIncludeVat: true })).toEqual([])
})

// ---------------------------------------------------------------------------
// Hücre ayrıştırma
// ---------------------------------------------------------------------------

test("parseMoneyCell accepts both decimal separators and thousands groups", () => {
  expect(parseMoneyCell("1.234,56")).toBe(123456)
  expect(parseMoneyCell("1234.56")).toBe(123456)
  expect(parseMoneyCell("1234,56")).toBe(123456)
  expect(parseMoneyCell("₺ 99,90")).toBe(9990)
  expect(parseMoneyCell("1.234.567,89")).toBe(123456789)
  expect(parseMoneyCell("")).toBeNull()
  expect(parseMoneyCell("fiyat yok")).toBeUndefined()
  expect(parseMoneyCell("-5")).toBeUndefined()
})

test("parsePercentCell reads %20, 20 and 18,5", () => {
  expect(parsePercentCell("%20")).toBe(2000)
  expect(parsePercentCell("20")).toBe(2000)
  expect(parsePercentCell("18,5")).toBe(1850)
  expect(parsePercentCell("")).toBeNull()
  expect(parsePercentCell("120")).toBeUndefined()
  expect(parsePercentCell("yok")).toBeUndefined()
})

test("parseIntegerCell strips thousands separators but rejects fractions", () => {
  expect(parseIntegerCell("25")).toBe(25)
  expect(parseIntegerCell("1.250")).toBe(1250)
  expect(parseIntegerCell("1 250")).toBe(1250)
  expect(parseIntegerCell("")).toBeNull()
  expect(parseIntegerCell("12,5")).toBeUndefined()
  expect(parseIntegerCell("çok")).toBeUndefined()
})

test("parseBooleanCell understands Turkish and English yes/no spellings", () => {
  expect(parseBooleanCell("Evet")).toBe(true)
  expect(parseBooleanCell("AKTİF")).toBe(true)
  expect(parseBooleanCell("1")).toBe(true)
  expect(parseBooleanCell("Hayır")).toBe(false)
  expect(parseBooleanCell("pasif")).toBe(false)
  expect(parseBooleanCell("")).toBeNull()
  expect(parseBooleanCell("belki")).toBeUndefined()
})

test("parseCategoryCell accepts the key or the label, rejects the unknown", () => {
  expect(parseCategoryCell("aku")).toBe("aku")
  expect(parseCategoryCell("Akü")).toBe("aku")
  expect(parseCategoryCell("Yağ Filtresi")).toBe("yag-filtresi")
  expect(parseCategoryCell("")).toBeNull()
  expect(parseCategoryCell("Uçak Motoru")).toBeUndefined()
})

// ---------------------------------------------------------------------------
// Uçtan uca: TR Excel çıktısı
// ---------------------------------------------------------------------------

test("a realistic TR Excel export maps to two new products", () => {
  const plan = planFrom(TR_EXCEL_CSV)
  expect(plan.counts).toEqual({ total: 2, created: 2, updated: 0, skipped: 0, error: 0 })

  const first = plan.entries[0]
  expect(first.action).toBe("create")
  expect(first.line).toBe(2)
  expect(first.input).toEqual({
    sku: "MTL-60AH",
    name: "Mutlu Akü 60Ah 540A",
    brandId: "brand_mutlu",
    categoryKey: "aku",
    barcode: "8690000000001",
    unit: "adet",
    description: "12V 60Ah, 540A",
    imageUrl: "https://ornek.com/aku.jpg",
    oemNumbers: ["1234567", "7654321"],
    workshopPriceKurus: 123456,
    vatRateBps: 2000,
    costPriceKurus: null,
    stockQty: 25,
    lowStockQty: 5,
    backorderable: false,
    leadTimeDays: 3,
    isActive: true,
    tecdocCategoryId: null,
  })

  // Boş bırakılan kolonlar varsayılana düşer, hata üretmez.
  expect(plan.entries[1].input).toMatchObject({
    sku: "MTL-72AH",
    unit: DEFAULT_UNIT,
    vatRateBps: DEFAULT_VAT_RATE_BPS,
    lowStockQty: 0,
    leadTimeDays: null,
    barcode: null,
    oemNumbers: [],
  })
})

test("re-uploading the same file produces 0 new and N updates (idempotency)", () => {
  const first = planFrom(TR_EXCEL_CSV)
  const existing = first.entries.map((e, i) => asExisting(e.input!, `prod_${i}`))

  const second = planFrom(TR_EXCEL_CSV, { existing })
  expect(second.counts).toEqual({ total: 2, created: 0, updated: 2, skipped: 0, error: 0 })
  expect(second.entries.map((e) => e.productId)).toEqual(["prod_0", "prod_1"])
  // İkinci turda yazılacak veri birincisiyle birebir aynı — sürüklenme yok.
  expect(second.entries.map((e) => e.input)).toEqual(first.entries.map((e) => e.input))
})

test("an imported product gets the same searchKey as one typed into the admin form", () => {
  const plan = planFrom(TR_EXCEL_CSV)
  const imported = bakimxProductWriteData(plan.entries[0].input!, BRAND.name)

  // Admin ekranındaki tekil ürün formunun ürettiği girdi (bkz. admin/catalog/actions.ts).
  const typedByHand = bakimxProductWriteData(
    {
      sku: "MTL-60AH",
      name: "Mutlu Akü 60Ah 540A",
      brandId: BRAND.id,
      categoryKey: "aku",
      barcode: "8690000000001",
      unit: "adet",
      description: "12V 60Ah, 540A",
      imageUrl: "https://ornek.com/aku.jpg",
      oemNumbers: ["1234567", "7654321"],
      workshopPriceKurus: 123456,
      vatRateBps: 2000,
      costPriceKurus: null,
      stockQty: 25,
      lowStockQty: 5,
      backorderable: false,
      leadTimeDays: 3,
      isActive: true,
      tecdocCategoryId: null,
    },
    BRAND.name,
  )

  expect(imported.searchKey).toBe(typedByHand.searchKey)
  expect(imported).toEqual(typedByHand)
})

// ---------------------------------------------------------------------------
// Hatalı satırlar
// ---------------------------------------------------------------------------

test("a bad row is reported with its line number and does not drop the batch", () => {
  const csv =
    "Ürün Kodu;Ürün Adı;Fiyat (KDV hariç);Stok\n" +
    "A1;Akü;100,00;5\n" +
    "A2;Filtre;bozuk;3\n" +
    ";Kodsuz;50;1\n" +
    "A3;Disk;250,00;7\n"
  const plan = planFrom(csv)

  expect(plan.counts).toEqual({ total: 4, created: 2, updated: 0, skipped: 0, error: 2 })
  expect(plan.issues).toEqual([
    { line: 3, sku: "A2", message: "Fiyat okunamadı: bozuk" },
    { line: 4, sku: "", message: "Ürün kodu boş." },
  ])
  expect(plan.entries.filter((e) => e.action === "create").map((e) => e.sku)).toEqual(["A1", "A3"])
})

test("a SKU repeated inside the same file fails on the second line", () => {
  const csv = "Ürün Kodu;Ürün Adı;Fiyat (KDV hariç);Stok\nA1;Akü;100;5\nA1;Akü tekrar;120;6\n"
  const plan = planFrom(csv)
  expect(plan.counts.created).toBe(1)
  expect(plan.issues).toEqual([{ line: 3, sku: "A1", message: "Bu ürün kodu 2. satırda da var." }])
})

test("a row whose brand column disagrees with the selected brand is an error", () => {
  const csv = "Ürün Kodu;Ürün Adı;Marka;Fiyat (KDV hariç);Stok\nA1;Akü;Bosch;100;5\n"
  const plan = planFrom(csv)
  expect(plan.counts.error).toBe(1)
  expect(plan.issues[0].message).toContain("Bosch")
})

test("a matching brand column with different casing and folding is accepted", () => {
  const csv = "Ürün Kodu;Ürün Adı;Marka;Fiyat (KDV hariç);Stok\nA1;Akü;MUTLU;100;5\n"
  expect(planFrom(csv).counts.created).toBe(1)
})

// ---------------------------------------------------------------------------
// KDV dahil fiyatlar
// ---------------------------------------------------------------------------

test("prices marked KDV dahil are converted to the net price stored in the catalog", () => {
  const csv = "Ürün Kodu;Ürün Adı;Fiyat (KDV hariç);KDV Oranı;Stok\nA1;Akü;120,00;20;5\n"
  const plan = planFrom(csv, { pricesIncludeVat: true })
  expect(plan.entries[0].input!.workshopPriceKurus).toBe(10000)
  expect(plan.entries[0].input!.vatRateBps).toBe(2000)
})

test("the gross price uses the existing product's VAT rate when the file has no rate column", () => {
  const existing: ExistingCatalogProduct = {
    ...planFrom("Ürün Kodu;Ürün Adı;Fiyat (KDV hariç);Stok\nA1;Akü;1;1\n").entries[0].input!,
    id: "prod_1",
    vatRateBps: 1000,
  }
  const csv = "Ürün Kodu;Ürün Adı;Fiyat (KDV hariç);Stok\nA1;Akü;110,00;5\n"
  const plan = planFrom(csv, { pricesIncludeVat: true, existing: [existing] })
  expect(plan.entries[0].input!.workshopPriceKurus).toBe(10000)
})

// ---------------------------------------------------------------------------
// price_stock_only modu
// ---------------------------------------------------------------------------

test("price_stock_only keeps the description and only moves price and stock", () => {
  const seed = planFrom(TR_EXCEL_CSV).entries[0].input!
  const existing = asExisting(seed, "prod_1")

  const csv = "Ürün Kodu;Fiyat (KDV hariç);Stok\nMTL-60AH;1.500,00;42\n"
  const plan = planFrom(csv, { mode: "price_stock_only", existing: [existing] })

  expect(plan.counts).toEqual({ total: 1, created: 0, updated: 1, skipped: 0, error: 0 })
  expect(plan.entries[0].input).toEqual({
    ...seed,
    workshopPriceKurus: 150000,
    stockQty: 42,
  })
})

test("price_stock_only skips an unknown SKU instead of inventing a product", () => {
  const csv = "Ürün Kodu;Fiyat (KDV hariç);Stok\nYOK-1;100;5\n"
  const plan = planFrom(csv, { mode: "price_stock_only" })
  expect(plan.counts).toEqual({ total: 1, created: 0, updated: 0, skipped: 1, error: 0 })
  expect(plan.entries[0].messages[0]).toContain("Katalogda bu ürün kodu yok")
})

test("price_stock_only skips a row whose price and stock cells are both blank", () => {
  const existing = asExisting(planFrom(TR_EXCEL_CSV).entries[0].input!, "prod_1")
  const csv = "Ürün Kodu;Fiyat (KDV hariç);Stok\nMTL-60AH;;\n"
  const plan = planFrom(csv, { mode: "price_stock_only", existing: [existing] })
  expect(plan.counts.skipped).toBe(1)
})

// ---------------------------------------------------------------------------
// "Boş hücre silmez" kuralı
// ---------------------------------------------------------------------------

test("upsert leaves untouched fields alone when their column is absent or blank", () => {
  const seed = planFrom(TR_EXCEL_CSV).entries[0].input!
  const existing = asExisting(seed, "prod_1")

  const csv = "Ürün Kodu;Ürün Adı;Fiyat (KDV hariç);Stok;Açıklama\nMTL-60AH;Mutlu Akü 60Ah 540A;1.500,00;30;\n"
  const plan = planFrom(csv, { existing: [existing] })

  const updated = plan.entries[0].input!
  expect(updated.workshopPriceKurus).toBe(150000)
  expect(updated.stockQty).toBe(30)
  // Boş açıklama hücresi ve hiç gelmeyen barkod/OEM kolonları mevcut değeri korur.
  expect(updated.description).toBe(seed.description)
  expect(updated.barcode).toBe(seed.barcode)
  expect(updated.oemNumbers).toEqual(seed.oemNumbers)
  expect(updated.imageUrl).toBe(seed.imageUrl)
})

test("a SKU that already belongs to another brand is refused, not silently moved", () => {
  const seed = planFrom(TR_EXCEL_CSV).entries[0].input!
  const foreign: ExistingCatalogProduct = {
    ...asExisting(seed, "prod_1", "Bosch"),
    brandId: "brand_bosch",
  }
  const plan = planFrom(TR_EXCEL_CSV, { existing: [foreign] })
  expect(plan.counts.error).toBe(1)
  expect(plan.issues[0].message).toContain("Bosch")
})

test("mergeImportRow drops the id and stale brand name from the write input", () => {
  const seed = planFrom(TR_EXCEL_CSV).entries[0].input!
  const merged = mergeImportRow(
    asExisting(seed, "prod_1"),
    { line: 2, sku: "MTL-60AH", patch: {}, grossPriceKurus: null, errors: [] },
    { brandId: BRAND.id, brandName: BRAND.name },
  )
  expect(merged).toEqual(seed)
  expect("id" in merged).toBe(false)
  expect("brandName" in merged).toBe(false)
})

// ---------------------------------------------------------------------------
// Şablon
// ---------------------------------------------------------------------------

test("the downloadable template round-trips through the importer", () => {
  const template = buildImportTemplateCsv()
  expect(template.startsWith("sep=;\n")).toBe(true)

  const doc = parseCsv(UTF8_BOM + template)
  expect(doc.delimiter).toBe(";")
  expect(doc.header).toEqual(CATALOG_IMPORT_COLUMNS.map((c) => c.label))

  const mapping = mapImportHeaders(doc.header)
  expect(validateImportHeader(mapping, { mode: "upsert", pricesIncludeVat: false })).toEqual([])

  const values = parseImportRow(doc.rows[0], mapping, { mode: "upsert", brandName: "Mutlu", pricesIncludeVat: false })
  expect(values.errors).toEqual([])
  expect(values.sku).toBe("MTL-60AH")
  expect(values.patch.workshopPriceKurus).toBe(123456)
})

test("every template column maps back to its own field", () => {
  const mapping = mapImportHeaders(CATALOG_IMPORT_COLUMNS.map((c) => c.label))
  expect(mapping.unknownHeaders).toEqual([])
  expect(mapping.duplicateHeaders).toEqual([])
  for (const [index, column] of CATALOG_IMPORT_COLUMNS.entries()) {
    expect(mapping.byField[column.field]).toBe(index)
  }
})
