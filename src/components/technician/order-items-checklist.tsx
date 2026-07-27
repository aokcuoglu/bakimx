"use client"

import { useTransition } from "react"
import { CheckSquare, Square } from "lucide-react"
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
 */
export function OrderItemsChecklist({
  items,
  locked,
}: {
  items: OrderItemRow[]
  locked: boolean
}) {
  const [isPending, startTransition] = useTransition()

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground/70">Bu iş emrinde henüz parça veya işçilik kalemi yok.</p>
  }

  const parts = items.filter((i) => i.type === "part")
  const labor = items.filter((i) => i.type !== "part")

  return (
    <div className="space-y-4">
      <ItemGroup title="Parçalar" items={parts} locked={locked} isPending={isPending} startTransition={startTransition} />
      <ItemGroup title="İşçilik" items={labor} locked={locked} isPending={isPending} startTransition={startTransition} />
    </div>
  )
}

function ItemGroup({
  title, items, locked, isPending, startTransition,
}: {
  title: string
  items: OrderItemRow[]
  locked: boolean
  isPending: boolean
  startTransition: (cb: () => void) => void
}) {
  if (items.length === 0) return null
  const done = items.filter((i) => i.completedAt).length

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground/70">{done}/{items.length}</span>
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const isDone = !!item.completedAt
          return (
            <button
              key={item.id}
              type="button"
              disabled={isPending || locked}
              onClick={() => {
                startTransition(async () => {
                  await toggleOrderItemCompletedAction(item.id, !isDone)
                })
              }}
              className="w-full flex items-start gap-2 py-2.5 px-2 rounded-lg text-left touch-manipulation hover:bg-muted disabled:opacity-60"
            >
              {isDone
                ? <CheckSquare className="size-5 shrink-0 text-success" />
                : <Square className="size-5 shrink-0 text-muted-foreground/70" />}
              <span className="flex-1 min-w-0">
                <span className={cn("block text-sm", isDone ? "line-through text-muted-foreground/70" : "text-foreground")}>
                  {item.name}
                </span>
                {item.note && <span className="block text-xs text-muted-foreground mt-0.5">{item.note}</span>}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm text-foreground">
                  {item.totalPrice != null
                    ? formatTRY(item.totalPrice)
                    : item.unitPrice != null
                      ? formatTRY(item.unitPrice * item.quantity)
                      : "—"}
                </span>
                <span className="text-xs text-muted-foreground">×{item.quantity}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
