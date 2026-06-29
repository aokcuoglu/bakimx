import type { Prisma, PaymentStatus } from "@prisma/client"
import { calculateOrderTotalsFromMinimal } from "@/lib/totals"
import { sumKurus } from "@/lib/money"
import { computePaymentStatus, computeRemainingAmount } from "@/lib/cashbox/status"

/**
 * Re-derive a service order's payment fields from authoritative sources:
 * grandTotal from its line items (kuruş; taxRate in bps) and paidAmount from the
 * sum of its completed collections. remainingAmount and paymentStatus follow.
 *
 * Call this in the same transaction after anything that changes either the line
 * items / discount / tax (which move grandTotal) or the collections (paid).
 */
export async function recalcOrderPayment(
  tx: Prisma.TransactionClient,
  serviceOrderId: string,
  workshopId: string
): Promise<{ statusChanged: boolean; newStatus: string } | null> {
  const order = await tx.serviceOrder.findFirst({
    where: { id: serviceOrderId, workshopId },
    include: { items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } } },
  })
  if (!order) return null

  const totals = calculateOrderTotalsFromMinimal(order.items, {
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
  })

  const collections = await tx.collectionPayment.findMany({
    where: { serviceOrderId, workshopId, status: "completed" },
  })

  const paidAmount = sumKurus(collections.map((c) => c.amount))
  const newPaymentStatus = computePaymentStatus(totals.grandTotal, paidAmount)
  const remainingAmount = computeRemainingAmount(totals.grandTotal, paidAmount)
  const lastPaymentAt =
    collections.length > 0
      ? collections.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())[0].paymentDate
      : null

  await tx.serviceOrder.updateMany({
    where: { id: serviceOrderId, workshopId },
    data: {
      paymentStatus: newPaymentStatus as PaymentStatus,
      paidAmount,
      remainingAmount,
      lastPaymentAt,
    },
  })

  return { statusChanged: order.paymentStatus !== newPaymentStatus, newStatus: newPaymentStatus }
}
