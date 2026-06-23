import { NextResponse } from "next/server"
import { getWorkshopSettings } from "@/app/(app)/settings/actions"

export async function GET() {
  try {
    const data = await getWorkshopSettings()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Yetkilendirme gerekli" }, { status: 401 })
  }
}