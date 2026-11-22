import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import { displayCustomerName } from "@/lib/search/unified-results"

export async function GET(request: Request) {
  const user = await requireAuth()
  // Restricted roles cannot open /orders/[id]; do not return those records here.
  if (isTechnicianRestrictedRole(user.role)) return NextResponse.json({ results: [] })

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100)
  if (q.length < 2) return NextResponse.json({ results: [] })

  const orders = await prisma.serviceOrder.findMany({
    where: {
      workshopId: user.workshopId,
      OR: [
        { workOrderNo: { contains: q, mode: "insensitive" } },
        { intakeForm: { vehicle: { plate: { contains: q, mode: "insensitive" } } } },
        { intakeForm: { customer: { fullName: { contains: q, mode: "insensitive" } } } },
        { intakeForm: { customer: { companyName: { contains: q, mode: "insensitive" } } } },
        { intakeForm: { customer: { firstName: { contains: q, mode: "insensitive" } } } },
        { intakeForm: { customer: { lastName: { contains: q, mode: "insensitive" } } } },
      ],
    },
    select: {
      id: true,
      workOrderNo: true,
      intakeForm: {
        select: {
          vehicle: { select: { plate: true } },
          customer: { select: { id: true, firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true } },
        },
      },
    },
    take: 8,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    results: orders.map((order) => ({
      id: order.id,
      label: order.workOrderNo ? `Araç kabul ${order.workOrderNo}` : "Araç kabulü",
      sublabel: `${order.intakeForm.vehicle.plate} · ${displayCustomerName(order.intakeForm.customer)}`,
    })),
  })
}
