"use client"

import { useState } from "react"
import Link from "next/link"
import { Clock } from "lucide-react"
import type { BillingOrder } from "@prisma/client"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CardPaymentPanel } from "@/components/billing/card-payment-panel"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getPlanPackage } from "@/lib/plans-catalog"
import { formatMinor } from "@/lib/billing/pricing"
import { getSupportWhatsAppUrl } from "@/lib/support-whatsapp"
import { CancelPendingOrderButton } from "@/components/billing/pending-order-actions"

type PendingOrder = Pick<BillingOrder, "planTier" | "billingCycle" | "amountMinor" | "method" | "reference">

export function PendingPaymentNotice({ order, canPurchase = false }: { order: PendingOrder; canPurchase?: boolean }) {
  const [paymentOpen, setPaymentOpen] = useState(false)
  const planName = getPlanPackage(order.planTier)?.name ?? order.planTier
  const cycleLabel = order.billingCycle === "monthly" ? "Aylık" : "Yıllık"

  return (
    <>
    <Alert variant="warning" className="flex flex-col gap-3 border-warning/20 bg-warning/5 px-3 py-2.5 text-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <Clock className="mt-0.5 size-4 shrink-0 text-warning-strong" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Bekleyen ödeme</p>
          <p className="text-xs text-muted-foreground-strong">{planName} · {cycleLabel} · {formatMinor(order.amountMinor)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground-strong">
            {order.method === "card"
              ? "Kart ödemeniz henüz tamamlanmadı."
              : <>Havale açıklamasına <span className="font-medium">{order.reference}</span> yazın; ödeme teyit edilince paketiniz aktifleşecek.</>}
          </p>
        </div>
      </div>
      {order.method === "card" && canPurchase && (
        <div className="flex flex-wrap items-center gap-1 self-start sm:self-center">
        <CancelPendingOrderButton reference={order.reference} />
        <Button type="button" variant="default" size="sm" className="self-start sm:self-center" onClick={() => setPaymentOpen(true)}>
          Ödemeye devam et
        </Button>
        </div>
      )}
      {order.method === "havale" && canPurchase && <Button asChild variant="outline" size="sm" className="self-start sm:self-center"><Link href={getSupportWhatsAppUrl(`Merhaba, ${order.reference} numaralı havale talebimi iptal edip başka paket seçmek istiyorum.`)} target="_blank" rel="noopener noreferrer">İptal için destek</Link></Button>}
    </Alert>
      {order.method === "card" && (
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[640px]">
          <DialogHeader className="px-4 py-3 sm:px-5">
            <DialogTitle>Ödemeyi tamamla</DialogTitle>
            <DialogDescription>Bekleyen kart ödemenizin bilgilerini girin.</DialogDescription>
          </DialogHeader>
          <CardPaymentPanel reference={order.reference} amountMinor={order.amountMinor} planLabel={`${planName} · ${cycleLabel}`} presentation="attio" />
        </DialogContent>
      </Dialog>
    )}
    </>
  )
}
