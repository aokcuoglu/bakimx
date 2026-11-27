import type { Prisma } from "@prisma/client"
import { istanbulDayStart } from "@/lib/istanbul-time"
import type { TechnicianOrderRow } from "@/lib/technician/queries"

export type KioskOrderGroups = {
  mine: TechnicianOrderRow[]
  others: TechnicianOrderRow[]
  drafts: TechnicianOrderRow[]
}

// Taslak ve onay bekleyen kabuller eski panelde de "Taslak İşler"deydi.
const DRAFT_STATUSES = ["draft", "waiting_approval"]

function isDraft(order: TechnicianOrderRow): boolean {
  return DRAFT_STATUSES.includes(order.status)
}

function rank(order: TechnicianOrderRow): number {
  if (order.status === "in_progress") return order.hasActiveLabor ? 0 : 1
  return 2
}

function sortOrders(orders: TechnicianOrderRow[]): TechnicianOrderRow[] {
  return [...orders].sort(
    (a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt)
  )
}

/**
 * Kiosk ana ekranının üç iş grubu. Bir iş yalnız bir grupta görünür: taslak
 * her zaman Taslak'ta, bana atanan İşlerim'de, geri kalanı Atölyedeki diğer
 * işlerde. `focusTechnicianId` yoksa çağıran `mine` olarak boş liste verir.
 */
export function groupKioskOrders(
  mine: TechnicianOrderRow[],
  workshop: TechnicianOrderRow[],
  // Çağıran odak teknisyenine göre `mine`'ı zaten süzdü; imza yalnız niyeti taşır.
  focusTechnicianId: string | null
): KioskOrderGroups {
  const mineOrders = focusTechnicianId ? mine.filter((o) => !isDraft(o)) : []
  const mineIds = new Set(mineOrders.map((o) => o.id))

  const draftsById = new Map<string, TechnicianOrderRow>()
  for (const o of [...mine, ...workshop]) {
    if (isDraft(o)) draftsById.set(o.id, o)
  }

  const others = workshop.filter((o) => !isDraft(o) && !mineIds.has(o.id))

  return {
    mine: sortOrders(mineOrders),
    others: sortOrders(others),
    drafts: [...draftsById.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }
}

/** "Bugün biten": İstanbul gününün başından beri tamamlanan işler (#904 sınıfı). */
export function completedTodayWhere(
  workshopId: string,
  now: Date,
  technicianId?: string
): Prisma.ServiceOrderWhereInput {
  return {
    workshopId,
    ...(technicianId ? { assignedTechnicianId: technicianId } : {}),
    status: { in: ["ready_for_delivery", "delivered"] },
    completedAt: { gte: istanbulDayStart(now) },
  }
}
