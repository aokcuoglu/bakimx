import { NextResponse } from "next/server"
import { z } from "zod"
import { getSalesAccess } from "@/lib/sales/access"
import { GOOGLE_MAPS_SKUS } from "@/lib/sales/google-maps-quota"
import { reserveGoogleMapsUsage } from "@/lib/sales/google-maps-usage.server"

const requestSchema = z.object({
  sku: z.enum(GOOGLE_MAPS_SKUS),
})

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    || request.headers.get("host")
  if (!origin || !host) return false

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  await getSalesAccess()

  if (!isSameOrigin(request)) {
    return NextResponse.json({ allowed: false, reason: "invalid_origin" }, { status: 403 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ allowed: false, reason: "invalid_request" }, { status: 400 })
  }

  try {
    const reservation = await reserveGoogleMapsUsage(parsed.data.sku)
    if (!reservation.allowed) {
      return NextResponse.json(
        { ...reservation, reason: "monthly_limit_reached" },
        { status: 429 },
      )
    }
    return NextResponse.json(reservation)
  } catch (error) {
    console.error("[google-maps-cost-guard] kullanım rezervasyonu alınamadı; çağrı engellendi", error)
    return NextResponse.json(
      { allowed: false, reason: "counter_unavailable" },
      { status: 503 },
    )
  }
}

