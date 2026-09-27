import Link from "next/link"
import { Camera, Coins, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PLAN_SEATS, type PlanState } from "@/lib/plan"
import { PHOTO_UPLOAD_POLICY } from "@/lib/plans-catalog"
import { summarizeSeatUsage, usagePercent } from "@/lib/billing/usage"
import type { WorkshopQuotaUsage } from "@/lib/rapidapi-quota"

type SeatUsage = { activeUsers: number; pendingInvites: number; used: number }

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={Math.min(used, limit)}
      aria-valuetext={`${used} / ${limit}`}
      className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${usagePercent(used, limit)}%` }} />
    </div>
  )
}

export function BillingUsagePanel({ plan, seatUsage, extraSeats, quota, canPurchase }: {
  plan: PlanState
  seatUsage: SeatUsage
  extraSeats: number
  quota: WorkshopQuotaUsage
  canPurchase: boolean
}) {
  const seats = summarizeSeatUsage({ ...seatUsage, includedSeats: PLAN_SEATS[plan.accessTier], extraSeats })
  return (
    <section id="kullanim" aria-labelledby="kullanim-baslik" className="scroll-mt-24 rounded-xl border bg-card">
      <div className="border-b px-5 py-4 sm:px-6">
        <h2 id="kullanim-baslik" className="text-base font-semibold">Kullanım</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Etkin paket haklarınızın bu ayki durumu.</p>
      </div>
      <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-medium"><Users className="size-4 text-muted-foreground" aria-hidden="true" /> Koltuklar</p>
          <p className="mt-4 text-xl font-semibold">{seats.used.toLocaleString("tr-TR")} <span className="text-sm font-normal text-muted-foreground">/ {seats.limit.toLocaleString("tr-TR")}</span></p>
          <Meter label="Koltuk kullanımı" used={seats.used} limit={seats.limit} />
          <p className="mt-2 text-xs text-muted-foreground">{seatUsage.activeUsers} aktif kullanıcı · {seatUsage.pendingInvites} davet</p>
        </div>
        <div className="p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-medium"><Camera className="size-4 text-muted-foreground" aria-hidden="true" /> Kullanımlar</p>
          <p className="mt-4 text-sm font-medium">{plan.accessTier === "lite" ? "Fotoğraf kontrol listesi yok" : `İş emri başına ${PHOTO_UPLOAD_POLICY.maxActivePerWorkOrder} aktif fotoğraf`}</p>
          <p className="mt-2 text-xs text-muted-foreground">İş emri bazında kullanılan fotoğraf hakkını görün.</p>
          <Button asChild variant="outline" size="compact" className="mt-4"><Link href="/settings/billing/record-usage">Kullanımı gör</Link></Button>
        </div>
        <div className="p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-medium"><Coins className="size-4 text-muted-foreground" aria-hidden="true" /> Krediler</p>
          {quota.totalCap > 0 ? (
            <>
              <p className="mt-4 text-xl font-semibold">{quota.used.toLocaleString("tr-TR")} <span className="text-sm font-normal text-muted-foreground">/ {quota.totalCap.toLocaleString("tr-TR")}</span></p>
              <Meter label="Aylık katalog kredisi kullanımı" used={quota.used} limit={quota.totalCap} />
              <p className="mt-2 text-xs text-muted-foreground">VIN {quota.vinUsed.toLocaleString("tr-TR")} · TecDoc {quota.tecdocUsed.toLocaleString("tr-TR")} · Kalan {quota.remaining.toLocaleString("tr-TR")}</p>
            </>
          ) : <p className="mt-4 text-sm text-muted-foreground">Paketinizde bulunmuyor.</p>}
          <Button asChild variant="outline" size="compact" className="mt-4"><Link href="/settings/billing/automation-credit-usage">Kredileri gör</Link></Button>
          {!canPurchase && <p className="mt-2 text-xs text-muted-foreground">Paket değişikliği için yöneticinizle görüşün.</p>}
        </div>
      </div>
      <p className="border-t px-5 py-3 text-xs leading-5 text-muted-foreground sm:px-6">
        Fotoğraf kuralları: tek seçimde {PHOTO_UPLOAD_POLICY.maxPerSelection} fotoğraf, dosya başına {PHOTO_UPLOAD_POLICY.rawSelectionMb} MB ham seçim,
        yaklaşık {PHOTO_UPLOAD_POLICY.compressionTargetMb} MB sıkıştırma hedefi ve {PHOTO_UPLOAD_POLICY.serverLimitMb} MB sunucu sınırı.
      </p>
    </section>
  )
}
