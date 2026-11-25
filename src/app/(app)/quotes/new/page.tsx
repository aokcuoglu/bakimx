import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { QuoteCreateForm } from "@/components/quotes/quote-create-form"
import { getLaborCatalog } from "@/lib/labor/queries"

export const metadata = { title: "Yeni Teklif" }

export default async function NewQuotePage() {
  const paywall = await getFeaturePaywall("quotes")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const laborCatalog = await getLaborCatalog(user.workshopId, { activeOnly: true })

  return (
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-5 sm:space-y-6">
        <QuoteCreateForm laborCatalog={laborCatalog} />
      </div>
    </AppShell>
  )
}
