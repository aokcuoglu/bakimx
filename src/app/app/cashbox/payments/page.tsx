import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { getCollections } from "@/lib/cashbox/queries"
import { PaymentMethodBadge, CollectionStatusBadge } from "@/components/app/status-badge"
import { formatTRY } from "@/lib/format"
import { formatDate } from "@/lib/utils-client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PrintButton } from "@/components/app/print-button"
import { FilterSelect } from "@/components/app/filter-select"
import { Plus, Search, Filter, Wallet, Eye, Download } from "lucide-react"
import { Input } from "@/components/ui/input"

type SP = { q?: string; method?: string; status?: string; period?: string; dateFrom?: string; dateTo?: string }

const DATE_PRESETS = [
  { value: "", label: "Tüm Dönem" },
  { value: "today", label: "Bugün" },
  { value: "yesterday", label: "Dün" },
  { value: "this_week", label: "Bu Hafta" },
  { value: "last_week", label: "Geçen Hafta" },
  { value: "this_month", label: "Bu Ay" },
  { value: "last_month", label: "Geçen Ay" },
  { value: "last_30", label: "Son 30 Gün" },
  { value: "last_90", label: "Son 90 Gün" },
  { value: "custom", label: "Özel" },
]

function getDateRange(period: string, dateFromStr?: string, dateToStr?: string): { dateFrom?: Date; dateTo?: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

  switch (period) {
    case "today":
      return { dateFrom: today }
    case "yesterday": {
      const yesterday = new Date(today.getTime() - 86400000)
      return { dateFrom: yesterday, dateTo: today }
    }
    case "this_week": {
      const day = now.getDay() || 7
      return { dateFrom: new Date(today.getTime() - (day - 1) * 86400000) }
    }
    case "last_week": {
      const day = now.getDay() || 7
      const endOfLastWeek = new Date(today.getTime() - day * 86400000)
      const startOfLastWeek = new Date(endOfLastWeek.getTime() - 6 * 86400000)
      return { dateFrom: startOfLastWeek, dateTo: endOfLastWeek }
    }
    case "this_month":
      return { dateFrom: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0) }
    case "last_month": {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      return { dateFrom: startOfLastMonth, dateTo: endOfLastMonth }
    }
    case "last_30":
      return { dateFrom: new Date(today.getTime() - 29 * 86400000) }
    case "last_90":
      return { dateFrom: new Date(today.getTime() - 89 * 86400000) }
    case "custom": {
      const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined
      const dateTo = dateToStr ? new Date(dateToStr) : undefined
      return { dateFrom, dateTo }
    }
    default:
      return {}
  }
}

export default async function PaymentsListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const q = (params.q || "").trim()
  const method = params.method || ""
  const status = params.status || ""
  const period = params.period || ""

  const { dateFrom, dateTo } = getDateRange(period, params.dateFrom, params.dateTo)

  const { rows: collections, total } = await getCollections(user.workshopId, {
    q: q || undefined,
    method: method || undefined,
    status: status || undefined,
    dateFrom,
    dateTo,
    limit: 200,
  })

  const exportParams = new URLSearchParams()
  if (method) exportParams.set("method", method)
  if (status) exportParams.set("status", status)
  if (dateFrom) exportParams.set("dateFrom", dateFrom.toISOString().slice(0, 10))
  if (dateTo) exportParams.set("dateTo", dateTo.toISOString().slice(0, 10))

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Tahsilatlar">
      <div className="space-y-5 sm:space-y-6 max-w-full">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/app" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/app/cashbox" className="hover:text-foreground">Kasa</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Tahsilatlar</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Tahsilatlar</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{total} kayıt bulundu</p>
          </div>
          <div className="flex gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              className="print:hidden"
              render={<a href={`/api/cashbox/export?type=collections&${exportParams.toString()}`} download />}
            >
              <Download className="size-4" />
              CSV
            </Button>
            <PrintButton className="print:hidden" />
            <Button nativeButton={false} size="default" render={<Link href="/app/cashbox/payments/new" />}>
              <Plus className="size-4" />
              Yeni Tahsilat
            </Button>
          </div>
        </div>

        <form action="/app/cashbox/payments" method="get" className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Müşteri, telefon, iş emri no, referans ara…"
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              name="method"
              defaultValue={method}
              placeholder="Tüm Yöntemler"
              options={[
                { value: "", label: "Tüm Yöntemler" },
                { value: "cash", label: "Nakit" },
                { value: "credit_card", label: "Kredi Kartı" },
                { value: "bank_transfer", label: "Havale/EFT" },
                { value: "other", label: "Diğer" },
              ]}
            />
            <FilterSelect
              name="status"
              defaultValue={status}
              placeholder="Tüm Durumlar"
              options={[
                { value: "", label: "Tüm Durumlar" },
                { value: "completed", label: "Tamamlandı" },
                { value: "cancelled", label: "İptal" },
              ]}
            />
            <FilterSelect
              name="period"
              defaultValue={period}
              placeholder="Tüm Dönem"
              options={DATE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
            />
            {period === "custom" && (
              <>
                <Input
                  name="dateFrom"
                  type="date"
                  defaultValue={params.dateFrom || ""}
                />
                <Input
                  name="dateTo"
                  type="date"
                  defaultValue={params.dateTo || ""}
                />
              </>
            )}
            <Button variant="outline" size="default" type="submit">
              <Filter className="size-4" />
              <span className="hidden sm:inline">Filtrele</span>
            </Button>
          </div>
        </form>

        {collections.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card border border-dashed border-border rounded-lg">
            <Wallet className="size-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">Tahsilat kaydı bulunamadı</p>
            <p className="text-xs mt-1">Farklı filtreler deneyin veya yeni tahsilat ekleyin</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Tarih</th>
                      <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
                      <th className="px-4 py-3 text-left font-semibold">İş Emri</th>
                      <th className="px-4 py-3 text-right font-semibold">Tutar</th>
                      <th className="px-4 py-3 text-left font-semibold">Yöntem</th>
                      <th className="px-4 py-3 text-left font-semibold">Referans</th>
                      <th className="px-4 py-3 text-left font-semibold">Durum</th>
                      <th className="px-4 py-3 text-right font-semibold">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {collections.map((c) => {
                      const nameFor = () =>
                        c.customer.type === "corporate"
                          ? c.customer.companyName || "—"
                          : c.customer.fullName || `${c.customer.firstName ?? ""} ${c.customer.lastName ?? ""}`.trim() || "—"
                      return (
                        <tr key={c.id} className="hover:bg-muted/60 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.paymentDate)}</td>
                          <td className="px-4 py-3">
                            <Link href={`/app/customers/${c.customer.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                              {nameFor()}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {c.serviceOrder ? (
                              <Link href={`/app/orders/${c.serviceOrder.id}`} className="text-xs font-mono text-primary hover:text-primary/80">
                                {c.serviceOrder.workOrderNo || "—"}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground/70 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">{formatTRY(c.amount)}</td>
                          <td className="px-4 py-3"><PaymentMethodBadge method={c.method} /></td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{c.referenceNo || "—"}</td>
                          <td className="px-4 py-3"><CollectionStatusBadge status={c.status} /></td>
                          <td className="px-4 py-3 text-right">
                            <Button nativeButton={false} variant="link" size="sm" render={<Link href={`/app/cashbox/payments/${c.id}`} />}>
                              <Eye className="size-3.5" />
                              Görüntüle
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:hidden space-y-2.5">
              {collections.map((c) => {
                const nameFor = () =>
                  c.customer.type === "corporate"
                    ? c.customer.companyName || "—"
                    : c.customer.fullName || `${c.customer.firstName ?? ""} ${c.customer.lastName ?? ""}`.trim() || "—"
                return (
                  <Link
                    key={c.id}
                    href={`/app/cashbox/payments/${c.id}`}
                    className="block rounded-lg border border-border bg-card p-3.5 active:bg-muted touch-manipulation hover:border-border transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{nameFor()}</span>
                          <PaymentMethodBadge method={c.method} />
                          <CollectionStatusBadge status={c.status} />
                        </div>
                        {c.serviceOrder && (
                          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{c.serviceOrder.workOrderNo} &bull; {c.serviceOrder.vehicle.plate}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(c.paymentDate)}{c.referenceNo ? ` &bull; Ref: ${c.referenceNo}` : ""}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-foreground">{formatTRY(c.amount)}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}