"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BottomSheet } from "@/components/shared/bottom-sheet"
import { cn } from "@/lib/utils"

export type FilterField = {
  name: string
  label: string
  placeholder?: string
  /** `filter-select.tsx` ile aynı opsiyon modeli. */
  options: { value: string; label: string }[]
  defaultValue?: string
}

type FilterValues = Record<string, string>

/**
 * Mobil filtre yüzeyi: tek "Filtrele" tetikleyici (aktif filtre sayısı badge'i) +
 * bottom sheet içinde tam genişlik 44px alanlar.
 *
 * İki mod:
 * - **URL modu (varsayılan):** Uygula/Temizle `searchParams`'ı günceller → server-side
 *   filtreleme korunur. `extraParams` ile korunacak ek paramlar geçilir.
 * - **Controlled mod:** `onApply`/`onClear` verilirse client-state ile çalışır
 *   (router'a dokunmaz); mevcut client-side filtre mantığına entegre olur.
 *
 * Yalnızca mobilde gösterilmelidir (ör. `lg:hidden` sarmalayıcı içinde).
 */
export function FilterSheet({
  fields,
  initialValues,
  onApply,
  onClear,
  extraParams,
  triggerClassName,
}: {
  fields: FilterField[]
  /** Taahhüt edilmiş (aktif) filtre değerleri — badge sayısı ve taslak başlangıcı. */
  initialValues?: FilterValues
  /** Verilirse controlled mod: Uygula taslağı bu callback'e geçer. */
  onApply?: (values: FilterValues) => void
  /** Controlled modda Temizle. */
  onClear?: () => void
  /** URL modunda korunacak ek paramlar (ör. arama `q`). */
  extraParams?: Record<string, string | undefined>
  triggerClassName?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const controlled = typeof onApply === "function"

  const committed = React.useMemo<FilterValues>(
    () =>
      initialValues ??
      Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""])),
    [initialValues, fields]
  )

  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<FilterValues>(committed)

  // Sheet açıldığında taslağı taahhüt edilmiş değerlerle senkronize et
  // (effect yerine event handler'da — cascading render uyarısını önler).
  function handleOpenChange(next: boolean) {
    if (next) setDraft(committed)
    setOpen(next)
  }

  const activeCount = fields.reduce(
    (n, f) => (committed[f.name] ? n + 1 : n),
    0
  )

  function buildUrl(next: FilterValues) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(extraParams ?? {})) {
      if (v) params.set(k, v)
    }
    for (const f of fields) {
      if (next[f.name]) params.set(f.name, next[f.name])
    }
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  function apply() {
    if (controlled) onApply!(draft)
    else router.push(buildUrl(draft))
    setOpen(false)
  }

  function clear() {
    const cleared = Object.fromEntries(fields.map((f) => [f.name, ""]))
    setDraft(cleared)
    if (controlled) onClear?.()
    else router.push(buildUrl(cleared))
    setOpen(false)
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Filtrele"
      trigger={
        <Button
          type="button"
          variant="outline"
          className={cn("relative", triggerClassName)}
        >
          <SlidersHorizontal />
          Filtrele
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      }
      footer={
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="xl"
            className="flex-1"
            onClick={clear}
          >
            Temizle
          </Button>
          <Button type="button" size="xl" className="flex-1" onClick={apply}>
            Uygula
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {f.label}
            </label>
            <Select
              items={f.options}
              value={draft[f.name] ?? ""}
              onValueChange={(v) =>
                setDraft((s) => ({ ...s, [f.name]: v ?? "" }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={f.placeholder ?? "Tümü"} />
              </SelectTrigger>
              <SelectContent>
                {f.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}
