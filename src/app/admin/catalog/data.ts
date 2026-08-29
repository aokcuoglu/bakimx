import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { bakimxProductSearchTerms } from "@/lib/parts/bakimx-search-key"
import { bakimxCategoryLabel } from "@/lib/catalog/bakimx-catalog"

/**
 * `/admin/catalog` okuma yolu. Admin tarafı olduğu için tenant filtresi YOK
 * (katalog global, sahibi BakımX); yetki kapısı çağıran sayfada.
 * Maliyet alanı (`costPriceKurus`) yalnız admin yüzeyinde döner — atölye
 * yüzeyine çıkan public DTO ayrı bir issue (BAK-33).
 */

/** Tek sayfada gösterilen ürün sayısı — filtresiz açılışta binlerce satır çekilmesin. */
export const CATALOG_PAGE_SIZE = 50

export type CatalogStatusFilter = "all" | "active" | "passive" | "low_stock" | "out_of_stock"

export const CATALOG_STATUS_FILTERS: CatalogStatusFilter[] = [
  "all",
  "active",
  "passive",
  "low_stock",
  "out_of_stock",
]

export function parseCatalogStatus(value: string | undefined): CatalogStatusFilter {
  return CATALOG_STATUS_FILTERS.includes((value ?? "all") as CatalogStatusFilter)
    ? ((value ?? "all") as CatalogStatusFilter)
    : "all"
}

export interface CatalogFilters {
  q: string
  brandId: string
  categoryKey: string
  status: CatalogStatusFilter
  page: number
}

export interface AdminCatalogProductRow {
  id: string
  sku: string
  name: string
  brandId: string
  brandName: string
  categoryKey: string | null
  categoryLabel: string
  workshopPriceKurus: number
  vatRateBps: number
  costPriceKurus: number | null
  stockQty: number
  lowStockQty: number
  backorderable: boolean
  isActive: boolean
  updatedAt: string
}

function buildWhere(filters: CatalogFilters): Prisma.BakimxProductWhereInput {
  const where: Prisma.BakimxProductWhereInput = {}

  // Arama: sorgu terimleri anahtarla AYNI katlamadan geçer, her terim ayrı
  // `contains` (VE mantığı) — "mutlu aku" hem markayı hem adı tutan satırı bulur.
  const terms = bakimxProductSearchTerms(filters.q)
  if (terms.length > 0) {
    where.AND = terms.map((term) => ({ searchKey: { contains: term } }))
  }

  if (filters.brandId) where.brandId = filters.brandId
  if (filters.categoryKey) where.categoryKey = filters.categoryKey

  switch (filters.status) {
    case "active":
      where.isActive = true
      break
    case "passive":
      where.isActive = false
      break
    case "out_of_stock":
      where.stockQty = { lte: 0 }
      break
    case "low_stock":
      // İki kolonun karşılaştırması Prisma alan referansıyla (raw SQL'e gerek yok).
      // `lowStockQty = 0` olan ürünün kritik eşiği yoktur, listeye girmez.
      where.stockQty = { gt: 0, lte: prisma.bakimxProduct.fields.lowStockQty }
      where.lowStockQty = { gt: 0 }
      break
    default:
      break
  }

  return where
}

export async function getCatalogProducts(
  filters: CatalogFilters,
): Promise<{ rows: AdminCatalogProductRow[]; total: number; page: number; pageCount: number }> {
  const where = buildWhere(filters)

  // `total` önce hesaplanır: geçersiz/eskimiş bir sayfa istenirse (ör. filtre
  // değişince sayfa sayısı azaldı) boş sayfa göstermek yerine son sayfaya kıstır.
  const total = await prisma.bakimxProduct.count({ where })
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE))
  const page = Math.min(Math.max(1, filters.page), pageCount)

  const products = await prisma.bakimxProduct.findMany({
    where,
    orderBy: [{ brandName: "asc" }, { name: "asc" }],
    skip: (page - 1) * CATALOG_PAGE_SIZE,
    take: CATALOG_PAGE_SIZE,
    select: {
      id: true,
      sku: true,
      name: true,
      brandId: true,
      brandName: true,
      categoryKey: true,
      workshopPriceKurus: true,
      vatRateBps: true,
      costPriceKurus: true,
      stockQty: true,
      lowStockQty: true,
      backorderable: true,
      isActive: true,
      updatedAt: true,
    },
  })

  const rows: AdminCatalogProductRow[] = products.map((p) => ({
    ...p,
    categoryLabel: bakimxCategoryLabel(p.categoryKey),
    updatedAt: p.updatedAt.toISOString(),
  }))

  return { rows, total, page, pageCount }
}

export interface CatalogBrandOption {
  id: string
  name: string
  isActive: boolean
}

/** Form ve filtre seçicilerini besleyen marka listesi (pasifler de döner: mevcut kayıt kaybolmasın). */
export async function getCatalogBrandOptions(): Promise<CatalogBrandOption[]> {
  return prisma.bakimxProductBrand.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, isActive: true },
  })
}

export interface AdminCatalogBrandRow {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  isActive: boolean
  productCount: number
  activeProductCount: number
}

export async function getCatalogBrandRows(): Promise<AdminCatalogBrandRow[]> {
  const [brands, totals, actives] = await Promise.all([
    prisma.bakimxProductBrand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, logoUrl: true, isActive: true },
    }),
    prisma.bakimxProduct.groupBy({ by: ["brandId"], _count: { _all: true } }),
    prisma.bakimxProduct.groupBy({ by: ["brandId"], where: { isActive: true }, _count: { _all: true } }),
  ])

  const totalById = new Map(totals.map((t) => [t.brandId, t._count._all]))
  const activeById = new Map(actives.map((t) => [t.brandId, t._count._all]))

  return brands.map((b) => ({
    ...b,
    productCount: totalById.get(b.id) ?? 0,
    activeProductCount: activeById.get(b.id) ?? 0,
  }))
}

export interface CatalogAuditRow {
  id: string
  action: string
  actorLabel: string
  beforeJson: unknown
  afterJson: unknown
  createdAt: string
}

/** Ürün kartında gösterilen son denetim satırları. */
export async function getProductAuditTrail(productId: string, take = 20): Promise<CatalogAuditRow[]> {
  const entries = await prisma.bakimxCatalogAudit.findMany({
    where: { entityType: "product", entityId: productId },
    orderBy: { createdAt: "desc" },
    take,
  })
  if (entries.length === 0) return []

  // `actorUserId` bir FK değil (katalog global, kullanıcı tenant'a bağlı) —
  // e-postayı ayrı bir toplu sorguyla çözüyoruz; kullanıcı silinmişse id kalır.
  const actorIds = [...new Set(entries.map((e) => e.actorUserId))]
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true },
  })
  const emailById = new Map(actors.map((a) => [a.id, a.email]))

  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    actorLabel: emailById.get(e.actorUserId) ?? e.actorUserId,
    beforeJson: e.beforeJson,
    afterJson: e.afterJson,
    createdAt: e.createdAt.toISOString(),
  }))
}
