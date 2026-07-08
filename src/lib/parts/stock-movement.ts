import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

/**
 * Stok düşümü / iade yardimcilari. Yalnızca server action'lardan import edilir
 * ("use server" DEGIL). Çağıran action kendi transaction'ını verir.
 *
 * Stok düşümü kaynakları:
 *  - "work_order": iş emri kalemi eklendiğinde (reserve), silindiğinde iade (return)
 *  - "manual": /parts/[id] üzerinden manuel giriş/çıkış/düzeltme (mevcut, parts/actions.ts)
 *
 * Teklif (quote) kalemi stok düşÜMEZ — yalnızca partId bağlar. Teklif iş emrine
 * çevrildiğinde (convertQuoteToWorkOrderAction) stok düşülür.
 */

export type StockSourceType = "work_order" | "quote" | "manual"

/**
 * Bir PartStockItem'in workshopId scope'una ait olduğunu doğrula ve getir.
 * Cross-tenant engel. Pasif parça reddedilir (null döner).
 */
export async function getActiveWorkshopPart(workshopId: string, partId: string) {
  return prisma.partStockItem.findFirst({
    where: { id: partId, workshopId, isActive: true },
  })
}

/**
 * Transaction içinde: stok düş + StockMovement oluştur (type=out).
 * Yetersiz stok varsa hata fırlatır (çağıran transaction rollback olur).
 */
export async function reserveStockInTx(
  tx: Prisma.TransactionClient,
  workshopId: string,
  partId: string,
  quantity: number,
  sourceType: StockSourceType,
  sourceId: string,
  createdByUserId: string,
  reason?: string,
): Promise<{ newQty: number }> {
  if (quantity <= 0) return { newQty: 0 }

  const part = await tx.partStockItem.findFirst({
    where: { id: partId, workshopId, isActive: true },
  })
  if (!part) {
    throw new Error("Parça bulunamadı veya pasif")
  }

  const previousQty = part.stockQty
  const newQty = previousQty - quantity
  if (newQty < 0) {
    throw new Error(
      `Yetersiz stok: ${part.name}. Mevcut: ${previousQty}, İhtiyaç: ${quantity}`,
    )
  }

  await tx.partStockItem.updateMany({
    where: { id: partId, workshopId },
    data: { stockQty: newQty },
  })

  await tx.stockMovement.create({
    data: {
      workshopId,
      partId,
      type: "out",
      quantity,
      previousQty,
      newQty,
      reason: reason ?? "İş emrine eklendi",
      sourceType,
      sourceId,
      createdByUserId,
    },
  })

  return { newQty }
}

/**
 * Transaction içinde: stok iade et + StockMovement oluştur (type=in, reason iade).
 * Silinen/değişen order item için geri ekle. Parça bulunamazsa sessizce atlanır
 * (referans kaybolmuş olabilir — parça silinmiş/pasifleştirilmiş).
 */
export async function returnStockInTx(
  tx: Prisma.TransactionClient,
  workshopId: string,
  partId: string,
  quantity: number,
  sourceType: StockSourceType,
  sourceId: string,
  createdByUserId: string,
  reason?: string,
): Promise<{ newQty: number } | null> {
  if (quantity <= 0) return { newQty: 0 }

  const part = await tx.partStockItem.findFirst({
    where: { id: partId, workshopId },
  })
  if (!part) {
    // Parça silinmiş/pasifleştirilmiş — iade yapma, hata da atma.
    return null
  }

  const previousQty = part.stockQty
  const newQty = previousQty + quantity

  await tx.partStockItem.updateMany({
    where: { id: partId, workshopId },
    data: { stockQty: newQty },
  })

  await tx.stockMovement.create({
    data: {
      workshopId,
      partId,
      type: "in",
      quantity,
      previousQty,
      newQty,
      reason: reason ?? "İş emrinden iade",
      sourceType,
      sourceId,
      createdByUserId,
    },
  })

  return { newQty }
}