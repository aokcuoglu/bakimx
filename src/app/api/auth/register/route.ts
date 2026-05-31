import { registerAction } from "@/app/(auth)/login/actions"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await registerAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 400 })
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}