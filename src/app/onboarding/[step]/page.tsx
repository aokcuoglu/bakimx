import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { OnboardingPreview } from "@/components/auth/onboarding-preview"
import { ONBOARDING_STEPS } from "@/lib/onboarding-steps"

export const metadata: Metadata = { title: "Servisinizi hazırlayın" }

export default async function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params
  const index = ONBOARDING_STEPS.findIndex((item) => item.slug === step)
  if (index < 0) notFound()
  return <OnboardingPreview step={index} />
}
