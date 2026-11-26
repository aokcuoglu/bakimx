"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input, inputSizeClasses, type InputSize } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/**
 * `size` Input'la aynı ölçek (docs/ui-control-sizing.md): değişkenler grup
 * üzerinde yeniden bağlanır, içindeki `InputGroupInput` aynı yükseklik, metin
 * ve dolguyu buradan miras alır. Blok hizalı eklenti ve textarea'lı grup
 * `h-auto` kalır.
 *
 * Odak halkası grupta çizilir (iç girdi kendi halkasını kapatır) ve iç
 * denetimin `data-slot`'una bağlı değildir: `has-[input:focus-visible]`.
 * Base UI `render` birleştirmesi slot'u ezdiğinde (`AutocompleteInput`)
 * halka kayboluyordu (#888). Halka Input ile aynı: 4px, ring/20.
 *
 * Dar hücre (#887): satır içi eklentinin olduğu yanda girdinin dolgusu
 * `--field-px` yerine 6px'tir (`[&>input]:pl-1.5` / `pr-1.5`); öbür yan
 * `--field-px` kalır.
 */
function InputGroup({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: InputSize }) {
  return (
    <div
      data-slot="input-group"
      data-size={size}
      role="group"
      className={cn(
        "group/input-group relative flex h-(--control-h) w-full min-w-0 items-center rounded-(--control-radius) border border-input bg-card transition-colors outline-none in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-disabled:bg-input/50 has-disabled:opacity-50 has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-4 has-[input:focus-visible]:ring-ring/20 has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-4 has-[textarea:focus-visible]:ring-ring/20 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-4 has-[[data-slot][aria-invalid=true]]:ring-destructive/10 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto dark:bg-input/30 dark:has-disabled:bg-input/80 dark:has-[[data-slot][aria-invalid=true]]:border-destructive/50 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
        inputSizeClasses,
        className
      )}
      {...props}
    />
  )
}

/**
 * Satır içi eklenti kendi boyunda kalır (`shrink-0`), yer açmak için küçülen
 * girdidir (`min-w-0`). Düğme / kbd yanındaki dar iç boşluk negatif dış boşlukla
 * değil, küçük dolguyla verilir: `mr-[-0.3rem]` eklentinin kutusunu grubun
 * içerik kutusundan ~5px dışarı taşırıyordu (#887 — dar hücrede ölçüldü).
 */
const inputGroupAddonVariants = cva(
  "flex h-auto shrink-0 cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--control-radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-2 has-[>button]:pl-1 has-[>kbd]:pl-1.5",
        "inline-end":
          "order-last pr-2 has-[>button]:pr-1 has-[>kbd]:pr-1.5",
        "block-start":
          "order-first w-full justify-start px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2",
        "block-end":
          "order-last w-full justify-start px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-2 text-sm shadow-none",
  {
    variants: {
      size: {
        xs: "h-8 gap-1 rounded-[calc(var(--control-radius)-3px)] px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
        sm: "",
        "icon-xs":
          "size-8 rounded-[calc(var(--control-radius)-3px)] p-0 has-[>svg]:p-0",
        "icon-sm": "size-8 p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

/**
 * Düğme `sm` / `compact` grubun kutusundan taşmasın: grup ölçüsüne göre
 * küçülür (32px düğme 28px grupta kenarlığı aşıyordu).
 */
const inputGroupButtonFit =
  "group-data-[size=sm]/input-group:data-[size=xs]:h-7 group-data-[size=sm]/input-group:data-[size=icon-xs]:size-7 group-data-[size=sm]/input-group:data-[size=icon-sm]:size-7 group-data-[size=compact]/input-group:data-[size=xs]:h-6 group-data-[size=compact]/input-group:data-[size=icon-xs]:size-6 group-data-[size=compact]/input-group:data-[size=icon-sm]:size-6"

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), inputGroupButtonFit, className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

/**
 * Ölçüyü `InputGroup`'un `size`'ından alır; kendi `size` prop'u yoktur.
 * Sığmayan placeholder / değer odak dışındayken harf ortasında kesilmez,
 * `…` ile biter (`text-ellipsis`, #887).
 */
function InputGroupInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "size">) {
  return (
    <Input
      {...props}
      // Slot props'tan sonra: `AutocompleteInput` gibi render birleştirmesi
      // kendi slot'unu geçse de grup denetimi olarak işaretli kalır.
      data-slot="input-group-control"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent text-ellipsis shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
        className
      )}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      {...props}
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
        className
      )}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
