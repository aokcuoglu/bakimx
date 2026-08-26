import { ArrowLeft, Zap } from "lucide-react"
import Link from "next/link"
import { AppShell } from "@/components/layout/app-shell"
import { getAppData } from "@/app/(app)/data"
import { VIN_LOOKUP_QUOTA, type PlanTier } from "@/lib/plan"
import { workshopMonthlyCap } from "@/lib/rapidapi-quota"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Ek Kota Satın Al" }

const EXTRA_QUOTA_OPTIONS = [
  { amount: 1_000, priceLabel: "₺199", description: "1.000 ek sorgu/ay" },
  { amount: 3_000, priceLabel: "₺499", description: "3.000 ek sorgu/ay" },
  { amount: 5_000, priceLabel: "₺799", description: "5.000 ek sorgu/ay" },
  { amount: 10_000, priceLabel: "₺1.499", description: "10.000 ek sorgu/ay" },
]

export default async function PurchaseQuotaPage() {
  const { workshop } = await getAppData()

  if (!workshop) {
    return (
      <AppShell pageTitle="Ek Kota Satın Al">
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  const tier = workshop.planTier as PlanTier
  const baseQuota = VIN_LOOKUP_QUOTA[tier] ?? 0
  const extraQuota = workshop.extraVinQuota ?? 0
  const totalCap = workshopMonthlyCap(tier, extraQuota)

  return (
    <AppShell workshopName={workshop.name} pageTitle="Ek Kota Satın Al">
      <div className="space-y-6 max-w-2xl">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/billing/quota">
                <ArrowLeft className="size-4" />
                Geri
              </Link>
            </Button>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Ek Kota Satın Al</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mevcut paketinize ek kota ekleyerek sorgu limitinizi artırın
          </p>
        </div>

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mevcut Durum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Paket kotası</p>
                <p className="font-semibold text-foreground">{baseQuota.toLocaleString("tr-TR")}/ay</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ek kota</p>
                <p className="font-semibold text-foreground">{extraQuota.toLocaleString("tr-TR")}/ay</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Toplam kota</p>
                <p className="font-semibold text-foreground">{totalCap.toLocaleString("tr-TR")}/ay</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Extra Quota Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="size-5 text-primary" />
              Ek Kota Seçenekleri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {EXTRA_QUOTA_OPTIONS.map((option) => (
              <div
                key={option.amount}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-foreground">{option.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Aylık toplam kota: {(totalCap + option.amount).toLocaleString("tr-TR")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-foreground">{option.priceLabel}</span>
                  <Button size="sm">Satın Al</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Info */}
        <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground space-y-1">
          <p>Ek kota satın alımı Havale/EFT ile yapılır.</p>
          <p>Ödeme onayından sonra kota 24 saat içinde aktifleşir.</p>
          <p>Ek kota mevcut paket kotasının üzerine eklenir.</p>
          <p>Kota her ayın başında sıfırlanır, bir sonraki aya devretmez.</p>
        </div>
      </div>
    </AppShell>
  )
}
