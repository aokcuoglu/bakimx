import { prisma } from "@/lib/db"

/** Opens exactly one manually-priced commission draft for an attributed first
 * paid subscription. The unique billingOrderId makes payment callback retries
 * safe. */
export async function createCommissionDraftForBillingOrder(billingOrderId: string): Promise<void> {
  const order = await prisma.billingOrder.findUnique({
    where: { id: billingOrderId },
    select: { id: true, workshopId: true, type: true },
  })
  if (!order || order.type === "renewal") return

  const lead = await prisma.salesLead.findUnique({
    where: { workshopId: order.workshopId },
    select: { id: true, advisorId: true },
  })
  if (!lead?.advisorId) return

  await prisma.salesCommission.upsert({
    where: { billingOrderId: order.id },
    create: { billingOrderId: order.id, leadId: lead.id, advisorId: lead.advisorId },
    update: {},
  })
}
