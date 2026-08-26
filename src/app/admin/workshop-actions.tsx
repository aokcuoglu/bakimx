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

const TIER_LABELS: Record<string, string> = {
  starter: "Başlangıç",
  pro: "Profesyonel",
  premium: "Premium",
}
const TIERS = ["starter", "pro", "premium"] as const

export interface WorkshopActionState {
  id: string
  approvalStatus: string
  requestedPlanTier: string | null
  extraSeats: number
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
  const [tier, setTier] = useState(w.requestedPlanTier ?? w.planTier ?? "pro")
  const paidPeriod = w.subscriptionStatus === "active" && !!w.currentPeriodEnd && new Date(w.currentPeriodEnd) > new Date()
  const includedSeats: Record<string, number> = { starter: 2, pro: 5, premium: 10 }

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
            <Button
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
          <DialogTrigger asChild><Button variant="outline" size="sm">Aboneliği yönet</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Aboneliği yönet</DialogTitle><DialogDescription>Değişikliklerin etkisini onaylamadan önce gözden geçirin.</DialogDescription></DialogHeader>
            {paidPeriod ? <div className="rounded-lg bg-muted p-3 text-sm space-y-1"><p>Aktif paket: <strong>{TIER_LABELS[w.planTier ?? "pro"]}</strong></p><p>Dönem bitişi: <strong>{new Date(w.currentPeriodEnd!).toLocaleDateString("tr-TR")}</strong></p><p className="text-muted-foreground">Ödenmiş dönem boyunca paket değiştirilemez; yenileme için faturalandırma akışını kullanın.</p></div> : <div className="space-y-2"><p className="text-sm font-medium">Manuel paket etkinleştirme</p><div className="flex gap-2">{TIERS.map((t) => <Button key={t} variant={tier === t ? "default" : "outline"} onClick={() => setTier(t)}>{TIER_LABELS[t]}</Button>)}</div><p className="text-xs text-muted-foreground">Seçili paket {TIER_LABELS[tier]}; onayla ile iş yeri etkinleşir.</p></div>}
            <div className="rounded-lg border p-3"><div className="flex items-center justify-between"><span className="font-medium text-sm">Ek koltuk</span><div className="flex items-center gap-2"><Button size="icon-sm" variant="outline" disabled={pending || seats === 0} onClick={() => setSeats(seats - 1)} aria-label="Ek koltuğu azalt"><Minus /></Button><span className="w-6 text-center">{seats}</span><Button size="icon-sm" variant="outline" disabled={pending || seats >= 500} onClick={() => setSeats(seats + 1)} aria-label="Ek koltuğu artır"><Plus /></Button></div></div><p className="mt-1 text-xs text-muted-foreground">Yeni limit: {(includedSeats[w.planTier ?? "pro"] ?? 0) + seats} koltuk{w.activeUsers != null ? ` · ${w.activeUsers} aktif kullanıcı` : ""}</p></div>
            {error && <p className="text-sm text-destructive-strong" role="alert">{error}</p>}<DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Vazgeç</Button><Button disabled={pending} onClick={() => run(async () => { if (seats !== w.extraSeats) { const r = await setWorkshopExtraSeats(w.id, seats); if (!r.ok) return r } return paidPeriod ? { ok: true } : activateWorkshopPlan(w.id, tier, "active") }, paidPeriod ? "Ek koltuklar kaydedildi" : "Paket etkinleştirildi", () => setOpen(false))}>{pending && <Loader2 className="animate-spin" />}{paidPeriod ? "Koltukları kaydet" : "Onayla ve etkinleştir"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>}
      </div>
      {error && <p className="text-sm text-destructive-strong">{error}</p>}
    </div>
  )
}
