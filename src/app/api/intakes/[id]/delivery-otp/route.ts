import { NextResponse } from "next/server"
import { requestDeliveryOtpAction } from "@/app/(app)/intakes/delivery-actions"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await requestDeliveryOtpAction(id)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
