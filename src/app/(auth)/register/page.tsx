import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { RegisterClient } from "@/components/auth/register-client"
import { isAuthenticated } from "@/lib/auth"
import { isSalePlanTier, type SalePlanTier } from "@/lib/plan"

export const metadata: Metadata = {
  title: "Ücretsiz Dene",
  description: "BakimX oto servis hesabınızı ücretsiz oluşturun — paket veya kart seçmeden 7 iş günü deneyin.",
}

export const dynamic = "force-dynamic"

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string | string[]; cycle?: string | string[] }>
}) {
  if (await isAuthenticated()) {
    redirect("/dashboard")
  }

  const sp = await searchParams
  const preferredTier: SalePlanTier | undefined = isSalePlanTier(sp.tier) ? sp.tier : undefined
  const preferredCycle = sp.cycle === "yearly" ? "yearly" as const : sp.cycle === "monthly" ? "monthly" as const : undefined

  return (
    <RegisterClient
      preferredPlan={
        preferredTier
          ? { tier: preferredTier, cycle: preferredCycle ?? "monthly" }
          : undefined
      }
    />
  )
}
