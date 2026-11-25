import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// e-santral kalıbı (docs/design-pattern-esantral.md): düz mavi dolgu, gölge yok.
const primaryFill = "bg-primary text-primary-foreground hover:bg-primary/90"

// Basılma efekti `translate` değil `transform` yazar (#819): call-site'lar
// düğmeyi `-translate-y-1/2` ile ortalıyor ve upstream'in 1px'lik translate'i
// aynı `--tw-translate-y`'yi ezip düğmeyi basılıyken yarı boyu aşağı
// zıplatıyordu. İki özellik bağımsızdır, üst üste biner.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[22px] border-0 bg-clip-padding font-sans text-center text-(length:--control-fs) font-medium leading-5 tracking-[-0.01em] whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:[transform:translateY(1px)] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: primaryFill,
        inverse:
          "border-navy-foreground bg-navy-foreground text-navy hover:bg-navy-foreground/90 hover:text-navy focus-visible:ring-navy-foreground/50",
        foreground: primaryFill,
        navy: primaryFill,
        whatsapp: "bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90",
        outline:
          "border border-border bg-card text-foreground hover:bg-muted aria-expanded:bg-muted dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:text-muted-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive-strong hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        success:
          "bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success/20",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning/20",
        link: "text-primary underline-offset-4 hover:underline",
        // Değer seçen Popover tetikleyicisi (birim, tarih) alan gibi görünür:
        // Input / SelectTrigger ile aynı çerçeve, zemin, ağırlık ve odak halkası;
        // köşe aşağıdaki compoundVariants'ta (#889).
        field:
          "border border-input bg-card font-normal text-foreground focus-visible:ring-4 focus-visible:ring-ring/20 dark:bg-input/30",
      },
      size: {
        // Ölçüler --control-* değişkenlerinden: telefonda 44px, md+ 36px
        // (globals.css, docs/ui-control-sizing.md). Köşe = telefon yüksekliğinin
        // yarısı: standart düğme hap, uzun kart-düğme yuvarlak köşeli kalır.
        default: "h-(--control-h) gap-1.5 px-(--control-px)",
        xs: "h-(--control-h-xs) gap-1 rounded-[16px] px-(--control-px-xs) text-(length:--control-fs-xs) leading-4 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-(--control-h-sm) gap-1.5 rounded-[18px] px-(--control-px-sm) text-(length:--control-fs-sm)",
        lg: "h-(--control-h-lg) gap-2 rounded-[25px] px-(--control-px-lg)",
        toolbar: "h-(--control-h-sm) gap-2 rounded-[18px] px-(--control-px-sm)",
        xl: "h-(--control-h-xl) gap-2 rounded-[26px] px-(--control-px-lg)",
        compact: "h-(--control-h-xs) gap-1 rounded-[16px] px-(--control-px-xs) text-(length:--control-fs-xs)",
        icon: "size-(--control-h) rounded-full",
        "icon-xs": "size-(--control-h-xs) rounded-full [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-(--control-h-sm) rounded-full",
        "icon-lg": "size-(--control-h-lg) rounded-full",
        "icon-compact": "size-(--control-h-xs) rounded-full",
        // Düğme olmayan kalıplar (#889) — çağrı yerinde h-auto / p-0 / rounded-*
        // yazılmasın diye. Köşe kart içindeki iç kutu adımıdır (rounded-md,
        // docs/ui-control-sizing.md → İç içe köşe).
        // Metin içindeki bağlantı/eylem: yazı boyutunu ve satırı çevreden alır.
        inline: "gap-1 rounded-sm p-0 text-[length:inherit] leading-[inherit]",
        // Çok satırlı liste satırı, seçenek kartı, bırakma alanı: en az kontrol
        // yüksekliği, sola hizalı, metin kırılır. Genişliği çağrı yeri verir.
        row: "min-h-(--control-h) justify-start gap-3 rounded-md px-3 py-2.5 text-left text-(length:--control-fs-sm) leading-5 whitespace-normal",
        // Görsel küçük resmi / fotoğraf ekle karosu: dolgusuz, taşanı kırpar.
        tile: "flex-col gap-1.5 overflow-hidden rounded-md p-0 text-(length:--control-fs-xs) leading-4 whitespace-normal",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
    // Alan görünümlü tetikleyici her boyutta girdinin köşesini taşır (size'ın
    // hap köşesinden sonra gelir, onu ezer).
    compoundVariants: [{ variant: "field", className: "rounded-(--control-radius)" }],
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
