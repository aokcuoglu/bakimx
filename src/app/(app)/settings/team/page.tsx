import { redirect } from "next/navigation"
import { getFeaturePaywall } from "@/lib/feature-page-access"

export default async function TeamSettingsGatePage() {
  const paywall = await getFeaturePaywall("team")
  if (paywall) return paywall
  redirect("/settings?tab=team")
}
