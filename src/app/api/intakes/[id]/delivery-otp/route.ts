import { NextResponse } from "next/server"
import { requestDeliveryOtpAction } from "@/app/(app)/intakes/delivery-actions"
import { apiErrorResponse } from "@/lib/api-errors"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await requestDeliveryOtpAction(id)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (err) {
    return apiErrorResponse(err)
  }
}
