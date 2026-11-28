import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"
import {
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

const DD = "shrink-0 whitespace-nowrap tabular-nums"

/**
 * Satırlar (`div > dt + dd`), sarmalayıcısız: bir `dl`in içine girer. Ek özellik
 * yoksa hiçbir şey çizmez. `packageAmountMinor` verilirse paket satırı ve toplam
 * da çizilir. Tüm tutarlar tek biçimleyiciyle (`formatMinor`) yazılır.
 */
export function OrderSummaryRows({
  addonLines,
  cycle,
  packageLabel,
  packageAmountMinor,
  totalLabel = "Toplam",
  tone = "default",
}: {
  addonLines: readonly AddonOrderLine[]
  cycle: Cycle
  packageLabel?: string
  packageAmountMinor?: number
  totalLabel?: string
  tone?: keyof typeof TONES
}) {
  if (addonLines.length === 0) return null
  const t = TONES[tone]
  const cycleLabel = cycle === "yearly" ? "Yıllık" : "Aylık"
  const total = packageAmountMinor === undefined ? null : packageAmountMinor + sumAddonLines(addonLines)
  return (
    <>
      {packageAmountMinor !== undefined && (
        <div className="flex justify-between gap-3">
          <dt className={cn("min-w-0", t.dt)}>{packageLabel ?? "Paket"}</dt>
          <dd className={cn("font-semibold", DD, t.dd)}>{formatMinor(packageAmountMinor)}</dd>
        </div>
      )}
      {addonLines.map((l) => (
        <div key={l.key} className="flex justify-between gap-3">
          <dt className={cn("min-w-0", t.dt)}>
            {l.name} ({cycleLabel})
          </dt>
          <dd className={cn("font-semibold", DD, t.dd)}>{formatMinor(l.amountMinor)}</dd>
        </div>
      ))}
      {total !== null && (
        <div className={cn("flex justify-between gap-3 border-t pt-1.5", t.border)}>
          <dt className={cn("min-w-0 font-semibold", t.dd)}>{totalLabel}</dt>
          <dd className={cn("font-bold", DD, t.dd)}>{formatMinor(total)}</dd>
        </div>
      )}
    </>
  )
}

/** `OrderSummaryRows`un kendi `dl`i ile sarılmış hâli; ek özellik yoksa hiçbir şey çizmez. */
export function OrderSummaryLines({
  className,
  ...rows
}: ComponentProps<typeof OrderSummaryRows> & { className?: string }) {
  if (rows.addonLines.length === 0) return null
  return (
    <dl className={cn("space-y-1.5 text-sm", className)}>
      <OrderSummaryRows {...rows} />
    </dl>
  )
}
