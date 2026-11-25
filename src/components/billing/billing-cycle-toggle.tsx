"use client"

import type { ReactNode } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

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
      // iOS segment: gri ray + seçili beyaz kart primitive'den (#889).
      variant="segment"
      size="control"
      aria-label={label}
      className={fullWidth ? "grid w-full grid-cols-2" : "inline-grid grid-cols-[auto_auto]"}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as BillingCycleValue)
      }}
    >
      {(["monthly", "yearly"] as const).map((cycle) => (
        <ToggleGroupItem
          key={cycle}
          value={cycle}
          className="min-w-0 tracking-[-0.07px]"
        >
          {cycle === "monthly" ? "Aylık" : "Yıllık"}
          {cycle === "yearly" && yearlyHint && (
            <span className="rounded-md bg-primary/10 px-1 text-[11px] font-medium leading-4 text-primary-strong"><span className="sr-only">, </span>{yearlyHint}{yearlyHintSrSuffix && <span className="sr-only">{yearlyHintSrSuffix}</span>}</span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
