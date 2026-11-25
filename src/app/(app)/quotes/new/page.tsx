import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { QuoteCreateForm } from "@/components/quotes/quote-create-form"
import { getLaborCatalog } from "@/lib/labor/queries"
import { resolveIntakeEntitlements } from "@/lib/intake/entitlements"

export const metadata = { title: "Yeni Teklif" }

export default async function NewQuotePage() {
  const paywall = await getFeaturePaywall("quotes")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const laborCatalog = await getLaborCatalog(user.workshopId, { activeOnly: true })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Teklif">
      <div className="space-y-5 sm:space-y-6">
        <QuoteCreateForm
          laborCatalog={laborCatalog}
          entitlements={resolveIntakeEntitlements(workshop, user.role)}
        />
      </div>
    </AppShell>
  )
}
