import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { getCashboxStats, getRecentCollections, getOpenReceivables, getPaymentMethodBreakdown, getCashboxDailyCollections } from "@/lib/cashbox/queries"
import Link from "next/link"
import { formatTRY } from "@/lib/format"
import { formatDate } from "@/lib/utils-client"
import { PrintButton } from "@/components/app/print-button"
import { PaymentMethodBadge, CollectionStatusBadge } from "@/components/app/status-badge"
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  Clock,
  Plus,
  Info,
  Receipt,
  Banknote,
  CreditCard,
  Building2,
  CircleDot,
  ArrowRight,
  Download,
  BarChart3,
} from "lucide-react"

export default async function CashboxPage() {
  const { user, workshop } = await getAppData()

  const [stats, recentCollections, openReceivables, methodBreakdown, dailyCollections] = await Promise.all([
    getCashboxStats(user.workshopId),
    getRecentCollections(user.workshopId, 10),
    getOpenReceivables(user.workshopId, 20),
    getPaymentMethodBreakdown(user.workshopId),
    getCashboxDailyCollections(user.workshopId, 14),
  ])

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Kasa">
      <div className="space-y-5 sm:space-y-6 max-w-full">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Kasa</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Kasa</h2>
            <p className="text-sm text-slate-500 mt-0.5">Tahsilat ve alacak takibi</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/cashbox/aging"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors touch-manipulation"
            >
              <BarChart3 className="size-4" />
              Yaşlandırma
            </Link>
            <Link
              href="/app/cashbox/payments/new"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors touch-manipulation"
            >
              <Plus className="size-4" />
              Yeni Tahsilat
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-500 flex items-start gap-2">
          <Info className="size-3.5 mt-0.5 shrink-0" />
          <span>Bu ekran operasyonel tahsilat takibi içindir. Resmi muhasebe veya e-fatura/e-arşiv yerine geçmez.</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Bugünkü Tahsilat"
            value={formatTRY(stats.todayCollected)}
            icon={Banknote}
            accent="text-emerald-700"
            accentBg="bg-emerald-100"
          />
          <KpiCard
            label="Bu Ay Tahsilat"
            value={formatTRY(stats.monthCollected)}
            icon={TrendingUp}
            accent="text-blue-700"
            accentBg="bg-blue-100"
          />
          <KpiCard
            label="Açık Alacak"
            value={formatTRY(stats.openReceivable)}
            icon={Receipt}
            accent="text-rose-700"
            accentBg="bg-rose-100"
          />
          <KpiCard
            label="Geciken Alacak"
            value={formatTRY(stats.overdueReceivable)}
            icon={AlertTriangle}
            accent="text-red-700"
            accentBg="bg-red-100"
          />
          <KpiCard
            label="Kısmi Ödemeler"
            value={stats.partialPayments.toString()}
            icon={Clock}
            accent="text-amber-700"
            accentBg="bg-amber-100"
          />
          <KpiCard
            label="Tahsilat Adedi"
            value={stats.totalCollectionCount.toString()}
            icon={CircleDot}
            accent="text-indigo-700"
            accentBg="bg-indigo-100"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <RecentCollectionsSection collections={recentCollections} />
          </div>
          <div className="space-y-5">
            <MethodBreakdownSection breakdown={methodBreakdown} />
            <OpenReceivablesSection receivables={openReceivables.slice(0, 5)} />
          </div>
        </div>

        <DailyChartSection dailyCollections={dailyCollections} />

        <div className="flex flex-wrap gap-2">
          <ExportButton type="collections" label="Tahsilatlar CSV" />
          <ExportButton type="receivables" label="Alacaklar CSV" />
          <ExportButton type="aging" label="Yaşlandırma CSV" />
          <PrintButton />
        </div>
      </div>
    </AppShell>
  )
}

function KpiCard({ label, value, icon: Icon, accent, accentBg }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: string; accentBg: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate">{label}</span>
        <div className={`size-7 rounded-lg ${accentBg} flex items-center justify-center`}>
          <Icon className={`size-3.5 ${accent}`} />
        </div>
      </div>
      <p className={`text-base sm:text-lg font-bold truncate ${accent}`}>{value}</p>
    </div>
  )
}

function RecentCollectionsSection({ collections }: { collections: import("@/lib/cashbox/queries").RecentCollection[] }) {
  const nameFor = (c: { type: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null }) =>
    c.type === "corporate" ? c.companyName || "—" : c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Receipt className="size-4 text-slate-500" />
          Son Tahsilatlar
        </h3>
        <Link href="/app/cashbox/payments" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
          Tümünü Gör <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-xl">
          <Wallet className="size-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500">Henüz tahsilat kaydı yok</p>
          <Link href="/app/cashbox/payments/new" className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium">
            <Plus className="size-3.5" /> İlk tahsilatı ekle
          </Link>
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
                    <th className="px-4 py-3 text-left font-semibold">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {collections.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(c.paymentDate)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/app/customers/${c.customer.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-600">
                          {nameFor(c.customer)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {c.serviceOrder ? (
                          <Link href={`/app/orders/${c.serviceOrder.id}`} className="text-sm text-blue-600 hover:text-blue-700 font-mono text-xs">
                            {c.serviceOrder.workOrderNo || "—"}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatTRY(c.amount)}</td>
                      <td className="px-4 py-3"><PaymentMethodBadge method={c.method} /></td>
                      <td className="px-4 py-3"><CollectionStatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:hidden space-y-2.5">
            {collections.map((c) => (
              <Link
                key={c.id}
                href={`/app/cashbox/payments/${c.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-3.5 active:bg-slate-50 touch-manipulation hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{nameFor(c.customer)}</span>
                      <PaymentMethodBadge method={c.method} />
                    </div>
                    {c.serviceOrder && (
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">{c.serviceOrder.workOrderNo}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatTRY(c.amount)}</p>
                    <p className="text-[11px] text-slate-500">{formatDate(c.paymentDate)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function OpenReceivablesSection({ receivables }: { receivables: import("@/lib/cashbox/queries").OpenReceivable[] }) {
  const nameFor = (c: { type: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null }) =>
    c.type === "corporate" ? c.companyName || "—" : c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-slate-900">Açık Alacaklar</h3>
        <div className="flex items-center gap-2">
          <Link href="/app/cashbox/aging" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Yaşlandırma <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {receivables.length === 0 ? (
        <div className="text-center py-8 bg-white border border-dashed border-slate-200 rounded-xl">
          <Receipt className="size-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500">Açık alacak yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {receivables.map((r) => (
            <Link
              key={r.id}
              href={`/app/orders/${r.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{nameFor(r.customer)}</p>
                  <p className="text-xs text-slate-500 font-mono">{r.workOrderNo || "—"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-rose-700">{formatTRY(r.remainingAmount)}</p>
                  <p className="text-[11px] text-slate-500">toplam: {formatTRY(r.grandTotal)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function MethodBreakdownSection({ breakdown }: { breakdown: import("@/lib/cashbox/queries").PaymentMethodBreakdown[] }) {
  const methodIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    cash: Banknote,
    credit_card: CreditCard,
    bank_transfer: Building2,
    other: CircleDot,
  }

  if (breakdown.length === 0) {
    return (
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-3">Yöntem Dağılımı</h3>
        <div className="text-center py-8 bg-white border border-dashed border-slate-200 rounded-xl">
          <Wallet className="size-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-500">Henüz veri yok</p>
        </div>
      </div>
    )
  }

  const totalAmount = breakdown.reduce((sum, b) => sum + b.total, 0)

  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900 mb-3">Yöntem Dağılımı</h3>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="divide-y divide-slate-100">
          {breakdown.map((b) => {
            const Icon = methodIcons[b.method] || CircleDot
            const pct = totalAmount > 0 ? Math.round((b.total / totalAmount) * 100) : 0
            return (
              <div key={b.method} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="size-3.5 text-slate-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{b.label}</p>
                    <p className="text-[11px] text-slate-500">{b.count} tahsilat</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{formatTRY(b.total)}</p>
                  <p className="text-[11px] text-slate-500">%{pct}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DailyChartSection({ dailyCollections }: { dailyCollections: Array<{ date: string; label: string; amount: number; count: number }> }) {
  const maxAmount = Math.max(1, ...dailyCollections.map((d) => d.amount))
  const hasData = dailyCollections.some((d) => d.amount > 0)

  if (!hasData) return null

  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900 mb-3">Son 14 Gün Tahsilat</h3>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-end gap-1 h-32">
          {dailyCollections.map((d) => {
            const pct = (d.amount / maxAmount) * 100
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end min-w-0" title={`${d.date}: ${formatTRY(d.amount)}`}>
                <span className="text-[10px] font-semibold text-slate-600 truncate max-w-full">
                  {d.amount > 0 ? formatTRY(d.amount) : ""}
                </span>
                <div
                  className="w-full rounded-t-md bg-blue-500 transition-all min-h-[4px]"
                  style={{ height: `${Math.max(2, pct)}%` }}
                />
                <span className="text-[10px] text-slate-400 font-medium truncate max-w-full">{d.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ExportButton({ type, label }: { type: "collections" | "receivables" | "aging"; label: string }) {
  return (
    <a
      href={`/api/cashbox/export?type=${type}`}
      download
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors print:hidden"
    >
      <Download className="size-3.5" />
      {label}
    </a>
  )
}