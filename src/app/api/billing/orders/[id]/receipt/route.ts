import { notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { isAdminEmail } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { generateReceiptHtml } from "@/lib/billing/receipt"
import { getPlanPackage } from "@/lib/plans-catalog"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session?.userId) return new Response("Unauthorized", { status: 401 })

  const order = await prisma.billingOrder.findUnique({
    where: { id },
    include: { workshop: { select: { id: true, name: true, invoiceTitle: true, taxNumber: true, taxOffice: true, address: true } } },
  })
  if (!order || order.status !== "confirmed") notFound()

  // Ownership: the order's workshop, or a platform admin.
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, workshopId: true } })
  const isOwner = me?.workshopId === order.workshopId
  if (!isOwner && !isAdminEmail(me?.email)) notFound()

  const snap = (order.billingSnapshot ?? {}) as { invoiceTitle?: string; taxNumber?: string; taxOffice?: string; address?: string }
  const html = generateReceiptHtml({
    reference: order.reference,
    planName: getPlanPackage(order.planTier)?.name ?? order.planTier,
    cycleLabel: order.billingCycle === "monthly" ? "Aylık" : "Yıllık",
    amountMinor: order.amountMinor,
    confirmedAt: order.confirmedAt,
    workshopName: order.workshop.name,
    invoiceTitle: snap.invoiceTitle ?? order.workshop.invoiceTitle,
    taxNumber: snap.taxNumber ?? order.workshop.taxNumber,
    taxOffice: snap.taxOffice ?? order.workshop.taxOffice,
    address: snap.address ?? order.workshop.address,
  })
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}
