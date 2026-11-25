"use client"

import type { ReactNode } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export type BillingCycleValue = "monthly" | "yearly"

/**
 * Aylık / Yıllık dönem seçici — paket kartı, ayarlar, abonelik yöneticisi ve
 * satın alma sihirbazının ortak kopyası. Öğeler `size="control"` (telefonda
 * 44px, md+ 36px); yükseklik çağrı yerinde ezilmez.
 */
export function BillingCycleToggle({
  value,
  onChange,
  yearlyHint,
  fullWidth = false,
  yearlyHintSrSuffix,
  label = "Faturalama dönemi",
}: {
  value: BillingCycleValue
  onChange: (value: BillingCycleValue) => void
  /** "Yıllık" etiketinin yanındaki çip (örn. %17, 2 ay bedava). */
  yearlyHint?: ReactNode
  fullWidth?: boolean
  /** Çipin ekran okuyucu eki (örn. " indirim"); görünür metni değiştirmez. */
  yearlyHintSrSuffix?: string
  label?: string
}) {
  return (
    <ToggleGroup
      type="single"
      size="control"
      spacing={1}
      aria-label={label}
      className={cn(
        "gap-0.5 rounded-lg bg-muted p-0.5",
        fullWidth ? "grid w-full grid-cols-2" : "inline-grid grid-cols-2"
      )}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as BillingCycleValue)
      }}
    >
      {(["monthly", "yearly"] as const).map((cycle) => (
        <ToggleGroupItem
          key={cycle}
          value={cycle}
          className="min-w-0 rounded-lg text-sm font-medium tracking-[-0.07px] text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:!bg-card data-[state=on]:!text-foreground data-[state=on]:shadow-[inset_0_0_0_1px_var(--border),0_1px_2px_-1px_rgba(0,0,0,0.12)]"
        >
          {cycle === "monthly" ? "Aylık" : "Yıllık"}
          {cycle === "yearly" && yearlyHint && (
            <span className="rounded-md bg-primary/10 px-1 text-[11px] font-medium leading-4 text-primary-strong">{yearlyHint}{yearlyHintSrSuffix && <span className="sr-only">{yearlyHintSrSuffix}</span>}</span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
