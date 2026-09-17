import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { apiErrorResponse } from "@/lib/api-errors"
import { activateWorkshopForUser, findActiveMembership } from "@/lib/membership"
import { establishSession } from "@/lib/session"
import { switchBranchSchema } from "@/lib/validations/branch"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    if (user.impersonatorAdminId) {
      return NextResponse.json(
        { error: "Taklit modunda şube değiştirilemez." },
        { status: 403 },
      )
    }

    const raw: unknown = await request.json()
    const parsed = switchBranchSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
    }

    const { workshopId } = parsed.data
    if (workshopId === user.workshopId) {
      return NextResponse.json({ workshopId, role: user.role })
    }

    const membership = await findActiveMembership(user.id, workshopId)
    if (!membership || membership.workshop.kind !== "customer") {
      return NextResponse.json(
        { error: "Bu şubeye erişiminiz yok." },
        { status: 403 },
      )
    }
    if (membership.workshop.approvalStatus === "rejected") {
      return NextResponse.json(
        { error: "Bu şube askıya alınmış." },
        { status: 403 },
      )
    }

    await activateWorkshopForUser({
      userId: user.id,
      workshopId,
      role: membership.role,
    })
    await establishSession(user.id, workshopId, membership.role)

    return NextResponse.json({
      workshopId,
      role: membership.role,
      name: membership.workshop.name,
    })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
