"use client"

import { useState, useTransition } from "react"
import { Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
}

/** Shared founder controls for a workshop (approve/reject · assign plan · extra
 *  seats). Used inline in the workshops list and on the 360° tenant detail. */
export function WorkshopActions({ w }: { w: WorkshopActionState }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [seats, setSeats] = useState(String(w.extraSeats))

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("")
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error || "İşlem başarısız")
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
              onClick={() => run(() => approveWorkshop(w.id))}
              size="sm"
            >
              <Check className="size-3.5" /> Onayla
            </Button>
            <Button
              disabled={pending}
              onClick={() => run(() => rejectWorkshop(w.id))}
              variant="outline"
              size="sm"
            >
              <X className="size-3.5" /> Reddet
            </Button>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-0.5">Plan ata:</span>
            {TIERS.map((t) => (
              <Button
                key={t}
                disabled={pending}
                onClick={() => run(() => activateWorkshopPlan(w.id, t, "active"))}
                variant={w.requestedPlanTier === t ? "default" : "outline"}
                size="sm"
                aria-label={`${TIER_LABELS[t]} planını etkinleştir`}
              >
                {TIER_LABELS[t]}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">Ek koltuk:</span>
            <Input
              type="number"
              min={0}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className="w-20"
              aria-label="Ek koltuk sayısı"
            />
            <Button
              disabled={pending}
              onClick={() => run(() => setWorkshopExtraSeats(w.id, Number.parseInt(seats, 10) || 0))}
              variant="outline"
              size="sm"
            >
              Uygula
            </Button>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive-strong">{error}</p>}
    </div>
  )
}
