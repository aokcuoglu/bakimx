import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

export type BillingAccount = {
  accountWorkshopId: string
  organizationId: string | null
  workshopIds: string[]
  isAccountWorkshop: boolean
}

/** Hesap atölyesi: en eski `createdAt`; eşitlikte en küçük id. */
export function pickAccountWorkshopId(rows: readonly { id: string; createdAt: Date }[]): string {
  if (rows.length === 0) throw new Error("Hesap atölyesi seçilemedi: atölye yok.")
  let best = rows[0]
  for (const r of rows) {
    const dt = r.createdAt.getTime() - best.createdAt.getTime()
    if (dt < 0 || (dt === 0 && r.id < best.id)) best = r
  }
  return best.id
}

/** Faturalama hesabı: kuruluşsuz atölye kendi hesabıdır; kuruluşta en eski müşteri atölyesi. */
export async function resolveBillingAccount(
  w: { id: string; organizationId: string | null },
  db: Prisma.TransactionClient = prisma,
): Promise<BillingAccount> {
  if (!w.organizationId) {
    return { accountWorkshopId: w.id, organizationId: null, workshopIds: [w.id], isAccountWorkshop: true }
  }
  const rows = await db.workshop.findMany({
    where: { organizationId: w.organizationId, kind: "customer" },
    select: { id: true, createdAt: true },
  })
  if (rows.length === 0) {
    return { accountWorkshopId: w.id, organizationId: w.organizationId, workshopIds: [w.id], isAccountWorkshop: true }
  }
  const accountWorkshopId = pickAccountWorkshopId(rows)
  return {
    accountWorkshopId,
    organizationId: w.organizationId,
    workshopIds: rows.map((r) => r.id),
    isAccountWorkshop: accountWorkshopId === w.id,
  }
}
