import { NextResponse } from "next/server"
import { getCurrentUser, PasswordChangeRequiredError, requireWritableWorkshop } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-errors"
import { PlanWriteLockedError } from "@/lib/plan"
import { onboardingSchema } from "@/lib/validations/onboarding"

export async function POST(request: Request) {
  try {
    const identity = await getCurrentUser()
    if (!identity || !identity.isActive) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 })
    }
    if (identity.role !== "owner" || identity.impersonatorAdminId) {
      return NextResponse.json({ error: "Kurulumu yalnız iş yeri sahibi tamamlayabilir." }, { status: 403 })
    }
    const { user } = await requireWritableWorkshop("settings.manage")
    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ error: "Geçersiz kurulum bilgileri." }, { status: 400 })
    }
    const parsed = onboardingSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: "Lütfen kurulum adımlarındaki seçimlerinizi kontrol edin." }, { status: 400 })
    }
    // This endpoint records preferences only; it cannot change plans, roles or module access.
    // The conditional update also prevents an old tab from replacing a completed profile.
    const result = await prisma.workshop.updateMany({
      where: { id: user.workshopId, onboardingProfile: { path: ["status"], equals: "pending" } },
      data: { onboardingProfile: { status: "completed", ...parsed.data } },
    })
    if (result.count !== 1) {
      return NextResponse.json({ error: "Kurulum zaten tamamlanmış. Panele dönebilirsiniz." }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof PlanWriteLockedError || error instanceof PasswordChangeRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return apiErrorResponse(error)
  }
}
