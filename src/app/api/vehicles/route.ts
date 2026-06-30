import { createVehicleAction } from "@/app/(app)/vehicles/actions"
import { getAppData } from "@/app/(app)/data"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await createVehicleAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, id: result.id })
  } catch (err) {
    console.error("[POST /api/vehicles] failed:", err)
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { user } = await getAppData()
    const url = new URL(request.url)
    const customerId = url.searchParams.get("customerId")

    const where: Record<string, unknown> = { workshopId: user.workshopId }
    if (customerId) where.customerId = customerId

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(vehicles)
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}