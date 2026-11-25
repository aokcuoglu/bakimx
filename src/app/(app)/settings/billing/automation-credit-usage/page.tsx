import { Coins } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { CreditPeriodSelect } from "@/components/billing/credit-period-select"
import { CreditQuotaDialog } from "@/components/billing/credit-quota-dialog"
import { getAccountBillingContext } from "@/lib/billing/account-context"
import { prisma } from "@/lib/db"
import { getWorkshopQuotaContext, getWorkshopQuotaUsage, quotaMonthWindow } from "@/lib/rapidapi-quota"

export const metadata = { title: "Krediler" }

function monthKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}` }

export default async function CreditUsagePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { workshop } = await getAccountBillingContext()
  const now = new Date()
  const periods = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    return { value: monthKey(date), label: offset === 0 ? "Bu ay" : new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date), date }
  })
  const requested = (await searchParams).period
  const selected = periods.find((period) => period.value === requested) ?? periods[0]
  const { monthStart, renewsAt } = quotaMonthWindow(selected.date)
  const context = getWorkshopQuotaContext(workshop)
  const current = selected.value === periods[0].value
  const [groups, currentUsage] = await Promise.all([
    prisma.quotaUsage.groupBy({
      by: ["source"],
      where: { workshopId: workshop.id, createdAt: { gte: monthStart, lt: renewsAt } },
      _count: { _all: true },
    }),
    getWorkshopQuotaUsage(context, now),
  ])
  const vin = groups.find((row) => row.source === "vin")?._count._all ?? 0
  const tecdoc = groups.find((row) => row.source === "tecdoc")?._count._all ?? 0
  const used = vin + tecdoc
  const cap = currentUsage.totalCap
  const percentage = current && cap ? Math.min(100, used / cap * 100) : 0

  return <AppShell pageTitle="Krediler" workshopName={workshop.name}>
    <div className="mx-auto max-w-3xl">
    <div className="flex flex-wrap items-start justify-between gap-3"><SettingsPageHeader title="Krediler" description="VIN ve TecDoc katalog sorgularınızı dönem bazında izleyin." /><CreditPeriodSelect value={selected.value} periods={periods.map(({ value, label }) => ({ value, label }))} /></div>
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4 sm:p-5"><div><p className="flex items-center gap-2 text-xs text-muted-foreground"><Coins className="size-4" aria-hidden="true" /> Kullanılan kredi</p><p className="mt-1 text-lg font-semibold">{used.toLocaleString("tr-TR")}{current && <span className="text-sm font-normal text-muted-foreground"> / {cap.toLocaleString("tr-TR")}</span>}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "UTC" }).format(monthStart)} – {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(renewsAt.getTime() - 86_400_000))}</p></div><CreditQuotaDialog included={currentUsage.baseQuota} extra={currentUsage.extraQuota} /></div>
      {current && <div className="border-b px-4 py-4 sm:px-5"><div role="progressbar" aria-label="Aylık kredi kullanımı" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={Math.min(used, cap)} className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${percentage}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">Bu ay kalan {currentUsage.remaining.toLocaleString("tr-TR")} kredi · {currentUsage.baseQuota.toLocaleString("tr-TR")} paket + {currentUsage.extraQuota.toLocaleString("tr-TR")} ek kota</p></div>}
      {used ? <div className="text-sm"><div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b px-4 py-2 text-xs text-muted-foreground sm:px-5"><span>Kaynak</span><span>Pay</span><span className="text-right">Sorgu</span></div>{[["VIN sorguları", vin], ["TecDoc katalog sorguları", tecdoc]] .map(([label, count]) => <div key={label} className="grid grid-cols-[1fr_auto_auto] gap-4 border-b px-4 py-3 last:border-b-0 sm:px-5"><span>{label}</span><span className="text-muted-foreground">{Math.round(Number(count) / used * 100)}%</span><span className="text-right tabular-nums">{Number(count).toLocaleString("tr-TR")}</span></div>)}</div> : <div className="px-4 py-14 text-center"><Coins className="mx-auto size-9 text-muted-foreground" aria-hidden="true" /><p className="mt-3 font-medium">Bu dönemde kredi kullanımı yok</p><p className="mt-1 text-sm text-muted-foreground">Sorgular yapıldığında VIN ve TecDoc dağılımı burada görünür.</p></div>}
    </div>
    {!current && <p className="mt-3 text-xs text-muted-foreground">Geçmiş dönemlerin kota hakkı kaydedilmediği için kalan hak gösterilmez. Üstteki kullanım sayısı o dönemin gerçek kayıtlarıdır.</p>}
    </div>
  </AppShell>
}
