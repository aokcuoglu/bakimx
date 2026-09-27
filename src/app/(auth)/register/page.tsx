import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isLiteRegistrationOpen } from "@/lib/lite-campaign"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RegisterClient } from "@/components/auth/register-client"
import { isAuthenticated } from "@/lib/auth"
import { isSalePlanTier, type SalePlanTier } from "@/lib/plan"
import { parseReferralCodeQuery } from "@/lib/referral-code"

export const metadata: Metadata = {
  title: "Ücretsiz Hesap Oluştur",
  description: "BakimX hesabınızı oluşturun. Lite kampanyasında süresiz ücretsiz kullanım; ücretli paketlerde 7 iş günlük deneme.",
}

export const dynamic = "force-dynamic"

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string | string[]; cycle?: string | string[]; ref?: string | string[] }>
}) {
  if (await isAuthenticated()) {
    redirect("/dashboard")
  }

  const sp = await searchParams
  const preferredTier: SalePlanTier | undefined = isSalePlanTier(sp.tier) ? sp.tier : undefined
  const preferredCycle = sp.cycle === "yearly" ? "yearly" as const : sp.cycle === "monthly" ? "monthly" as const : undefined
  const referralCode = parseReferralCodeQuery(sp.ref)

  if (preferredTier === "lite" && !isLiteRegistrationOpen()) {
    return <main className="mx-auto max-w-xl p-6"><Alert><AlertTitle>Yeni Lite kayıtları kapalı</AlertTitle><AlertDescription>Mevcut Lite üyelerinin ücretsiz kullanımı devam ediyor. Kayıt sırasında başka bir paket otomatik seçilmez.</AlertDescription></Alert></main>
  }

  return (
    <RegisterClient
      referralCode={referralCode}
      preferredPlan={
        preferredTier
          ? { tier: preferredTier, cycle: preferredCycle ?? "monthly" }
          : undefined
      }
    />
  )
}
