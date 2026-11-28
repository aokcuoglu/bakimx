import { cn } from "@/lib/utils"
import {
  formatAddonMinor,
  isAddonOrderKey,
  priceRenewalAddonLines,
  type AddonOrderLine,
} from "@/lib/billing/addon-pricing"
import { formatMinor } from "@/lib/billing/pricing"

type Cycle = "monthly" | "yearly"

/** Yenilemede paket siparişine eklenecek satın alınmış ek özellik kalemleri (#1049). */
export function renewalAddonLines(keys: readonly string[] | undefined, cycle: Cycle): AddonOrderLine[] {
  return priceRenewalAddonLines({ keys: (keys ?? []).filter(isAddonOrderKey), cycle })
}

export function sumAddonLines(lines: readonly AddonOrderLine[]): number {
  return lines.reduce((sum, l) => sum + l.amountMinor, 0)
}

const TONES = {
  default: { dt: "text-muted-foreground", dd: "text-foreground", border: "border-border" },
  onNavy: { dt: "text-navy-foreground/55", dd: "text-navy-foreground", border: "border-white/10" },
} as const

/**
 * Paket + satın alınmış ek özellik satırları (`dl`). Ek özellik yoksa hiçbir
 * şey çizmez; çağıran mevcut düzenini korur. `packageAmountMinor` verilirse
 * paket satırı ve toplam da gösterilir.
 */
export function OrderSummaryLines({
  addonLines,
  cycle,
  packageLabel,
  packageAmountMinor,
  totalLabel = "Toplam",
  tone = "default",
  className,
}: {
  addonLines: readonly AddonOrderLine[]
  cycle: Cycle
  packageLabel?: string
  packageAmountMinor?: number
  totalLabel?: string
  tone?: keyof typeof TONES
  className?: string
}) {
  if (addonLines.length === 0) return null
  const t = TONES[tone]
  const cycleLabel = cycle === "yearly" ? "Yıllık" : "Aylık"
  const total = packageAmountMinor === undefined ? null : packageAmountMinor + sumAddonLines(addonLines)
  return (
    <dl className={cn("space-y-1.5 text-sm", className)}>
      {packageAmountMinor !== undefined && (
        <div className="flex justify-between gap-3">
          <dt className={t.dt}>{packageLabel ?? "Paket"}</dt>
          <dd className={cn("font-semibold", t.dd)}>{formatMinor(packageAmountMinor)}</dd>
        </div>
      )}
      {addonLines.map((l) => (
        <div key={l.key} className="flex justify-between gap-3">
          <dt className={t.dt}>
            {l.name} ({cycleLabel})
          </dt>
          <dd className={cn("shrink-0 font-semibold", t.dd)}>{formatAddonMinor(l.amountMinor)}</dd>
        </div>
      ))}
      {total !== null && (
        <div className={cn("flex justify-between gap-3 border-t pt-1.5", t.border)}>
          <dt className={cn("font-semibold", t.dd)}>{totalLabel}</dt>
          <dd className={cn("font-bold", t.dd)}>{formatMinor(total)}</dd>
        </div>
      )}
    </dl>
  )
}
