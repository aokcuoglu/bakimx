import { requireAuth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { getCommunicationLogs, getCommunicationStats } from "@/app/app/communications/actions"

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(request.url)

    const type = searchParams.get("type") || undefined
    const status = searchParams.get("status") || undefined
    const search = searchParams.get("search") || undefined

    const [logs, stats] = await Promise.all([
      getCommunicationLogs(user.workshopId, { type, status, search }),
      getCommunicationStats(user.workshopId),
    ])

    return NextResponse.json({ logs, stats })
  } catch {
    return NextResponse.json({ error: "Yetkilendirme hatası" }, { status: 401 })
  }
}