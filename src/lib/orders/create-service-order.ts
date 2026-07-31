import type { Prisma, ArrivalReason } from "@prisma/client"
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
  // Kabul sihirbazında seçilebilen servise geliş nedeni. Randevu/teklif
  // dönüşümünde toplanmadığı için opsiyonel.
  arrivalReason?: ArrivalReason | null,
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
    data: { workshopId, intakeFormId, workOrderNo, status: "draft", arrivalReason: arrivalReason ?? null },
  })

  return { id: order.id, workOrderNo }
}
