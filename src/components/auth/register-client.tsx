"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RegisterForm } from "@/components/auth/register-form"
import type { SalesRegistrationPrefill } from "@/components/auth/register-form"
import { RegisterSidebar } from "@/components/auth/register-sidebar"
import type { RegisterWizardSnapshot } from "@/lib/register-onboarding"
import type { SalePlanTier } from "@/lib/plan"

type PreferredPlan = {
  tier: SalePlanTier
  cycle: "monthly" | "yearly"
}

const INITIAL_SNAPSHOT: RegisterWizardSnapshot = {
  currentStep: 0,
  sector: "",
  businessFeatureCount: 0,
  teamSize: "",
  moduleCount: 0,
}

export function RegisterClient({
  salesRegistration,
  preferredPlan,
}: {
  salesRegistration?: SalesRegistrationPrefill
  preferredPlan?: PreferredPlan
}) {
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT)

  const handleSnapshotChange = useCallback((next: RegisterWizardSnapshot) => {
    setSnapshot((current) => {
      if (
        current.currentStep === next.currentStep &&
        current.sector === next.sector &&
        current.businessFeatureCount === next.businessFeatureCount &&
        current.teamSize === next.teamSize &&
        current.moduleCount === next.moduleCount
      ) return current
      return next
    })
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-3 sm:px-5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/">
            <ArrowLeft data-icon="inline-start" />
            Ana Sayfa
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Zaten üye misiniz?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Giriş Yap
          </Link>
        </p>
      </header>

      <div className="flex flex-1 lg:min-h-[calc(100vh-3.5rem)]">
        <RegisterSidebar snapshot={snapshot} preferredPlan={preferredPlan} />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:px-12">
          <div className="mx-auto w-full max-w-4xl">
            <RegisterForm
              salesRegistration={salesRegistration}
              preferredPlan={preferredPlan}
              onSnapshotChange={handleSnapshotChange}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
