"use server"

import { prisma } from "@/lib/db"
import { requireAuth, requireWritableWorkshop } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { prefetchCommonVehicleParts } from "@/lib/tecdoc/prefetch"
import { partCreateSchema, partUpdateSchema, quickPartCreateSchema, stockMovementSchema, partSupplierPricesSchema } from "@/lib/validations/part"
import { getValidationError } from "@/lib/validations/shared"
import { AuditLogAction } from "@/lib/audit"
import { normalizeSupplierPriceRows, derivePartPricing, shouldPreserveDerivedPricing, type SupplierPriceRow } from "@/lib/parts/supplier-prices"
import type { QuickPartCreateResult } from "@/lib/parts/quick-part-draft"

type SupplierPricesResult =
  | { error: string }
  | { skip: true }
  | { rows: SupplierPriceRow[]; derived: { purchasePrice: number | null; supplierId: string | null } }

/**
 * `supplierPrices` JSON alanını okur, doğrular ve tedarikçilerin bu atölyeye
 * ait olduğunu teyit eder. workshopId çağırandan gelir — client'a güvenilmez.
 *
 * Girdiye göre üç farklı sonuç:
 * - Alan FormData'da **hiç yok** (`formData.get` → `null`): `{ skip: true }` —
 *   çağıran tedarikçi satırlarına dokunmamalı (silmemeli, türetilmiş alanları
 *   değiştirmemeli). Alanı göndermeyen bir çağıran = "bu konuda bilgim yok",
 *   "hepsini sil" değil.
 * - Alan boş string (`""`) ya da geçerli JSON'da boş dizi (`"[]"`): satırlar
 *   temizlenir, türetilmiş `purchasePrice`/`supplierId` `null`'a düşer. Bu,
 *   alanın **açıkça gönderildiği** ve kullanıcının tüm satırları sildiği
 *   anlamına gelir. Bugünkü tek çağıran (parça formu) her zaman geçerli JSON
 *   gönderdiği için pratikte `""` yolu hiç tetiklenmez, ama boş dizi (`"[]"`)
 *   ile aynı "temizle" davranışını korumak için burada da temizleme yapılır.
 * - Alan dolu JSON dizisi: satırlar doğrulanır/normalize edilir, tedarikçi
 *   sahipliği tek sorguda teyit edilir.
 */
async function parseSupplierPrices(formData: FormData, workshopId: string): Promise<SupplierPricesResult> {
  const raw = formData.get("supplierPrices")
  if (raw === null) {
    return { skip: true }
  }
  if (typeof raw !== "string" || raw.trim() === "") {
    return { rows: [], derived: { purchasePrice: null, supplierId: null } }
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { error: "Tedarikçi fiyatları okunamadı" }
  }

  const parsed = partSupplierPricesSchema.safeParse(json)
  if (!parsed.success) return { error: getValidationError(parsed) ?? "Tedarikçi fiyatları geçersiz" }

  const rows = normalizeSupplierPriceRows(parsed.data)
  if (rows.length > 0) {
    const ids = rows.map((r) => r.supplierId)
    const owned = await prisma.supplier.count({ where: { workshopId, id: { in: ids } } })
    if (owned !== ids.length) return { error: "Geçersiz tedarikçi" }
  }

  return { rows, derived: derivePartPricing(rows) }
}

export async function createPartAction(formData: FormData) {
  const { user } = await requireWritableWorkshop("catalog.manage")
  const workshopId = user.workshopId

  const raw: Record<string, string> = {}
  const fields = ["name", "sku", "oemNo", "brand", "category", "description", "unit", "stockQty", "criticalStockQty", "purchasePrice", "salePrice", "currency", "supplierName", "supplierPhone", "supplierId", "shelfLocation", "barcode"]
  for (const f of fields) {
    const v = formData.get(f)
    if (v && typeof v === "string") raw[f] = v
  }

  const parsed = partCreateSchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) }

  const prices = await parseSupplierPrices(formData, workshopId)
  if ("error" in prices) return { error: prices.error }
  // Yeni kayıtta korunacak önceki bir değer yok — alan gönderilmemişse (skip)
  // türetilmiş fiyat/tedarikçi null kalır, satır yazılmaz.
  const priceRows = "skip" in prices ? [] : prices.rows
  const priceDerived = "skip" in prices ? { purchasePrice: null, supplierId: null } : prices.derived

  const part = await prisma.partStockItem.create({
    data: {
      workshopId,
      name: parsed.data.name,
      sku: parsed.data.sku || null,
      oemNo: parsed.data.oemNo || null,
      brand: parsed.data.brand || null,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
      unit: parsed.data.unit || "adet",
      stockQty: parsed.data.stockQty,
      criticalStockQty: parsed.data.criticalStockQty,
      purchasePrice: priceDerived.purchasePrice,
      salePrice: parsed.data.salePrice ?? null,
      currency: parsed.data.currency || "TRY",
      supplierName: null,
      supplierPhone: null,
      supplierId: priceDerived.supplierId,
      shelfLocation: parsed.data.shelfLocation || null,
      barcode: parsed.data.barcode || null,
    },
  })

  if (priceRows.length > 0) {
    await prisma.partSupplierPrice.createMany({
      data: priceRows.map((r) => ({
        workshopId,
        partId: part.id,
        supplierId: r.supplierId,
        purchasePrice: r.purchasePrice,
        currency: parsed.data.currency || "TRY",
        supplierSku: r.supplierSku || null,
        isPreferred: r.isPreferred,
      })),
    })
  }

  if (parsed.data.stockQty > 0) {
    await prisma.stockMovement.create({
      data: {
        workshopId,
        partId: part.id,
        type: "in",
        quantity: parsed.data.stockQty,
        previousQty: 0,
        newQty: parsed.data.stockQty,
        reason: "İlk stok girişi",
        sourceType: "manual",
        createdByUserId: user.id,
      },
    })
  }

  await AuditLogAction(workshopId, user.id, "PartStockItem", part.id, "part_created")
  revalidatePath("/parts")
  return { success: true, id: part.id }
}

/**
 * İş emri ekranındaki "Oluştur & Düzenle" modalından hızlı stok kartı açar (#210).
 *
 * Tam parça formunun (createPartAction) yerini TUTMAZ; yalnız kod + ad (+ marka,
 * kategori, satış fiyatı) yazar. Kasıtlı sınırlar:
 * - Kart `stockQty = 0` ile açılır ve StockMovement üretmez. Buradaki amaç
 *   "rafımdan şu parçayı harcadım" değil, "bu parçaya kalıcı bir stok kodu
 *   tanımlayayım"dır; kalem de karta BAĞLANMAZ (ServiceOrderItem.partId boş
 *   kalır), dolayısıyla iş emri stok düşümü (reserveStockInTx) tetiklenmez.
 *   Aksi hâlde 0 stoklu yeni kart "Yetersiz stok" ile kalem eklemeyi bloklardı.
 * - Aynı koddan ikinci kart açılmasını engeller. `PartStockItem.sku` üzerinde
 *   DB tekil kısıtı YOKtur (mevcut veride yinelenen kodlar olabileceği için
 *   eklenmedi); bu yüzden kontrol uygulama katmanındadır ve eşzamanlı iki
 *   istekte teorik olarak yarışabilir. Tam parça formu bu kontrolü hâlâ
 *   yapmıyor — oradaki davranış bilinçli olarak değiştirilmedi.
 */
export async function createQuickPartAction(formData: FormData): Promise<QuickPartCreateResult> {
  const { user } = await requireWritableWorkshop("catalog.manage")
  const workshopId = user.workshopId

  const raw: Record<string, string> = {}
  for (const f of ["brand", "category", "salePrice"]) {
    const v = formData.get(f)
    if (v && typeof v === "string") raw[f] = v
  }
  // sku/name boş gelse bile ANAHTAR olarak taşınır: aksi hâlde alan `undefined`
  // olur ve Zod kendi genel tip hatasını döndürür ("expected string, received
  // undefined") — kullanıcı "Stok kodu zorunludur" mesajını görmez.
  for (const f of ["sku", "name"]) {
    const v = formData.get(f)
    raw[f] = typeof v === "string" ? v : ""
  }

  const parsed = quickPartCreateSchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) ?? "Geçersiz bilgiler" }

  const { sku, name } = parsed.data

  // Pasif kartlar da kodu tutar — isActive filtresi YOK.
  const existing = await prisma.partStockItem.findFirst({
    where: { workshopId, sku: { equals: sku, mode: "insensitive" } },
    select: { name: true },
  })
  if (existing) {
    return { error: `Bu stok kodu zaten kullanılıyor: “${existing.name}”` }
  }

  const part = await prisma.partStockItem.create({
    data: {
      workshopId,
      name,
      sku,
      brand: parsed.data.brand || null,
      category: parsed.data.category || null,
      salePrice: parsed.data.salePrice ?? null,
    },
  })

  await AuditLogAction(workshopId, user.id, "PartStockItem", part.id, "part_created")
  revalidatePath("/parts")
  return { success: true as const, id: part.id, sku, name }
}

export async function updatePartAction(partId: string, formData: FormData) {
  const { user } = await requireWritableWorkshop("catalog.manage")
  const workshopId = user.workshopId

  const part = await prisma.partStockItem.findFirst({
    where: { id: partId, workshopId },
    include: { _count: { select: { supplierPrices: true } } },
  })
  if (!part) return { error: "Parça bulunamadı" }

  const raw: Record<string, string> = {}
  const fields = ["name", "sku", "oemNo", "brand", "category", "description", "unit", "stockQty", "criticalStockQty", "purchasePrice", "salePrice", "currency", "supplierName", "supplierPhone", "supplierId", "shelfLocation", "barcode"]
  for (const f of fields) {
    const v = formData.get(f)
    if (v && typeof v === "string") raw[f] = v
  }

  const parsed = partUpdateSchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) }

  const prices = await parseSupplierPrices(formData, workshopId)
  if ("error" in prices) return { error: prices.error }
  // Alan hiç gönderilmemişse (skip) tedarikçi satırlarına dokunulmaz: ne
  // deleteMany/createMany çalışır ne de türetilmiş purchasePrice/supplierId
  // değiştirilir (anahtarlar updateMany data'sından tamamen çıkarılır, ki
  // Prisma mevcut değerleri korusun).
  //
  // Aynı koruma, satırı hiç olmayan ESKİ parçalara boş liste geldiğinde de
  // uygulanır: backfill satır üretemediği için (ör. fiyatı var carisi yok)
  // boş liste "hepsini sil" değil "taşınacak veri yoktu" demektir — bkz.
  // shouldPreserveDerivedPricing.
  const touchSupplierPrices = !("skip" in prices)
  const priceRows = "skip" in prices ? [] : prices.rows
  const preserveDerived = shouldPreserveDerivedPricing({
    touched: touchSupplierPrices,
    incomingRowCount: priceRows.length,
    existingRowCount: part._count.supplierPrices,
  })
  // `"skip" in prices` mantıken gereksiz (preserveDerived skip'te zaten true)
  // ama TypeScript'in `prices.derived`'i daraltması için gerekli.
  const priceDerivedUpdate = preserveDerived || "skip" in prices
    ? {}
    : { purchasePrice: prices.derived.purchasePrice, supplierId: prices.derived.supplierId }

  await prisma.$transaction([
    ...(touchSupplierPrices ? [prisma.partSupplierPrice.deleteMany({ where: { partId, workshopId } })] : []),
    ...(touchSupplierPrices && priceRows.length > 0
      ? [
          prisma.partSupplierPrice.createMany({
            data: priceRows.map((r) => ({
              workshopId,
              partId,
              supplierId: r.supplierId,
              purchasePrice: r.purchasePrice,
              currency: parsed.data.currency || "TRY",
              supplierSku: r.supplierSku || null,
              isPreferred: r.isPreferred,
            })),
          }),
        ]
      : []),
    prisma.partStockItem.updateMany({
      where: { id: partId, workshopId },
      data: {
        name: parsed.data.name,
        sku: parsed.data.sku || null,
        oemNo: parsed.data.oemNo || null,
        brand: parsed.data.brand || null,
        category: parsed.data.category || null,
        description: parsed.data.description || null,
        unit: parsed.data.unit || "adet",
        stockQty: parsed.data.stockQty,
        criticalStockQty: parsed.data.criticalStockQty,
        salePrice: parsed.data.salePrice ?? null,
        currency: parsed.data.currency || "TRY",
        shelfLocation: parsed.data.shelfLocation || null,
        barcode: parsed.data.barcode || null,
        ...priceDerivedUpdate,
      },
    }),
  ])

  await AuditLogAction(workshopId, user.id, "PartStockItem", partId, "part_updated")
  revalidatePath(`/parts/${partId}`)
  revalidatePath("/parts")
  revalidatePath("/suppliers")
  return { success: true, id: partId }
}

export async function deactivatePartAction(partId: string) {
  const { user } = await requireWritableWorkshop("catalog.manage")
  const workshopId = user.workshopId

  const part = await prisma.partStockItem.findFirst({
    where: { id: partId, workshopId },
  })
  if (!part) return { error: "Parça bulunamadı" }

  await prisma.partStockItem.updateMany({
    where: { id: partId, workshopId },
    data: { isActive: false },
  })

  await AuditLogAction(workshopId, user.id, "PartStockItem", partId, "part_deactivated")
  revalidatePath(`/parts/${partId}`)
  revalidatePath("/parts")
  return { success: true }
}

export async function reactivatePartAction(partId: string) {
  const { user } = await requireWritableWorkshop("catalog.manage")
  const workshopId = user.workshopId

  const part = await prisma.partStockItem.findFirst({
    where: { id: partId, workshopId },
  })
  if (!part) return { error: "Parça bulunamadı" }

  await prisma.partStockItem.updateMany({
    where: { id: partId, workshopId },
    data: { isActive: true },
  })

  await AuditLogAction(workshopId, user.id, "PartStockItem", partId, "part_reactivated")
  revalidatePath(`/parts/${partId}`)
  revalidatePath("/parts")
  return { success: true }
}

export async function deletePartAction(partId: string) {
  const { user } = await requireWritableWorkshop("catalog.manage")
  const workshopId = user.workshopId

  const part = await prisma.partStockItem.findFirst({
    where: { id: partId, workshopId },
  })
  if (!part) return { error: "Parça bulunamadı" }

  const orderUsage = await prisma.serviceOrderItem.count({
    where: { partId, workshopId },
  })
  const quoteUsage = await prisma.quoteItem.count({
    where: { partId, workshopId },
  })
  if (orderUsage > 0 || quoteUsage > 0) {
    return { error: `Bu parça ${orderUsage} iş emri ve ${quoteUsage} teklifte kullanılmış. Silinemez, pasifleştirin.` }
  }

  const movementCount = await prisma.stockMovement.count({
    where: { partId, workshopId },
  })

  if (movementCount > 0) {
    return { error: "Bu parçaya ait stok hareketleri var. Silinemez, pasifleştirin." }
  }

  await prisma.partStockItem.deleteMany({
    where: { id: partId, workshopId },
  })

  await AuditLogAction(workshopId, user.id, "PartStockItem", partId, "part_deleted")
  revalidatePath("/parts")
  return { success: true }
}

export async function createStockMovementAction(formData: FormData) {
  const { user } = await requireWritableWorkshop("catalog.manage")
  const workshopId = user.workshopId

  const raw = {
    partId: formData.get("partId") as string,
    type: formData.get("type") as string,
    quantity: formData.get("quantity") as string,
    reason: formData.get("reason") as string,
  }

  const parsed = stockMovementSchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) }

  const part = await prisma.partStockItem.findFirst({
    where: { id: parsed.data.partId, workshopId },
  })
  if (!part) return { error: "Parça bulunamadı" }

  if (!part.isActive) return { error: "Pasif parça için stok hareketi yapılamaz" }

  const previousQty = part.stockQty
  let newQty: number

  if (parsed.data.type === "in") {
    newQty = previousQty + parsed.data.quantity
  } else if (parsed.data.type === "out") {
    if (previousQty < parsed.data.quantity) {
      return { error: `Yetersiz stok. Mevcut: ${previousQty}, Çıkış: ${parsed.data.quantity}` }
    }
    newQty = previousQty - parsed.data.quantity
  } else {
    newQty = parsed.data.quantity
  }

  await prisma.$transaction([
    prisma.partStockItem.updateMany({
      where: { id: parsed.data.partId, workshopId },
      data: { stockQty: newQty },
    }),
    prisma.stockMovement.create({
      data: {
        workshopId,
        partId: parsed.data.partId,
        type: parsed.data.type,
        quantity: parsed.data.quantity,
        previousQty,
        newQty,
        reason: parsed.data.reason || null,
        sourceType: "manual",
        createdByUserId: user.id,
      },
    }),
  ])

  await AuditLogAction(workshopId, user.id, "StockMovement", parsed.data.partId, `stock_${parsed.data.type}`)
  revalidatePath(`/parts/${parsed.data.partId}`)
  revalidatePath("/parts")
  return { success: true }
}

export async function getPartsAction(params: {
  search?: string
  stockStatus?: string
  category?: string
  brand?: string
}) {
  const { search, stockStatus, category, brand } = params
  const { workshopId } = await requireAuth()

  const where: Record<string, unknown> = { workshopId }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { oemNo: { contains: search, mode: "insensitive" } },
      { brand: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      { supplierName: { contains: search, mode: "insensitive" } },
    ]
  }

  if (category) {
    where.category = category
  }

  if (brand) {
    where.brand = brand
  }

  let parts = await prisma.partStockItem.findMany({
    where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    orderBy: { name: "asc" },
  })

  if (stockStatus && stockStatus !== "all") {
    parts = parts.filter((p) => {
      if (stockStatus === "in_stock") return p.isActive && p.stockQty > p.criticalStockQty
      if (stockStatus === "critical") return p.isActive && p.stockQty > 0 && p.stockQty <= p.criticalStockQty
      if (stockStatus === "out_of_stock") return p.isActive && p.stockQty <= 0
      return true
    })
  }

  return parts
}

export async function getUniqueBrandsAction() {
  const { workshopId } = await requireAuth()
  const parts = await prisma.partStockItem.findMany({
    where: { workshopId, brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
  })
  return parts.map((p) => p.brand).filter(Boolean) as string[]
}

export async function getUniqueCategoriesAction() {
  const { workshopId } = await requireAuth()
  const parts = await prisma.partStockItem.findMany({
    where: { workshopId, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
  })
  return parts.map((p) => p.category).filter(Boolean) as string[]
}

export async function searchPartsCatalogAction(query: string) {
  const user = await requireAuth()
  return prisma.partStockItem.findMany({
    where: {
      workshopId: user.workshopId,
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
        { oemNo: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
        { barcode: { contains: query } },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      oemNo: true,
      brand: true,
      stockQty: true,
      criticalStockQty: true,
      salePrice: true,
      unit: true,
      isActive: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  })
}

/**
 * Parça sekmesi güvenlik ağı: araç kataloğa bağlı ama parça cache'i boşsa
 * (ör. kayıt anını kaçırmış mevcut araçlar) yaygın bakım parçalarını arka
 * planda (after) doldurur. Kota + mock guard'ları prefetch içinde. Tenant
 * izolasyonu: workshopId requireAuth()'tan; client'ın vehicleId'si workshop'a
 * ait mi doğrulanır, catalogVehicleTypeId client'tan ALINMAZ (DB'den okunur).
 */
export async function ensureVehiclePartsPrefetched(
  vehicleId: string
): Promise<{ status: "cached" | "started" | "skipped" }> {
  const user = await requireAuth()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workshopId: user.workshopId },
    select: { catalogVehicleTypeId: true },
  })
  if (!vehicle?.catalogVehicleTypeId) return { status: "skipped" }

  const vehicleTypeId = vehicle.catalogVehicleTypeId
  const existing = await prisma.tecdocArticle.findFirst({
    where: { vehicleTypeId },
    select: { id: true },
  })
  if (existing) return { status: "cached" }

  after(() => prefetchCommonVehicleParts(vehicleTypeId))
  return { status: "started" }
}
