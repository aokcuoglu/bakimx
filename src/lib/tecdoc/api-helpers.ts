import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { type PlanTier } from "@/lib/plan"
import { resolveFeature } from "@/lib/features"
import { rateLimit } from "@/lib/rate-limit"
import { TecdocError } from "./types"

/** Shared auth + feature gate + rate limit for the /api/tecdoc/* routes. */
export async function tecdocRouteGuard(): Promise<NextResponse | { workshopId: string }> {
  const { user, workshop } = await getCurrentUserWithWorkshop()

  if (!(await resolveFeature(workshop.id, workshop.planTier as PlanTier, "partsCatalog"))) {
    return NextResponse.json(
      { error: "Parça kataloğu bu çalışma alanında kapalı.", code: "feature_locked" },
      { status: 403 }
    )
  }

  // Cache hits are cheap; misses are billed. A single drill-down fires several
  // calls, so this window is looser than the VIN route's.
  const limit = rateLimit(`tecdoc:${user.workshopId}`, 30, 60_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla katalog isteği yapıldı. Lütfen biraz bekleyip tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
    )
  }

  return { workshopId: user.workshopId }
}

export function tecdocErrorResponse(err: unknown): NextResponse {
  if (err instanceof TecdocError) {
    const status =
      err.code === "invalid_params" ? 400 : err.code === "quota_exceeded" ? 429 : err.code === "config_error" ? 500 : 502
    return NextResponse.json({ error: err.message, code: err.code }, { status })
  }
  console.error("[tecdoc]", err instanceof Error ? err.message : err)
  return NextResponse.json(
    { error: "Parça kataloğu sorgusunda beklenmeyen bir hata oluştu. Lütfen tekrar deneyin." },
    { status: 500 }
  )
}

export function parsePositiveInt(value: string | null): number | null {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}
