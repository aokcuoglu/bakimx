import Link from "next/link"
import { Clock } from "lucide-react"
import type { BillingOrder } from "@prisma/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getPlanPackage } from "@/lib/plans-catalog"
import { formatMinor } from "@/lib/billing/pricing"

export function PendingPaymentNotice({ order }: { order: BillingOrder }) {
  return (
    <Alert variant="warning">
      <Clock />
      <AlertTitle>
        Bekleyen ödeme · {getPlanPackage(order.planTier)?.name} ({order.billingCycle === "monthly" ? "Aylık" : "Yıllık"}) · {formatMinor(order.amountMinor)}
      </AlertTitle>
      <AlertDescription>
        {order.method === "card" ? (
          <>
            <p>Başlattığınız kart ödemesi henüz tamamlanmadı.</p>
            <Button variant="foreground" size="compact" className="mt-2" asChild>
              <Link href={`/payment/result?ref=${encodeURIComponent(order.reference)}`}>Ödemeye devam et</Link>
            </Button>
          </>
        ) : (
          <p>
            Havale açıklamasına <span className="font-semibold">{order.reference}</span> yazın. Ödemeniz teyit edilince paketiniz aktifleşecek.
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}
