import { requestApprovalAction, verifyOtpAction } from "@/app/app/intakes/approval-actions"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const contentType = request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body = await request.json()
      if (body.otpCode) {
        const result = await verifyOtpAction(id, body.otpCode)
        if (result?.error) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({ success: true })
      }
    }

    const result = await requestApprovalAction(id)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const response: Record<string, unknown> = {
      success: true,
      approvalId: result.approvalId,
    }

    if (process.env.NODE_ENV !== "production") {
      response.otpCode = result.otpCode
    } else {
      response.message = "Onay kodu demo ortamında gösterilir."
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
