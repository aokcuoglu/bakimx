import type { Prisma } from "@prisma/client"
import { generateUniqueWorkOrderNo } from "@/lib/work-order-number"

/**
 * Bir kabul (intake) için ServiceOrder'ı, VAR OLAN bir transaction içinde oluşturur.
 * Workshop'a özgü benzersiz iş emri numarası üretir.
 * Audit / timeline / revalidate sorumluluğu ÇAĞIRANA aittir.
 */
export async function createServiceOrderForIntake(
  tx: Prisma.TransactionClient,
  workshopId: string,
  intakeFormId: string,
): Promise<{ id: string; workOrderNo: string }> {
  const workOrderNo = await generateUniqueWorkOrderNo((candidate) =>
    tx.serviceOrder
      .findFirst({
        where: { workshopId, workOrderNo: candidate },
        select: { id: true },
      })
      .then((clash) => clash !== null),
  )

  const order = await tx.serviceOrder.create({
    data: { workshopId, intakeFormId, workOrderNo, status: "draft" },
  })

  return { id: order.id, workOrderNo }
}
