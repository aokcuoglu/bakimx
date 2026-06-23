"use client"

import * as React from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

/**
 * Mobil-öncelikli alt sayfa (bottom sheet) — mevcut `Sheet side="bottom"` üzerine.
 * Üstte drag-handle, kaydırılabilir gövde, gerçek `safe-area-bottom` footer'ı.
 *
 * Kontrollü kullanım (open/onOpenChange) ya da `trigger` ile tetikleme destekler.
 */
export function BottomSheet({
  open,
  onOpenChange,
  trigger,
  title = "Seçenekler",
  description,
  hideHeader = false,
  children,
  footer,
  className,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Sheet'i açan eleman (ör. bir Button). */
  trigger?: React.ReactElement
  title?: React.ReactNode
  description?: React.ReactNode
  /** Başlığı görsel olarak gizler ama a11y için DOM'da tutar. */
  hideHeader?: boolean
  children: React.ReactNode
  /** Alttaki yapışkan aksiyon alanı (safe-area dahil). */
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className={cn("max-h-[85vh] gap-0 rounded-t-2xl", className)}
      >
        <div className="mx-auto mt-2 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
        <SheetHeader className={cn("pt-2 pb-3", hideHeader && "sr-only")}>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-border p-4 safe-area-bottom">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
