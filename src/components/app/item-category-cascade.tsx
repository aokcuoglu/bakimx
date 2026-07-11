"use client"

import { useEffect, useRef, useState } from "react"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { flattenCategoryLeaves } from "@/lib/tecdoc/tree"
import type { CategoryLeaf, CategoryNode } from "@/lib/tecdoc/types"
import { trIncludes } from "@/lib/tr-search"

export function ItemCategoryCascade({
  vehicleTypeId,
  supplierId,
  value,
  onSelect,
}: {
  vehicleTypeId: number | null
  supplierId: number | null
  value: string | null
  onSelect: (sel: { category: string; categoryId: number | null }) => void
}) {
  // Araç TecDoc'ta eşleşmemiş → serbest metin fallback (mevcut davranış).
  const [freeText, setFreeText] = useState(value || "")
  if (vehicleTypeId == null) {
    return (
      <Input
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
        onBlur={() => {
          if (freeText !== (value || "")) onSelect({ category: freeText, categoryId: null })
        }}
        placeholder="Kategori (serbest)"
        className="h-8 text-xs w-40"
      />
    )
  }
  return (
    <CategoryComboboxImpl
      vehicleTypeId={vehicleTypeId}
      supplierId={supplierId}
      value={value}
      onSelect={onSelect}
    />
  )
}

function CategoryComboboxImpl({
  vehicleTypeId,
  supplierId,
  value,
  onSelect,
}: {
  vehicleTypeId: number
  supplierId: number | null
  value: string | null
  onSelect: (sel: { category: string; categoryId: number | null }) => void
}) {
  const [leaves, setLeaves] = useState<CategoryLeaf[]>([])
  // Arama metni committed value'dan ayrı; value değişince senkronlanır.
  const [query, setQuery] = useState(value ?? "")
  // Son commit'lenen değeri senkron tutar — kapanışta güvenilir revert için
  // (seçimde onOpenChange, prop güncellenmeden önce senkron çalışır).
  const committedRef = useRef(value ?? "")
  useEffect(() => {
    committedRef.current = value ?? ""
    const t = setTimeout(() => setQuery(value ?? ""), 0)
    return () => clearTimeout(t)
  }, [value])

  useEffect(() => {
    let active = true
    const url =
      supplierId != null
        ? `/api/tecdoc/categories?vehicleId=${vehicleTypeId}&supplierId=${supplierId}`
        : `/api/tecdoc/categories?vehicleId=${vehicleTypeId}`
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        const tree: CategoryNode[] = Array.isArray(d?.categories) ? d.categories : []
        setLeaves(flattenCategoryLeaves(tree))
      })
      .catch(() => { if (active) setLeaves([]) })
    return () => { active = false }
  }, [vehicleTypeId, supplierId])

  return (
    <Combobox
      items={leaves}
      filter={(item: CategoryLeaf, q: string) => trIncludes(item.name, q) || trIncludes(item.path, q)}
      itemToStringLabel={(c: CategoryLeaf) => c.name}
      itemToStringValue={(c: CategoryLeaf) => c.name}
      inputValue={query}
      onInputValueChange={(v: string) => setQuery(v)}
      onValueChange={(c: CategoryLeaf | null) => {
        if (c) { committedRef.current = c.name; setQuery(c.name); onSelect({ category: c.name, categoryId: c.id }) }
      }}
      onOpenChange={(open: boolean) => { if (!open) setQuery(committedRef.current) }}
    >
      <ComboboxInput placeholder="Kategori ara..." className="w-40" />
      <ComboboxContent>
        <ComboboxEmpty className="py-2 text-sm text-muted-foreground">
          Uygun kategori bulunamadı
        </ComboboxEmpty>
        <ComboboxList>
          {(c: CategoryLeaf) => (
            <ComboboxItem key={c.id} value={c}>
              <span className="flex flex-col">
                <span>{c.name}</span>
                {c.path && <span className="text-xs text-muted-foreground">{c.path}</span>}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
