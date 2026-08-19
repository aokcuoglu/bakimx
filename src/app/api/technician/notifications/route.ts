import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { apiErrorResponse } from "@/lib/api-errors"
import { getTechnicianNotifications } from "@/lib/technician/notifications"

/**
 * Teknisyen paneli bildirim yoklama ucu (BAK-109, Faz A).
 *
 * `?since=<ISO>` — o zamandan sonraki, bu kullanıcıya ait teknisyene atanmış iş
 * emirlerindeki kararları döner. `since` yoksa/parse edilemiyorsa son 5 dakika
 * baz alınır — istemci ilk mount'ta kendi cursor'ını "şimdi" olarak başlatır,
 * bu yalnız savunma sınırıdır.
 *
 * Tenant izolasyonu ve "kendi işlemim bana bildirim üretmesin" filtresi
 * `getTechnicianNotifications` içinde (workshopId + actorUserId != user.id).
 */
export const dynamic = "force-dynamic"

const FALLBACK_LOOKBACK_MS = 5 * 60 * 1000

export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const sinceParam = new URL(request.url).searchParams.get("since")
    const parsed = sinceParam ? new Date(sinceParam) : null
    const since = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(Date.now() - FALLBACK_LOOKBACK_MS)

    const notifications = await getTechnicianNotifications({
      workshopId: user.workshopId,
      userId: user.id,
      technicianId: user.technicianId,
      since,
    })

    return NextResponse.json(
      { notifications, serverTime: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  } catch (err) {
    return apiErrorResponse(err)
  }
}
