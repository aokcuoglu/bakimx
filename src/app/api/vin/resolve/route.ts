import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { type PlanTier } from "@/lib/plan"
import { resolveFeature } from "@/lib/features"
import { rateLimit } from "@/lib/rate-limit"
import { resolveVinToCatalog } from "@/lib/vin/resolve"
import { VinLookupError, isValidVin } from "@/lib/vin/types"

const bodySchema = z.object({
  vin: z.string().min(1),
  hints: z
    .object({
      engineDisplacement: z.string().optional(),
      enginePower: z.string().optional(),
      fuelType: z.string().optional(),
      firstRegistrationDate: z.string().optional(),
      modelYear: z.number().int().optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  const { user, workshop } = await getCurrentUserWithWorkshop()

  if (!(await resolveFeature(workshop.id, workshop.planTier as PlanTier, "vinLookup"))) {
    return NextResponse.json(
      { error: "VIN'den araç tanıma bu çalışma alanında kapalı.", code: "feature_locked" },
      { status: 403 }
    )
  }

  // Cache hits are cheap, but every miss is a billed provider call — keep the
  // per-workshop window tight.
  const limit = rateLimit(`vin:${user.workshopId}`, 10, 60_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla VIN sorgusu yapıldı. Lütfen biraz bekleyip tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
    )
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 })
  }

  if (!isValidVin(body.vin)) {
    return NextResponse.json(
      { error: "Geçersiz şase numarası (VIN 17 karakter olmalı, I/O/Q harfleri içeremez)." },
      { status: 400 }
    )
  }

  try {
    const resolution = await resolveVinToCatalog(body.vin, body.hints ?? {})
    return NextResponse.json(resolution)
  } catch (err) {
    if (err instanceof VinLookupError) {
      const status =
        err.code === "invalid_vin" ? 400 : err.code === "quota_exceeded" ? 429 : err.code === "config_error" ? 500 : 502
      return NextResponse.json({ error: err.message, code: err.code }, { status })
    }
    console.error("[vin/resolve]", err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: "VIN sorgulama sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin." },
      { status: 500 }
    )
  }
}
