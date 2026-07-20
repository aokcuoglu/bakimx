"use client"

import { useEffect, useState } from "react"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox"
import { InputGroupButton } from "@/components/ui/input-group"
import { Search } from "lucide-react"
import { flattenCategoryLeaves } from "@/lib/tecdoc/tree"
import type { CategoryLeaf, CategoryNode, PartBrandSummary } from "@/lib/tecdoc/types"

type Option = { id: number; label: string; sub?: string }

/**
 * Parça satırının Marka/Kategori kolonunda cache'li TecDoc verisinde aranabilir
 * filtre. Seçim aramayı daraltır (satıra persist EDİLMEZ). Liste altında
 * "Katalogda ara →" → canlı picker'ı ön-odaklı açar. Base UI Combobox katı
 * liste-seçim (free-form değil, `LocationCombobox` deseni): listede olmayan
 * girdi odak/Enter'da geri alınır.
 */
export function PartFilterCombobox({
  kind,
  vehicleTypeId,
  value,
  disabled,
  onSelect,
  onClear,
  onOpenPicker,
}: {
  kind: "brand" | "category"
  vehicleTypeId: number
  value: string
  disabled?: boolean
  onSelect: (id: number, name: string) => void
  onClear: () => void
  onOpenPicker: () => void
}) {
  const [options, setOptions] = useState<Option[]>([])
  const [loaded, setLoaded] = useState(false)

  // Seçenekleri ilk açılışta / araç değişince bir kez çek (cache, kotasız).
  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kind/vehicleTypeId değişince yeniden yükleniyor göstermek için senkron reset.
    setLoaded(false)
    const url =
      kind === "brand"
        ? `/api/tecdoc/brands?vehicleId=${vehicleTypeId}`
        : `/api/tecdoc/categories?vehicleId=${vehicleTypeId}`
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) { if (active) setLoaded(true); return }
        if (kind === "brand") {
          const brands: PartBrandSummary[] = Array.isArray(data.brands) ? data.brands : []
          setOptions(brands.map((b) => ({ id: b.supplierId, label: b.name })))
        } else {
          const tree: CategoryNode[] = Array.isArray(data.categories) ? data.categories : []
          const leaves: CategoryLeaf[] = flattenCategoryLeaves(tree)
          setOptions(leaves.map((l) => ({ id: l.id, label: l.name, sub: l.path || undefined })))
        }
        setLoaded(true)
      })
      .catch(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [kind, vehicleTypeId])

  const placeholder = kind === "brand" ? "Marka" : "Kategori"
  // Aynı `options` referansından türetildiği için Base UI'ın varsayılan
  // Object.is eşitliği item<->value eşleşmesi için yeterli (isItemEqualToValue
  // gerekmiyor).
  const selected = options.find((o) => o.label === value) ?? null

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(opt: Option | null) => {
        if (opt) onSelect(opt.id, opt.label)
        else onClear()
      }}
      itemToStringValue={(o: Option) => o.label}
      itemToStringLabel={(o: Option) => o.label}
      disabled={disabled}
    >
      <ComboboxInput
        placeholder={placeholder}
        disabled={disabled}
        showClear={!!value}
        className="text-xs"
      />
      <ComboboxContent>
        <ComboboxEmpty>{loaded ? "Bulunamadı" : "Yükleniyor…"}</ComboboxEmpty>
        <ComboboxList>
          {(o: Option) => (
            <ComboboxItem key={o.id} value={o}>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.sub && (
                  <span className="block truncate text-[11px] text-muted-foreground">{o.sub}</span>
                )}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
        <div className="border-t border-border p-1">
          <InputGroupButton
            size="sm"
            variant="ghost"
            className="w-full justify-start"
            // Input blur'ı popup'ı onClick'ten önce kapatmasın diye focus'u koru.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenPicker}
          >
            <Search />
            Katalogda ara →
          </InputGroupButton>
        </div>
      </ComboboxContent>
    </Combobox>
  )
}
