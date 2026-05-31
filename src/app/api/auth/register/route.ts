import { NextRequest, NextResponse } from "next/server"
import { registerAction } from "@/app/(auth)/login/actions"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const result = await registerAction(formData)
    if (result && "error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error && (error as { message: string }).message === "NEXT_REDIRECT") {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
