import "server-only"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { formatTRY } from "@/lib/format"
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  PHOTO_TYPES,
  DAMAGE_TYPES,
  VEHICLE_ZONES,
} from "@/lib/constants"

export type ActivityCategory =
  | "create"
  | "part"
  | "labor"
  | "payment"
  | "status"
  | "meta"
  | "photo"
  | "damage"
  | "tech"

export type OrderActivityEntry = {
  id: string
  at: string // ISO
  actor: string
  action: string
  category: ActivityCategory
  label: string
  detail?: string
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Nakit",
  credit_card: "Kredi Kartı",
  bank_transfer: "Havale/EFT",
  other: "Diğer",
}

type ActorRef = { firstName: string | null; lastName: string | null; email: string } | null

function formatActor(actor: ActorRef): string {
  if (!actor) return "Sistem"
  const name = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim()
  return name || actor.email
}

function safeParse(json: string | null): Record<string, unknown> {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function statusLabel(key: string): string {
  return (ORDER_STATUS as Record<string, { label: string }>)[key]?.label ?? key
}
function paymentLabel(key: string): string {
  return (PAYMENT_STATUS as Record<string, { label: string }>)[key]?.label ?? key
}

type Built = { category: ActivityCategory; label: string; detail?: string } | null

// Aksiyon + metadata → personel-içi TR etiket. Bilinmeyen aksiyonlar null döner
// (log'a girmez) — kart yalnız anlamlı işlemleri gösterir.
function buildEntry(action: string, meta: Record<string, unknown>): Built {
  if (action.startsWith("order_status_changed_to_")) {
    return { category: "status", label: `Durum değişti: ${statusLabel(action.replace("order_status_changed_to_", ""))}` }
  }
  if (action.startsWith("order_payment_changed_to_") || action.startsWith("payment_status_changed_to_")) {
    const key = action.replace("order_payment_changed_to_", "").replace("payment_status_changed_to_", "")
    return { category: "payment", label: `Ödeme durumu: ${paymentLabel(key)}` }
  }

  switch (action) {
    case "service_order_created":
    case "service_order_created_from_quote":
    case "service_order_created_from_appointment":
      return { category: "create", label: "İş emri oluşturuldu" }

    case "order_item_added": {
      const name = String(meta.name ?? "Kalem")
      const isLabor = meta.type === "labor"
      const qty = Number(meta.quantity ?? 1)
      const parts = [isLabor ? "İşçilik" : "Parça"]
      if (qty > 1) parts.push(`${qty} adet`)
      if (typeof meta.unitPrice === "number") parts.push(formatTRY(meta.unitPrice))
      return { category: isLabor ? "labor" : "part", label: `${name} eklendi`, detail: parts.join(" · ") }
    }
    case "order_item_removed": {
      const name = String(meta.name ?? "Kalem")
      const isLabor = meta.type === "labor"
      return { category: isLabor ? "labor" : "part", label: `${name} çıkarıldı`, detail: isLabor ? "İşçilik" : "Parça" }
    }

    case "order_meta_updated":
      return { category: "meta", label: "İş emri bilgileri güncellendi" }

    case "collection_created": {
      const amount = typeof meta.amount === "number" ? formatTRY(meta.amount) : null
      const method = typeof meta.method === "string" ? PAYMENT_METHOD_LABELS[meta.method] ?? meta.method : null
      return {
        category: "payment",
        label: "Tahsilat alındı",
        detail: [amount, method].filter(Boolean).join(" · ") || undefined,
      }
    }
    case "collection_cancelled": {
      const amount = typeof meta.amount === "number" ? formatTRY(meta.amount) : null
      const reason = typeof meta.reason === "string" ? meta.reason : null
      return {
        category: "payment",
        label: "Tahsilat iptal edildi",
        detail: [amount, reason].filter(Boolean).join(" · ") || undefined,
      }
    }

    case "photo_uploaded": {
      const type = typeof meta.type === "string" ? (PHOTO_TYPES as Record<string, { label: string }>)[meta.type]?.label ?? meta.type : null
      return { category: "photo", label: "Fotoğraf eklendi", detail: type ?? undefined }
    }

    case "damage_mark_added": {
      const zone = typeof meta.zone === "string" ? (VEHICLE_ZONES as Record<string, string>)[meta.zone] ?? meta.zone : null
      const dtype = typeof meta.damageType === "string" ? (DAMAGE_TYPES as Record<string, { label: string }>)[meta.damageType]?.label ?? meta.damageType : null
      return { category: "damage", label: "Hasar işaretlendi", detail: [zone, dtype].filter(Boolean).join(" · ") || undefined }
    }

    case "technician_assigned":
      return { category: "tech", label: "Usta atandı", detail: typeof meta.technicianName === "string" ? meta.technicianName : undefined }
    case "technician_unassigned":
      return { category: "tech", label: "Usta ataması kaldırıldı" }
    case "work_started":
      return { category: "tech", label: "Çalışma başlatıldı" }
    case "work_on_hold":
      return { category: "tech", label: "Çalışma beklemeye alındı" }
    case "work_completed":
      return { category: "tech", label: "Çalışma tamamlandı" }

    default:
      return null
  }
}

/**
 * İş emri detayının personel-içi "İşlem Geçmişi" kartı için aktivite akışı.
 * Tenant izolasyonu: tüm sorgular workshopId ile filtrelenir.
 * Kaynak: AuditLog — order'a stamp'lenen orderId + ServiceOrder-entity satırları
 * (durum/ödeme/meta/usta, geçmiş dahil) + intake'e bağlı foto/hasar kanıt satırları.
 */
export async function getOrderActivity({
  workshopId,
  orderId,
  intakeFormId,
}: {
  workshopId: string
  orderId: string
  intakeFormId: string
}): Promise<OrderActivityEntry[]> {
  const [items, photos, damageMarks, collections] = await Promise.all([
    prisma.serviceOrderItem.findMany({ where: { serviceOrderId: orderId, workshopId }, select: { id: true } }),
    prisma.vehiclePhoto.findMany({ where: { intakeFormId, workshopId }, select: { id: true } }),
    prisma.damageMark.findMany({ where: { intakeFormId, workshopId }, select: { id: true } }),
    prisma.collectionPayment.findMany({ where: { serviceOrderId: orderId, workshopId }, select: { id: true } }),
  ])

  const or: Prisma.AuditLogWhereInput[] = [
    { orderId },
    { entityType: "ServiceOrder", entityId: orderId },
  ]
  if (items.length) or.push({ entityType: "ServiceOrderItem", entityId: { in: items.map((i) => i.id) } })
  if (collections.length) or.push({ entityType: "CollectionPayment", entityId: { in: collections.map((c) => c.id) } })
  if (photos.length) or.push({ entityType: "VehiclePhoto", entityId: { in: photos.map((p) => p.id) } })
  if (damageMarks.length) or.push({ entityType: "DamageMark", entityId: { in: damageMarks.map((d) => d.id) } })

  const rows = await prisma.auditLog.findMany({
    where: { workshopId, OR: or },
    include: { actorUser: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: "desc" },
  })

  const entries: OrderActivityEntry[] = []
  for (const row of rows) {
    const built = buildEntry(row.action, safeParse(row.metadataJson))
    if (!built) continue
    entries.push({
      id: row.id,
      at: row.createdAt.toISOString(),
      actor: formatActor(row.actorUser),
      action: row.action,
      category: built.category,
      label: built.label,
      detail: built.detail,
    })
  }
  return entries
}
