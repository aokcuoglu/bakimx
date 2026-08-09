"use server"

import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import {
  LOGOUT_REASON_PARAM,
  SESSION_INACTIVE_REASON,
  SESSION_INVALID_REASON,
} from "@/lib/session-recovery"

export async function getAppData() {
  const user = await getCurrentUser()
  // Düz `/login` yönlendirmesi burada SONSUZ DÖNGÜ yapar: oturum çerezi hâlâ
  // geçerli imzalı olduğu için middleware bizi /dashboard'a geri yollar.
  // `reason` middleware'e çerezi imha etmesini söyler (bkz. lib/session-recovery.ts).
  if (!user) redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
  // Deactivated seats lose page access immediately (mirrors requireAuth).
  if (!user.isActive) redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INACTIVE_REASON}`)

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
  })

  return { user, workshop }
}