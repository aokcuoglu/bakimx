import type { Prisma, PaymentStatus } from "@prisma/client"
import { calculateOrderTotalsFromMinimal, ORDER_TOTALS_ITEM_SELECT } from "@/lib/totals"
import { computeStoredGrandTotal } from "@/lib/orders/stored-total"
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
  // Satırı kilitle: eşzamanlı iki kalem eklemesi READ COMMITTED altında birbirinin
  // kalemini görmeden toplam yazar ve saklanan `grandTotal` eksik kalırdı. Kilit
  // işlem sonuna dek tutulur, ikinci çağrı birincinin kalemini görür (#831).
  // `tx` gerçek bir işlem istemcisi olmak ZORUNDA (global prisma'da FOR UPDATE anlamsız).
  await tx.$queryRaw`SELECT "id" FROM "ServiceOrder" WHERE "id" = ${serviceOrderId} AND "workshopId" = ${workshopId} FOR UPDATE`
  const order = await tx.serviceOrder.findFirst({
    where: { id: serviceOrderId, workshopId },
    include: { items: { select: ORDER_TOTALS_ITEM_SELECT } },
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
      // Liste sıralaması için saklanan toplam (#831) — kalemler/indirim/KDV
      // değiştiğinde bu çağrı zaten yapılıyor, ayrı bir senkron yolu yok.
      grandTotal: computeStoredGrandTotal(order.items, {
        discountAmount: order.discountAmount,
        taxRate: order.taxRate,
      }),
    },
  })

  return { statusChanged: order.paymentStatus !== newPaymentStatus, newStatus: newPaymentStatus }
}
