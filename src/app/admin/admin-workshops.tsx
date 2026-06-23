"use client"

import { useState, useTransition } from "react"
import { Check, X, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { approveWorkshop, rejectWorkshop, activateWorkshopPlan, setWorkshopExtraSeats } from "@/app/admin/actions"

export interface AdminWorkshopRow {
  id: string
  name: string
  ownerEmail: string | null
  approvalStatus: string
  subscriptionStatus: string
  planTier: string
  requestedPlanTier: string | null
  trialEndsAt: string | null
  extraSeats: number
  createdAt: string
}

const TIER_LABELS: Record<string, string> = {
  starter: "Başlangıç",
  pro: "Profesyonel",
  premium: "Premium",
}
const TIERS = ["starter", "pro", "premium"] as const

const APPROVAL_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
}
const SUB_BADGE: Record<string, string> = {
  trialing: "bg-blue-100 text-blue-800",
  active: "bg-emerald-100 text-emerald-800",
  past_due: "bg-amber-100 text-amber-800",
  canceled: "bg-muted text-muted-foreground",
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", className)}>
      {children}
    </span>
  )
}

function Row({ w }: { w: AdminWorkshopRow }) {
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

  const trial = w.trialEndsAt ? new Date(w.trialEndsAt).toLocaleDateString("tr-TR") : null

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{w.name}</span>
            <Badge className={APPROVAL_BADGE[w.approvalStatus] ?? "bg-muted"}>{w.approvalStatus}</Badge>
            <Badge className={SUB_BADGE[w.subscriptionStatus] ?? "bg-muted"}>{w.subscriptionStatus}</Badge>
            <Badge className="bg-muted text-muted-foreground">{TIER_LABELS[w.planTier] ?? w.planTier}</Badge>
            {w.requestedPlanTier && (
              <Badge className="bg-primary/15 text-foreground">
                <Sparkles className="size-3 mr-1" /> Talep: {TIER_LABELS[w.requestedPlanTier] ?? w.requestedPlanTier}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {w.ownerEmail ?? "—"}
            {trial && <span> · deneme bitiş: {trial}</span>}
          </p>
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

          {w.approvalStatus === "pending" && (
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
          )}

          {w.approvalStatus !== "pending" && (
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
                    })
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
      </div>
    </div>
  )
}

export function AdminWorkshops({ workshops }: { workshops: AdminWorkshopRow[] }) {
  if (workshops.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz iş yeri yok.</p>
  }
  return (
    <div className="space-y-3">
      {workshops.map((w) => (
        <Row key={w.id} w={w} />
      ))}
    </div>
  )
}
