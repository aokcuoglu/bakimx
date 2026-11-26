import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// e-santral kalıbı (docs/design-pattern-esantral.md): düz mavi dolgu, gölge yok.
const primaryFill = "bg-primary text-primary-foreground hover:bg-primary/90"

// Kendi kenarlığı olmayan variant'lar (row satırına şeffaf 1px çerçeve alır).
const NO_BORDER_VARIANTS = [
  "default",
  "inverse",
  "foreground",
  "navy",
  "whatsapp",
  "secondary",
  "ghost",
  "destructive",
  "success",
  "warning",
  "link",
  "tint",
  "on-photo-ghost",
] as const

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
          "border border-input bg-card font-normal text-foreground focus-visible:ring-4 focus-visible:ring-ring/20 aria-invalid:ring-4 aria-invalid:ring-destructive/10 dark:bg-input/30 dark:aria-invalid:ring-destructive/20",
        // Ton variant'ları (#925): çağrı yerinde `border-destructive/*`,
        // `bg-primary/N` ya da `bg-white/*` yazılmasın diye ton buradan gelir,
        // className'den değil.
        // İkincil yıkıcı eylem (İptal, Pasif Yap): outline çerçevesi, kırmızı ton.
        "destructive-outline":
          "border border-destructive/20 bg-card text-destructive-strong hover:bg-destructive/10 aria-expanded:bg-destructive/10 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-input/30 dark:hover:bg-destructive/20 dark:focus-visible:ring-destructive/40",
        // Birincil tonlu seçili / önerilen eylem. Metin -strong: tonlu zeminde
        // çıplak text-primary AA'yı geçmez (BAK-160). Ölçüm (#925; kart /
        // sayfa / bg-muted): açık /10 6.06 / 5.46 / 5.59, hover /20
        // 5.25 / 4.77 / 4.87. Koyu /10 5.67 / 6.28 / 4.67; koyuda hover da /10
        // kalır: /20 bg-muted'da 4.05, /13 4.48'e iniyor, geçen en yüksek /12
        // ise /10'dan gözle ayırt edilmiyor (ΔE_OK ≈ 0.01).
        tint: "bg-primary/10 text-primary-strong hover:bg-primary/20 aria-expanded:bg-primary/20 dark:hover:bg-primary/10 dark:aria-expanded:bg-primary/10",
        // Fotoğraf / kamera katmanı üstünde (siyah zemin) çerçeveli ve hayalet düğme.
        "on-photo":
          "border border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:border-white focus-visible:ring-white/40",
        "on-photo-ghost":
          "text-white hover:bg-white/15 hover:text-white focus-visible:ring-white/40",
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
    // compoundVariants size ve variant sınıflarından sonra gelir, onları ezer.
    compoundVariants: [
      // Alan görünümlü tetikleyici her boyutta girdinin köşesini taşır; compact
      // metni compact girdiyle aynı (telefonda 16px — iOS odak yakınlaştırması).
      { variant: "field", className: "rounded-(--control-radius)" },
      { variant: "field", size: "compact", className: "text-(length:--control-fs-field-xs)" },
      // Liste satırları variant'tan bağımsız aynı çerçeve kutusunda durur:
      // seçili (secondary) satır outline komşularından 2px kısa kalmaz,
      // seçim değişince satır kaymaz. Çerçeveli variant'lar (outline, field)
      // kendi kenarlık rengini korur.
      { size: "row", variant: [...NO_BORDER_VARIANTS], className: "border border-transparent" },
      // Hayalet liste satırı soluk (devre dışı gibi) okunmaz.
      { size: "row", variant: "ghost", className: "text-foreground dark:text-foreground" },
    ],
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
