import { updateOrderArrivalReasonAction } from "@/app/(app)/orders/actions"
import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const result = await updateOrderArrivalReasonAction(id, typeof body.reason === "string" ? body.reason : "")
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiErrorResponse(err)
  }
}
