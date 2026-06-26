import { getAdvisorProvider } from "@/lib/advisor"
import { AuditLogAction } from "@/lib/audit"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { type PlanTier } from "@/lib/plan"
import { resolveFeature } from "@/lib/features"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { user, workshop } = await getCurrentUserWithWorkshop()

  if (!(await resolveFeature(workshop.id, workshop.planTier as PlanTier, "aiAdvisor"))) {
    return NextResponse.json(
      {
        error:
          "AI Servis Danışmanı yalnızca Premium pakette kullanılabilir. Yükseltmek için Paketler sayfasını ziyaret edin.",
        code: "feature_locked",
      },
      { status: 403 }
    )
  }

  let body: { complaint?: string; vehicleBrand?: string; vehicleModel?: string; mileage?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 })
  }

  if (!body.complaint || typeof body.complaint !== "string") {
    return NextResponse.json({ error: "Müşteri şikayeti zorunludur" }, { status: 400 })
  }

  const advisorInput = {
    customerComplaint: body.complaint,
    vehicleBrand: body.vehicleBrand || "",
    vehicleModel: body.vehicleModel || "",
    mileage: body.mileage ?? null,
    previousWorkOrders: [],
  }

  try {
    const provider = await getAdvisorProvider()
    const result = await provider.suggest(advisorInput)

    await AuditLogAction(user.workshopId, user.id, "ServiceAdvisor", "standalone", "ai_advisor_requested", JSON.stringify({ provider: result.provider }))

    const { rawResponse, ...safeResult } = result

    if (process.env.NODE_ENV !== "production" && rawResponse) {
      console.log(`[AI Advisor] workshopId=${user.workshopId} provider=${result.provider} rawResponse length=${rawResponse.length}`)
    }

    return NextResponse.json({ success: true, result: safeResult })
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI danışman hatası"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}