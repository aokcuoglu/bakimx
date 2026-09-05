import { BarChart3, Zap, ArrowUpCircle } from "lucide-react"
import Link from "next/link"
import { AppShell } from "@/components/layout/app-shell"
import { getAppData } from "@/app/(app)/data"
import { VIN_LOOKUP_QUOTA, type PlanTier } from "@/lib/plan"
import { workshopMonthlyCap, countWorkshopCallsThisMonth } from "@/lib/rapidapi-quota"
import { getPlanPackage } from "@/lib/plans-catalog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata = { title: "Kota Yönetimi" }

export default async function QuotaPage() {
  const { workshop } = await getAppData()

  if (!workshop) {
    return (
      <AppShell pageTitle="Kota Yönetimi">
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
  const used = await countWorkshopCallsThisMonth(workshop.id)
  const pct = totalCap > 0 ? Math.min(100, Math.round((used / totalCap) * 100)) : 0
  const ownedPkg = getPlanPackage(tier)

  return (
    <AppShell workshopName={workshop.name} pageTitle="Kota Yönetimi">
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Kota Yönetimi</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Şase ve parça sorgu kota durumunuzu görüntüleyin
          </p>
        </div>

        {/* Current Quota */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-5 text-primary" />
              Aylık Kota Kullanımı
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-foreground">
                {used.toLocaleString("tr-TR")}
              </span>
              <span className="text-sm text-muted-foreground">
                / {totalCap.toLocaleString("tr-TR")} sorgu
              </span>
            </div>

            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-primary"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{pct}% kullanıldı</span>
              <span>{Math.max(0, totalCap - used).toLocaleString("tr-TR")} kalan</span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-muted-foreground">Paket kotası</p>
                <p className="font-semibold text-foreground">{baseQuota.toLocaleString("tr-TR")}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-muted-foreground">Ek kota</p>
                <p className="font-semibold text-foreground">{extraQuota.toLocaleString("tr-TR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upgrade / Extra Quota */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="size-5 text-primary" />
              Kota Artırma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mevcut paketinizdeki kota yetersiz mi? Ek kota satın alarak veya paketinizi yükselterek limitinizi artırabilirsiniz.
            </p>

            <div className="flex flex-col gap-3">
              <Button asChild variant="outline" className="justify-start gap-3 h-auto py-4">
                <Link href="/billing/quota/purchase">
                  <ArrowUpCircle className="size-5 text-primary shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">Ek Kota Satın Al</p>
                    <p className="text-xs text-muted-foreground">Mevcut paketinize ek kota ekleyin</p>
                  </div>
                </Link>
              </Button>

              <Button asChild variant="outline" className="justify-start gap-3 h-auto py-4">
                <Link href="/billing">
                  <ArrowUpCircle className="size-5 text-primary shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">Paket Yükselt</p>
                    <p className="text-xs text-muted-foreground">
                      Daha yüksek pakete geçerek kota limitinizi artırın
                      {ownedPkg && ` (mevcut: ${ownedPkg.name})`}
                    </p>
                  </div>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground space-y-1">
          <p>Kota, her ayın başında sıfırlanır.</p>
          <p>Şase ve parça sorguları aynı kota dahildir.</p>
          <p>Ek kota satin alma islemi onaydan sonra 24 saat icinde aktiflesir.</p>
        </div>
      </div>
    </AppShell>
  )
}
