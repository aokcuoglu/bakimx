import Link from "next/link"
import { PackageSearch } from "lucide-react"
import { getAppData } from "@/app/(app)/data"
import { getWorkshopBakimxOrders } from "@/app/(app)/bakimx-orders/data"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  BAKIMX_ORDER_STATUS_LABELS,
  type BakimxOrderStatusValue,
} from "@/lib/catalog/bakimx-order"
import { formatTRY } from "@/lib/format"
import { getPlanState, hasWorkshopFeature } from "@/lib/plan"
import { formatDiscountLabel } from "@/lib/parts/bakimx-price"
import { FeaturePaywall } from "@/components/billing/feature-paywall"
import { InlineFeatureUpsell } from "@/components/billing/inline-feature-upsell"

export const dynamic = "force-dynamic"

/**
 * Atölyenin BakımX sipariş talepleri (BAK-60).
 *
 * `/purchases` ile BİLEREK BİRLEŞTİRİLMEDİ: orası teknisyenin iş emrine
 * dışarıdan aldığı parçaların (`ServiceOrderItem.source = purchase`) listesi ve
 * arkasında bir sipariş modeli yok. İkisini tek ekranda toplamak "dış tedarikçi"
 * ile "BakımX'ten talep"i aynı şey gibi gösterirdi.
 *
 * Yeni sipariş kapısı `procurement` özelliğidir. Paket küçüldüğünde daha önce
 * taahhüt edilmiş siparişler mutabakat için okunabilir kalır.
 */
const STATUS_BADGE: Record<BakimxOrderStatusValue, { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  requested: { variant: "outline" },
  confirmed: { variant: "secondary" },
  shipped: { variant: "default", className: "bg-success/15 text-success-strong" },
  cancelled: { variant: "destructive" },
}

export default async function BakimxOrdersPage() {
  const { user, workshop } = await getAppData()
  // Sorgu daima oturumdaki atölyeyle süzülür — başka atölyenin siparişi görünmez.
  const orders = await getWorkshopBakimxOrders(user.workshopId)
  const canCreate = !!workshop && hasWorkshopFeature(workshop, "procurement")
  const currentTier = workshop ? getPlanState(workshop).tier : "lite"

  if (!canCreate && orders.length === 0) {
    return <FeaturePaywall feature="procurement" currentTier={currentTier} itemCount={0} />
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle="BakımX Siparişleri" wide>
      <div className="space-y-5 sm:space-y-6">
        <div className="hidden sm:flex items-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Ana Panel
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">BakımX Siparişleri</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">BakımX Siparişleri</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            BakımX kataloğundan istediğiniz ürünler ve talebin durumu
          </p>
        </div>

        {!canCreate && (
          <InlineFeatureUpsell feature="procurement" currentTier={currentTier} />
        )}

        {orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <PackageSearch className="size-14 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-base font-medium">Henüz sipariş talebiniz yok</p>
            <p className="text-sm mt-1">
              Parça seçicideki BakımX ürün satırında “Sipariş ver” ile talep oluşturabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const badge = STATUS_BADGE[order.status]
              return (
                <Card key={order.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={badge.variant} className={badge.className}>
                          {BAKIMX_ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {order.createdAt.toLocaleString("tr-TR")} tarihinde talep edildi
                        </span>
                        {order.shippedAt && (
                          <span className="text-xs text-success-strong">
                            · {order.shippedAt.toLocaleString("tr-TR")} tarihinde gönderildi
                          </span>
                        )}
                        {order.cancelledAt && (
                          <span className="text-xs text-destructive-strong">
                            · {order.cancelledAt.toLocaleString("tr-TR")} tarihinde iptal edildi
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatTRY(order.totalKurus)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">KDV hariç</span>
                      </span>
                    </div>

                    <ul className="divide-y divide-border/60 text-sm">
                      {order.items.map((item) => {
                        const discountNote = formatDiscountLabel(item.discountBps)
                        return (
                          <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                            <span className="font-medium text-foreground">{item.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                            <span className="text-xs text-muted-foreground">
                              · {item.quantity} adet × {formatTRY(item.unitPriceKurus)}
                            </span>
                            {discountNote && (
                              <span className="text-xs text-success-strong">· {discountNote}</span>
                            )}
                          </li>
                        )
                      })}
                    </ul>

                    {order.note && (
                      <p className="text-xs text-muted-foreground">Not: {order.note}</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
