"use client"

import * as React from "react"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Aç/kapa bölüm (#950). Tetikleyici `asChild` ile mevcut `Button`'ı sarar;
 * `aria-expanded` / `aria-controls` Radix'ten gelir, çağrı yerinde elle yazılmaz.
 * Panel kapalıyken DOM'dan kalkar; alanları kapalıyken de formla gitmesi gereken
 * bölümler `keepMounted` verir (Radix `forceMount` hiçbir zaman `hidden` yazmaz,
 * gizleme `data-[state=closed]:hidden` ile yapılır).
 * Ölçü/animasyon çağrı yerinde ezilmez (`control-call-sites.test.ts` →
 * `COLLAPSIBLE_FORBIDDEN`). Yükseklik değişkeni (`--radix-collapsible-content-height`)
 * bilinçli olarak sabitlenmez: bkz. `ui/accordion.tsx` içindeki gerekçe.
 */
function Collapsible({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

function CollapsibleTrigger({ ...props }: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
}

function CollapsibleContent({
  className,
  keepMounted = false,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content> & {
  /** Kapalıyken de DOM'da kal (görünmez); form alanları için. */
  keepMounted?: boolean
}) {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      forceMount={keepMounted ? true : undefined}
      className={cn(
        keepMounted
          ? "data-[state=closed]:hidden"
          : "overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up",
        className
      )}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
