import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { pickAccountWorkshopId } from "@/lib/billing/account-pick"

export { pickAccountWorkshopId }

export type BillingAccount = {
  accountWorkshopId: string
  organizationId: string | null
  workshopIds: string[]
  isAccountWorkshop: boolean
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
