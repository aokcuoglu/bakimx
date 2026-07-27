"use client"

import { useTransition } from "react"
import { Package, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PARTS_REQUEST_STATUS } from "@/lib/constants"
import { convertPartsRequestToOrderItemAction } from "@/app/(app)/technician/actions"

export interface PartsRequestRow {
  id: string
  partName: string
  partSku: string | null
  brand: string | null
  quantity: number
  note: string | null
  status: string
  createdAt: string
  requestedByName: string | null
}

/**
 * Ustanın sahadan gönderdiği parça talepleri. "Kaleme Ekle" talebi iş emri
 * kalemine çevirir (fiyat ofiste girilir) ve talebi "hazırlandı" yapar.
 * Rozet renkleri teknisyen tarafındaki PARTS_REQUEST_STATUS ile paylaşılır
 * (@/lib/constants) — iki taraf arasında tutarlılık için tek kaynak.
 */
export function PartsRequestPanel({
  requests,
  locked,
  onError,
}: {
  requests: PartsRequestRow[]
  locked: boolean
  onError: (msg: string) => void
}) {
  const [isPending, startTransition] = useTransition()

  if (requests.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <Package className="size-4" />
        Parça Talepleri
        <span className="text-xs font-normal text-muted-foreground/70">({requests.length})</span>
      </h3>
      <div className="space-y-2">
        {requests.map((req) => {
          const status = (PARTS_REQUEST_STATUS as Record<string, { label: string; color: string }>)[req.status]
          return (
            <div key={req.id} className="flex flex-wrap items-start justify-between gap-2 py-2 px-3 rounded-lg bg-muted">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{req.partName}</span>
                  {req.partSku && <span className="text-xs font-mono text-muted-foreground">{req.partSku}</span>}
                  {req.brand && <span className="text-xs text-muted-foreground">{req.brand}</span>}
                  <span className="text-xs text-muted-foreground">×{req.quantity}</span>
                </div>
                {req.note && <p className="text-xs text-muted-foreground mt-0.5">{req.note}</p>}
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {req.requestedByName ? `${req.requestedByName} · ` : ""}
                  {new Date(req.createdAt).toLocaleDateString("tr-TR")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", status?.color)}>
                  {status?.label || req.status}
                </span>
                {!locked && req.status === "requested" && (
                  <Button
                    variant="outline"
                    size="lg"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const res = await convertPartsRequestToOrderItemAction(req.id)
                        if (res && "error" in res && res.error) onError(res.error)
                      })
                    }}
                    className="touch-manipulation"
                  >
                    <Plus className="size-3.5" />
                    Kaleme Ekle
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
