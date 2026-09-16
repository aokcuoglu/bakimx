import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-errors"

/**
 * Marks the dashboard product tour as completed (or skipped) for the signed-in user.
 * Idempotent: already-completed rows stay unchanged.
 */
export async function POST() {
  try {
    const identity = await getCurrentUser()
    if (!identity || !identity.isActive) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 })
    }
    if (identity.impersonatorAdminId) {
      return NextResponse.json({ error: "Temsil oturumunda tur kaydedilemez." }, { status: 403 })
    }

    if (!identity.dashboardTourCompletedAt) {
      await prisma.user.update({
        where: { id: identity.id },
        data: { dashboardTourCompletedAt: new Date() },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
