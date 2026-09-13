import { redirect } from "next/navigation"
import { getAppData } from "@/app/(app)/data"
import { RegisterClient } from "@/components/auth/register-client"
import { isOnboardingPending } from "@/lib/validations/onboarding"

export default async function OnboardingPage() {
  const { user, workshop } = await getAppData()
  if (user.role !== "owner" || user.impersonatorAdminId || !isOnboardingPending(workshop?.onboardingProfile)) {
    redirect("/dashboard")
  }
  return <RegisterClient mode="onboarding" />
}
