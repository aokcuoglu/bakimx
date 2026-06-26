import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { getCashboxStats, getRecentCollections, getOpenReceivables, getPaymentMethodBreakdown, getCashboxDailyCollections } from "@/lib/cashbox/queries"
import Link from "next/link"
import { Button } from "@/components/ui/button"
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
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Kasa</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Kasa</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Tahsilat ve alacak takibi</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              size="lg"
              render={<Link href="/cashbox/aging" />}
            >
              <BarChart3 className="size-4" />
              Yaşlandırma
            </Button>
            <Button
              nativeButton={false}
              size="lg"
              className="touch-manipulation"
              render={<Link href="/cashbox/payments/new" />}
            >
              <Plus className="size-4" />
              Yeni Tahsilat
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
          <Info className="size-3.5 mt-0.5 shrink-0" />
          <span>Bu ekran operasyonel tahsilat takibi içindir. Resmi muhasebe veya e-fatura/e-arşiv yerine geçmez.</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Bugünkü Tahsilat"
            value={formatTRY(stats.todayCollected)}
            icon={Banknote}
            accent="text-success"
            accentBg="bg-success/10"
          />
          <KpiCard
            label="Bu Ay Tahsilat"
            value={formatTRY(stats.monthCollected)}
            icon={TrendingUp}
            accent="text-primary"
            accentBg="bg-primary/10"
          />
          <KpiCard
            label="Açık Alacak"
            value={formatTRY(stats.openReceivable)}
            icon={Receipt}
            accent="text-destructive"
            accentBg="bg-destructive/10"
          />
          <KpiCard
            label="Geciken Alacak"
            value={formatTRY(stats.overdueReceivable)}
            icon={AlertTriangle}
            accent="text-destructive"
            accentBg="bg-destructive/10"
          />
          <KpiCard
            label="Kısmi Ödemeler"
            value={stats.partialPayments.toString()}
            icon={Clock}
            accent="text-warning"
            accentBg="bg-warning/10"
          />
          <KpiCard
            label="Tahsilat Adedi"
            value={stats.totalCollectionCount.toString()}
            icon={CircleDot}
            accent="text-primary"
            accentBg="bg-primary/10"
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
    <div className="rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</span>
        <div className={`size-7 rounded-lg ${accentBg} flex items-center justify-center`}>
          <Icon className={`size-3.5 ${accent}`} />
        </div>
      </div>
      <p className="text-base sm:text-lg font-bold text-foreground">{value}</p>
    </div>
  )
}

function RecentCollectionsSection({ collections }: { collections: import("@/lib/cashbox/queries").RecentCollection[] }) {
  const nameFor = (c: { type: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null }) =>
    c.type === "corporate" ? c.companyName || "—" : c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          Son Tahsilatlar
        </h3>
        <Link href="/cashbox/payments" className="text-sm text-primary hover:text-primary font-medium flex items-center gap-1">
          Tümünü Gör <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-12 bg-card border border-dashed border-border rounded-lg">
          <Wallet className="size-10 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Henüz tahsilat kaydı yok</p>
          <Link href="/cashbox/payments/new" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary font-medium">
            <Plus className="size-3.5" /> İlk tahsilatı ekle
          </Link>
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
                    <th className="px-4 py-3 text-left font-semibold">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {collections.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/60 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.paymentDate)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/customers/${c.customer.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                          {nameFor(c.customer)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {c.serviceOrder ? (
                          <Link href={`/orders/${c.serviceOrder.id}`} className="text-sm text-primary hover:text-primary font-mono text-xs">
                            {c.serviceOrder.workOrderNo || "—"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground/70">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{formatTRY(c.amount)}</td>
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
                href={`/cashbox/payments/${c.id}`}
                className="block rounded-lg border border-border bg-card p-3.5 active:bg-muted touch-manipulation hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{nameFor(c.customer)}</span>
                      <PaymentMethodBadge method={c.method} />
                    </div>
                    {c.serviceOrder && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{c.serviceOrder.workOrderNo}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{formatTRY(c.amount)}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(c.paymentDate)}</p>
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
        <h3 className="text-base font-semibold text-foreground">Açık Alacaklar</h3>
        <div className="flex items-center gap-2">
          <Link href="/cashbox/aging" className="text-sm text-primary hover:text-primary font-medium flex items-center gap-1">
            Yaşlandırma <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {receivables.length === 0 ? (
        <div className="text-center py-8 bg-card border border-dashed border-border rounded-lg">
          <Receipt className="size-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Açık alacak yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {receivables.map((r) => (
            <Link
              key={r.id}
              href={`/orders/${r.id}`}
              className="block rounded-lg border border-border bg-card p-3 hover:border-border transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{nameFor(r.customer)}</p>
                  <p className="text-xs text-muted-foreground font-mono">{r.workOrderNo || "—"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{formatTRY(r.remainingAmount)}</p>
                  <p className="text-[11px] text-muted-foreground">toplam: {formatTRY(r.grandTotal)}</p>
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
        <h3 className="text-base font-semibold text-foreground mb-3">Yöntem Dağılımı</h3>
        <div className="text-center py-8 bg-card border border-dashed border-border rounded-lg">
          <Wallet className="size-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Henüz veri yok</p>
        </div>
      </div>
    )
  }

  const totalAmount = breakdown.reduce((sum, b) => sum + b.total, 0)

  return (
    <div>
      <h3 className="text-base font-semibold text-foreground mb-3">Yöntem Dağılımı</h3>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {breakdown.map((b) => {
            const Icon = methodIcons[b.method] || CircleDot
            const pct = totalAmount > 0 ? Math.round((b.total / totalAmount) * 100) : 0
            return (
              <div key={b.method} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{b.label}</p>
                    <p className="text-[11px] text-muted-foreground">{b.count} tahsilat</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">{formatTRY(b.total)}</p>
                  <p className="text-[11px] text-muted-foreground">%{pct}</p>
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
      <h3 className="text-base font-semibold text-foreground mb-3">Son 14 Gün Tahsilat</h3>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-end gap-1 h-32">
          {dailyCollections.map((d) => {
            const pct = (d.amount / maxAmount) * 100
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end min-w-0" title={`${d.date}: ${formatTRY(d.amount)}`}>
                <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-full">
                  {d.amount > 0 ? formatTRY(d.amount) : ""}
                </span>
                <div
                  className="w-full rounded-t-md bg-primary transition-all min-h-[4px]"
                  style={{ height: `${Math.max(2, pct)}%` }}
                />
                <span className="text-[10px] text-muted-foreground/70 font-medium truncate max-w-full">{d.label}</span>
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
    <Button
      nativeButton={false}
      variant="outline"
      size="sm"
      className="print:hidden"
      render={<a href={`/api/cashbox/export?type=${type}`} download />}
    >
      <Download className="size-3.5" />
      {label}
    </Button>
  )
}