import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react"
import { prisma } from "@/lib/db"
import { formatMinor } from "@/lib/billing/pricing"
import { getPlanPackage } from "@/lib/plans-catalog"
import { TAMI_ERROR_MESSAGES } from "@/lib/tami/errors"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { CardPaymentPanel } from "@/components/billing/card-payment-panel"
import type { PlanTier } from "@/lib/plan"

export const metadata: Metadata = {
  title: "Ödeme Sonucu",
  description: "BakımX ödeme sonucu.",
}

// Sonuç DAİMA anlık DB durumundan türetilir (query'deki `err` yalnız bir ipucu).
export const dynamic = "force-dynamic"

function planLabel(tier: PlanTier, cycle: string): string {
  const pkg = getPlanPackage(tier)
  const c = cycle === "yearly" ? "Yıllık" : "Aylık"
  return pkg ? `${pkg.name} · ${c}` : c
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-muted px-5 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </main>
  )
}

function IconBadge({
  icon: Icon,
  tone,
}: {
  icon: typeof CheckCircle2
  tone: "success" | "error" | "muted"
}) {
  const cls =
    tone === "success"
      ? "bg-primary/10 text-primary"
      : tone === "error"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground"
  return (
    <div className={`mx-auto mb-4 flex size-14 items-center justify-center rounded-full ${cls}`}>
      <Icon className="size-7" />
    </div>
  )
}

/** Sipariş özeti kartı — plan/tutar/son 4 hane. Workshop kimliği GÖSTERİLMEZ. */
function OrderSummary({
  tier,
  cycle,
  amountMinor,
  maskedPan,
}: {
  tier: PlanTier
  cycle: string
  amountMinor: number
  maskedPan?: string | null
}) {
  const last4 = maskedPan ? maskedPan.replace(/\D/g, "").slice(-4) : null
  return (
    <div className="mt-4 space-y-1.5 rounded-lg border bg-muted/40 p-4 text-left text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Paket</span>
        <span className="font-medium text-foreground">{planLabel(tier, cycle)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Tutar</span>
        <span className="font-semibold text-foreground">{formatMinor(amountMinor)}</span>
      </div>
      {last4 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Kart</span>
          <span className="font-mono text-foreground">•••• {last4}</span>
        </div>
      )}
    </div>
  )
}

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; err?: string }>
}) {
  const sp = await searchParams
  const ref = typeof sp.ref === "string" ? sp.ref : null
  const err = typeof sp.err === "string" ? sp.err : null

  // 1) Referans yok → nazik genel hata.
  if (!ref) {
    return (
      <Shell>
        <div className="text-center">
          <IconBadge icon={AlertCircle} tone="muted" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">Ödeme bulunamadı</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ödeme referansı eksik. Lütfen satın alma adımlarını yeniden başlatın.
          </p>
          <Link
            href="/satin-al"
            className="mt-6 inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            Satın alma sayfasına git
          </Link>
        </div>
      </Shell>
    )
  }

  const order = await prisma.billingOrder.findUnique({ where: { reference: ref } })
  if (!order) {
    return (
      <Shell>
        <div className="text-center">
          <IconBadge icon={AlertCircle} tone="muted" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">Sipariş bulunamadı</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bu referansa ait bir sipariş bulunamadı. Bağlantıyı kontrol edin veya yeniden deneyin.
          </p>
          <Link
            href="/satin-al"
            className="mt-6 inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            Satın alma sayfasına git
          </Link>
        </div>
      </Shell>
    )
  }

  const lastTxn = await prisma.paymentTransaction.findFirst({
    where: { billingOrderId: order.id },
    orderBy: { createdAt: "desc" },
  })
  const tier = order.planTier as PlanTier

  // 2) Başarı → sipariş onaylandı (aktifleşti).
  if (order.status === "confirmed") {
    return (
      <Shell>
        <div className="text-center">
          <IconBadge icon={CheckCircle2} tone="success" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">Ödeme başarılı</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Paketiniz aktifleştirildi. Uygulamayı hemen kullanmaya başlayabilirsiniz.
          </p>
          <OrderSummary
            tier={tier}
            cycle={order.billingCycle}
            amountMinor={order.amountMinor}
            maskedPan={lastTxn?.maskedPan}
          />
          {order.periodEnd && (
            <p className="mt-3 text-xs text-muted-foreground">
              Dönem bitişi:{" "}
              <span className="font-medium text-foreground">
                {order.periodEnd.toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </span>
            </p>
          )}
          <Link
            href="/login"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 md:h-9"
          >
            Uygulamaya Git
          </Link>
        </div>
      </Shell>
    )
  }

  // 3) İptal edilmiş sipariş.
  if (order.status === "cancelled") {
    return (
      <Shell>
        <div className="text-center">
          <IconBadge icon={XCircle} tone="muted" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">Sipariş iptal edilmiş</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bu sipariş iptal edilmiş. Dilerseniz yeni bir satın alma başlatabilirsiniz.
          </p>
          <Link
            href="/satin-al"
            className="mt-6 inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            Yeni satın alma başlat
          </Link>
        </div>
      </Shell>
    )
  }

  // Buradan sonrası: order.status === "pending_payment".
  // 4) Ödeme işleniyor — callback geldi, aktivasyon henüz tamamlanmadı.
  if (lastTxn?.status === "callback_received") {
    return (
      <Shell>
        {/* Hafif otomatik yenileme: aktivasyon tamamlanınca başarı görünümü gelir. */}
        <meta httpEquiv="refresh" content="4" />
        <div className="flex flex-col items-center text-center">
          <BrandSpinner size={52} />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
            Ödemeniz işleniyor
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Bankadan onay alındı, paketiniz aktifleştiriliyor. Bu sayfa birkaç saniye içinde
            otomatik yenilenecek.
          </p>
          <OrderSummary
            tier={tier}
            cycle={order.billingCycle}
            amountMinor={order.amountMinor}
            maskedPan={lastTxn?.maskedPan}
          />
        </div>
      </Shell>
    )
  }

  // 5) Hata / başlangıç — başarısız/expired txn, err ipucu, veya hiç txn yok.
  // Türkçe hata mesajını çöz.
  let errorMessage: string | null = null
  if (lastTxn && (lastTxn.status === "failed" || lastTxn.status === "expired")) {
    errorMessage =
      (lastTxn.errorCode ? TAMI_ERROR_MESSAGES[lastTxn.errorCode] : undefined) ??
      lastTxn.errorMessage ??
      TAMI_ERROR_MESSAGES.default
  } else if (err === "card") {
    errorMessage = "Kart bilgilerini kontrol edip yeniden deneyin."
  } else if (err === "rate") {
    errorMessage = "Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin."
  } else if (err === "config") {
    errorMessage =
      "Kart ödemesi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin veya bizimle iletişime geçin."
  }

  // Yapılandırma hatasında kart yeniden-deneme panelini gösterme — deneme yine
  // aynı guard'a takılır; kullanıcıya "iletişime geçin" ipucu daha doğru.
  const canRetryCard = order.method === "card" && err !== "config"

  return (
    <Shell>
      <div className="text-center">
        <IconBadge icon={AlertCircle} tone="error" />
        <h1 className="text-xl font-bold tracking-tight text-foreground">Ödeme tamamlanamadı</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {errorMessage ?? "Ödeme henüz tamamlanmadı. Aşağıdan yeniden deneyebilirsiniz."}
        </p>
        <OrderSummary
          tier={tier}
          cycle={order.billingCycle}
          amountMinor={order.amountMinor}
          maskedPan={lastTxn?.maskedPan}
        />
      </div>

      {canRetryCard ? (
        <div className="mt-6 border-t pt-6">
          <CardPaymentPanel
            reference={order.reference}
            amountMinor={order.amountMinor}
            planLabel={planLabel(tier, order.billingCycle)}
          />
        </div>
      ) : (
        <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
          <Clock className="mt-0.5 size-4 shrink-0" />
          <span>Sorun yaşıyorsanız bizimle iletişime geçin, size yardımcı olalım.</span>
        </p>
      )}
    </Shell>
  )
}
