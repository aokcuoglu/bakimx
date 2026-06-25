import { NextResponse } from "next/server"
import { verifyDeliveryOtpAction } from "@/app/(app)/intakes/delivery-actions"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as { code?: string }
    const result = await verifyDeliveryOtpAction(id, (body.code ?? "").trim())
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
