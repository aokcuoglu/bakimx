import Link from "next/link"
import { BarChart3, CalendarClock, Camera, CircleAlert, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PHOTO_UPLOAD_POLICY } from "@/lib/plans-catalog"
import type { PlanState } from "@/lib/plan"
import type { WorkshopQuotaUsage } from "@/lib/rapidapi-quota"
import { USAGE_TONE_LABELS, summarizeSeatUsage, usagePercent, usageTone, type UsageTone } from "@/lib/billing/usage"
import { cn } from "@/lib/utils"

type SeatUsage = { activeUsers: number; pendingInvites: number; used: number }

const meterToneClasses: Record<UsageTone, string> = {
  normal: "bg-primary",
  warning: "bg-warning",
  critical: "bg-destructive",
}

function formatDate(date: Date | null): string {
  if (!date) return "Tarih belirtilmemiş"
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(date)
}

function UsageMeter({ used, limit, label }: { used: number; limit: number; label: string }) {
  const percent = usagePercent(used, limit)
  const tone = usageTone(used, limit)
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <Badge
          variant={tone === "critical" ? "destructive" : "secondary"}
          className={tone === "warning" ? "bg-warning/10 text-warning-strong" : undefined}
        >
          {USAGE_TONE_LABELS[tone]}
        </Badge>
        <span className="text-muted-foreground">%{percent} kullanıldı</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-valuetext={`${used} / ${limit}, ${USAGE_TONE_LABELS[tone]}`}
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full", meterToneClasses[tone])} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function UpgradeAction({ canPurchase, children }: { canPurchase: boolean; children: React.ReactNode }) {
  if (!canPurchase) {
    return <p className="text-xs text-muted-foreground">Paket değişikliği için yöneticinizle görüşün.</p>
  }
  return (
    <Button asChild size="sm" variant="outline">
      <Link href="#paketler">{children}</Link>
    </Button>
  )
}

export function BillingUsageCards({
  plan,
  planName,
  billingCycle,
  seatUsage,
  includedSeats,
  extraSeats,
  quota,
  photoEnabled,
  canPurchase,
  receiptHref,
}: {
  plan: PlanState
  planName: string
  billingCycle: "monthly" | "yearly" | null
  seatUsage: SeatUsage
  includedSeats: number
  extraSeats: number
  quota: WorkshopQuotaUsage
  photoEnabled: boolean
  canPurchase: boolean
  receiptHref?: string
}) {
  const seats = summarizeSeatUsage({ ...seatUsage, includedSeats, extraSeats })
  const cycleLabel = billingCycle === "yearly" ? "Yıllık dönem" : billingCycle === "monthly" ? "Aylık dönem" : "Dönem bilgisi yok"
  const paidPeriodLabel = plan.currentPeriodEnd
    ? `${cycleLabel} · ${formatDate(plan.currentPeriodEnd)} tarihinde yenilenir veya sona erer.`
    : `${cycleLabel} · Yenilenme/bitiş tarihi belirtilmemiş.`

  return (
    <section id="kullanim" aria-labelledby="kullanim-baslik" className="scroll-mt-24 space-y-4">
      <div>
        <h2 id="kullanim-baslik" className="text-lg font-bold text-foreground">Gerçek kullanımınız</h2>
        <p className="text-sm text-muted-foreground">Paket haklarınız ve bu aya ait tenant kullanımı.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-5 text-primary" aria-hidden="true" /> Abonelik
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {plan.isTrialing ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground">Ücretsiz deneme</p>
                  <Badge>Premium deneme hakları</Badge>
                </div>
                <p className="text-muted-foreground">
                  {plan.trialDaysLeft ?? 0} iş günü kaldı ·{" "}
                  {plan.trialEndsAt
                    ? `${formatDate(plan.trialEndsAt)} tarihinde biter.`
                    : "Deneme bitiş tarihi belirtilmemiş."}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-foreground">{planName}</p>
                <p className="text-muted-foreground">{paidPeriodLabel}</p>
              </>
            )}
            {!plan.hasAccess && (
              <p className="inline-flex items-start gap-1.5 text-destructive-strong">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Abonelik erişimi aktif değil.
              </p>
            )}
            {receiptHref && (
              <a href={receiptHref} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Son ödeme makbuzunu görüntüle
              </a>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-5 text-primary" aria-hidden="true" /> Koltuk kullanımı
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-2xl font-bold text-foreground">
              {seats.used.toLocaleString("tr-TR")} / {seats.limit.toLocaleString("tr-TR")}
            </p>
            <UsageMeter used={seats.used} limit={seats.limit} label="Koltuk kullanımı" />
            <p className="text-muted-foreground">
              {seats.activeUsers} aktif kullanıcı + {seats.pendingInvites} süresi geçmemiş davet
            </p>
            <p className="text-xs text-muted-foreground">
              {seats.includedSeats} dahil koltuk{seats.extraSeats > 0 ? ` + ${seats.extraSeats} ek koltuk` : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-5 text-primary" aria-hidden="true" /> Aylık sorgu kullanımı
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {quota.baseQuota <= 0 ? (
              <>
                <p className="font-semibold text-foreground">Paketinizde bulunmuyor</p>
                <p className="text-muted-foreground">Şase ve canlı TecDoc katalog sorguları Profesyonel ve Premium paketlerde yer alır.</p>
                <UpgradeAction canPurchase={canPurchase}>Paketi yükselt</UpgradeAction>
              </>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <p className="text-2xl font-bold text-foreground">
                    {quota.used.toLocaleString("tr-TR")} / {quota.totalCap.toLocaleString("tr-TR")}
                  </p>
                  <span className="text-xs text-muted-foreground">{quota.remaining.toLocaleString("tr-TR")} kalan</span>
                </div>
                <UsageMeter used={quota.used} limit={quota.totalCap} label="Aylık şase ve katalog sorgu kullanımı" />
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">VIN</dt><dd className="text-right font-medium text-foreground">{quota.vinUsed.toLocaleString("tr-TR")}</dd>
                  <dt className="text-muted-foreground">TecDoc</dt><dd className="text-right font-medium text-foreground">{quota.tecdocUsed.toLocaleString("tr-TR")}</dd>
                  <dt className="text-muted-foreground">Paket kotası</dt><dd className="text-right font-medium text-foreground">{quota.baseQuota.toLocaleString("tr-TR")}</dd>
                  <dt className="text-muted-foreground">Ek kota</dt><dd className="text-right font-medium text-foreground">{quota.extraQuota.toLocaleString("tr-TR")}</dd>
                </dl>
                <p className="text-xs text-muted-foreground">{formatDate(quota.renewsAt)} tarihinde yenilenir.</p>
                {canPurchase && (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/billing/quota/purchase">Ek kota seçenekleri</Link>
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="size-5 text-primary" aria-hidden="true" /> Fotoğraf kuralları
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {photoEnabled ? (
            <>
              <p className="font-medium text-foreground">İş emri başına en fazla {PHOTO_UPLOAD_POLICY.maxActivePerWorkOrder} aktif fotoğraf</p>
              <p className="text-muted-foreground">
                Tek seçimde {PHOTO_UPLOAD_POLICY.maxPerSelection} fotoğraf; dosya başına {PHOTO_UPLOAD_POLICY.rawSelectionMb} MB ham seçim,
                yaklaşık {PHOTO_UPLOAD_POLICY.compressionTargetMb} MB sıkıştırma hedefi ve {PHOTO_UPLOAD_POLICY.serverLimitMb} MB sunucu sınırı.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-foreground">Paketinizde bulunmuyor</p>
              <p className="text-muted-foreground">İş emri fotoğraf checklist’i Profesyonel ve Premium paketlerde yer alır.</p>
              <UpgradeAction canPurchase={canPurchase}>Paketi yükselt</UpgradeAction>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
