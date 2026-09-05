import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import Link from "next/link"
import { QuoteCreateForm } from "@/components/quotes/quote-create-form"
import { getLaborCatalog } from "@/lib/labor/queries"

export default async function NewQuotePage() {
  const paywall = await getFeaturePaywall("quotes")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const laborCatalog = await getLaborCatalog(user.workshopId, { activeOnly: true })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Teklif">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/quotes" className="hover:text-foreground">Teklifler</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Yeni</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Yeni Teklif</h2>

        <QuoteCreateForm laborCatalog={laborCatalog} />
      </div>
    </AppShell>
  )
}
