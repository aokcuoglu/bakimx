import { getIntakeAction } from "@/app/app/intakes/actions"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const intake = await getIntakeAction(id)
    if (!intake) {
      return NextResponse.json({ error: "Kabul formu bulunamadı" }, { status: 404 })
    }
    return NextResponse.json(intake)
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}