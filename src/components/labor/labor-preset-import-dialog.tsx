"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { formatPrice } from "@/lib/parts/format"
import { LABOR_PRESETS } from "@/lib/labor/presets"

export function LaborPresetImportDialog({
  open, onOpenChange,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  // Her açılışta hepsi seçili başlar — en sık kullanım "hepsini ekle".
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- açılışta seçimi sıfırla
    setSelected(new Set(LABOR_PRESETS.map((p) => p.name)))
  }, [open])

  // Kategori başlıklarıyla gruplanmış görünüm (liste sırası korunur).
  const groups = useMemo(() => {
    const map = new Map<string, typeof LABOR_PRESETS[number][]>()
    for (const p of LABOR_PRESETS) {
      const arr = map.get(p.category) ?? []
      arr.push(p)
      map.set(p.category, arr)
    }
    return [...map.entries()]
  }, [])

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const allSelected = selected.size === LABOR_PRESETS.length

  async function submit() {
    if (selected.size === 0 || submitting) return
    setSubmitting(true)

    const { importLaborPresetsAction } = await import("@/app/(app)/parts/labor-actions")
    const res = await importLaborPresetsAction([...selected])

    // NOT: sadece `"error" in res` — bileşik koşul res.added/res.skipped'ı daraltmaz.
    if ("error" in res) {
      toast.error(res.error)
      setSubmitting(false)
      return
    }

    // Atlanan kalem sayısı dürüstçe bildirilir; sessiz atlama yok.
    toast.success(
      res.skipped > 0
        ? `${res.added} kalem eklendi, ${res.skipped} kalem zaten listenizde vardı`
        : `${res.added} kalem eklendi`
    )
    onOpenChange(false)
    setSubmitting(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hazır listeden ekle</DialogTitle>
          <DialogDescription>
            Sık kullanılan işçilikler önerilen fiyatlarıyla listenize kopyalanır. Fiyatları
            sonrasında kendinize göre düzenleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-xs text-muted-foreground">{selected.size} kalem seçili</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(LABOR_PRESETS.map((p) => p.name)))
            }
          >
            {allSelected ? "Seçimi temizle" : "Tümünü seç"}
          </Button>
        </div>

        <div className="space-y-3">
          {groups.map(([category, items]) => (
            <div key={category} className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </p>
              {items.map((p) => (
                <label
                  key={p.name}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer"
                >
                  <Checkbox checked={selected.has(p.name)} onCheckedChange={() => toggle(p.name)} />
                  <span className="min-w-0 flex-1 text-sm truncate">{p.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatPrice(p.defaultPriceKurus)}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Vazgeç
          </Button>
          <Button type="button" onClick={submit} disabled={submitting || selected.size === 0}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {selected.size} kalemi ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
