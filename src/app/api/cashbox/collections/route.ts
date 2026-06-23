import { createCollectionAction } from "@/app/(app)/cashbox/actions"
import { requireAuth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    await requireAuth()
    const formData = await request.formData()
    const result = await createCollectionAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, id: result?.id })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}