import { createHash } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getActiveImpersonation } from "@/lib/session"
import { getStorageProvider } from "@/lib/storage"
import { parseCsv } from "@/lib/catalog/csv-parse"
import {
  applyImportPlan,
  loadExistingProductsBySku,
} from "@/lib/catalog/bakimx-import"
import {
  buildImportPlan,
  CATALOG_IMPORT_MODE_LABELS,
  decodeImportFile,
  describeUnsupportedImportFile,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_MAX_REPORTED_ERRORS,
  IMPORT_PREVIEW_SAMPLE,
  mapImportHeaders,
  validateImportHeader,
  type CatalogImportMode,
  type ImportPlan,
  type ImportPlanCounts,
  type ImportRowIssue,
} from "@/lib/catalog/product-import"

/**
 * Katalog içe aktarımının uygulama servisi — BAK-34 / GitHub #211.
 *
 * AKIŞ: **yükle → ön izleme (dry-run) → uygula.** Ön izleme hiçbir ürüne
 * dokunmaz; kullanıcı yeni / güncellenecek / atlanacak / hatalı ayrımını
 * ONAYLAMADAN önce görür. Kısmi ya da sessiz uygulama yoktur.
 *
 * NEDEN SERVER ACTION DEĞİL: dosya yükleme uçları `/api/admin/catalog/import/*`
 * route handler'larıdır. Next server action gövdesi varsayılan 1 MB ile
 * sınırlıdır; 20.000 satırlık bir fiyat listesi bunun kat kat üstünde ve limit
 * yalnız TÜM action'lar için birden yükseltilebilirdi. Depodaki dosya yükleyen
 * diğer uçlar da route handler (bkz. src/app/api/photos/route.ts).
 * Yetki kapısı (`requireAdminCapability("manageCatalog")`) route'ta; bu modül
 * çağıranın kimliğini parametre olarak alır.
 *
 * DOSYA KİMLİĞİ: ön izleme ile uygulama İKİ ayrı istektir ve dosya tarayıcıdan
 * ikinci kez gönderilir. Aradaki dosyanın değişmediği, ön izlemede hesaplanıp
 * `errorsJson.fileHash`'e yazılan SHA-256 ile doğrulanır; tutmazsa uygulama
 * reddedilir — kullanıcı gördüğü rapordan başka bir şeyi uygulayamaz.
 */

export type ImportActionError = { ok: false; error: string; details?: string[] }

export interface ImportPreviewRow {
  line: number
  sku: string
  name: string
  workshopPriceKurus: number
  vatRateBps: number
  stockQty: number
  note: string
}

export interface ImportPreviewResult {
  ok: true
  importId: string
  fileName: string
  brandId: string
  brandName: string
  mode: CatalogImportMode
  pricesIncludeVat: boolean
  counts: ImportPlanCounts
  /** Satır sınırına takıldığı için okunmayan satır var mı. */
  truncated: boolean
  /** Tanınmayan başlıklar — yok sayıldılar, kullanıcı yanlış dosyayı fark etsin. */
  unknownHeaders: string[]
  creates: ImportPreviewRow[]
  updates: ImportPreviewRow[]
  skips: ImportPreviewRow[]
  issues: ImportRowIssue[]
  issuesTruncated: boolean
}

export interface ImportApplyResult {
  ok: true
  importId: string
  counts: ImportPlanCounts
}

/** `errorsJson` içine yazılan rapor — satır hataları + partiyi tanımlayan bilgiler. */
interface ImportReportJson {
  fileHash: string
  delimiter: string
  unknownHeaders: string[]
  truncated: boolean
  rows: ImportRowIssue[]
  rowsTruncated: boolean
}

const MODE_VALUES: CatalogImportMode[] = ["upsert", "price_stock_only"]

function asJson(value: ImportReportJson): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

/**
 * Toplu yazma yolu `$executeRaw` kullanıyor; `src/lib/db.ts`'teki salt-okunur
 * taklit (impersonation) uzantısı YALNIZ model operasyonlarını sarar ve ham
 * SQL'i görmez. Kapıyı burada elle koyuyoruz — aksi hâlde salt-okunur bir
 * oturum katalogu güncelleyebilirdi.
 */
async function assertWritable(): Promise<string | null> {
  const impersonation = await getActiveImpersonation()
  if (impersonation?.readOnly) return "Salt-okunur taklit (impersonation) oturumunda değişiklik yapılamaz."
  return null
}

function safeFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "import.csv"
  )
}

interface ImportRequest {
  file: File
  bytes: Uint8Array
  fileHash: string
  brand: { id: string; name: string }
  mode: CatalogImportMode
  pricesIncludeVat: boolean
}

/** Ön izleme ve uygulamanın ORTAK girdi okuması — iki uç aynı kuralları uygular. */
async function readImportRequest(formData: FormData): Promise<ImportRequest | ImportActionError> {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Dosya seçilmedi." }
  // Boyut, baytları belleğe almadan ÖNCE kapıda kesilir.
  if (file.size > IMPORT_MAX_FILE_BYTES) {
    return { ok: false, error: `Dosya çok büyük (en fazla ${Math.round(IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB).` }
  }

  const brandId = String(formData.get("brandId") ?? "")
  if (!brandId) return { ok: false, error: "Marka seçilmedi." }

  const rawMode = String(formData.get("mode") ?? "upsert") as CatalogImportMode
  if (!MODE_VALUES.includes(rawMode)) return { ok: false, error: "Geçersiz içe aktarma modu." }

  const pricesIncludeVat = formData.get("pricesIncludeVat") === "true"

  const brand = await prisma.bakimxProductBrand.findUnique({ where: { id: brandId }, select: { id: true, name: true } })
  if (!brand) return { ok: false, error: "Marka bulunamadı." }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const unsupported = describeUnsupportedImportFile(file.name, bytes)
  if (unsupported) return { ok: false, error: unsupported }

  return { file, bytes, fileHash: sha256(bytes), brand, mode: rawMode, pricesIncludeVat }
}

interface ParsedImport {
  plan: ImportPlan
  delimiter: string
  unknownHeaders: string[]
  truncated: boolean
}

/**
 * Baytlardan plana. Dosya düzeyinde hata varsa (kodlama, eksik kolon) plan hiç
 * kurulmaz — eksik kolonla üretilmiş bir "0 hata" raporu kullanıcıyı yanıltır.
 */
async function buildPlanFromBytes(request: ImportRequest): Promise<ParsedImport | ImportActionError> {
  const decoded = decodeImportFile(request.bytes)
  if ("error" in decoded) return { ok: false, error: decoded.error }

  const doc = parseCsv(decoded.text, { maxRows: IMPORT_MAX_ROWS })
  if (doc.header.length === 0) return { ok: false, error: "Dosyada başlık satırı bulunamadı." }
  if (doc.rows.length === 0) return { ok: false, error: "Dosyada veri satırı yok (yalnız başlık var)." }

  const mapping = mapImportHeaders(doc.header)
  const headerErrors = validateImportHeader(mapping, { mode: request.mode, pricesIncludeVat: request.pricesIncludeVat })
  if (headerErrors.length > 0) {
    return { ok: false, error: "Dosya başlıkları uygun değil.", details: headerErrors }
  }

  const skuIndex = mapping.byField.sku
  const skus = doc.rows.map((row) => (skuIndex === undefined ? "" : (row.cells[skuIndex] ?? "").trim()))
  const existingBySku = await loadExistingProductsBySku(skus)

  const plan = buildImportPlan({
    rows: doc.rows,
    mapping,
    mode: request.mode,
    brand: request.brand,
    pricesIncludeVat: request.pricesIncludeVat,
    existingBySku,
  })

  return { plan, delimiter: doc.delimiter, unknownHeaders: mapping.unknownHeaders, truncated: doc.truncated }
}

function toPreviewRows(plan: ImportPlan, action: "create" | "update" | "skip"): ImportPreviewRow[] {
  return plan.entries
    .filter((entry) => entry.action === action)
    .slice(0, IMPORT_PREVIEW_SAMPLE)
    .map((entry) => ({
      line: entry.line,
      sku: entry.sku,
      name: entry.name,
      workshopPriceKurus: entry.input?.workshopPriceKurus ?? 0,
      vatRateBps: entry.input?.vatRateBps ?? 0,
      stockQty: entry.input?.stockQty ?? 0,
      note: entry.messages.join(" "),
    }))
}

function buildReport(parsed: ParsedImport, fileHash: string): ImportReportJson {
  return {
    fileHash,
    delimiter: parsed.delimiter,
    unknownHeaders: parsed.unknownHeaders,
    truncated: parsed.truncated,
    rows: parsed.plan.issues.slice(0, IMPORT_MAX_REPORTED_ERRORS),
    rowsTruncated: parsed.plan.issues.length > IMPORT_MAX_REPORTED_ERRORS,
  }
}

/**
 * Yüklenen dosyayı storage'a yazar. Başarısızlık ÖLÜMCÜL DEĞİL: dosya kopyası
 * yalnız sonradan denetim içindir, içe aktarımın kendisi bellekteki baytlarla
 * yürür. Storage kapalıyken kullanıcı fiyat listesini yükleyememeli değil.
 */
async function storeImportFile(importId: string, request: ImportRequest): Promise<string | null> {
  try {
    const provider = await getStorageProvider()
    const path = `bakimx-catalog/imports/${importId}/${request.fileHash.slice(0, 16)}-${safeFileName(request.file.name)}`
    const result = await provider.upload(request.file, path)
    return result.key
  } catch (error) {
    console.error(`[catalog-import] file store failed (import=${importId})`, error)
    return null
  }
}

// ---------------------------------------------------------------------------
// 1-2. Yükle + ön izleme (dry-run)
// ---------------------------------------------------------------------------

/**
 * Dosyayı kaydeder ve UYGULAMADAN önce ne olacağını raporlar. Parti kaydı her
 * durumda açılır: başarısız bir deneme de (`failed`) geçmişte görünmeli ki
 * "yükledim ama bir şey olmadı" sessizliği oluşmasın.
 */
export async function previewCatalogImport(
  formData: FormData,
  actorUserId: string,
): Promise<ImportPreviewResult | ImportActionError> {
  const blocked = await assertWritable()
  if (blocked) return { ok: false, error: blocked }

  const request = await readImportRequest(formData)
  if ("ok" in request) return request

  const record = await prisma.bakimxProductImport.create({
    data: {
      brandId: request.brand.id,
      fileName: request.file.name.slice(0, 200),
      mode: request.mode,
      status: "pending",
      pricesIncludeVat: request.pricesIncludeVat,
      createdByUserId: actorUserId,
    },
    select: { id: true },
  })

  const fileKey = await storeImportFile(record.id, request)

  const parsed = await buildPlanFromBytes(request)
  if ("ok" in parsed) {
    await prisma.bakimxProductImport.update({
      where: { id: record.id },
      data: {
        status: "failed",
        fileKey,
        errorsJson: asJson({
          fileHash: request.fileHash,
          delimiter: "",
          unknownHeaders: [],
          truncated: false,
          rows: [parsed.error, ...(parsed.details ?? [])].map((message) => ({ line: 0, sku: "", message })),
          rowsTruncated: false,
        }),
      },
    })
    return parsed
  }

  const { plan } = parsed
  await prisma.bakimxProductImport.update({
    where: { id: record.id },
    data: {
      status: "previewed",
      fileKey,
      totalRows: plan.counts.total,
      createdCount: plan.counts.created,
      updatedCount: plan.counts.updated,
      skippedCount: plan.counts.skipped,
      errorCount: plan.counts.error,
      errorsJson: asJson(buildReport(parsed, request.fileHash)),
    },
  })

  return {
    ok: true,
    importId: record.id,
    fileName: request.file.name,
    brandId: request.brand.id,
    brandName: request.brand.name,
    mode: request.mode,
    pricesIncludeVat: request.pricesIncludeVat,
    counts: plan.counts,
    truncated: parsed.truncated,
    unknownHeaders: parsed.unknownHeaders,
    creates: toPreviewRows(plan, "create"),
    updates: toPreviewRows(plan, "update"),
    skips: toPreviewRows(plan, "skip"),
    issues: plan.issues.slice(0, IMPORT_MAX_REPORTED_ERRORS),
    issuesTruncated: plan.issues.length > IMPORT_MAX_REPORTED_ERRORS,
  }
}

// ---------------------------------------------------------------------------
// 3. Uygula
// ---------------------------------------------------------------------------

/**
 * Onaylanan partiyi yazar. Plan SIFIRDAN yeniden kurulur (katalog ön izlemeden
 * bu yana değişmiş olabilir) ve parti sayaçları GERÇEK sonuçtan yazılır — plan
 * tahmininden değil.
 */
export async function applyCatalogImport(
  importId: string,
  formData: FormData,
  actorUserId: string,
): Promise<ImportApplyResult | ImportActionError> {
  if (!importId) return { ok: false, error: "İçe aktarma partisi seçilmedi." }

  const blocked = await assertWritable()
  if (blocked) return { ok: false, error: blocked }

  const record = await prisma.bakimxProductImport.findUnique({
    where: { id: importId },
    select: { id: true, status: true, brandId: true, mode: true, pricesIncludeVat: true, errorsJson: true },
  })
  if (!record) return { ok: false, error: "İçe aktarma partisi bulunamadı." }
  if (record.status !== "previewed") {
    return { ok: false, error: "Bu parti uygulanabilir durumda değil. Dosyayı yeniden yükleyip ön izleyin." }
  }

  const request = await readImportRequest(formData)
  if ("ok" in request) return request

  // Ön izlemedeki dosyayla aynı dosya mı? Değilse kullanıcı görmediği bir
  // değişikliği onaylamış olurdu.
  const report = record.errorsJson as unknown as ImportReportJson | null
  if (report?.fileHash && report.fileHash !== request.fileHash) {
    return { ok: false, error: "Dosya ön izlemedekinden farklı. Yeniden ön izleyin." }
  }
  if (record.brandId !== request.brand.id || record.mode !== request.mode || record.pricesIncludeVat !== request.pricesIncludeVat) {
    return { ok: false, error: "İçe aktarma ayarları ön izlemeden sonra değişti. Yeniden ön izleyin." }
  }

  const parsed = await buildPlanFromBytes(request)
  if ("ok" in parsed) return parsed

  const { plan } = parsed
  const written = await applyImportPlan(plan, {
    importId: record.id,
    actorUserId,
    brandName: request.brand.name,
    mode: request.mode,
  })

  // Gerçek sonuç: yazılamayan create (eşzamanlı çakışma) "atlandı" sayılır,
  // sayaçlar dosyanın toplamıyla tutar.
  const counts: ImportPlanCounts = {
    total: plan.counts.total,
    created: written.created,
    updated: written.updated,
    skipped: plan.counts.skipped + (plan.counts.created - written.created) + (plan.counts.updated - written.updated),
    error: plan.counts.error,
  }

  await prisma.$transaction(async (tx) => {
    await tx.bakimxProductImport.update({
      where: { id: record.id },
      data: {
        status: "applied",
        appliedAt: new Date(),
        totalRows: counts.total,
        createdCount: counts.created,
        updatedCount: counts.updated,
        skippedCount: counts.skipped,
        errorCount: counts.error,
        errorsJson: asJson(buildReport(parsed, request.fileHash)),
      },
    })
    // Denetim SATIR BAŞINA yazılmaz — binlerce satır `bakimx_catalog_audit`'i
    // boğar. Parti başına tek kayıt; satır ayrıntısı `errorsJson`'da.
    await tx.bakimxCatalogAudit.create({
      data: {
        actorUserId,
        entityType: "import",
        entityId: record.id,
        action: "import_apply",
        afterJson: {
          brandId: request.brand.id,
          brandName: request.brand.name,
          fileName: request.file.name.slice(0, 200),
          mode: CATALOG_IMPORT_MODE_LABELS[request.mode],
          pricesIncludeVat: request.pricesIncludeVat,
          ...counts,
        } as Prisma.InputJsonValue,
      },
    })
  })
  return { ok: true, importId: record.id, counts }
}

/** Ön izlenmiş ama uygulanmayan partiyi kapatır — liste "bekliyor" göstermesin. */
export async function cancelCatalogImport(importId: string): Promise<{ ok: true } | ImportActionError> {
  if (!importId) return { ok: false, error: "İçe aktarma partisi seçilmedi." }

  const record = await prisma.bakimxProductImport.findUnique({ where: { id: importId }, select: { status: true } })
  if (!record) return { ok: false, error: "İçe aktarma partisi bulunamadı." }
  if (record.status === "applied") return { ok: false, error: "Uygulanmış parti iptal edilemez." }

  await prisma.bakimxProductImport.update({ where: { id: importId }, data: { status: "cancelled" } })
  return { ok: true }
}
