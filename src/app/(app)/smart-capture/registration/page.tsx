import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { SmartCaptureRegistration } from "@/components/intake/smart-capture-registration"

export const metadata = { title: "Ruhsat Okuma" }

export default async function SmartCaptureRegistrationPage() {
  const paywall = await getFeaturePaywall("ocrIntake")
  if (paywall) return paywall
  const { workshop } = await getAppData()

  return (
    <AppShell workshopName={workshop?.name} showGlobalSearch={false}>
      <div className="space-y-5 sm:space-y-6">
        <SmartCaptureRegistration />
      </div>
    </AppShell>
  )
}
