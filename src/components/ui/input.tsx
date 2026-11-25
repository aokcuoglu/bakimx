import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Kontrol ölçüsü (docs/ui-control-sizing.md). Varyant `--control-*`
 * değişkenlerini öğenin kendisinde yeniden bağlar; taban sınıflar
 * (`h-(--control-h)`, `text-(length:--control-fs)`, `px-(--field-px)`) aynı
 * kalır. `InputGroup` aynı bağlamayı grup üzerinde yapar, içindeki
 * `InputGroupInput` grubun ölçüsünü böyle izler.
 *
 * - `default`: telefonda 44px, md+ 36px — her form, diyalog ve arama alanı.
 * - `sm`: 36 / 32px — yoğun filtre araç çubuğu, tablo başlığı süzgeci.
 * - `compact`: 32 / 28px — tablo satırı içi düzenleyici. Metin telefonda 16px
 *   (`--control-fs-field-xs`; iOS altında yakınlaştırır), md+ 14px.
 * - `lg`: 50 / 44px — tek başına duran büyük giriş (plaka, teslim kodu).
 */
const inputSizeClasses =
  "data-[size=sm]:[--control-h:var(--control-h-sm)] data-[size=compact]:[--control-h:var(--control-h-xs)] data-[size=compact]:[--control-fs:var(--control-fs-field-xs)] data-[size=compact]:[--field-px:var(--control-px-xs)] data-[size=lg]:[--control-h:var(--control-h-lg)]"

type InputSize = "default" | "sm" | "compact" | "lg"

function Input({
  className,
  type,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & { size?: InputSize }) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        "h-(--control-h) w-full min-w-0 rounded-(--control-radius) border border-input bg-card px-(--field-px) py-1 text-(length:--control-fs) tracking-[-0.01em] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/10 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/20",
        inputSizeClasses,
        className
      )}
      {...props}
    />
  )
}

export { Input, inputSizeClasses, type InputSize }
