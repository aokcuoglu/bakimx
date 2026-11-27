import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { isReleasableExpiredAddonOrder } from "@/lib/billing/addon-pricing"

/**
 * Dönemi bitmiş ve canlı ödeme işlemi olmayan bekleyen ek özellik siparişlerini
 * iptal eder (#829); aksi halde paket yenilemeyi ve yeni siparişi sonsuza dek
 * kilitlerdi. `where` kapsamı çağıranın bekleyen-sipariş guard'ı ile aynıdır.
 * İptal tek `updateMany` ile `pending_payment` guard'ı altında yapılır.
 */
export async function releaseExpiredAddonOrders(
  where: Prisma.BillingOrderWhereInput,
  now: Date = new Date(),
): Promise<number> {
  const candidates = await prisma.billingOrder.findMany({
    where: { ...where, type: "addon", status: "pending_payment" },
    select: {
      id: true,
      reference: true,
      type: true,
      status: true,
      workshopId: true,
      workshop: { select: { currentPeriodEnd: true } },
      paymentTransactions: { select: { status: true } },
    },
  })
  const releasable = candidates.filter((o) =>
    isReleasableExpiredAddonOrder(o, o.workshop.currentPeriodEnd, o.paymentTransactions, now),
  )
  if (releasable.length === 0) return 0

  const cancelled = await prisma.billingOrder.updateMany({
    where: { id: { in: releasable.map((o) => o.id) }, status: "pending_payment" },
    data: { status: "cancelled" },
  })
  for (const o of releasable) {
    await AuditLogAction(
      o.workshopId,
      undefined,
      "BillingOrder",
      o.reference,
      "billing_order_cancelled",
      JSON.stringify({ reason: "addon_period_ended" }),
    )
  }
  return cancelled.count
}
