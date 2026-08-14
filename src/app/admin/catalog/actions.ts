"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { getValidationError } from "@/lib/validations/shared"
import {
  bakimxBrandInputSchema,
  bakimxBulkActiveSchema,
  bakimxBulkPriceSchema,
  bakimxBulkStockSchema,
  bakimxProductInputSchema,
} from "@/lib/validations/bakimx-product"
import {
  applyPricePercent,
  applyStockUpdate,
  bakimxProductWriteData,
  catalogAuditAction,
  diffCatalogFields,
  isBakimxCategoryKey,
  productAuditSnapshot,
  uniqueBakimxBrandSlug,
  type BakimxProductWriteInput,
} from "@/lib/catalog/bakimx-catalog"
import { buildBakimxProductSearchKey } from "@/lib/parts/bakimx-search-key"

/**
 * `/admin/catalog` server action'ları (BAK-32).
 *
 * YETKİ: her action AYRI AYRI `requireAdminCapability("manageCatalog")` çağırır.
 * `/admin/layout.tsx`'teki `requireAdmin()` guard'ı action'lara MİRAS KALMAZ
 * (bkz. src/lib/admin.ts) — buradaki tekrar süs değil, tek gerçek kapı.
 *
 * DENETİM: her ürün/marka mutasyonu `BakimxCatalogAudit`'e yazılır ve yazma ile
 * AYNI transaction içindedir; mutasyon başarılıysa denetim satırı da vardır.
 * (Mevcut `AuditLog` burada kullanılamaz: `workshopId` zorunlu, global katalog
 * bir atölyeye ait değil.)
 *
 * ARAMA: `searchKey` üreten tek yer `bakimxProductWriteData` — hiçbir action
 * onu elle yazmaz, dolayısıyla bayat kalamaz.
 */

type Result = { ok: true; id?: string } | { ok: false; error: string }

/** Denetim ve fark alma için ürün satırından okunan alanlar. */
const PRODUCT_AUDIT_SELECT = {
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
  costPriceKurus: true,
  stockQty: true,
  lowStockQty: true,
  backorderable: true,
  leadTimeDays: true,
  isActive: true,
  publishedAt: true,
} as const

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/** Zod'dan çıkan girdiyi DB'ye yazılabilir hâle indirger (boş metin → null). */
function toWriteInput(input: {
  sku: string
  name: string
  brandId: string
  categoryKey: string
  barcode: string
  unit: string
  description: string
  imageUrl: string
  oemNumbers: string[]
  workshopPriceKurus: number
  vatRateBps: number
  costPriceKurus: number | null
  stockQty: number
  lowStockQty: number
  backorderable: boolean
  leadTimeDays: number | null
  isActive: boolean
}): BakimxProductWriteInput {
  return {
    sku: input.sku,
    name: input.name,
    brandId: input.brandId,
    // Bilinmeyen kategori anahtarı sessizce kabul edilmez: taksonomi dışıysa boş kalır.
    categoryKey: isBakimxCategoryKey(input.categoryKey) ? input.categoryKey : null,
    barcode: input.barcode || null,
    unit: input.unit || "adet",
    description: input.description || null,
    imageUrl: input.imageUrl || null,
    oemNumbers: input.oemNumbers,
    workshopPriceKurus: input.workshopPriceKurus,
    vatRateBps: input.vatRateBps,
    costPriceKurus: input.costPriceKurus,
    stockQty: input.stockQty,
    lowStockQty: input.lowStockQty,
    backorderable: input.backorderable,
    leadTimeDays: input.leadTimeDays,
    isActive: input.isActive,
  }
}

function revalidateCatalog() {
  revalidatePath("/admin", "layout")
}

// ---------------------------------------------------------------------------
// Ürün — tekil
// ---------------------------------------------------------------------------

export async function createBakimxProductAction(raw: unknown): Promise<Result> {
  const ctx = await requireAdminCapability("manageCatalog")

  const parsed = bakimxProductInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: getValidationError(parsed) ?? "Geçersiz ürün bilgisi." }
  const input = toWriteInput(parsed.data)

  const brand = await prisma.bakimxProductBrand.findUnique({
    where: { id: input.brandId },
    select: { id: true, name: true },
  })
  if (!brand) return { ok: false, error: "Marka bulunamadı." }

  const data = bakimxProductWriteData(input, brand.name)

  try {
    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.bakimxProduct.create({
        data: {
          ...data,
          currency: "TRY",
          updatedByUserId: ctx.user.id,
          publishedAt: data.isActive ? new Date() : null,
        },
        select: PRODUCT_AUDIT_SELECT,
      })
      await tx.bakimxCatalogAudit.create({
        data: {
          actorUserId: ctx.user.id,
          entityType: "product",
          entityId: product.id,
          action: "create",
          afterJson: asJson(productAuditSnapshot(product)),
        },
      })
      return product
    })

    revalidateCatalog()
    return { ok: true, id: created.id }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "Bu ürün kodu (SKU) zaten kullanılıyor." }
    throw error
  }
}

export async function updateBakimxProductAction(productId: string, raw: unknown): Promise<Result> {
  const ctx = await requireAdminCapability("manageCatalog")
  if (!productId) return { ok: false, error: "Ürün seçilmedi." }

  const parsed = bakimxProductInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: getValidationError(parsed) ?? "Geçersiz ürün bilgisi." }
  const input = toWriteInput(parsed.data)

  const [current, brand] = await Promise.all([
    prisma.bakimxProduct.findUnique({ where: { id: productId }, select: PRODUCT_AUDIT_SELECT }),
    prisma.bakimxProductBrand.findUnique({ where: { id: input.brandId }, select: { id: true, name: true } }),
  ])
  if (!current) return { ok: false, error: "Ürün bulunamadı." }
  if (!brand) return { ok: false, error: "Marka bulunamadı." }

  const data = bakimxProductWriteData(input, brand.name)
  const diff = diffCatalogFields(productAuditSnapshot(current), productAuditSnapshot(data))
  const action = catalogAuditAction(diff.keys)

  // Hiçbir alan değişmediyse yazma da denetim de yapılmaz — "değişiklik yok"
  // bir hata değil, sessiz başarı.
  if (!action) return { ok: true, id: current.id }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.bakimxProduct.update({
        where: { id: productId },
        data: {
          ...data,
          updatedByUserId: ctx.user.id,
          // İlk yayına alınma anı bir kez yazılır; sonraki aktif/pasif turları onu değiştirmez.
          ...(data.isActive && current.publishedAt === null ? { publishedAt: new Date() } : {}),
        },
      })
      await tx.bakimxCatalogAudit.create({
        data: {
          actorUserId: ctx.user.id,
          entityType: "product",
          entityId: productId,
          action,
          beforeJson: asJson(diff.before),
          afterJson: asJson(diff.after),
        },
      })
    })

    revalidateCatalog()
    return { ok: true, id: productId }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "Bu ürün kodu (SKU) zaten kullanılıyor." }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Ürün — toplu işlemler
// ---------------------------------------------------------------------------

export async function bulkSetBakimxProductActiveAction(raw: unknown): Promise<Result> {
  const ctx = await requireAdminCapability("manageCatalog")

  const parsed = bakimxBulkActiveSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: getValidationError(parsed) ?? "Geçersiz toplu işlem." }
  const { productIds, isActive } = parsed.data

  const rows = await prisma.bakimxProduct.findMany({
    where: { id: { in: productIds }, isActive: !isActive },
    select: { id: true, isActive: true, publishedAt: true },
  })
  if (rows.length === 0) return { ok: true }

  const ids = rows.map((r) => r.id)
  const firstPublishIds = isActive ? rows.filter((r) => r.publishedAt === null).map((r) => r.id) : []
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.bakimxProduct.updateMany({
      where: { id: { in: ids } },
      data: { isActive, updatedByUserId: ctx.user.id },
    })
    if (firstPublishIds.length > 0) {
      await tx.bakimxProduct.updateMany({
        where: { id: { in: firstPublishIds } },
        data: { publishedAt: now },
      })
    }
    await tx.bakimxCatalogAudit.createMany({
      data: ids.map((id) => ({
        actorUserId: ctx.user.id,
        entityType: "product",
        entityId: id,
        action: "update",
        beforeJson: asJson({ isActive: !isActive }),
        afterJson: asJson({ isActive }),
      })),
    })
  })

  revalidateCatalog()
  return { ok: true }
}

export async function bulkUpdateBakimxProductPricesAction(raw: unknown): Promise<Result> {
  const ctx = await requireAdminCapability("manageCatalog")

  const parsed = bakimxBulkPriceSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: getValidationError(parsed) ?? "Geçersiz fiyat güncellemesi." }
  const { productIds, percent } = parsed.data

  const rows = await prisma.bakimxProduct.findMany({
    where: { id: { in: productIds } },
    select: { id: true, workshopPriceKurus: true },
  })
  if (rows.length === 0) return { ok: false, error: "Seçilen ürünler bulunamadı." }

  // Yüzde uygulaması KURUŞ üzerinde, tek yerde yuvarlanır (money.ts sözleşmesi).
  const changes = rows
    .map((row) => ({ id: row.id, before: row.workshopPriceKurus, after: applyPricePercent(row.workshopPriceKurus, percent) }))
    .filter((change) => change.before !== change.after)
  if (changes.length === 0) return { ok: true }

  await prisma.$transaction(async (tx) => {
    for (const change of changes) {
      await tx.bakimxProduct.update({
        where: { id: change.id },
        data: { workshopPriceKurus: change.after, updatedByUserId: ctx.user.id },
      })
    }
    await tx.bakimxCatalogAudit.createMany({
      data: changes.map((change) => ({
        actorUserId: ctx.user.id,
        entityType: "product",
        entityId: change.id,
        action: "price_change",
        beforeJson: asJson({ workshopPriceKurus: change.before }),
        afterJson: asJson({ workshopPriceKurus: change.after, percent }),
      })),
    })
  })

  revalidateCatalog()
  return { ok: true }
}

export async function bulkUpdateBakimxProductStockAction(raw: unknown): Promise<Result> {
  const ctx = await requireAdminCapability("manageCatalog")

  const parsed = bakimxBulkStockSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: getValidationError(parsed) ?? "Geçersiz stok güncellemesi." }
  const { productIds, mode, quantity } = parsed.data

  const rows = await prisma.bakimxProduct.findMany({
    where: { id: { in: productIds } },
    select: { id: true, stockQty: true },
  })
  if (rows.length === 0) return { ok: false, error: "Seçilen ürünler bulunamadı." }

  const changes = rows
    .map((row) => ({ id: row.id, before: row.stockQty, after: applyStockUpdate(row.stockQty, mode, quantity) }))
    .filter((change) => change.before !== change.after)
  if (changes.length === 0) return { ok: true }

  await prisma.$transaction(async (tx) => {
    for (const change of changes) {
      await tx.bakimxProduct.update({
        where: { id: change.id },
        data: { stockQty: change.after, updatedByUserId: ctx.user.id },
      })
    }
    await tx.bakimxCatalogAudit.createMany({
      data: changes.map((change) => ({
        actorUserId: ctx.user.id,
        entityType: "product",
        entityId: change.id,
        action: "stock_change",
        beforeJson: asJson({ stockQty: change.before }),
        afterJson: asJson({ stockQty: change.after, mode }),
      })),
    })
  })

  revalidateCatalog()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Marka
// ---------------------------------------------------------------------------

export async function createBakimxBrandAction(raw: unknown): Promise<Result> {
  const ctx = await requireAdminCapability("manageCatalog")

  const parsed = bakimxBrandInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: getValidationError(parsed) ?? "Geçersiz marka bilgisi." }
  const { name, logoUrl, isActive } = parsed.data

  const taken = await prisma.bakimxProductBrand.findMany({ select: { slug: true } })
  const slug = uniqueBakimxBrandSlug(name, taken.map((b) => b.slug))

  try {
    const brand = await prisma.$transaction(async (tx) => {
      const created = await tx.bakimxProductBrand.create({
        data: { name, slug, logoUrl: logoUrl || null, isActive },
        select: { id: true, name: true, slug: true, logoUrl: true, isActive: true },
      })
      await tx.bakimxCatalogAudit.create({
        data: {
          actorUserId: ctx.user.id,
          entityType: "brand",
          entityId: created.id,
          action: "create",
          afterJson: asJson(created),
        },
      })
      return created
    })

    revalidateCatalog()
    return { ok: true, id: brand.id }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "Bu marka adı zaten kayıtlı." }
    throw error
  }
}

export async function updateBakimxBrandAction(brandId: string, raw: unknown): Promise<Result> {
  const ctx = await requireAdminCapability("manageCatalog")
  if (!brandId) return { ok: false, error: "Marka seçilmedi." }

  const parsed = bakimxBrandInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: getValidationError(parsed) ?? "Geçersiz marka bilgisi." }
  const { name, logoUrl, isActive } = parsed.data

  const current = await prisma.bakimxProductBrand.findUnique({
    where: { id: brandId },
    select: { id: true, name: true, slug: true, logoUrl: true, isActive: true },
  })
  if (!current) return { ok: false, error: "Marka bulunamadı." }

  const renamed = current.name !== name
  let slug = current.slug
  if (renamed) {
    const taken = await prisma.bakimxProductBrand.findMany({
      where: { id: { not: brandId } },
      select: { slug: true },
    })
    slug = uniqueBakimxBrandSlug(name, taken.map((b) => b.slug))
  }

  const after = { name, slug, logoUrl: logoUrl || null, isActive }
  const diff = diffCatalogFields(current as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>)
  if (diff.keys.length === 0) return { ok: true, id: brandId }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.bakimxProductBrand.update({ where: { id: brandId }, data: after })
      await tx.bakimxCatalogAudit.create({
        data: {
          actorUserId: ctx.user.id,
          entityType: "brand",
          entityId: brandId,
          action: "update",
          beforeJson: asJson(diff.before),
          afterJson: asJson(diff.after),
        },
      })
    })
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "Bu marka adı zaten kayıtlı." }
    throw error
  }

  // Marka adı ürün kartında DENORMALİZE tutuluyor ve `searchKey`'i besliyor:
  // yeniden adlandırma sonrası iki alanı da tazelemezsek liste eski adı gösterir
  // ve ürün yeni adıyla ARANAMAZ. Transaction dışında, parçalar hâlinde: marka
  // güncellemesinin kendisi çoktan kalıcı, bu yalnız türetilmiş veriyi düzeltir.
  if (renamed) {
    const products = await prisma.bakimxProduct.findMany({
      where: { brandId },
      select: { id: true, name: true, sku: true, oemNumbers: true },
    })
    for (const product of products) {
      await prisma.bakimxProduct.update({
        where: { id: product.id },
        data: {
          brandName: name,
          searchKey: buildBakimxProductSearchKey({
            name: product.name,
            brandName: name,
            sku: product.sku,
            oemNumbers: product.oemNumbers,
          }),
        },
      })
    }
  }

  revalidateCatalog()
  return { ok: true, id: brandId }
}

/** "Markanın tüm ürünlerini pasifleştir" — markanın kendisine dokunmaz. */
export async function deactivateBakimxBrandProductsAction(brandId: string): Promise<Result> {
  const ctx = await requireAdminCapability("manageCatalog")
  if (!brandId) return { ok: false, error: "Marka seçilmedi." }

  const brand = await prisma.bakimxProductBrand.findUnique({ where: { id: brandId }, select: { id: true } })
  if (!brand) return { ok: false, error: "Marka bulunamadı." }

  const rows = await prisma.bakimxProduct.findMany({
    where: { brandId, isActive: true },
    select: { id: true },
  })
  if (rows.length === 0) return { ok: true, id: brandId }

  const ids = rows.map((r) => r.id)
  await prisma.$transaction(async (tx) => {
    await tx.bakimxProduct.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false, updatedByUserId: ctx.user.id },
    })
    await tx.bakimxCatalogAudit.createMany({
      data: ids.map((id) => ({
        actorUserId: ctx.user.id,
        entityType: "product",
        entityId: id,
        action: "update",
        beforeJson: asJson({ isActive: true }),
        afterJson: asJson({ isActive: false, reason: "brand_deactivate_all", brandId }),
      })),
    })
  })

  revalidateCatalog()
  return { ok: true, id: brandId }
}
