import { NextResponse } from "next/server"
import { verifyDeliveryOtpAction } from "@/app/(app)/intakes/delivery-actions"
import { apiErrorResponse } from "@/lib/api-errors"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as { code?: string }
    const result = await verifyDeliveryOtpAction(id, (body.code ?? "").trim())
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (err) {
    return apiErrorResponse(err)
  }
}
