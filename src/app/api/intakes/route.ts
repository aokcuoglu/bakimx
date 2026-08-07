import { createIntakeAction } from "@/app/(app)/intakes/actions"
import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await createIntakeAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    if (result?.id) {
      return NextResponse.json({ success: true, id: result.id, orderId: result.orderId })
    }
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 400 })
  } catch (err) {
    return apiErrorResponse(err)
  }
}