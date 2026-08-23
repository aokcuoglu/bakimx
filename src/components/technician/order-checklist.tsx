"use client"

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react"
import type { RefObject } from "react"
import {
  Check, CheckCircle2, CheckSquare, ListChecks, Plus, Square, Trash2, Undo2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CHECKLIST_CATEGORIES } from "@/lib/constants"
import type { ChecklistCategoryKey } from "@/lib/constants"
import {
  activeChecklist,
  applyChecklistPatch,
  checklistProgress,
  incompleteChecklistIds,
  removedChecklist,
  type ChecklistPatch,
} from "@/lib/technician/checklist-state"
import {
  addChecklistItemAction,
  completeAllChecklistItemsAction,
  deleteChecklistItemAction,
  restoreChecklistItemAction,
  toggleChecklistItemAction,
  uncompleteAllChecklistItemsAction,
} from "@/app/(app)/technician/actions"

/** Satır parlaması ve tik animasyonunun süresi — globals.css'teki keyframe'lerle eş. */
const FLASH_MS = 700
/** Silinen satırın kayıp animasyonu; bittikten sonra satır listeden düşer. */
const REMOVE_MS = 200

const NO_IDS: ReadonlySet<string> = new Set<string>()

const CATEGORY_ORDER: ChecklistCategoryKey[] = ["inspection", "repair", "delivery"]

export interface ChecklistItemRow {
  id: string
  category: string
  description: string
  isCompleted: boolean
  isRequired: boolean
  completedAt: string | null
  note: string | null
  sortOrder: number
  deletedAt: string | null
}

export interface ChecklistState {
  /** İyimser liste — silinenler dahil, ayrım `deletedAt` ile yapılır. */
  items: ChecklistItemRow[]
  busyIds: ReadonlySet<string>
  flashIds: ReadonlySet<string>
  removingIds: ReadonlySet<string>
  bulkCategory: string | null
  toggle: (item: ChecklistItemRow) => void
  remove: (item: ChecklistItemRow) => void
  restore: (item: ChecklistItemRow) => void
  completeCategory: (category: string) => void
  uncompleteCategory: (category: string) => void
}

/**
 * Kontrol listesinin dokunma durumu (BAK-24, BAK-21'deki "Yapılacak İşler"
 * deseninin aynısı).
 *
 * Tik eskiden yalnız sunucu yanıtı dönünce beliriyordu; 16 maddelik listede
 * teknisyen dokunuşunun geçip geçmediğini anlayamıyordu. Artık `useOptimistic`
 * ile tik ve yeşil metin ANINDA gelir, sunucu arkada onaylar, reddederse durum
 * kendiliğinden geri döner ve hata toast'a düşer. Silme de iyimser: satır kısa
 * bir kayıp animasyonuyla listeden düşer, "Silinen maddeler"den geri alınır.
 *
 * Durum bilinçli olarak SAYFA seviyesinde tutuluyor (kart içinde değil): alt
 * taraftaki "kontrol listesini aç" hatırlatması da aynı iyimser sayıyı
 * kullanmalı, yoksa tiklerin gerisinde kalıp yanlış sayı gösterir.
 */
export function useChecklistState(
  items: ChecklistItemRow[],
  { orderId, locked, onError }: { orderId: string; locked: boolean; onError?: (msg: string) => void }
): ChecklistState {
  const [, startTransition] = useTransition()
  const [optimisticItems, patchOptimistic] = useOptimistic(
    items,
    (state: ChecklistItemRow[], patch: ChecklistPatch) => applyChecklistPatch(state, patch)
  )
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(NO_IDS)
  const [flashIds, setFlashIds] = useState<ReadonlySet<string>>(NO_IDS)
  const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(NO_IDS)
  const [bulkCategory, setBulkCategory] = useState<string | null>(null)

  // Zamanlayıcılar unmount'ta temizlenmeli, yoksa ayrılan ekranda setState
  // uyarısı bırakır.
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const t of pending) clearTimeout(t)
      pending.clear()
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
      timers.current.delete(timer)
      setFlashIds((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }, FLASH_MS)
    timers.current.add(timer)
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

  const toggle = useCallback(
    (item: ChecklistItemRow) => {
      if (locked || busyIds.has(item.id)) return
      const nextDone = !item.isCompleted
      setBusy([item.id], true)
      if (nextDone) flash([item.id])

      startTransition(async () => {
        patchOptimistic({ type: "toggle", ids: [item.id], done: nextDone })
        const res = await toggleChecklistItemAction(item.id, nextDone)
        if (res && "error" in res && res.error) reportError(res.error)
        setBusy([item.id], false)
      })
    },
    [busyIds, flash, locked, patchOptimistic, reportError, setBusy]
  )

  const remove = useCallback(
    (item: ChecklistItemRow) => {
      if (locked || busyIds.has(item.id)) return
      // Önce kayıp animasyonu, sonra iyimser silme: satır sessizce yok olsaydı
      // teknisyen hangi maddenin gittiğini göremezdi.
      setRemovingIds((prev) => new Set([...prev, item.id]))
      setBusy([item.id], true)

      const timer = setTimeout(() => {
        timers.current.delete(timer)
        startTransition(async () => {
          setRemovingIds((prev) => {
            const next = new Set(prev)
            next.delete(item.id)
            return next
          })
          patchOptimistic({ type: "delete", ids: [item.id] })
          const res = await deleteChecklistItemAction(item.id)
          if (res && "error" in res && res.error) reportError(res.error)
          setBusy([item.id], false)
        })
      }, REMOVE_MS)
      timers.current.add(timer)
    },
    [busyIds, locked, patchOptimistic, reportError, setBusy]
  )

  const restore = useCallback(
    (item: ChecklistItemRow) => {
      if (locked || busyIds.has(item.id)) return
      setBusy([item.id], true)

      startTransition(async () => {
        patchOptimistic({ type: "restore", ids: [item.id] })
        const res = await restoreChecklistItemAction(item.id)
        if (res && "error" in res && res.error) reportError(res.error)
        setBusy([item.id], false)
      })
    },
    [busyIds, locked, patchOptimistic, reportError, setBusy]
  )

  const completeCategory = useCallback(
    (category: string) => {
      if (locked || bulkCategory) return
      const ids = incompleteChecklistIds(optimisticItems, category)
      if (ids.length === 0) return

      setBulkCategory(category)
      setBusy(ids, true)
      flash(ids)

      startTransition(async () => {
        patchOptimistic({ type: "toggle", ids, done: true })
        const res = await completeAllChecklistItemsAction(orderId, category)
        if (res && "error" in res && res.error) reportError(res.error)
        setBusy(ids, false)
        setBulkCategory(null)
      })
    },
    [bulkCategory, flash, locked, optimisticItems, orderId, patchOptimistic, reportError, setBusy]
  )

  const uncompleteCategory = useCallback(
    (category: string) => {
      if (locked || bulkCategory) return
      const ids = activeChecklist(optimisticItems)
        .filter((item) => item.category === category && item.isCompleted)
        .map((item) => item.id)
      if (ids.length === 0) return

      setBulkCategory(category)
      setBusy(ids, true)
      startTransition(async () => {
        patchOptimistic({ type: "toggle", ids, done: false })
        const res = await uncompleteAllChecklistItemsAction(orderId, category)
        if (res && "error" in res && res.error) reportError(res.error)
        setBusy(ids, false)
        setBulkCategory(null)
      })
    },
    [bulkCategory, locked, optimisticItems, orderId, patchOptimistic, reportError, setBusy]
  )

  return {
    items: optimisticItems,
    busyIds,
    flashIds,
    removingIds,
    bulkCategory,
    toggle,
    remove,
    restore,
    completeCategory,
    uncompleteCategory,
  }
}

/**
 * Teknisyenin kontrol listesi kartı.
 *
 * Liste ZORUNLU DEĞİL (BAK-24): hiçbir madde iş emrini kilitlemiyor. Bu yüzden
 * kart görsel olarak öne çıkıyor — ilerleme çubuğu, aşama sayaçları ve aşama
 * bazlı "tümünü işaretle" teknisyeni listeyi doldurmaya davet ediyor, kapı
 * olarak zorlamıyor. Kart kapalı başlar: mobilde açıkken ekranın çoğunu
 * kaplıyordu, başlıktaki özet açmadan da durumu anlatıyor.
 */
export function OrderChecklist({
  orderId,
  state,
  locked,
  open,
  onOpenChange,
  containerRef,
}: {
  orderId: string
  state: ChecklistState
  locked: boolean
  open: string[]
  onOpenChange: (value: string[]) => void
  containerRef?: RefObject<HTMLDivElement | null>
}) {
  const progress = checklistProgress(state.items)
  const active = activeChecklist(state.items)
  const removed = removedChecklist(state.items)
  const allDone = progress.total > 0 && progress.remaining === 0

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-lg border px-4 scroll-mt-4 transition-colors",
        allDone
          ? "border-success/30 bg-primary/[0.04]"
          : progress.total > 0 && !locked
            ? "border-primary/25 bg-primary/[0.04]"
            : "border-border bg-primary/[0.04]"
      )}
    >
      <Accordion type="multiple" value={open} onValueChange={onOpenChange}>
        <AccordionItem value="checklist" className="border-0">
          <AccordionTrigger className="items-center gap-3 py-3 hover:no-underline">
            <span
              aria-hidden
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg",
                allDone ? "bg-success/15 text-success-strong" : "bg-primary/10 text-primary-strong"
              )}
            >
              {allDone ? <CheckCircle2 className="size-5" /> : <ListChecks className="size-5" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-foreground">Kontrol Listesi</span>
                {/* Zorunlu olmadığı başlıkta yazıyor: teknisyen listeyi bir kapı
                    değil, işini kanıtlayan bir kayıt olarak görsün. */}
                <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground bg-muted">
                  isteğe bağlı
                </span>
                <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
                  {progress.completed}/{progress.total}
                </span>
              </span>
              <span aria-hidden className="block h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    "block h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500",
                    allDone ? "bg-success" : "bg-primary"
                  )}
                  style={{ width: `${progress.percent}%` }}
                />
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {progress.total === 0
                  ? "Kontrol maddesi yok"
                  : allDone
                    ? "Tüm maddeler işaretlendi"
                    : `${progress.remaining} madde kaldı`}
              </span>
            </span>
          </AccordionTrigger>

          <AccordionContent className="pb-4">
            {CATEGORY_ORDER.map((category) => (
              <ChecklistSection
                key={category}
                category={category}
                items={active.filter((i) => i.category === category)}
                state={state}
                locked={locked}
              />
            ))}

            {active.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Bu iş emrinde kontrol maddesi kalmadı.
              </p>
            )}

            <RemovedChecklistItems items={removed} state={state} locked={locked} />

            {locked ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Teslim edilmiş/iptal edilmiş iş emrinde kontrol maddesi eklenemez
              </p>
            ) : (
              <AddChecklistItemForm orderId={orderId} />
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

function ChecklistSection({
  category,
  items,
  state,
  locked,
}: {
  category: ChecklistCategoryKey
  items: ChecklistItemRow[]
  state: ChecklistState
  locked: boolean
}) {
  if (items.length === 0) return null

  const info = CHECKLIST_CATEGORIES[category]
  const done = items.filter((i) => i.isCompleted).length
  const remaining = items.length - done
  const bulkPending = state.bulkCategory === category

  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center gap-2">
        <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium", info.color)}>
          {info.label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {done}/{items.length}
        </span>
        {/* Aşama bazlı toplu işaretleme: teslim kontrolleri araç tamir
            edilmeden işaretlenmesin diye liste geneli değil. */}
        {!locked && (
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => state.uncompleteCategory(category)}
              disabled={done === 0 || bulkPending}
              className="gap-1 text-muted-foreground hover:text-foreground"
            >
              {bulkPending ? <BrandSpinner size={12} className="!flex-row !gap-0" /> : <Undo2 className="size-3" />}
              Tümünü kaldır
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => state.completeCategory(category)}
              disabled={remaining === 0 || bulkPending}
              className="gap-1 text-primary hover:text-primary"
            >
              {bulkPending ? <BrandSpinner size={12} className="!flex-row !gap-0" /> : <ListChecks className="size-3" />}
              Tümünü işaretle
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-0.5">
        {items.map((item) => (
          <ChecklistRow key={item.id} item={item} state={state} locked={locked} />
        ))}
      </div>
    </div>
  )
}

function ChecklistRow({
  item,
  state,
  locked,
}: {
  item: ChecklistItemRow
  state: ChecklistState
  locked: boolean
}) {
  const isBusy = state.busyIds.has(item.id)
  const isFlashing = state.flashIds.has(item.id)
  const isRemoving = state.removingIds.has(item.id)
  const isDone = item.isCompleted

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-lg",
        // İşaretlendiği an kısa bir yeşil parlama — hangi satıra dokunulduğu
        // toplu işaretlemede de tek tek görünür.
        isFlashing && isDone && "motion-safe:animate-item-done",
        isRemoving && "motion-safe:animate-row-remove"
      )}
    >
      <button
        type="button"
        disabled={isBusy || locked}
        aria-pressed={isDone}
        onClick={() => state.toggle(item)}
        className={cn(
          "flex min-h-8 flex-1 items-start gap-2.5 rounded-lg px-2 py-1.5 text-left",
          "cursor-pointer touch-manipulation transition-colors hover:bg-muted",
          // Sunucu yanıtı beklenirken satır kilitli ama SOLUK DEĞİL: iyimser tik
          // zaten göründüğü için soluklaştırmak "işlem geri alındı" gibi okunur.
          "disabled:cursor-default disabled:hover:bg-transparent"
        )}
      >
        {/* Tik anında gelir; `key` durum değişince değişir ki pop animasyonu
            her işaretlemede baştan çalışsın. */}
        <span
          key={isDone ? "done" : "todo"}
          className={cn(
            "mt-0.5 inline-flex shrink-0 motion-safe:transition-transform motion-safe:duration-150",
            // Basılı tutarken kutu içeri gider — dokunuşun kaydedildiği sunucu
            // yanıtından ÖNCE hissedilsin diye.
            !locked && !isBusy && "motion-safe:group-active:scale-90",
            isFlashing && isDone && "motion-safe:animate-check-pop"
          )}
        >
          {isDone
            ? <CheckSquare className="size-5 text-success-strong" />
            : <Square className="size-5 text-muted-foreground group-hover:text-foreground" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className={cn(
            "block text-sm transition-colors duration-300",
            isDone ? "text-success-strong" : "text-foreground"
          )}>
            {item.description}
          </span>
          {item.note && <span className="mt-0.5 block text-xs text-muted-foreground">{item.note}</span>}
        </span>
      </button>

      {/* Şablon maddeleri de silinebilir: atölye kullanmadığı kontrolü bu iş
          emrinden çıkarabilmeli. Silme yalnız bu iş emrini etkiler, şablon
          olduğu gibi kalır (bkz. deleteChecklistItemAction). Görünürlük mobilde
          hover'a bağlı olamaz — dokunmatikte hover yok, buton görünmez ama
          tıklanabilir kalıyordu. */}
      {!locked && (
        <button
          type="button"
          aria-label={`"${item.description}" maddesini bu iş emrinden sil`}
          onClick={() => state.remove(item)}
          disabled={isBusy}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive-strong disabled:pointer-events-none md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  )
}

/**
 * Bu iş emrinden çıkarılan maddeler — kapalı başlar, tek dokunuşla geri alınır.
 *
 * Silme soft olduğu için yanlış dokunuş kalıcı değil; bölüm olmasaydı silinen
 * madde teknisyen için tamamen kaybolurdu (şablonda duruyor olması yalnız YENİ
 * iş emirlerini ilgilendirir, bu iş emrine geri getirmez).
 */
function RemovedChecklistItems({
  items,
  state,
  locked,
}: {
  items: ChecklistItemRow[]
  state: ChecklistState
  locked: boolean
}) {
  const [show, setShow] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="mt-3 border-t border-border pt-2">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => setShow((v) => !v)}
        aria-expanded={show}
        className="px-1.5 text-muted-foreground"
      >
        Silinen maddeler ({items.length})
      </Button>
      {show && (
        <ul className="mt-1 space-y-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 py-1">
              <span className="min-w-0 flex-1 text-sm text-muted-foreground line-through">
                {item.description}
              </span>
              {!locked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={state.busyIds.has(item.id)}
                  aria-label={`"${item.description}" maddesini geri al`}
                  onClick={() => state.restore(item)}
                  className="shrink-0 text-primary"
                >
                  <Undo2 className="size-3.5" />
                  Geri al
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Yeni kontrol maddesi ekleme.
 *
 * Aşama seçimi eskiden düz yazı gibi duruyordu: seçili olanın arka planı da
 * formun arka planı da `bg-muted` olduğu için hangisinin seçili olduğu — hatta
 * tıklanabilir olduğu — görünmüyordu. Artık üç seçenek eşit genişlikte, seçili
 * olan çerçevesi/dolgusu ve tikiyle ayrışıyor, üzerine gelince tepki veriyor.
 */
function AddChecklistItemForm({ orderId }: { orderId: string }) {
  const [show, setShow] = useState(false)
  const [category, setCategory] = useState<ChecklistCategoryKey>("inspection")
  const [description, setDescription] = useState("")
  const [isPending, startTransition] = useTransition()

  function close() {
    setShow(false)
    setDescription("")
  }

  if (!show) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setShow(true)}
        className="mt-3 w-full justify-center gap-1.5 border-dashed bg-primary/[0.04] text-primary hover:bg-primary/[0.08] hover:text-primary"
      >
        <Plus className="size-4" />
        Kontrol maddesi ekle
      </Button>
    )
  }

  return (
    <form
      action={() => {
        const fd = new FormData()
        fd.set("serviceOrderId", orderId)
        fd.set("category", category)
        fd.set("description", description)
        fd.set("sortOrder", "0")
        startTransition(async () => {
          const res = await addChecklistItemAction(fd)
          // Hata durumunda form AÇIK kalır: yazılan açıklama kaybolmasın.
          if (res && "error" in res && res.error) {
            toast.error(res.error)
            return
          }
          close()
        })
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") close()
      }}
      className="mt-3 space-y-3 rounded-lg border border-border bg-primary/[0.04] p-3 shadow-sm"
    >
      <p className="text-xs font-semibold text-foreground">Yeni kontrol maddesi</p>

      <div className="space-y-1.5">
        <span className="block text-xs text-muted-foreground">Hangi aşamada?</span>
        <ToggleGroup
          type="single"
          value={category}
          onValueChange={(v) => { if (v) setCategory(v as ChecklistCategoryKey) }}
          className="grid w-full grid-cols-3"
        >
          {CATEGORY_ORDER.map((cat) => (
            <ToggleGroupItem
              key={cat}
              value={cat}
              variant="outline"
              className="w-full gap-1 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:font-semibold data-[state=on]:text-primary-strong"
            >
              {category === cat && <Check className="size-3.5" />}
              {CHECKLIST_CATEGORIES[cat].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Input
        type="text"
        autoFocus
        value={description}
        maxLength={500}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Örn: Klima gazı kontrol edildi"
        required
      />

      <div className="flex gap-2">
        <Button type="submit" size="lg" disabled={isPending || !description.trim()} className="touch-manipulation">
          {isPending ? <BrandSpinner size={16} className="!flex-row !gap-0" /> : <Plus className="size-4" />}
          Ekle
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={close}
          className="touch-manipulation"
        >
          İptal
        </Button>
      </div>
    </form>
  )
}
