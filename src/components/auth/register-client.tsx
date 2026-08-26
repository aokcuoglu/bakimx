"use client"

import { useCallback, useState } from "react"
import { BrandRail } from "@/components/billing/brand-rail"
import { RegisterForm } from "@/components/auth/register-form"
import type { PlanTier } from "@/lib/plan"

export function RegisterClient({ advisors = [] }: { advisors?: { id: string; label: string }[] }) {
  const [tier, setTier] = useState<PlanTier>("pro")
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly")

  const handlePlanChange = useCallback((newTier: string, newCycle: string) => {
    setTier(newTier as PlanTier)
    setCycle(newCycle as "monthly" | "yearly")
  }, [])

  return (
    <div className="min-h-screen flex flex-col lg:flex-row lg:h-screen bg-muted">
      <div className="lg:w-[38%] shrink-0 lg:h-full">
        <BrandRail mode="public" tier={tier} cycle={cycle} step={0} />
      </div>
      <div className="flex-1 flex items-center lg:items-start justify-center p-6 lg:p-10 lg:overflow-y-auto">
        <div className="w-full max-w-[520px]">
          <RegisterForm onPlanChange={handlePlanChange} advisors={advisors} />
        </div>
      </div>
    </div>
  )
}
