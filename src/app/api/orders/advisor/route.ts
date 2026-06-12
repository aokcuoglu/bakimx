import { getAdvisorProvider } from "@/lib/advisor"
import { AuditLogAction } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  let body: { intakeFormId?: string; complaint?: string; vehicleBrand?: string; vehicleModel?: string; mileage?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 })
  }

  const intakeFormId = body.intakeFormId
  if (!intakeFormId || typeof intakeFormId !== "string") {
    return NextResponse.json({ error: "intakeFormId zorunludur" }, { status: 400 })
  }

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
    include: {
      customer: true,
      vehicle: true,
      order: { include: { items: true } },
    },
  })

  if (!intake) {
    return NextResponse.json({ error: "Kabul formu bulunamadı" }, { status: 404 })
  }

  const previousOrders = await prisma.serviceOrder.findMany({
    where: {
      workshopId: user.workshopId,
      intakeForm: {
        vehicleId: intake.vehicleId,
      },
      NOT: { id: intake.order?.id || "" },
    },
    include: {
      intakeForm: { select: { customerComplaint: true } },
      items: { select: { type: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  const advisorInput = {
    customerComplaint: body.complaint || intake.customerComplaint || "",
    vehicleBrand: body.vehicleBrand || intake.vehicle.brand || "",
    vehicleModel: body.vehicleModel || intake.vehicle.model || "",
    mileage: body.mileage ?? intake.mileageAtIntake ?? intake.vehicle.mileage ?? null,
    previousWorkOrders: previousOrders.map((o) => ({
      workOrderNo: o.workOrderNo,
      createdAt: o.createdAt.toISOString(),
      customerComplaint: o.intakeForm.customerComplaint || "",
      items: o.items.map((i) => ({ type: i.type, name: i.name })),
    })),
  }

  try {
    const provider = await getAdvisorProvider()
    const result = await provider.suggest(advisorInput)

    await AuditLogAction(user.workshopId, user.id, "ServiceOrder", intakeFormId, "ai_advisor_requested", JSON.stringify({ provider: result.provider }))

    const { rawResponse, ...safeResult } = result

    if (process.env.NODE_ENV !== "production" && rawResponse) {
      console.log(`[AI Advisor] workshopId=${user.workshopId} provider=${result.provider} rawResponse length=${rawResponse.length}`)
    }

    return NextResponse.json({
      success: true,
      result: safeResult,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI danışman hatası"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}