import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { QuoteList } from "@/components/app/quote-list"
import { getQuotesAction, getQuoteCountsByStatus } from "./actions"

type SP = { q?: string; status?: string }

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { workshop } = await getAppData()
  const params = await searchParams
  const q = (params.q || "").trim()
  const status = params.status || "all"

  const [quotes, counts] = await Promise.all([
    getQuotesAction(q || undefined, status !== "all" ? status : undefined),
    getQuoteCountsByStatus(),
  ])

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Teklifler">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Teklifler</span>
          <span className="mx-2">/</span>
          <span className="text-slate-500">Tümü</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Teklifler</h2>
            <p className="text-sm text-slate-500 mt-0.5">{quotes.length} teklif</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/quotes/new"
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors touch-manipulation"
            >
              <Plus className="size-4" />
              Yeni Teklif
            </Link>
            <Link
              href="/app/quotes/new"
              className="sm:hidden inline-flex items-center justify-center size-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white touch-manipulation"
              aria-label="Yeni teklif"
            >
              <Plus className="size-5" />
            </Link>
          </div>
        </div>

        <form method="GET" action="/app/quotes" className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Teklif no, müşteri, plaka ile ara..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
          />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
        </form>

        {quotes.length === 0 && !q ? (
          <div className="text-center py-16">
            <div className="size-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Plus className="size-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Henüz teklif yok</h3>
            <p className="text-sm text-slate-500 mb-4">İlk teklifinizi oluşturmaya başlayın.</p>
            <Link
              href="/app/quotes/new"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors touch-manipulation"
            >
              <Plus className="size-4" />
              Yeni Teklif Oluştur
            </Link>
          </div>
        ) : quotes.length === 0 && q ? (
          <div className="text-center py-16">
            <Search className="size-10 mx-auto mb-3 text-slate-300" />
            <h3 className="text-sm font-medium text-slate-700">Sonuç bulunamadı</h3>
            <p className="text-xs text-slate-500 mt-1">Farklı bir arama terimi deneyin.</p>
          </div>
        ) : (
          <QuoteList quotes={quotes} counts={counts} activeStatus={status} search={q} />
        )}
      </div>
    </AppShell>
  )
}
