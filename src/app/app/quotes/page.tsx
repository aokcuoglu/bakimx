import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { QuoteList } from "@/components/app/quote-list"
import { getQuotesAction, getQuoteCountsByStatus } from "./actions"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

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
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/app" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Teklifler</span>
          <span className="mx-2">/</span>
          <span className="text-muted-foreground">Tümü</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Teklifler</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{quotes.length} teklif</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              nativeButton={false}
              size="default"
              className="hidden sm:inline-flex"
              render={<Link href="/app/quotes/new" />}
            >
              <Plus className="size-4" />
              Yeni Teklif
            </Button>
            <Button
              nativeButton={false}
              size="icon"
              className="sm:hidden"
              render={<Link href="/app/quotes/new" />}
              aria-label="Yeni teklif"
            >
              <Plus className="size-5" />
            </Button>
          </div>
        </div>

        <form method="GET" action="/app/quotes" className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Teklif no, müşteri, plaka ile ara..."
            className="pl-9"
          />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
        </form>

        {quotes.length === 0 && !q ? (
          <div className="text-center py-16">
            <div className="size-16 mx-auto mb-4 rounded-lg bg-muted flex items-center justify-center">
              <Plus className="size-8 text-muted-foreground/70" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Henüz teklif yok</h3>
            <p className="text-sm text-muted-foreground mb-4">İlk teklifinizi oluşturmaya başlayın.</p>
            <Button
              nativeButton={false}
              size="default"
              render={<Link href="/app/quotes/new" />}
            >
              <Plus className="size-4" />
              Yeni Teklif Oluştur
            </Button>
          </div>
        ) : quotes.length === 0 && q ? (
          <div className="text-center py-16">
            <Search className="size-10 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="text-sm font-medium text-foreground">Sonuç bulunamadı</h3>
            <p className="text-xs text-muted-foreground mt-1">Farklı bir arama terimi deneyin.</p>
          </div>
        ) : (
          <QuoteList quotes={quotes} counts={counts} activeStatus={status} search={q} />
        )}
      </div>
    </AppShell>
  )
}
