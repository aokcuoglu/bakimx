import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { getCollections } from "@/lib/cashbox/queries"
import { PaymentMethodBadge, CollectionStatusBadge } from "@/components/app/status-badge"
import { formatTRY } from "@/lib/format"
import { formatDate } from "@/lib/utils-client"
import Link from "next/link"
import { Plus, Search, Filter, Wallet, Eye } from "lucide-react"

type SP = { q?: string; method?: string; status?: string; period?: string }

export default async function PaymentsListPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const q = (params.q || "").trim()
  const method = params.method || ""
  const status = params.status || ""
  const period = params.period || ""

  const now = new Date()
  let dateFrom: Date | undefined
  let dateTo: Date | undefined

  if (period === "today") {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  } else if (period === "week") {
    const day = now.getDay() || 7
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0, 0)
  } else if (period === "month") {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  }

  const { rows: collections, total } = await getCollections(user.workshopId, {
    q: q || undefined,
    method: method || undefined,
    status: status || undefined,
    dateFrom,
    dateTo,
    limit: 200,
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Tahsilatlar">
      <div className="space-y-5 sm:space-y-6 max-w-full">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/app/cashbox" className="hover:text-slate-700">Kasa</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Tahsilatlar</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Tahsilatlar</h2>
            <p className="text-sm text-slate-500 mt-0.5">{total} kayıt bulundu</p>
          </div>
          <Link
            href="/app/cashbox/payments/new"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors touch-manipulation"
          >
            <Plus className="size-4" />
            Yeni Tahsilat
          </Link>
        </div>

        <form action="/app/cashbox/payments" method="get" className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Müşteri, telefon, iş emri no, referans ara…"
              className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <select
              name="method"
              defaultValue={method}
              className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value="">Tüm Yöntemler</option>
              <option value="cash">Nakit</option>
              <option value="credit_card">Kredi Kartı</option>
              <option value="bank_transfer">Havale/EFT</option>
              <option value="other">Diğer</option>
            </select>
            <select
              name="status"
              defaultValue={status}
              className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value="">Tüm Durumlar</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal</option>
            </select>
            <select
              name="period"
              defaultValue={period}
              className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value="">Tüm Dönem</option>
              <option value="today">Bugün</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors touch-manipulation"
            >
              <Filter className="size-4" />
              Filtrele
            </button>
          </div>
        </form>

        {collections.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-white border border-dashed border-slate-200 rounded-xl">
            <Wallet className="size-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">Tahsilat kaydı bulunamadı</p>
            <p className="text-xs mt-1">Farklı filtreler deneyin veya yeni tahsilat ekleyin</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
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
                  <tbody className="divide-y divide-slate-100">
                    {collections.map((c) => {
                      const nameFor = () =>
                        c.customer.type === "corporate"
                          ? c.customer.companyName || "—"
                          : c.customer.fullName || `${c.customer.firstName ?? ""} ${c.customer.lastName ?? ""}`.trim() || "—"
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(c.paymentDate)}</td>
                          <td className="px-4 py-3">
                            <Link href={`/app/customers/${c.customer.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-600">
                              {nameFor()}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {c.serviceOrder ? (
                              <Link href={`/app/orders/${c.serviceOrder.id}`} className="text-xs font-mono text-blue-600 hover:text-blue-700">
                                {c.serviceOrder.workOrderNo || "—"}
                              </Link>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatTRY(c.amount)}</td>
                          <td className="px-4 py-3"><PaymentMethodBadge method={c.method} /></td>
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">{c.referenceNo || "—"}</td>
                          <td className="px-4 py-3"><CollectionStatusBadge status={c.status} /></td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/app/cashbox/payments/${c.id}`}
                              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors touch-manipulation"
                            >
                              <Eye className="size-3.5" />
                              Görüntüle
                            </Link>
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
                    className="block rounded-xl border border-slate-200 bg-white p-3.5 active:bg-slate-50 touch-manipulation hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">{nameFor()}</span>
                          <PaymentMethodBadge method={c.method} />
                          <CollectionStatusBadge status={c.status} />
                        </div>
                        {c.serviceOrder && (
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">{c.serviceOrder.workOrderNo} &bull; {c.serviceOrder.vehicle.plate}</p>
                        )}
                        <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(c.paymentDate)}{c.referenceNo ? ` &bull; Ref: ${c.referenceNo}` : ""}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-900">{formatTRY(c.amount)}</p>
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