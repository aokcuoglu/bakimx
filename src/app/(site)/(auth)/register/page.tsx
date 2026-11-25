import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { RegisterClient } from "@/components/auth/register-client"
import { isAuthenticated } from "@/lib/auth"
import { SERVICE_PACKAGE } from "@/lib/plans-catalog"
import { parseReferralCodeQuery } from "@/lib/referral-code"

export const metadata: Metadata = {
  title: "Ücretsiz Hesap Oluştur",
  description: "BakımX hesabınızı oluşturun. Servis Paketi'ni kart bilgisi olmadan 7 iş günü ücretsiz deneyin.",
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
  // Satışta tek paket var (#782): fiyat sayfasından `?tier=` ile gelindiyse
  // (eski `lite`/`premium` bağlantıları dahil) ilgilenilen paket Servis Paketi'dir.
  const preferredTier = sp.tier ? SERVICE_PACKAGE.tier : undefined
  const preferredCycle = sp.cycle === "yearly" ? "yearly" as const : sp.cycle === "monthly" ? "monthly" as const : undefined
  const referralCode = parseReferralCodeQuery(sp.ref)

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
