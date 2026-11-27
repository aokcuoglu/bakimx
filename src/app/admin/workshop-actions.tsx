"use client"

import { useState, useTransition } from "react"
import { Check, X, Loader2, Minus, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  approveWorkshop,
  rejectWorkshop,
  activateWorkshopPlan,
  setWorkshopExtraSeats,
} from "@/app/admin/actions"
import { isSalePlanTier, PLAN_LABELS, PLAN_SEATS, planLabel } from "@/lib/plan"
import { formatTrDate } from "@/lib/format-date"

/** Elle etkinleştirme her zaman tek satış paketine yapılır (#782, #830). Ek
 *  özellikler pakete değil, iş yeri detayındaki anahtarlara bağlıdır (#827). */
const MANUAL_ACTIVATION_TIER = "pro" as const

export interface WorkshopActionState {
  id: string
  approvalStatus: string
  requestedPlanTier: string | null
  extraSeats: number
  /** Ek koltuklar hariç, bugünkü erişim profilinin içerdiği koltuk. */
  includedSeats: number
  /** Satır süresiz eski Lite hakkı taşıyor mu (`hasLifetimeLite`). */
  lifetimeLite: boolean
  planTier?: string
  currentPeriodEnd?: string | null
  subscriptionStatus?: string
  activeUsers?: number
}

/** Shared founder controls for a workshop (approve/reject · assign plan · extra
 *  seats). Used inline in the workshops list and on the 360° tenant detail. */
export function WorkshopActions({ w }: { w: WorkshopActionState }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [seats, setSeats] = useState(w.extraSeats)
  const [open, setOpen] = useState(false)
  const paidPeriod = w.subscriptionStatus === "active" && !!w.currentPeriodEnd && new Date(w.currentPeriodEnd) > new Date()
  // Koltuk kaydı ve paket etkinleştirme ayrı düğmelerdir (#939). Ödenmiş dönemde
  // dahil koltuk bugünkü profilden gelir; aksi halde limit, etkinleştirilecek
  // paketin koltuğu üzerinden hesaplanır.
  const includedSeats = paidPeriod ? w.includedSeats : PLAN_SEATS[MANUAL_ACTIVATION_TIER]
  const manualLabel = PLAN_LABELS[MANUAL_ACTIVATION_TIER]
  // Satıştaki paket dışındaki eski satır yalnız "Paketi etkinleştir" ile Servis
  // Paketi'ne geçer; koltuk kaydı paketi değiştirmez. Uyarı ve düğme hedefi söyler.
  const legacyTier = !!w.planTier && !isSalePlanTier(w.planTier)
  const legacyNote = legacyTier
    ? `Bu iş yeri ${planLabel(w.planTier)} satırında; etkinleştirirseniz ${manualLabel}'ne geçer.` +
      (w.lifetimeLite ? " Süresiz Lite hakkı kalkar." : "") +
      " Ek özellikler iş yeri detayındaki anahtarlardan açılır."
    : null
  const activateLabel = legacyTier ? `${manualLabel}'ne geçir` : "Paketi etkinleştir"
  const activateSuccess = legacyTier ? `İş yeri ${manualLabel}'ne geçirildi` : "Paket etkinleştirildi"

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, successMessage?: string, onSuccess?: () => void) {
    setError("")
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        const message = res.error || "İşlem başarısız"
        setError(message)
        toast.error(message)
        return
      }

      if (successMessage) toast.success(successMessage)
      onSuccess?.()
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

        {w.approvalStatus === "pending" ? (
          <>
            <Button variant="foreground"
              disabled={pending}
              onClick={() => run(() => approveWorkshop(w.id), "İş yeri onaylandı")}
              size="sm"
            >
              <Check className="size-3.5" /> Onayla
            </Button>
            <Button
              disabled={pending}
              onClick={() => run(() => rejectWorkshop(w.id), "İş yeri reddedildi")}
              variant="outline"
              size="sm"
            >
              <X className="size-3.5" /> Reddet
            </Button>
          </>
        ) : <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="outline">Aboneliği yönet</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Aboneliği yönet</DialogTitle><DialogDescription>Değişikliklerin etkisini onaylamadan önce gözden geçirin.</DialogDescription></DialogHeader>
            {paidPeriod ? (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <p>Aktif paket: <strong>{planLabel(w.planTier)}</strong></p>
                <p>Dönem bitişi: <strong>{formatTrDate(w.currentPeriodEnd!)}</strong></p>
                <p className="text-muted-foreground-strong">Ödenmiş dönem boyunca paket değiştirilemez; yenileme için faturalandırma akışını kullanın.</p>
              </div>
            ) : (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <p>Manuel etkinleştirme: <strong>{manualLabel}</strong></p>
                {legacyNote && <p className="font-normal text-foreground">{legacyNote}</p>}
              </div>
            )}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Ek koltuk</span>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" disabled={pending || seats === 0} onClick={() => setSeats(seats - 1)} aria-label="Ek koltuğu azalt"><Minus /></Button>
                  <span className="w-6 text-center">{seats}</span>
                  <Button size="icon" variant="outline" disabled={pending || seats >= 500} onClick={() => setSeats(seats + 1)} aria-label="Ek koltuğu artır"><Plus /></Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Yeni limit: {includedSeats + seats} koltuk{w.activeUsers != null ? ` · ${w.activeUsers} aktif kullanıcı` : ""}</p>
              <Button variant="outline" disabled={pending || seats === w.extraSeats} onClick={() => run(() => setWorkshopExtraSeats(w.id, seats), "Ek koltuklar kaydedildi")}>
                {pending && <Loader2 className="animate-spin" />}Koltukları kaydet
              </Button>
            </div>
            {error && <p className="text-sm text-destructive-strong" role="alert">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Kapat</Button>
              {!paidPeriod && (
                <Button variant="foreground" disabled={pending} onClick={() => run(() => activateWorkshopPlan(w.id, MANUAL_ACTIVATION_TIER, "active"), activateSuccess, () => setOpen(false))}>
                  {pending && <Loader2 className="animate-spin" />}{activateLabel}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>}
      </div>
      {error && <p className="text-sm text-destructive-strong">{error}</p>}
    </div>
  )
}
