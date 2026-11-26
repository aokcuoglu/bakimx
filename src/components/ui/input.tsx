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

/**
 * Görünüm (#952, docs/ui-control-sizing.md → Görünüm). Ölçüden bağımsızdır.
 * Üst öğe `group/field-row` taşır; hayalet alan satırın üzerine gelince ya da
 * odaklanınca çerçevesini gösterir.
 *
 * - `default`: kartlı, çerçeveli alan.
 * - `ghost`: çerçevesiz, saydam; satır hover/odakta çerçeve belirir.
 * - `inline`: metin gibi görünen alan; odakta dolgu ve çerçeve gelir.
 */
const inputAppearanceClasses = {
  default: "",
  ghost:
    "border-transparent bg-transparent group-hover/field-row:border-input group-focus-within/field-row:border-input disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent",
  inline:
    "border-transparent bg-transparent px-0 font-medium focus-visible:px-(--field-px) disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent",
} as const

type InputAppearance = keyof typeof inputAppearanceClasses

function Input({
  className,
  type,
  size = "default",
  appearance = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & {
  size?: InputSize
  appearance?: InputAppearance
}) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      data-appearance={appearance === "default" ? undefined : appearance}
      className={cn(
        "h-(--control-h) w-full min-w-0 rounded-(--control-radius) border border-input bg-card px-(--field-px) py-1 text-(length:--control-fs) tracking-[-0.01em] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/10 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/20",
        inputSizeClasses,
        inputAppearanceClasses[appearance],
        className
      )}
      {...props}
    />
  )
}

export {
  Input,
  inputSizeClasses,
  type InputSize,
  type InputAppearance,
}
