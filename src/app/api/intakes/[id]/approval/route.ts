import { requestApprovalAction, verifyOtpAction } from "@/app/app/intakes/approval-actions"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check if this is a verify request
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
    return NextResponse.json({ success: true, otpCode: result.otpCode, approvalId: result.approvalId })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}