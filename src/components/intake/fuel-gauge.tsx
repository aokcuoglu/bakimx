"use client"

import { cn } from "@/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { FUEL_LEVELS, formatFuelLevel, fuelNeedlePoint, isFuelSegmentFilled, isLowFuel } from "@/lib/fuel-level"

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
        className={cn(GAUGE_WIDTHS[size], low ? "text-destructive-strong" : "text-primary")}
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
        {/* sm boyutta (56px) 11px'lik metin ~6px'e iner — okunmuyor, o yüzden gizli. */}
        {size === "md" && (
          <>
            <text x="4" y="61" fontSize="11" className="fill-muted-foreground">E</text>
            <text x="86" y="61" fontSize="11" className="fill-muted-foreground">F</text>
          </>
        )}
      </svg>
      {showLabel && (
        <span className={cn("text-xs font-medium", low ? "text-destructive-strong" : "text-foreground")}>
          {formatFuelLevel(value)}
        </span>
      )}
    </div>
  )
}

/**
 * 5 kademeli yakıt seçimi, tek sıra çubuk. Seçili kademeye tekrar dokunmak
 * seçimi kaldırır (Base UI ToggleGroup davranışı) → değer null = "ölçülmedi".
 *
 * Kadran (`FuelGauge`) bilinçli olarak burada YOK: alan mobilde ekranın çoğunu
 * kaplıyordu (#197). Kadran salt-okunur gösterimlerde (araç detayı, pasaport,
 * PDF) duruyor — orada zaten dar bir alanda tek bir değeri anlatıyor.
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
  const low = value != null && isLowFuel(value)

  return (
    <ToggleGroup
      type="single"
      value={value != null ? String(value) : ""}
      onValueChange={(v) => onChange(v ? Number(v) : null)}
      variant="outline"
      size="lg"
      // Bölmeler bitişik olsun ki beş ayrı buton değil tek bir çubuk okunsun.
      spacing={0}
      disabled={disabled}
      aria-label="Yakıt seviyesi"
      // Geniş kartlarda (iş emri düzenleme) çubuk sayfa boyunca yayılmasın.
      className="w-full max-w-sm"
    >
      {FUEL_LEVELS.map((level) => (
        <ToggleGroupItem
          key={level}
          value={String(level)}
          className={cn(
            "flex-1",
            // `data-[state=on]:` varyantları ŞART: outline varyantının kendi
            // `data-[state=on]:bg-muted` kuralı, düz `bg-*` sınıfını ezip seçili
            // bölmeyi açık zemin + beyaz metin (yani görünmez) bırakıyor.
            // (Radix `type="single"` grubunda öğeler `role="radio"` alır, yani
            // `aria-pressed` HİÇ basılmaz — durum yalnız `data-state`'te.)
            isFuelSegmentFilled(level, value) &&
              (low
                ? "bg-destructive text-destructive-foreground data-[state=on]:border-destructive data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground"
                : "bg-primary text-primary-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground")
          )}
        >
          {formatFuelLevel(level)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
