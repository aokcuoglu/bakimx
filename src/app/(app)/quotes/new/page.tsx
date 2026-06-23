import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import Link from "next/link"
import { QuoteCreateForm } from "@/components/app/quote-create-form"

export default async function NewQuotePage() {
  const { workshop } = await getAppData()

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

        <QuoteCreateForm />
      </div>
    </AppShell>
  )
}
