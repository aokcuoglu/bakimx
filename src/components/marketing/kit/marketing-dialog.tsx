"use client"

import type { ReactNode } from "react"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { RoundIconButton } from "./round-icon-button"
import styles from "./kit.module.css"

export type MarketingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Diyaloğun erişilebilir adı; görünür başlık içerikte ayrıca `DialogHeading` ile verilir. */
  title: string
  size?: "md" | "sm"
  onOpenAutoFocus?: (event: Event) => void
  /**
   * Kapanışta odağın nereye döneceği. Radix yalnız kendi `Dialog.Trigger`'ına
   * döndürür; pencereyi dışarıdaki bir tetikleyici açıyorsa onu burada odakla.
   */
  onCloseAutoFocus?: (event: Event) => void
  children: ReactNode
}

/**
 * Pazarlama penceresi (e-santral `.modal`): masaüstünde ortada 500/460px, 30px köşe;
 * telefonda alttan açılan sheet. Radix Dialog odak tuzağı, Escape ve odak dönüşünü verir.
 */
export function MarketingDialog({ open, onOpenChange, title, size = "md", onOpenAutoFocus, onCloseAutoFocus, children }: MarketingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        overlayClassName={styles.overlay}
        className={cn(styles.dialog, size === "sm" && styles.dialogSm)}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className={styles.dialogBody}>
          <DialogClose asChild>
            <RoundIconButton label="Kapat" size={32} className={styles.dialogClose}>
              <svg viewBox="0 0 12 12" aria-hidden="true" className={styles.closeIcon}>
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
              </svg>
            </RoundIconButton>
          </DialogClose>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Pencere içindeki görünür başlık (30px, telefonda 26px). */
export function DialogHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className={styles.dialogHeading}>
      {children}
    </h2>
  )
}

/** Başlık altındaki gri açıklama. */
export function DialogLead({ children }: { children: ReactNode }) {
  return <p className={styles.dialogLead}>{children}</p>
}
