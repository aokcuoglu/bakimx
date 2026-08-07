import { updateOrderStatusAction } from "@/app/(app)/orders/actions"
import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const result = await updateOrderStatusAction(id, body.status)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiErrorResponse(err)
  }
}