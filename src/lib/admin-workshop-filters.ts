import type { $Enums, Prisma } from "@prisma/client"
import { ACQUISITION_SOURCES } from "@/lib/acquisition-sources"

/** Yönetici konsolu iş yeri listesinde bir sayfada gösterilen kayıt sayısı. */
export const WORKSHOP_PAGE_SIZE = 20

/** Aramada dikkate alınan en uzun metin — URL'den gelen girdiyi sınırlar. */
const MAX_QUERY_LENGTH = 100

const APPROVAL_STATUSES = ["pending", "approved", "rejected"] as const satisfies
  readonly $Enums.WorkshopApprovalStatus[]
const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "canceled"] as const satisfies
  readonly $Enums.SubscriptionStatus[]

export const WORKSHOP_APPROVAL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "pending", label: "Onay bekliyor" },
  { value: "approved", label: "Onaylı" },
  { value: "rejected", label: "Reddedildi" },
]

export const WORKSHOP_SUBSCRIPTION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "trialing", label: "Denemede" },
  { value: "active", label: "Aktif" },
  { value: "past_due", label: "Ödeme gecikti" },
  { value: "canceled", label: "İptal" },
]

/** Ham `searchParams` — her alan istemciden gelir, hiçbiri güvenilir değildir. */
export interface WorkshopListSearchParams {
  q?: string
  approval?: string
  subscription?: string
  page?: string
  acquisitionSource?: string
  acquisitionAdvisorId?: string
}

/** Doğrulanmış liste durumu. Sorgu ve bağlantı üretimi yalnız bunu kullanır. */
export interface WorkshopListQuery {
  q: string
  approval: $Enums.WorkshopApprovalStatus | null
  subscription: $Enums.SubscriptionStatus | null
  page: number
  acquisitionSource: $Enums.AcquisitionSource | null
  acquisitionAdvisorId: string | null
}

function pick<T extends string>(allowed: readonly T[], value: string | undefined): T | null {
  return allowed.find((option) => option === value) ?? null
}

/**
 * `searchParams`'ı sunucu tarafında doğrular: tanınmayan durum değerleri ve
 * geçersiz sayfa numaraları sessizce düşürülür, böylece URL'ye elle yazılan bir
 * değer sorguya sızmaz.
 */
export function parseWorkshopListParams(sp: WorkshopListSearchParams): WorkshopListQuery {
  const page = Number.parseInt(sp.page ?? "1", 10)
  return {
    q: (sp.q ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    approval: pick(APPROVAL_STATUSES, sp.approval),
    subscription: pick(SUBSCRIPTION_STATUSES, sp.subscription),
    page: Number.isFinite(page) ? Math.max(1, page) : 1,
    acquisitionSource: pick(ACQUISITION_SOURCES, sp.acquisitionSource),
    acquisitionAdvisorId: sp.acquisitionAdvisorId?.trim() || null,
  }
}

/** Filtre uygulanmış mı — boş sonuç metnini ve "Temizle" düğmesini belirler. */
export function isWorkshopListFiltered(query: WorkshopListQuery): boolean {
  return Boolean(query.q || query.approval || query.subscription || query.acquisitionSource || query.acquisitionAdvisorId)
}

/**
 * Arama atölye adında ve **herhangi bir** üyenin e-postasında eşleşir; listede
 * gösterilen "iletişim e-postası" yalnız ilk üyeye ait olduğu için destek
 * personeli ikinci bir kullanıcının adresiyle de atölyeyi bulabilmeli.
 */
export function buildWorkshopWhere(query: WorkshopListQuery): Prisma.WorkshopWhereInput {
  const where: Prisma.WorkshopWhereInput = {}
  if (query.approval) where.approvalStatus = query.approval
  if (query.subscription) where.subscriptionStatus = query.subscription
  if (query.acquisitionSource) where.acquisitionSource = query.acquisitionSource
  if (query.acquisitionAdvisorId) where.acquisitionAdvisorId = query.acquisitionAdvisorId
  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: "insensitive" } },
      { users: { some: { email: { contains: query.q, mode: "insensitive" } } } },
    ]
  }
  return where
}

/**
 * Liste durumunu URL'de taşıyan bağlantı — destek görüşmesinde filtrelenmiş
 * ekran olduğu gibi paylaşılabilsin diye sayfa/filtre state'i URL'de tutulur.
 */
export function buildWorkshopListHref(query: WorkshopListQuery, page: number = query.page): string {
  const qs = new URLSearchParams()
  if (query.q) qs.set("q", query.q)
  if (query.approval) qs.set("approval", query.approval)
  if (query.subscription) qs.set("subscription", query.subscription)
  if (query.acquisitionSource) qs.set("acquisitionSource", query.acquisitionSource)
  if (query.acquisitionAdvisorId) qs.set("acquisitionAdvisorId", query.acquisitionAdvisorId)
  if (page > 1) qs.set("page", String(page))
  const search = qs.toString()
  return search ? `/admin/workshops?${search}` : "/admin/workshops"
}
