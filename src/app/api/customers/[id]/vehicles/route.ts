import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth()
  const { id } = await params

  const customer = await prisma.customer.findFirst({
    where: { id, workshopId: user.workshopId },
    select: { id: true },
  })
  if (!customer) {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 })
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { workshopId: user.workshopId, customerId: id },
    select: { id: true, plate: true, brand: true, model: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ vehicles })
}
