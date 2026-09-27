"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getFeaturesLostOnDowngrade } from "@/lib/billing/plan-change"
import type { SalePlanTier } from "@/lib/plan"
import { getPlanPackage } from "@/lib/plans-catalog"

export function DowngradePlanDialog({
  open,
  onOpenChange,
  fromTier,
  toTier,
  periodEndLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fromTier: SalePlanTier
  toTier: SalePlanTier
  periodEndLabel: string | null
  onConfirm: () => void
}) {
  const target = getPlanPackage(toTier)
  const lost = getFeaturesLostOnDowngrade(fromTier, toTier).slice(0, 8)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100%-1.5rem)] max-w-md gap-0 overflow-hidden rounded-xl bg-card p-0"
        showCloseButton={false}
      >
        <DialogHeader className="space-y-2 px-5 pb-2 pt-5 pr-12 text-left">
          <DialogTitle className="text-base font-semibold leading-snug">
            {target?.name} paketine düşülsün mü?
          </DialogTitle>
          <DialogDescription className="text-sm leading-5 text-muted-foreground">
            {periodEndLabel != null
              ? `${periodEndLabel} tarihinde ${target?.name} paketine geçeceksiniz.`
              : `Mevcut abonelik döneminizin sonunda ${target?.name} paketine geçeceksiniz.`}{" "}
            Para iadesi yapılmaz; dönem sonuna kadar mevcut haklarınız devam eder. Sonrasında şu
            özelliklere erişiminiz kalkar:
          </DialogDescription>
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-3 top-3 text-muted-foreground"
            >
              <X className="size-4" />
              <span className="sr-only">Kapat</span>
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="px-5 pb-2">
          {lost.length > 0 ? (
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-5 text-foreground">
              {lost.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Daha düşük paketin limitleri ve özellik seti uygulanır.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Düşür
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
