import { getIntakeAction, updateIntakeDetailsAction } from "@/app/(app)/intakes/actions"
import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const intake = await getIntakeAction(id)
    if (!intake) {
      return NextResponse.json({ error: "Kabul formu bulunamadı" }, { status: 404 })
    }
    return NextResponse.json(intake)
  } catch (err) {
    return apiErrorResponse(err)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const result = await updateIntakeDetailsAction(id, {
      customerComplaint: body.customerComplaint,
      internalNote: body.internalNote,
      mileageAtIntake: body.mileageAtIntake,
      fuelLevelAtIntake: body.fuelLevelAtIntake,
      droppedOffByName: body.droppedOffByName,
      droppedOffByPhone: body.droppedOffByPhone,
      pickedUpByName: body.pickedUpByName,
      pickedUpByPhone: body.pickedUpByPhone,
    })
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiErrorResponse(err)
  }
}