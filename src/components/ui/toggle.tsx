"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Toggle as TogglePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-muted data-[state=on]:bg-muted dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        // Seçili seçenek birincil tonla okunur (e-santral: mavi = eylem ve
        // seçim, #889): çerçeve, ton ve metin birlikte değişir; ton üstünde
        // `-strong` metin (theme-tokens.test.ts).
        outline:
          "border border-input bg-transparent hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary-strong data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary-strong",
        // iOS segment denetimi: gri ray (ToggleGroup `variant="segment"`) içinde
        // seçili öğe beyaz kart. Ray dolgusunu kendisi ekler; öğe köşesi
        // raydan bir kademe küçük (İç içe köşe). Tabs `default` şeridiyle aynı dil.
        segment:
          "rounded-md text-muted-foreground hover:bg-transparent hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_0_0_1px_var(--border),0_1px_2px_-1px_rgba(0,0,0,0.12)] dark:data-[state=on]:bg-input/30",
      },
      size: {
        default:
          "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-8 min-w-8 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        // Dokunma ölçüsü: telefonda 44px, md+ 36px (--control-h). Telefonda
        // görünen seçiciler bunu alır; default/sm/lg masaüstü araç çubuğu içindir.
        control: "h-(--control-h) min-w-(--control-h) px-3",
        // Seçenek kartı (ikon + başlık + açıklama): Button `row` ile aynı ölçü —
        // en az kontrol yüksekliği, sola hizalı, metin kırılır (#889).
        row: "min-h-(--control-h) justify-start gap-3 rounded-md px-3 py-2.5 text-left text-(length:--control-fs-sm) leading-5 whitespace-normal",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
