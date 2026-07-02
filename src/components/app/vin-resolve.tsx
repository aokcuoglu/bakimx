"use client"

import { Button } from "@/components/ui/button"
import { Loader2, ScanLine, Check, BadgeCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VinCandidate } from "@/lib/vin/types"

export type { VinCandidate }

/** "VIN'den getir" — manual trigger next to the VIN input. */
export function VinResolveButton({
  loading,
  disabled,
  onClick,
}: {
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled || loading}
      className="gap-2 shrink-0"
      title="Şase numarasından marka, model ve motor bilgilerini getir"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
      VIN&apos;den getir
    </Button>
  )
}

/**
 * Engine-variant picker shown when the VIN maps to several catalog types and
 * the ruhsat hints can't pick a confident winner. Mobile-first tappable rows.
 */
export function VinCandidateList({
  candidates,
  selectedId,
  onSelect,
  onDismiss,
}: {
  candidates: VinCandidate[]
  selectedId: number | null
  onSelect: (candidate: VinCandidate) => void
  onDismiss: () => void
}) {
  if (candidates.length === 0) return null
  return (
    <div className="rounded-md border border-border bg-muted/30 p-2 space-y-1">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-xs font-medium text-muted-foreground">
          Katalogda {candidates.length} motor varyantı bulundu — aracınıza uyanı seçin
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Vazgeç
        </button>
      </div>
      {candidates.map((c, i) => {
        const selected = selectedId === c.vehicleTypeId
        return (
          <button
            key={c.vehicleTypeId}
            type="button"
            onClick={() => onSelect(c)}
            className={cn(
              "w-full min-h-11 flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
              selected
                ? "border-primary bg-primary/5 text-foreground"
                : "border-transparent bg-background hover:border-border"
            )}
          >
            <span className={cn("size-4 shrink-0", selected ? "text-primary" : "text-transparent")}>
              <Check className="size-4" />
            </span>
            <span className="flex-1">{c.label}</span>
            {i === 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium px-2 py-0.5 shrink-0">
                <BadgeCheck className="size-3" />
                En uygun
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
