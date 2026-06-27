"use client"

import Link from "next/link"
import { Sparkles, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { WorkshopActions } from "@/app/admin/workshop-actions"

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
  const trial = w.trialEndsAt ? new Date(w.trialEndsAt).toLocaleDateString("tr-TR") : null

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/admin/workshops/${w.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
              {w.name}
            </Link>
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
          <Link
            href={`/admin/workshops/${w.id}`}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Detay <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="shrink-0">
          <WorkshopActions w={w} />
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
