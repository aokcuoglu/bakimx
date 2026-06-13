import { requireAuth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { customerPreferencesSchema } from "@/lib/validation"
import { AuditLogAction } from "@/lib/audit"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { customerId, ...prefs } = body

    if (!customerId) {
      return NextResponse.json({ error: "Müşteri ID gerekli" }, { status: 400 })
    }

    const parsed = customerPreferencesSchema.safeParse(prefs)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }, { status: 400 })
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, workshopId: user.workshopId },
    })

    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 })
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        smsConsent: parsed.data.smsConsent,
        whatsappConsent: parsed.data.whatsappConsent,
        emailConsent: parsed.data.emailConsent,
        kvkkApprovedAt: parsed.data.smsConsent || parsed.data.whatsappConsent || parsed.data.emailConsent
          ? new Date()
          : customer.kvkkApprovedAt,
      },
    })

    await AuditLogAction(user.workshopId, user.id, "Customer", customerId, "communication_preferences_updated", JSON.stringify(parsed.data))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })
    }
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}