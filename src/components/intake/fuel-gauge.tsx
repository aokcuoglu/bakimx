"use client"

import { cn } from "@/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { FUEL_LEVELS, formatFuelLevel, fuelNeedlePoint, isLowFuel } from "@/lib/fuel-level"

const GAUGE_WIDTHS = {
  sm: "w-14",
  md: "w-28",
} as const

/**
 * Araç göstergesine benzeyen yarım-ay yakıt kadranı (salt görünüm).
 * Geometri src/lib/fuel-level.ts ile ortak — PDF çıktısı da aynı kadranı üretir.
 */
export function FuelGauge({
  value,
  size = "md",
  showLabel = true,
  className,
}: {
  value: number
  size?: keyof typeof GAUGE_WIDTHS
  showLabel?: boolean
  className?: string
}) {
  const needle = fuelNeedlePoint(value)
  const arcEnd = fuelNeedlePoint(value, 40)
  const low = isLowFuel(value)

  return (
    <div className={cn("inline-flex flex-col items-center gap-0.5", className)}>
      <svg
        viewBox="0 0 100 62"
        className={cn(GAUGE_WIDTHS[size], low ? "text-destructive" : "text-primary")}
        role="img"
        aria-label={`Yakıt seviyesi: ${formatFuelLevel(value)}`}
      >
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" strokeWidth={8} strokeLinecap="round" className="stroke-muted" />
        {value > 0 && (
          <path
            d={`M 10 50 A 40 40 0 0 1 ${arcEnd.x.toFixed(2)} ${arcEnd.y.toFixed(2)}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={8}
            strokeLinecap="round"
          />
        )}
        <line
          x1="50"
          y1="50"
          x2={needle.x.toFixed(2)}
          y2={needle.y.toFixed(2)}
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
        />
        <circle cx="50" cy="50" r="4" fill="currentColor" />
        <text x="4" y="61" fontSize="11" className="fill-muted-foreground">E</text>
        <text x="86" y="61" fontSize="11" className="fill-muted-foreground">F</text>
      </svg>
      {showLabel && (
        <span className={cn("text-xs font-medium", low ? "text-destructive" : "text-foreground")}>
          {formatFuelLevel(value)}
        </span>
      )}
    </div>
  )
}

/**
 * Kadran + 5 kademeli seçim. Seçili kademeye tekrar dokunmak seçimi kaldırır
 * (Base UI ToggleGroup davranışı) → değer null olur = "ölçülmedi".
 */
export function FuelLevelPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-center">
        <FuelGauge
          value={value ?? 0}
          size="md"
          showLabel={false}
          className={value == null ? "opacity-40" : undefined}
        />
      </div>
      <ToggleGroup
        value={value != null ? [String(value)] : []}
        onValueChange={(v) => onChange(v.length ? Number(v[0]) : null)}
        variant="outline"
        size="lg"
        disabled={disabled}
        className="w-full"
      >
        {FUEL_LEVELS.map((level) => (
          <ToggleGroupItem key={level} value={String(level)} className="flex-1">
            {formatFuelLevel(level)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
