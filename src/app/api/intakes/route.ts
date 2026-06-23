import { createIntakeAction } from "@/app/(app)/intakes/actions"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await createIntakeAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    if (result?.id) {
      return NextResponse.json({ success: true, id: result.id })
    }
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}