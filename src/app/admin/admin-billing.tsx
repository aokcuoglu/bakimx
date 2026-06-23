"use client"

import { useState, useTransition } from "react"
import { Check, X, Loader2, Landmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { confirmBillingOrder, cancelBillingOrder } from "@/app/admin/actions"

export interface AdminOrderRow {
  id: string
  workshopName: string
  type: string
  planTier: string
  billingCycle: string
  amountLabel: string
  reference: string
  invoiceTitle: string | null
  taxNumber: string | null
  createdAt: string
}
export interface AdminSubRow {
  id: string
  name: string
  planTier: string
  billingCycle: string | null
  periodEnd: string | null
  daysLeft: number | null
}

const TIER_LABELS: Record<string, string> = { starter: "Başlangıç", pro: "Profesyonel", premium: "Premium" }
const CYCLE_LABELS: Record<string, string> = { monthly: "Aylık", yearly: "Yıllık" }

export function AdminBilling({
  orders,
  subscriptions,
  revenue,
}: {
  orders: AdminOrderRow[]
  subscriptions: AdminSubRow[]
  revenue: { activeCount: number; mrrLabel: string; monthLabel: string }
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Aktif abonelik" value={String(revenue.activeCount)} />
        <Stat label="MRR (aylık)" value={revenue.mrrLabel} />
        <Stat label="Bu ay tahsil" value={revenue.monthLabel} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Bekleyen Ödemeler</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bekleyen ödeme yok.</p>
        ) : (
          orders.map((o) => <OrderRow key={o.id} o={o} />)
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Abonelikler</h2>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aktif abonelik yok.</p>
        ) : (
          <div className="space-y-2">
            {subscriptions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm">
                <span className="font-medium text-foreground">{s.name}</span>
                <span className="text-muted-foreground">
                  {TIER_LABELS[s.planTier] ?? s.planTier}
                  {s.billingCycle && ` · ${CYCLE_LABELS[s.billingCycle] ?? s.billingCycle}`}
                  {s.periodEnd && ` · bitiş ${s.periodEnd}`}
                  {s.daysLeft != null && (
                    <span className={cn("ml-2 font-medium", s.daysLeft <= 7 ? "text-amber-600" : "text-foreground")}>{s.daysLeft} gün</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
    </div>
  )
}

function OrderRow({ o }: { o: AdminOrderRow }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("")
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error || "İşlem başarısız")
    })
  }
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{o.workshopName}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px]">{TIER_LABELS[o.planTier] ?? o.planTier} · {CYCLE_LABELS[o.billingCycle] ?? o.billingCycle}</span>
            <span className="font-semibold text-foreground">{o.amountLabel}</span>
          </div>
          <p className="text-muted-foreground mt-1 inline-flex items-center gap-1">
            <Landmark className="size-3.5" /> Referans: <span className="font-mono text-foreground">{o.reference}</span>
          </p>
          <p className="text-muted-foreground">{o.invoiceTitle ?? "—"}{o.taxNumber ? ` · VKN ${o.taxNumber}` : ""}</p>
          {error && <p className="text-destructive mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <button disabled={pending} onClick={() => run(() => confirmBillingOrder(o.id))} className={cn(buttonVariants({ size: "sm" }), "gap-1")}>
            <Check className="size-3.5" /> Havale alındı
          </button>
          <button disabled={pending} onClick={() => run(() => cancelBillingOrder(o.id))} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}>
            <X className="size-3.5" /> İptal
          </button>
        </div>
      </div>
    </div>
  )
}
