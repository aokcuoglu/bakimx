"use client"

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react"
import { CheckSquare, ListChecks, Loader2, Square } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { applyCompletion, completionSummary, incompleteIds } from "@/lib/technician/order-items"
import { completeAllOrderItemsAction, toggleOrderItemCompletedAction } from "@/app/(app)/technician/actions"

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

/** Satır parlaması ve tik animasyonunun süresi — globals.css'teki keyframe'lerle eş. */
const FLASH_MS = 700

const NO_IDS: ReadonlySet<string> = new Set<string>()

/**
 * Teknisyenin iş emri kalemlerini tek dokunuşla "yapıldı" işaretlediği liste.
 * Kalemler tamamlanmadan iş tamamlanamaz (kapı server action'da).
 *
 * DOKUNMA GERİ BİLDİRİMİ (BAK-21): tik eskiden yalnız sunucu yanıtı dönünce
 * beliriyordu; arada satır spinner'a döndüğü için teknisyen dokunuşunun geçip
 * geçmediğini anlayamıyordu. Artık `useOptimistic` ile tik ve yeşil metin
 * ANINDA gelir, tik yerine otururken büyür ve satır kısa bir yeşil parlama
 * bırakır. Sunucu reddederse iyimser durum kendiliğinden geri alınır ve hata
 * toast'a düşer — geri dönüş de görsel bir sinyal olur.
 *
 * Sayaç ve "Tümünü tamamla" bu bileşenin içinde: iyimser durumla aynı yerde
 * durmazlarsa başlık tiklerin gerisinde kalır ve liste bozuk görünür.
 */
export function OrderItemsChecklist({
  orderId,
  items,
  locked,
  onError,
}: {
  orderId: string
  items: OrderItemRow[]
  locked: boolean
  onError?: (msg: string) => void
}) {
  const [, startTransition] = useTransition()
  const [optimisticItems, patchOptimistic] = useOptimistic(
    items,
    (state: OrderItemRow[], patch: { ids: readonly string[]; done: boolean }) =>
      applyCompletion(state, patch.ids, patch.done)
  )
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(NO_IDS)
  const [flashIds, setFlashIds] = useState<ReadonlySet<string>>(NO_IDS)
  const [bulkPending, setBulkPending] = useState(false)

  // Parlama zamanlayıcıları unmount'ta temizlenmeli, yoksa ayrılan ekranda
  // setState uyarısı bırakır.
  const flashTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  useEffect(() => {
    const timers = flashTimers.current
    return () => {
      for (const t of timers) clearTimeout(t)
      timers.clear()
    }
  }, [])

  const reportError = useCallback(
    (msg: string) => {
      if (onError) onError(msg)
      else toast.error(msg)
    },
    [onError]
  )

  const flash = useCallback((ids: readonly string[]) => {
    if (ids.length === 0) return
    setFlashIds((prev) => new Set([...prev, ...ids]))
    const timer = setTimeout(() => {
      flashTimers.current.delete(timer)
      setFlashIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }, FLASH_MS)
    flashTimers.current.add(timer)
  }, [])

  const setBusy = useCallback((ids: readonly string[], busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (busy) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  const { total, done, remaining } = completionSummary(optimisticItems)
  const parts = optimisticItems.filter((i) => i.type === "part")
  const labor = optimisticItems.filter((i) => i.type !== "part")

  function toggle(item: OrderItemRow) {
    if (locked || busyIds.has(item.id)) return
    const nextDone = !item.completedAt
    setBusy([item.id], true)
    if (nextDone) flash([item.id])

    startTransition(async () => {
      patchOptimistic({ ids: [item.id], done: nextDone })
      const res = await toggleOrderItemCompletedAction(item.id, nextDone)
      if (res && "error" in res && res.error) reportError(res.error)
      setBusy([item.id], false)
    })
  }

  function completeAll() {
    if (locked || bulkPending) return
    const ids = incompleteIds(optimisticItems)
    if (ids.length === 0) return

    setBulkPending(true)
    setBusy(ids, true)
    flash(ids)

    startTransition(async () => {
      patchOptimistic({ ids, done: true })
      const res = await completeAllOrderItemsAction(orderId)
      if (res && "error" in res && res.error) reportError(res.error)
      setBusy(ids, false)
      setBulkPending(false)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          Yapılacak İşler
          <span className="ml-2 text-xs font-normal text-muted-foreground/70 tabular-nums">
            {done}/{total}
          </span>
        </h3>
        {!locked && total > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={completeAll}
            disabled={remaining === 0 || bulkPending}
            className="shrink-0 gap-1.5 touch-manipulation"
          >
            {bulkPending
              ? <Loader2 className="size-3.5 animate-spin" />
              : <ListChecks className="size-3.5" />}
            Tümünü tamamla
          </Button>
        )}
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground/70">Bu iş emrinde henüz parça veya işçilik kalemi yok.</p>
      ) : (
        <div className="space-y-3">
          <ItemGroup title="Parçalar" items={parts} locked={locked} busyIds={busyIds} flashIds={flashIds} onToggle={toggle} />
          <ItemGroup title="İşçilik" items={labor} locked={locked} busyIds={busyIds} flashIds={flashIds} onToggle={toggle} />
        </div>
      )}
    </div>
  )
}

function ItemGroup({
  title, items, locked, busyIds, flashIds, onToggle,
}: {
  title: string
  items: OrderItemRow[]
  locked: boolean
  busyIds: ReadonlySet<string>
  flashIds: ReadonlySet<string>
  onToggle: (item: OrderItemRow) => void
}) {
  if (items.length === 0) return null
  const done = items.filter((i) => i.completedAt).length

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground/70 tabular-nums">{done}/{items.length}</span>
      </div>
      <div>
        {items.map((item) => {
          const isDone = !!item.completedAt
          const isBusy = busyIds.has(item.id)
          const isFlashing = flashIds.has(item.id)
          const price = item.totalPrice != null
            ? formatTRY(item.totalPrice)
            : item.unitPrice != null
              ? formatTRY(item.unitPrice * item.quantity)
              : "—"

          return (
            <button
              key={item.id}
              type="button"
              disabled={isBusy || locked}
              aria-pressed={isDone}
              onClick={() => onToggle(item)}
              className={cn(
                "group w-full min-h-8 flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-left",
                "touch-manipulation cursor-pointer hover:bg-muted transition-colors",
                // Sunucu yanıtı beklenirken satır kilitli ama SOLUK DEĞİL:
                // iyimser tik zaten göründüğü için soluklaştırmak "işlem geri
                // alındı" gibi okunuyordu.
                "disabled:cursor-default disabled:hover:bg-transparent",
                // İşaretlendiği an kısa bir yeşil parlama — hangi satıra
                // dokunulduğu, toplu tamamlamada da tek tek görünür.
                isFlashing && isDone && "motion-safe:animate-item-done",
              )}
            >
              {/* Tik anında gelir; `key` durum değişince değişir ki pop animasyonu
                  her işaretlemede baştan çalışsın. */}
              <span
                key={isDone ? "done" : "todo"}
                className={cn(
                  "shrink-0 inline-flex motion-safe:transition-transform motion-safe:duration-150",
                  // Basılı tutarken kutu içeri gider — dokunuşun kaydedildiği
                  // sunucu yanıtından ÖNCE hissedilsin diye.
                  !locked && !isBusy && "motion-safe:group-active:scale-90",
                  isFlashing && isDone && "motion-safe:animate-check-pop",
                )}
              >
                {isDone
                  ? <CheckSquare className="size-5 text-success-strong" />
                  : <Square className="size-5 text-muted-foreground/70" />}
              </span>

              <span className="flex-1 min-w-0">
                <span className={cn(
                  "block truncate text-sm transition-colors duration-300",
                  isDone ? "text-success-strong" : "text-foreground",
                )}>
                  {item.name}
                </span>
                {item.note && <span className="block truncate text-xs text-muted-foreground">{item.note}</span>}
              </span>

              <span className={cn(
                "shrink-0 text-sm tabular-nums transition-colors duration-300",
                isDone ? "text-success-strong" : "text-foreground",
              )}>
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
