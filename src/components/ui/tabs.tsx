"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  // `orientation` burada destructure ediliyordu ve Root'a GEÇİRİLMİYORDU.
  // Sınıflar `data-orientation`a baktığı için görünüm doğru çıkar, ama Radix ok
  // tuşu gezinmesini kendi `orientation` prop'undan okur — dikey bir şeritte
  // klavye yatay davranırdı. Bugün dikey kullanım yok (BAK-189 taraması), yani
  // hata gizli; ilk dikey şeritte patlardı.
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      orientation={orientation}
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

/**
 * `justify-center-safe` (= `justify-content: safe center`) bilinçli bir tercih,
 * düz `justify-center` DEĞİL.
 *
 * Ortalanmış bir flex kabı taştığında taşma iki yana dağılır: baştaki içerik
 * negatif ofsete düşer ve `scrollLeft` zaten 0 olduğu için oraya kaydırılamaz —
 * yani ilk sekme kalıcı olarak erişilemez hale gelir. `/settings` şeridinde tam
 * olarak bu yaşandı (#277): "İş Yeri Profili" x = −88px'te kalıyordu.
 *
 * `safe center`, taşma olduğu anda hizalamayı `start`'a düşürür; sığdığı sürece
 * ortalama korunur. Böylece kaydırılabilir yeni bir şerit eklendiğinde aynı
 * tuzağa düşülmez. Desteklemeyen eski tarayıcılarda kural tamamen geçersiz
 * sayılır ve `justify-content` başlangıç değerine (start hizası) döner — yine
 * güvenli taraf.
 */
const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center-safe rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-11 group-data-vertical/tabs:gap-2",
      },
      size: {
        default: "",
        control: "group-data-horizontal/tabs:h-auto",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * `size="control"` telefonda dokunulan sekme şeridi içindir: şerit `h-auto`
 * olur, yükseklik tetikleyicilere (`--control-h`: telefonda 44px, md+ 36px)
 * geçer. `default` (segment) ve `line` ile çalışır; `line` + `control` e-santral
 * sayfa sekmesidir (TabsTrigger'daki not). Varsayılan `line` (28px) masaüstü
 * yoğun yüzey içindir (docs/ui-control-sizing.md, #854).
 */
function TabsList({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-size={size}
      className={cn(tabsListVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors motion-reduce:transition-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:h-7 group-data-[variant=line]/tabs-list:flex-none group-data-[variant=line]/tabs-list:px-2 group-data-[variant=line]/tabs-list:py-1 group-data-[variant=line]/tabs-list:leading-5 group-data-[variant=line]/tabs-list:tracking-[-0.005em] group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:hover:bg-muted group-data-[variant=line]/tabs-list:data-[state=active]:border-border group-data-[variant=line]/tabs-list:data-[state=active]:bg-muted dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-muted",
        "group-data-[size=control]/tabs-list:h-(--control-h)",
        "data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-7px] group-data-horizontal/tabs:after:h-px group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-px group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        // `line` + `size="control"` (#854): e-santral sayfa sekmesi —
        // order-detail.module.css `.tab` kalıbı. Yükseklik `--control-h`
        // (telefonda 44px, md+ 36px), metin kontrol ölçeğinde (`--control-fs`),
        // dolgu yok; seçili sekme mavi metin + 2px mavi alt çizgi
        // (design-pattern-esantral: "mavi = seçili sekme"). Alt çizgi ve odak
        // halkası tetikleyicinin İÇİNDE: yatay kaydırmalı şerit
        // (`overflow-y-hidden`) dışarı taşanı keser. İki grup öneki birlikte
        // seçiciyi `line` kurallarından özgül kılar; CSS sırasına bağlı değil.
        "group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:h-(--control-h) group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:px-3 group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:text-(length:--control-fs) group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:hover:bg-transparent group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:focus-visible:ring-inset group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:data-[state=active]:border-transparent group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:data-[state=active]:text-primary-strong dark:group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:data-[state=active]:bg-transparent",
        "group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:after:bg-primary group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:group-data-horizontal/tabs:after:bottom-0 group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:group-data-horizontal/tabs:after:h-0.5 group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:group-data-vertical/tabs:after:right-0 group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:group-data-vertical/tabs:after:w-0.5",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
