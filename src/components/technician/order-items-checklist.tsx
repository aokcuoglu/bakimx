"use client"

import { useState, useTransition } from "react"
import { CheckSquare, Square, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/format"
import { toggleOrderItemCompletedAction } from "@/app/(app)/technician/actions"

export interface OrderItemRow {
  id: string
  type: string
  name: string
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  note: string | null
  completedAt: string | null
}

/**
 * Teknisyenin iş emri kalemlerini tek dokunuşla "yapıldı" işaretlediği liste.
 * Kalemler tamamlanmadan iş tamamlanamaz (kapı server action'da).
 *
 * Bekleme durumu SATIR BAZLI: dokunulan satır spinner'a döner ve yalnız o satır
 * kilitlenir — tek global pending tüm listeyi donduruyordu ve dokunuşun işlenip
 * işlenmediği belli olmuyordu.
 */
export function OrderItemsChecklist({
  items,
  locked,
  onError,
}: {
  items: OrderItemRow[]
  locked: boolean
  onError?: (msg: string) => void
}) {
  const [, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground/70">Bu iş emrinde henüz parça veya işçilik kalemi yok.</p>
  }

  const parts = items.filter((i) => i.type === "part")
  const labor = items.filter((i) => i.type !== "part")

  function toggle(item: OrderItemRow) {
    setPendingId(item.id)
    startTransition(async () => {
      const res = await toggleOrderItemCompletedAction(item.id, !item.completedAt)
      if (res && "error" in res && res.error) onError?.(res.error)
      setPendingId(null)
    })
  }

  return (
    <div className="space-y-3">
      <ItemGroup title="Parçalar" items={parts} locked={locked} pendingId={pendingId} onToggle={toggle} />
      <ItemGroup title="İşçilik" items={labor} locked={locked} pendingId={pendingId} onToggle={toggle} />
    </div>
  )
}

function ItemGroup({
  title, items, locked, pendingId, onToggle,
}: {
  title: string
  items: OrderItemRow[]
  locked: boolean
  pendingId: string | null
  onToggle: (item: OrderItemRow) => void
}) {
  if (items.length === 0) return null
  const done = items.filter((i) => i.completedAt).length

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground/70">{done}/{items.length}</span>
      </div>
      <div>
        {items.map((item) => {
          const isDone = !!item.completedAt
          const isPending = pendingId === item.id
          const price = item.totalPrice != null
            ? formatTRY(item.totalPrice)
            : item.unitPrice != null
              ? formatTRY(item.unitPrice * item.quantity)
              : "—"

          return (
            <button
              key={item.id}
              type="button"
              disabled={isPending || locked}
              onClick={() => onToggle(item)}
              // Mobilde 44px dokunma hedefi korunur; md+ masaüstünde satır kompakt.
              className={cn(
                "w-full min-h-11 md:min-h-0 flex items-center gap-2.5 py-2 md:py-1.5 px-2 rounded-lg text-left",
                "touch-manipulation cursor-pointer hover:bg-muted transition-colors",
                "disabled:cursor-default disabled:hover:bg-transparent",
              )}
            >
              {isPending
                ? <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
                : isDone
                  ? <CheckSquare className="size-5 shrink-0 text-success" />
                  : <Square className="size-5 shrink-0 text-muted-foreground/70" />}

              <span className="flex-1 min-w-0">
                <span className={cn("block truncate text-sm", isDone ? "text-success" : "text-foreground")}>
                  {item.name}
                </span>
                {item.note && <span className="block truncate text-xs text-muted-foreground">{item.note}</span>}
              </span>

              <span className={cn("shrink-0 text-sm tabular-nums", isDone ? "text-success" : "text-foreground")}>
                {item.quantity > 1 && <span className="mr-1.5 text-xs text-muted-foreground">×{item.quantity}</span>}
                {price}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
