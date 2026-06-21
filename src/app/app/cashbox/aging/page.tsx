import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { getReceivableAging } from "@/lib/cashbox/queries"
import Link from "next/link"
import { formatTRY } from "@/lib/format"
import { Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const bucketColors = [
  { bg: "bg-success/10", border: "border-success/20", text: "text-success", accentBg: "bg-success/20", icon: Clock },
  { bg: "bg-warning/10", border: "border-warning/20", text: "text-warning", accentBg: "bg-warning/20", icon: Clock },
  { bg: "bg-warning/10", border: "border-warning/20", text: "text-warning", accentBg: "bg-warning/20", icon: AlertTriangle },
  { bg: "bg-destructive/10", border: "border-destructive/20", text: "text-destructive", accentBg: "bg-destructive/20", icon: AlertTriangle },
]

export default async function AgingReportPage() {
  const { user, workshop } = await getAppData()
  const aging = await getReceivableAging(user.workshopId)

  const totalAging = aging.reduce((sum, b) => sum + b.totalAmount, 0)

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yaşlandırma Raporu">
      <div className="space-y-5 sm:space-y-6 max-w-full">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/app" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/app/cashbox" className="hover:text-foreground">Kasa</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Yaşlandırma Raporu</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Alacak Yaşlandırma Raporu</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Müşteri alacaklarının vade gruplarına göre dağılımı</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-card p-3.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Toplam Alacak</p>
            <p className="text-lg font-bold text-foreground mt-1">{formatTRY(totalAging)}</p>
          </div>
          {aging.map((bucket, i) => (
            <div key={bucket.key} className={cn("rounded-lg border p-3.5", bucketColors[i].bg, bucketColors[i].border)}>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{bucket.label}</p>
              <p className={cn("text-lg font-bold mt-1", bucketColors[i].text)}>{formatTRY(bucket.totalAmount)}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
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
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={cn("size-9 rounded-lg flex items-center justify-center", color.accentBg)}>
            <Icon className={cn("size-4", color.text)} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{bucket.label}</h3>
            <p className="text-xs text-muted-foreground">Alacak yok</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground/70 text-center py-4">Bu grupta alacak bulunmuyor.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={cn("size-9 rounded-lg flex items-center justify-center", color.accentBg)}>
            <Icon className={cn("size-4", color.text)} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{bucket.label}</h3>
            <p className="text-xs text-muted-foreground">{bucket.count} müşteri</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-bold", color.text)}>{formatTRY(bucket.totalAmount)}</p>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {bucket.customers.map((customer, idx) => (
          <div key={idx} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/60 transition-colors">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{customer.customerName}</p>
              <p className="text-xs text-muted-foreground">{customer.customerPhone}</p>
            </div>
            <p className={cn("text-sm font-semibold ml-3 shrink-0", color.text)}>{formatTRY(customer.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}