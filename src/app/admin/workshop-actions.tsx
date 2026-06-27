"use client"

import { useState, useTransition } from "react"
import { Check, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
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
            <button
              disabled={pending}
              onClick={() => run(() => approveWorkshop(w.id))}
              className={cn(buttonVariants({ size: "sm" }), "gap-1")}
            >
              <Check className="size-3.5" /> Onayla
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => rejectWorkshop(w.id))}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
            >
              <X className="size-3.5" /> Reddet
            </button>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-0.5">Plan ata:</span>
            {TIERS.map((t) => (
              <button
                key={t}
                disabled={pending}
                onClick={() => run(() => activateWorkshopPlan(w.id, t, "active"))}
                className={cn(
                  buttonVariants({
                    variant: w.requestedPlanTier === t ? "default" : "outline",
                    size: "sm",
                  }),
                )}
                title={`${TIER_LABELS[t]} olarak etkinleştir`}
              >
                {TIER_LABELS[t]}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">Ek koltuk:</span>
            <input
              type="number"
              min={0}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className="h-8 w-16 rounded-lg border border-border bg-white px-2 text-xs"
            />
            <button
              disabled={pending}
              onClick={() => run(() => setWorkshopExtraSeats(w.id, Number.parseInt(seats, 10) || 0))}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Uygula
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
