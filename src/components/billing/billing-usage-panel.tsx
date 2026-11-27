import Link from "next/link"
import { Camera, ChevronRight, Coins, Info, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { PlanState } from "@/lib/plan"
import { PHOTO_UPLOAD_POLICY } from "@/lib/plans-catalog"
import { summarizeSeatUsage, usagePercent } from "@/lib/billing/usage"
import type { WorkshopQuotaUsage } from "@/lib/rapidapi-quota"

type SeatUsage = { activeUsers: number; pendingInvites: number; used: number }

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit}
      aria-valuenow={Math.min(used, limit)} aria-valuetext={`${used} / ${limit}`}
      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${usagePercent(used, limit)}%` }} />
    </div>
  )
}

function UsageHeading({ title, description, icon: Icon }: {
  title: string
  description: string
  icon: typeof Users
}) {
  return (
    <div className="flex min-h-7 items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <Tooltip>
        <TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-xs" aria-label={`${title} hakkında bilgi`}><Info className="size-3.5" /></Button></TooltipTrigger>
        <TooltipContent side="top">{description}</TooltipContent>
      </Tooltip>
    </div>
  )
}

export function BillingUsagePanel({ plan, seatUsage, extraSeats, quota, canPurchase, onManageSeats }: {
  plan: PlanState
  seatUsage: SeatUsage
  extraSeats: number
  quota: WorkshopQuotaUsage
  canPurchase: boolean
  onManageSeats: () => void
}) {
  const shared = quota.workshopCount > 1
  const seats = summarizeSeatUsage({ ...seatUsage, includedSeats: plan.includedSeats, extraSeats })
  return (
    <section id="kullanim" aria-label="Paket kullanımı" className="scroll-mt-24 border-t">
      <div className="grid gap-5 p-4 sm:grid-cols-3 sm:p-5">
        <div className="flex min-w-0 flex-col">
          <UsageHeading title="Koltuklar" icon={Users} description="Aktif üyeler ve bekleyen davetler koltuk hakkınızdan düşer." />
          <div className="mt-4">
            <p className="text-sm font-semibold tabular-nums">{seats.used.toLocaleString("tr-TR")} <span className="font-normal text-muted-foreground">/ {seats.limit.toLocaleString("tr-TR")}</span></p>
            <Meter label="Koltuk kullanımı" used={seats.used} limit={seats.limit} />
          </div>
          <div className="mt-auto pt-5"><Button type="button" variant="outline" size="sm" onClick={onManageSeats}>Üyeleri yönet</Button></div>
        </div>
        <div className="flex min-w-0 flex-col">
          <UsageHeading title="Kullanımlar" icon={Camera} description="Fotoğraf hakkı her araç kabulü için ayrıdır. Silinmiş fotoğraflar aktif kullanıma dahil edilmez." />
          <div className="mt-4">
            <p className="text-sm font-semibold">{plan.accessTier === "lite" ? "Fotoğraf hakkı yok" : <>{PHOTO_UPLOAD_POLICY.maxActivePerWorkOrder} <span className="font-normal text-muted-foreground">fotoğraf / araç kabulü</span></>}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">Araç kabul bazında kullanımı görün</p>
          </div>
          <div className="mt-auto pt-5"><Button asChild variant="outline" size="sm"><Link href="/settings/billing/record-usage">Kullanım <ChevronRight className="size-3.5" /></Link></Button></div>
        </div>
        <div className="flex min-w-0 flex-col">
          <UsageHeading title="Krediler" icon={Coins} description={canPurchase ? `VIN ve TecDoc sorguları ${shared ? "hesabın tüm şubeleriyle paylaşılan " : ""}aynı aylık katalog hakkını kullanır. Kullanım her ayın başında yenilenir.` : `VIN ve TecDoc, ${shared ? "hesap genelinde paylaşılan " : ""}aynı aylık hakkı kullanır. Paket değişikliği için yöneticinizle görüşün.`} />
          <div className="mt-4">
            {quota.totalCap > 0 ? (
              <><p className="text-sm font-semibold tabular-nums">{quota.used.toLocaleString("tr-TR")} <span className="font-normal text-muted-foreground">/ {quota.totalCap.toLocaleString("tr-TR")}</span></p><Meter label="Aylık katalog kredisi kullanımı" used={quota.used} limit={quota.totalCap} />{shared && <p className="mt-1.5 text-xs text-muted-foreground">Hesap genelinde, tüm şubeler için</p>}</>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Paketinizde bulunmuyor</p>
                <p className="mt-1.5 text-xs text-muted-foreground">Şaseden parça ek özelliktir; yakında uygulama içinden satın alınabilecek.</p>
              </>
            )}
          </div>
          <div className="mt-auto pt-5"><Button asChild variant="outline" size="sm"><Link href="/settings/billing/automation-credit-usage">Kullanım <ChevronRight className="size-3.5" /></Link></Button></div>
        </div>
      </div>
    </section>
  )
}
