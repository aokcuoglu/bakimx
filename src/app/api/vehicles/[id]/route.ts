import { getAppData } from "@/app/(app)/data"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { updateVehicleAction, deleteVehicleAction } from "@/app/(app)/vehicles/actions"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user } = await getAppData()

    const vehicle = await prisma.vehicle.findFirst({
      where: { id, workshopId: user.workshopId },
      include: { customer: true },
    })
    if (!vehicle) {
      return NextResponse.json({ error: "Araç bulunamadı" }, { status: 404 })
    }
    return NextResponse.json(vehicle)
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const formData = await request.formData()
    const result = await updateVehicleAction(id, formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await deleteVehicleAction(id)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
