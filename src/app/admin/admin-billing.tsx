"use client"

import { useState, useTransition } from "react"
import {
  Check,
  X,
  Loader2,
  Landmark,
  CreditCard,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { confirmBillingOrder, cancelBillingOrder, retryStuckActivation } from "@/app/admin/actions"

/** Bir kartlı ödeme denemesinin (PaymentTransaction) admin'e görünen özeti —
 *  TAMI destek talebi için correlationId dahil. Kart verisi (PAN/CVV) asla
 *  yer almaz; maskedPan zaten yalnız maskeli. */
export interface AdminTxnRow {
  id: string
  status: string
  maskedPan: string | null
  cardBrand: string | null
  errorCode: string | null
  correlationId: string | null
  createdAt: string
}

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
  /** BillingMethod: "havale" | "manual" | "card". */
  method: string
  /** BillingOrderStatus — pendingOrders'ta hep "pending_payment", recentOrders'ta "confirmed"/"cancelled". */
  status: string
  confirmedByEmail: string | null
  /** En son deneme (varsa) — hızlı özet için. */
  lastTxn: AdminTxnRow | null
  /** Sipariş başına son 5 deneme — "Ödeme denemeleri" bölümü. */
  txnHistory: AdminTxnRow[]
}

/** callback_received durumunda takılı kalmış (para muhtemelen çekilmiş,
 *  aktivasyon tamamlanmamış) kart ödemesi. */
export interface AdminStuckTxnRow {
  id: string
  billingOrderId: string
  workshopName: string
  reference: string
  providerOrderId: string
  amountLabel: string
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
const METHOD_LABELS: Record<string, string> = { card: "Kart", havale: "Havale", manual: "Manuel" }
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Bekliyor",
  confirmed: "Onaylandı",
  cancelled: "İptal",
}
const TXN_STATUS_LABELS: Record<string, string> = {
  initiated: "Başlatıldı",
  callback_received: "Callback alındı",
  completed: "Tamamlandı",
  failed: "Başarısız",
  expired: "Süresi doldu",
}

export function AdminBilling({
  orders,
  recentOrders,
  stuckTransactions,
  subscriptions,
  revenue,
}: {
  orders: AdminOrderRow[]
  recentOrders: AdminOrderRow[]
  stuckTransactions: AdminStuckTxnRow[]
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

      <StuckTransactionsSection rows={stuckTransactions} />

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Bekleyen Ödemeler</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bekleyen ödeme yok.</p>
        ) : (
          orders.map((o) => <OrderRow key={o.id} o={o} />)
        )}
      </section>

      <RecentOrdersSection rows={recentOrders} />

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

function MethodBadge({ method }: { method: string }) {
  const isCard = method === "card"
  return (
    <Badge variant="outline" className="gap-1 text-[11px]">
      {isCard ? <CreditCard className="size-3" /> : <Landmark className="size-3" />}
      {METHOD_LABELS[method] ?? method}
    </Badge>
  )
}

/** Kopyalanabilir küçük mono metin — TAMI destek talebi için correlationId/işlem no. */
function CopyMono({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      title="Kopyala"
      className="font-mono text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
    >
      {copied ? "Kopyalandı" : value}
    </button>
  )
}

/** Kartlı bir siparişin genişletilebilir deneme geçmişi — masaüstünde tablo,
 *  mobilde kart listesi (mevcut liste sayfalarındaki responsive desen). */
function PaymentAttempts({ txns }: { txns: AdminTxnRow[] }) {
  const [open, setOpen] = useState(false)
  if (txns.length === 0) return null

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        Ödeme denemeleri ({txns.length})
      </button>
      {open && (
        <div className="mt-2">
          <div className="hidden md:block rounded-lg border border-border bg-background overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Tarih</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Durum</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Kart</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Hata</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Correlation ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {txns.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(t.createdAt).toLocaleString("tr-TR")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{TXN_STATUS_LABELS[t.status] ?? t.status}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {t.cardBrand ?? "—"}
                      {t.maskedPan ? ` · ${t.maskedPan}` : ""}
                    </td>
                    <td className="px-3 py-2">{t.errorCode ?? "—"}</td>
                    <td className="px-3 py-2">{t.correlationId ? <CopyMono value={t.correlationId} /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-2">
            {txns.map((t) => (
              <div key={t.id} className="rounded-lg border border-border bg-background p-2.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{TXN_STATUS_LABELS[t.status] ?? t.status}</span>
                  <span className="text-muted-foreground">{new Date(t.createdAt).toLocaleString("tr-TR")}</span>
                </div>
                {(t.cardBrand || t.maskedPan) && (
                  <p className="text-muted-foreground">
                    {t.cardBrand ?? ""}
                    {t.maskedPan ? ` · ${t.maskedPan}` : ""}
                  </p>
                )}
                {t.errorCode && <p className="text-destructive">{t.errorCode}</p>}
                {t.correlationId && <CopyMono value={t.correlationId} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Otomatik (kart) kaynağı ya da manuel onaylayan e-postası — yalnız
 *  onaylanmış siparişlerde anlamlı. */
function SourceBadge({ o }: { o: AdminOrderRow }) {
  if (o.status !== "confirmed") return null
  if (o.confirmedByEmail === "tami") {
    return <Badge className="text-[11px]">Otomatik (kart)</Badge>
  }
  if (o.confirmedByEmail) {
    return <span className="text-xs text-muted-foreground">Onaylayan: {o.confirmedByEmail}</span>
  }
  return null
}

function OrderRow({ o }: { o: AdminOrderRow }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const isCard = o.method === "card"
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
            <MethodBadge method={o.method} />
            <span className="font-semibold text-foreground">{o.amountLabel}</span>
          </div>
          <p className="text-muted-foreground mt-1 inline-flex items-center gap-1">
            <Landmark className="size-3.5" /> Referans: <span className="font-mono text-foreground">{o.reference}</span>
          </p>
          <p className="text-muted-foreground">{o.invoiceTitle ?? "—"}{o.taxNumber ? ` · VKN ${o.taxNumber}` : ""}</p>
          {isCard && <PaymentAttempts txns={o.txnHistory} />}
          {error && <p className="text-destructive mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {/* Kartlı akış otomatik — yanlışlıkla elle onaylanıp çifte aktivasyona
              yol açmasın diye kartlı bekleyen siparişte confirm butonu YOK. */}
          {!isCard && (
            <button disabled={pending} onClick={() => run(() => confirmBillingOrder(o.id))} className={cn(buttonVariants({ size: "sm" }), "gap-1")}>
              <Check className="size-3.5" /> Havale alındı
            </button>
          )}
          <button disabled={pending} onClick={() => run(() => cancelBillingOrder(o.id))} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}>
            <X className="size-3.5" /> İptal
          </button>
        </div>
      </div>
    </div>
  )
}

function StuckTransactionsSection({ rows }: { rows: AdminStuckTxnRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-destructive flex items-center gap-2">
        <AlertTriangle className="size-5" /> Takılı Ödemeler
      </h2>
      <p className="text-sm text-muted-foreground">
        Banka tarafında çekim tamamlanmış olabilir ama plan aktivasyonu tamamlanmadı. Kontrol edip tekrar deneyin.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <StuckTxnRow key={r.id} r={r} />
        ))}
      </div>
    </section>
  )
}

function StuckTxnRow({ r }: { r: AdminStuckTxnRow }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  function retry() {
    setError("")
    startTransition(async () => {
      const res = await retryStuckActivation(r.id)
      if (!res.ok) setError(res.error || "İşlem başarısız")
      else setDone(true)
    })
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{r.workshopName}</span>
            <span className="font-semibold text-foreground">{r.amountLabel}</span>
          </div>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1">
            Referans: <span className="font-mono text-foreground">{r.reference}</span>
            · İşlem: <CopyMono value={r.providerOrderId} />
          </p>
          <p className="text-muted-foreground">{new Date(r.createdAt).toLocaleString("tr-TR")} tarihinden beri &quot;callback_received&quot;</p>
          {error && <p className="text-destructive mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {done ? (
            <span className="text-sm font-medium text-emerald-600">Aktivasyon tamamlandı</span>
          ) : (
            <button disabled={pending} onClick={retry} className={cn(buttonVariants({ size: "sm" }), "gap-1")}>
              <RefreshCw className="size-3.5" /> Aktivasyonu Tekrar Dene
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function RecentOrdersSection({ rows }: { rows: AdminOrderRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">Son Siparişler</h2>
      <div className="space-y-2">
        {rows.map((o) => (
          <RecentOrderRow key={o.id} o={o} />
        ))}
      </div>
    </section>
  )
}

function RecentOrderRow({ o }: { o: AdminOrderRow }) {
  const isCard = o.method === "card"
  const statusTone =
    o.status === "confirmed" ? "text-emerald-600" : o.status === "cancelled" ? "text-muted-foreground" : "text-foreground"
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{o.workshopName}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px]">{TIER_LABELS[o.planTier] ?? o.planTier} · {CYCLE_LABELS[o.billingCycle] ?? o.billingCycle}</span>
            <MethodBadge method={o.method} />
            <Badge variant="outline" className={cn("text-[11px]", statusTone)}>
              {ORDER_STATUS_LABELS[o.status] ?? o.status}
            </Badge>
            <SourceBadge o={o} />
            <span className="font-semibold text-foreground">{o.amountLabel}</span>
          </div>
          <p className="text-muted-foreground mt-1">
            Referans: <span className="font-mono text-foreground">{o.reference}</span>
          </p>
          {isCard && <PaymentAttempts txns={o.txnHistory} />}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{new Date(o.createdAt).toLocaleDateString("tr-TR")}</span>
      </div>
    </div>
  )
}
