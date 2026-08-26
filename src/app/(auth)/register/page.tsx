import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { RegisterClient } from "@/components/auth/register-client"
import { isAuthenticated } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const metadata: Metadata = {
  title: "Ücretsiz Dene",
  description: "BakimX iş yeri hesabınızı oluşturun — kart doğrulamasının ardından 7 gün ücretsiz deneme.",
}

export const dynamic = "force-dynamic"

export default async function RegisterPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard")
  }

  const advisors = await prisma.salesAdvisor.findMany({ where: { disabledAt: null }, include: { user: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: "asc" } })
  return <RegisterClient advisors={advisors.map((a) => ({ id: a.id, label: [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") || a.user.email || "—" }))} />
}
