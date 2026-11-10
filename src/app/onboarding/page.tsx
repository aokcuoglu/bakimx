import { redirect } from "next/navigation"
import { FIRST_ONBOARDING_PATH } from "@/lib/onboarding-steps"

export default function OnboardingIndex() {
  redirect(FIRST_ONBOARDING_PATH)
}
