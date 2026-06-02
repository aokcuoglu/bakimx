import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import Link from "next/link"
import { QuoteCreateForm } from "@/components/app/quote-create-form"

export default async function NewQuotePage() {
  const { workshop } = await getAppData()

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Teklif">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/app/quotes" className="hover:text-slate-700">Teklifler</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Yeni</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Yeni Teklif</h2>

        <QuoteCreateForm />
      </div>
    </AppShell>
  )
}
