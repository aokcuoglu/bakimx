"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

/**
 * Akordeon görünümü kökte bir kez seçilir, öğeler bağlamdan okur (#926):
 * - `default` — alt çizgili liste (SSS, kayıt formundaki "Diğer sektörler").
 * - `card` — her öğe ayrı kart (şablon, destek talebi, aday listesi); e-santral
 *   kartı gibi kenarlıksız, `ui/card.tsx`'in soluk halkasıyla. Durum tonu çağrı
 *   yerinde halka RENGİYLE verilir (`ring-warning/30`), kalınlıkla değil.
 * - `disclosure` — tek bir kart görünümlü açılır başlık; içerik kartın altında
 *   akar (teknisyen panelindeki "Taslak İşler").
 * Tetikleyici her görünümde en az kontrol yüksekliğindedir (telefonda 44px).
 * Ölçü, dolgu, köşe ve zemin çağrı yerinde ezilmez
 * (`control-call-sites.test.ts` → `ACCORDION_FORBIDDEN`).
 */
type AccordionVariant = "default" | "card" | "disclosure"

const AccordionVariantContext = React.createContext<AccordionVariant>("default")

const ROOT_VARIANT: Record<AccordionVariant, string> = {
  default: "",
  card: "gap-2",
  disclosure: "",
}

const ITEM_VARIANT: Record<AccordionVariant, string> = {
  default: "not-last:border-b",
  card: "rounded-lg bg-card ring-1 ring-foreground/[0.05]",
  disclosure: "",
}

// Kart kenarlıksız (halka kutunun dışına çizilir), tetikleyici kartın köşesini
// (rounded-lg, 12px) aynen taşır. `disclosure` kapalıyken tek başına duran bir
// başlıktır; oku koyu tonda kalır ki telefonda dokunulabilir olduğu belli olsun.
const TRIGGER_VARIANT: Record<AccordionVariant, string> = {
  default: "min-h-(--control-h) py-3",
  card: "min-h-(--control-h) px-4 py-3 transition-colors hover:bg-muted/50",
  disclosure:
    "min-h-(--control-h) items-center bg-card px-4 py-3 ring-1 ring-foreground/[0.05] transition-colors hover:bg-muted/60 active:bg-muted **:data-[slot=accordion-trigger-icon]:text-foreground",
}

const CONTENT_VARIANT: Record<AccordionVariant, string> = {
  default: "pt-0 pb-3 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
  card: "px-4 pt-0 pb-4",
  disclosure: "pt-2 pb-0",
}

function Accordion({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root> & { variant?: AccordionVariant }) {
  return (
    <AccordionVariantContext.Provider value={variant}>
      <AccordionPrimitive.Root
        data-slot="accordion"
        data-variant={variant}
        className={cn("flex w-full flex-col", ROOT_VARIANT[variant], className)}
        {...props}
      />
    </AccordionVariantContext.Provider>
  )
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  const variant = React.useContext(AccordionVariantContext)
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(ITEM_VARIANT[variant], className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  const variant = React.useContext(AccordionVariantContext)
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger relative flex flex-1 items-start justify-between rounded-lg border border-transparent text-left text-sm font-medium transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:after:border-ring disabled:pointer-events-none disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
          TRIGGER_VARIANT[variant],
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
        />
        <ChevronUpIcon
          data-slot="accordion-trigger-icon"
          className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  const variant = React.useContext(AccordionVariantContext)
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up"
      {...props}
    >
      {/*
        Registry sürümü iç kapsayıcıya `h-(--radix-accordion-content-height)`
        veriyor; BİLİNÇLİ OLARAK ALMIYORUZ. Radix o değişkeni yalnızca açılış/
        kapanışta ölçüyor (`react-collapsible` layout effect'i `[open, present]`
        ile sınırlı, ResizeObserver yok). Panel AÇIKKEN içerik büyüdüğünde
        değişken bayat kalıyor ve `overflow-hidden` fazlalığı kırpıyor —
        teknisyen kontrol listesinde "Kontrol maddesi ekle" formu açılınca
        ölçüldü: içerik 96px'e sabitlenip alt butonlar görünmez oluyordu.
        Açılış animasyonu değişkeni yine keyframe'den (Content elemanı üzerinde)
        okuduğu için etkilenmiyor.
      */}
      <div className={cn(CONTENT_VARIANT[variant], className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
