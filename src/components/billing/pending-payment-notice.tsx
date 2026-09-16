import Link from "next/link"
import { Clock } from "lucide-react"
import type { BillingOrder } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { getPlanPackage } from "@/lib/plans-catalog"
import { formatMinor } from "@/lib/billing/pricing"

export function PendingPaymentNotice({ order }: { order: BillingOrder }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
      <Clock className="mt-0.5 size-5 shrink-0 text-warning-strong" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-foreground">
          Bekleyen ödeme · {getPlanPackage(order.planTier)?.name} ({order.billingCycle === "monthly" ? "Aylık" : "Yıllık"}) · {formatMinor(order.amountMinor)}
        </p>
        {order.method === "card" ? (
          <>
            <p className="mt-0.5 text-muted-foreground">Başlattığınız kart ödemesi henüz tamamlanmadı.</p>
            <Button variant="foreground" size="compact" className="mt-2" asChild>
              <Link href={`/payment/result?ref=${encodeURIComponent(order.reference)}`}>Ödemeye devam et</Link>
            </Button>
          </>
        ) : (
          <p className="mt-0.5 text-muted-foreground">
            Havale açıklamasına <span className="font-semibold">{order.reference}</span> yazın. Ödemeniz teyit edilince paketiniz aktifleşecek.
          </p>
        )}
      </div>
    </div>
  )
}
