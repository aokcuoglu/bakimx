import { createCollectionAction } from "@/app/app/cashbox/actions"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await createCollectionAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, id: result?.id })
  } catch (_error) {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}