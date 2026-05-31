"use server"

import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"

export async function getAppData() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
  })

  return { user, workshop }
}