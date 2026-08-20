"use client"

import Link from "next/link"
import { Sparkles, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
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
  pending: "bg-warning/10 text-warning-strong",
  approved: "bg-success/10 text-success-strong",
  rejected: "bg-destructive/10 text-destructive-strong",
}
const SUB_BADGE: Record<string, string> = {
  trialing: "bg-primary/10 text-primary-strong",
  active: "bg-success/10 text-success-strong",
  past_due: "bg-warning/10 text-warning-strong",
  canceled: "bg-muted text-muted-foreground",
}
const APPROVAL_LABELS: Record<string, string> = { pending: "Onay bekliyor", approved: "Onaylı", rejected: "Reddedildi" }
const SUB_LABELS: Record<string, string> = { trialing: "Denemede", active: "Aktif", past_due: "Ödeme gecikti", canceled: "İptal" }

function Row({ w, canManage }: { w: AdminWorkshopRow; canManage: boolean }) {
  const trial = w.trialEndsAt ? new Date(w.trialEndsAt).toLocaleDateString("tr-TR") : null

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/admin/workshops/${w.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
              {w.name}
            </Link>
            <Badge variant="outline" className={cn("text-[11px]", APPROVAL_BADGE[w.approvalStatus] ?? "bg-muted")}>
              {APPROVAL_LABELS[w.approvalStatus] ?? w.approvalStatus}
            </Badge>
            <Badge variant="outline" className={cn("text-[11px]", SUB_BADGE[w.subscriptionStatus] ?? "bg-muted")}>
              {SUB_LABELS[w.subscriptionStatus] ?? w.subscriptionStatus}
            </Badge>
            <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground">
              {TIER_LABELS[w.planTier] ?? w.planTier}
            </Badge>
            {w.requestedPlanTier && (
              <Badge variant="outline" className="text-[11px] bg-primary/15 text-foreground">
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

        {canManage && (
          <div className="shrink-0">
            <WorkshopActions w={w} />
          </div>
        )}
      </div>
    </div>
  )
}

/** `canManage` = `manageWorkshops` yetkisi. Kapı sunucudadır; bu yalnız yetkisi
 *  olmayan role 404 üretecek düğmeyi göstermemek içindir (BAK-93). */
export function AdminWorkshops({
  workshops,
  canManage = false,
}: {
  workshops: AdminWorkshopRow[]
  canManage?: boolean
}) {
  // Boş sonuç durumu (filtreli/filtresiz ayrımıyla) sayfaya aittir —
  // bkz. `src/app/admin/workshops/page.tsx`.
  return (
    <div className="space-y-3">
      {workshops.map((w) => (
        <Row key={w.id} w={w} canManage={canManage} />
      ))}
    </div>
  )
}
