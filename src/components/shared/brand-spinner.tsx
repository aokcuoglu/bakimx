import { cn } from "@/lib/utils"

/**
 * Markalı yükleme animasyonu — oto servis/bakım temalı.
 * Birbirine geçen iki dişli (marka mavisi + navy) zıt yönde döner;
 * "servis/bakım sürüyor" hissini verir. Saf CSS animasyonu (JS yok).
 */

const TOOTH = { w: 3.4, len: 5, ringR: 8.6, ringW: 4.4, hubR: 2.6 }

/** Tek dişli — kendi 32×32 viewBox'ında ortalı; svg animate-spin ile döner. */
function Gear({ teeth, colorClass }: { teeth: number; colorClass: string }) {
  return (
    <g className={colorClass}>
      {Array.from({ length: teeth }).map((_, i) => (
        <rect
          key={i}
          x={16 - TOOTH.w / 2}
          y={16 - TOOTH.ringR - TOOTH.len + 1.5}
          width={TOOTH.w}
          height={TOOTH.len}
          rx={1.2}
          fill="currentColor"
          transform={`rotate(${(360 / teeth) * i} 16 16)`}
        />
      ))}
      {/* Halka gövde (ortası boş — her zeminde temiz durur) */}
      <circle
        cx={16}
        cy={16}
        r={TOOTH.ringR}
        fill="none"
        stroke="currentColor"
        strokeWidth={TOOTH.ringW}
      />
      {/* Göbek */}
      <circle cx={16} cy={16} r={TOOTH.hubR} fill="currentColor" />
    </g>
  )
}

export function BrandSpinner({
  size = 48,
  label,
  className,
}: {
  /** Genel boyut (px). */
  size?: number
  /** Altta gösterilecek opsiyonel metin (ör. "Yükleniyor…"). */
  label?: string
  className?: string
}) {
  const big = Math.round(size * 0.72)
  const small = Math.round(size * 0.52)

  return (
    <div
      role="status"
      aria-label={label ?? "Yükleniyor"}
      className={cn("flex flex-col items-center gap-3", className)}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Büyük dişli — saat yönünde */}
        <svg
          viewBox="0 0 32 32"
          className="absolute left-0 top-0 animate-spin motion-reduce:animate-none"
          style={{ width: big, height: big, animationDuration: "2.6s" }}
          aria-hidden="true"
        >
          <Gear teeth={9} colorClass="text-brand" />
        </svg>
        {/* Küçük dişli — ters yönde, farklı hız (mekanik his) */}
        <svg
          viewBox="0 0 32 32"
          className="absolute bottom-0 right-0 animate-spin motion-reduce:animate-none"
          style={{
            width: small,
            height: small,
            animationDuration: "1.9s",
            animationDirection: "reverse",
          }}
          aria-hidden="true"
        >
          <Gear teeth={7} colorClass="text-navy dark:text-brand/70" />
        </svg>
      </div>
      {label && (
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      )}
      <span className="sr-only">Yükleniyor</span>
    </div>
  )
}
