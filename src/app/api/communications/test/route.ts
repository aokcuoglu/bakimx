import { requireAuth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { sendProviderTestAction } from "@/app/(app)/settings/notifications/actions"

export async function POST(request: Request) {
  try {
    await requireAuth()
    const formData = await request.formData()
    const result = await sendProviderTestAction(formData)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Yetkilendirme hatası" }, { status: 401 })
  }
}
