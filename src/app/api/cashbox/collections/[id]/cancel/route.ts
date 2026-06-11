import { cancelCollectionAction } from "@/app/app/cashbox/actions"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await cancelCollectionAction(id)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (_error) {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}