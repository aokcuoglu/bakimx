"use client"

import * as React from "react"

import { BottomSheet } from "@/components/shared/bottom-sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type FormSurfaceKind = "dialog" | "sheet"

/**
 * Bir formu ya diyalogda ya da alt sayfada (bottom sheet) açan tek kabuk (#1061).
 *
 * `parts-labor-grid`'in `addSurface` deseniyle aynı sözleşme: yüzeyi çağıran
 * seçer (teknisyen iş ekranı telefonda `"sheet"`, masaüstünde `"dialog"`), form
 * gövdesi ve alt düğmeler iki yüzeyde de aynıdır. Alt sayfada düğmeler
 * `BottomSheet`'in safe-area'lı yapışkan footer'ına, diyalogda `DialogFooter`'a
 * oturur.
 */
export function FormSurface({
  surface = "dialog",
  open,
  onOpenChange,
  title,
  description,
  footer,
  dialogClassName,
  children,
}: {
  surface?: FormSurfaceKind
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  footer: React.ReactNode
  /** Yalnız diyalog yüzeyinde: genişlik (ör. `sm:max-w-md`). */
  dialogClassName?: string
  children: React.ReactNode
}) {
  if (surface === "sheet") {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        footer={footer}
      >
        {children}
      </BottomSheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
