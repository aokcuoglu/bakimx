"use client"

import { useCallback, useState } from "react"
import { RegisterFooter } from "./register-footer"
import { Header } from "@/components/sections/Header"
import { RegisterForm } from "@/components/auth/register-form"
import type { SalesRegistrationPrefill } from "@/components/auth/register-form"
import styles from "./register-design.module.css"
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
  mode = "register",
}: {
  mode?: "register" | "onboarding"
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

  if (mode === "onboarding") {
    return (
      <main className="mx-auto w-full max-w-5xl rounded-lg border border-border bg-card p-5 sm:p-10">
        <RegisterForm mode="onboarding" />
      </main>
    )
  }

  return (
    <div className={styles.viewport}>
      <Header />

      <div className={styles.layout}>
        <RegisterSidebar snapshot={snapshot} preferredPlan={preferredPlan} mode={mode} />
        <main aria-label="Hesap kayıt formu" className="no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 sm:px-10 sm:py-12 lg:px-14 xl:px-20">
          <div className="w-full max-w-2xl">
            <RegisterForm
              mode={mode}
              salesRegistration={salesRegistration}
              preferredPlan={preferredPlan}
              onSnapshotChange={handleSnapshotChange}
            />
          </div>
        </main>
      </div>
      <RegisterFooter className="px-5 py-4 sm:px-8" />
    </div>
  )
}
