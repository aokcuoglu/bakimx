import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { getReceivableAging } from "@/lib/cashbox/queries"
import Link from "next/link"
import { formatTRY } from "@/lib/format"
import { Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const bucketColors = [
  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", accentBg: "bg-emerald-100", icon: Clock },
  { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", accentBg: "bg-amber-100", icon: Clock },
  { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", accentBg: "bg-orange-100", icon: AlertTriangle },
  { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", accentBg: "bg-rose-100", icon: AlertTriangle },
]

export default async function AgingReportPage() {
  const { user, workshop } = await getAppData()
  const aging = await getReceivableAging(user.workshopId)

  const totalAging = aging.reduce((sum, b) => sum + b.totalAmount, 0)

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yaşlandırma Raporu">
      <div className="space-y-5 sm:space-y-6 max-w-full">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/app/cashbox" className="hover:text-slate-700">Kasa</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Yaşlandırma Raporu</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Alacak Yaşlandırma Raporu</h2>
          <p className="text-sm text-slate-500 mt-0.5">Müşteri alacaklarının vade gruplarına göre dağılımı</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Toplam Alacak</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{formatTRY(totalAging)}</p>
          </div>
          {aging.map((bucket, i) => (
            <div key={bucket.key} className={cn("rounded-xl border p-3.5", bucketColors[i].bg, bucketColors[i].border)}>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{bucket.label}</p>
              <p className={cn("text-lg font-bold mt-1", bucketColors[i].text)}>{formatTRY(bucket.totalAmount)}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-500 flex items-start gap-2">
          <Clock className="size-3.5 mt-0.5 shrink-0" />
          <span>Yaşlandırma, iş emri oluşturma tarihine göre hesaplanır. 0-7 gün arası en yeni alacakları, 60+ gün arası en gecikmiş alacakları gösterir.</span>
        </div>

        <div className="space-y-4">
          {aging.map((bucket, i) => (
            <AgingBucketCard key={bucket.key} bucket={bucket} colorIndex={i} />
          ))}
        </div>
      </div>
    </AppShell>
  )
}

function AgingBucketCard({ bucket, colorIndex }: { bucket: Awaited<ReturnType<typeof getReceivableAging>>[number]; colorIndex: number }) {
  const color = bucketColors[colorIndex]
  const Icon = color.icon

  if (bucket.totalAmount === 0 && bucket.customers.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("size-9 rounded-lg flex items-center justify-center", color.accentBg)}>
            <Icon className={cn("size-4", color.text)} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{bucket.label}</h3>
            <p className="text-xs text-slate-500">Alacak yok</p>
          </div>
        </div>
        <p className="text-sm text-slate-400 text-center py-4">Bu grupta alacak bulunmuyor.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={cn("size-9 rounded-lg flex items-center justify-center", color.accentBg)}>
            <Icon className={cn("size-4", color.text)} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{bucket.label}</h3>
            <p className="text-xs text-slate-500">{bucket.count} müşteri</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-bold", color.text)}>{formatTRY(bucket.totalAmount)}</p>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {bucket.customers.map((customer, idx) => (
          <div key={idx} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{customer.customerName}</p>
              <p className="text-xs text-slate-500">{customer.customerPhone}</p>
            </div>
            <p className={cn("text-sm font-semibold ml-3 shrink-0", color.text)}>{formatTRY(customer.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}