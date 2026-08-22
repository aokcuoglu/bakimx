import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { bakimxProductWriteData } from "@/lib/catalog/bakimx-catalog"
import type {
  ExistingCatalogProduct,
  CatalogImportMode,
  ImportPlan,
  ImportPlanEntry,
} from "@/lib/catalog/product-import"

/**
 * İçe aktarımın DB'ye dokunan yarısı — BAK-34. Saf çekirdek (ayrıştırma,
 * eşleme, plan) `src/lib/catalog/product-import.ts`'te ve birim testli;
 * burada yalnız okuma/yazma var.
 *
 * NEDEN PARÇA BAŞINA TEK STATEMENT: satır-başına `upsert` ile kurulan
 * `$transaction([...])` batch'i dizi formunda `timeout` seçeneği ALMAZ, 5 sn'de
 * P2028 ile TÜM partiyi geri alır (aynı tuzak `src/lib/tecdoc/catalog.ts`
 * içindeki `persistArticles` notunda belgeli). Bu yüzden yeni ürünler parça
 * başına tek `createMany`, güncellemeler parça başına tek `UPDATE ... FROM
 * jsonb_to_recordset(...)` ile yazılır: 500 satır tek gidiş-dönüş, her parça
 * kendi başına atomik.
 */

/** Tek statement'a sığdırılan satır sayısı — 500 × 19 alan tek JSON parametre. */
export const IMPORT_WRITE_CHUNK = 500
/** `sku IN (...)` sorgusunun parça boyutu. */
const SKU_LOOKUP_CHUNK = 1000

/** Mevcut ürünün içe aktarımda okunan alanları — `BakimxProductWriteInput` + id. */
const EXISTING_PRODUCT_SELECT = {
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
  crossReferences: true,
  workshopPriceKurus: true,
  vatRateBps: true,
  costPriceKurus: true,
  stockQty: true,
  lowStockQty: true,
  backorderable: true,
  leadTimeDays: true,
  isActive: true,
  tecdocCategoryId: true,
} as const satisfies Prisma.BakimxProductSelect

/**
 * Dosyadaki SKU'ların katalogdaki karşılıkları. Marka filtresi YOKTUR: aynı
 * ürün kodu başka bir markanın altındaysa bunu bilmek gerekir (`sku` global
 * UNIQUE), yoksa uygulama anında P2002 ile patlardık.
 */
export async function loadExistingProductsBySku(
  skus: readonly string[],
): Promise<Map<string, ExistingCatalogProduct>> {
  const unique = [...new Set(skus.filter(Boolean))]
  const found = new Map<string, ExistingCatalogProduct>()

  for (let i = 0; i < unique.length; i += SKU_LOOKUP_CHUNK) {
    const rows = await prisma.bakimxProduct.findMany({
      where: { sku: { in: unique.slice(i, i + SKU_LOOKUP_CHUNK) } },
      select: EXISTING_PRODUCT_SELECT,
    })
    for (const row of rows) found.set(row.sku, row)
  }

  return found
}

export interface ApplyImportContext {
  importId: string
  actorUserId: string
  brandName: string
  mode: CatalogImportMode
}

export interface ApplyImportResult {
  created: number
  updated: number
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Planı uygular ve GERÇEKTEN yazılan satır sayılarını döner (raporlanan
 * sayaçlar plandan değil buradan beslenir).
 *
 * `createMany` `skipDuplicates` ile çalışır: ön izlemeden sonra aynı SKU başka
 * bir yoldan açıldıysa parti düşmez, o satır yazılmaz ve sayaç bunu yansıtır.
 */
export async function applyImportPlan(
  plan: ImportPlan,
  context: ApplyImportContext,
): Promise<ApplyImportResult> {
  const creates = plan.entries.filter((e) => e.action === "create" && e.input)
  const updates = plan.entries.filter((e) => e.action === "update" && e.input && e.productId)

  const created = await applyCreates(creates, context)
  const updated =
    context.mode === "price_stock_only"
      ? await applyPriceStockUpdates(updates, context)
      : await applyFullUpdates(updates, context)

  return { created, updated }
}

async function applyCreates(entries: ImportPlanEntry[], context: ApplyImportContext): Promise<number> {
  let created = 0
  const now = new Date()

  for (const part of chunk(entries, IMPORT_WRITE_CHUNK)) {
    const result = await prisma.bakimxProduct.createMany({
      data: part.map((entry) => ({
        // Tek yazma yolu: `searchKey` ve `brandName` burada üretilir, elle değil.
        ...bakimxProductWriteData(entry.input!, context.brandName),
        currency: "TRY",
        lastImportId: context.importId,
        updatedByUserId: context.actorUserId,
        publishedAt: entry.input!.isActive ? now : null,
      })),
      skipDuplicates: true,
    })
    created += result.count
  }

  return created
}

/** `UPDATE ... FROM jsonb_to_recordset` için tek satırlık JSON kaydı (tam kart). */
function fullUpdateRecord(entry: ImportPlanEntry, brandName: string) {
  const data = bakimxProductWriteData(entry.input!, brandName)
  return {
    id: entry.productId,
    name: data.name,
    brand_id: data.brandId,
    brand_name: data.brandName,
    category_key: data.categoryKey,
    barcode: data.barcode,
    unit: data.unit,
    description: data.description,
    image_url: data.imageUrl,
    oem_numbers: data.oemNumbers,
    cross_references: data.crossReferences,
    workshop_price_kurus: data.workshopPriceKurus,
    vat_rate_bps: data.vatRateBps,
    cost_price_kurus: data.costPriceKurus,
    stock_qty: data.stockQty,
    low_stock_qty: data.lowStockQty,
    backorderable: data.backorderable,
    lead_time_days: data.leadTimeDays,
    is_active: data.isActive,
    search_key: data.searchKey,
  }
}

/**
 * `upsert` modunun güncellemesi: kart tamamen yeniden yazılır. Plan, dosyada
 * gelmeyen alanları mevcut değerleriyle doldurduğu için "yazılan" değer
 * dokunulmayan alanlarda aynı kalır.
 *
 * `published_at` ilk yayına alma anını korur (tekil ürün action'ıyla aynı kural),
 * `oem_numbers` JSON dizisinden `text[]`'e SQL tarafında çevrilir.
 */
async function applyFullUpdates(entries: ImportPlanEntry[], context: ApplyImportContext): Promise<number> {
  let updated = 0

  for (const part of chunk(entries, IMPORT_WRITE_CHUNK)) {
    const payload = JSON.stringify(part.map((entry) => fullUpdateRecord(entry, context.brandName)))
    updated += await prisma.$executeRaw`
      UPDATE bakimx_products AS p
      SET
        name = v.name,
        brand_id = v.brand_id,
        brand_name = v.brand_name,
        category_key = v.category_key,
        barcode = v.barcode,
        unit = v.unit,
        description = v.description,
        image_url = v.image_url,
        oem_numbers = ARRAY(SELECT jsonb_array_elements_text(v.oem_numbers)),
        cross_references = ARRAY(SELECT jsonb_array_elements_text(v.cross_references)),
        workshop_price_kurus = v.workshop_price_kurus,
        vat_rate_bps = v.vat_rate_bps,
        cost_price_kurus = v.cost_price_kurus,
        stock_qty = v.stock_qty,
        low_stock_qty = v.low_stock_qty,
        backorderable = v.backorderable,
        lead_time_days = v.lead_time_days,
        is_active = v.is_active,
        search_key = v.search_key,
        last_import_id = ${context.importId},
        updated_by_user_id = ${context.actorUserId},
        updated_at = now(),
        published_at = CASE WHEN v.is_active AND p.published_at IS NULL THEN now() ELSE p.published_at END
      FROM jsonb_to_recordset(${payload}::jsonb) AS v(
        id text,
        name text,
        brand_id text,
        brand_name text,
        category_key text,
        barcode text,
        unit text,
        description text,
        image_url text,
        oem_numbers jsonb,
        cross_references jsonb,
        workshop_price_kurus integer,
        vat_rate_bps integer,
        cost_price_kurus integer,
        stock_qty integer,
        low_stock_qty integer,
        backorderable boolean,
        lead_time_days integer,
        is_active boolean,
        search_key text
      )
      WHERE p.id = v.id
    `
  }

  return updated
}

/**
 * `price_stock_only` modunun güncellemesi: SET listesi bilerek dar. Ad,
 * açıklama, görsel ve OEM kolonlarına DOKUNULMAZ — markanın yeni fiyat listesi
 * geldiğinde ürün kartının elle düzenlenmiş metinlerini geri yazmamak bu modun
 * varlık sebebi. `search_key` de bu yüzden hariç: kaynağı olan alanlar değişmiyor.
 */
async function applyPriceStockUpdates(entries: ImportPlanEntry[], context: ApplyImportContext): Promise<number> {
  let updated = 0

  for (const part of chunk(entries, IMPORT_WRITE_CHUNK)) {
    const payload = JSON.stringify(
      part.map((entry) => ({
        id: entry.productId,
        workshop_price_kurus: entry.input!.workshopPriceKurus,
        vat_rate_bps: entry.input!.vatRateBps,
        stock_qty: entry.input!.stockQty,
        low_stock_qty: entry.input!.lowStockQty,
      })),
    )
    updated += await prisma.$executeRaw`
      UPDATE bakimx_products AS p
      SET
        workshop_price_kurus = v.workshop_price_kurus,
        vat_rate_bps = v.vat_rate_bps,
        stock_qty = v.stock_qty,
        low_stock_qty = v.low_stock_qty,
        last_import_id = ${context.importId},
        updated_by_user_id = ${context.actorUserId},
        updated_at = now()
      FROM jsonb_to_recordset(${payload}::jsonb) AS v(
        id text,
        workshop_price_kurus integer,
        vat_rate_bps integer,
        stock_qty integer,
        low_stock_qty integer
      )
      WHERE p.id = v.id
    `
  }

  return updated
}
