"use client"

import { useEffect, useState } from "react"
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "@/components/ui/autocomplete"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Plus, Search, XIcon } from "lucide-react"
import { flattenCategoryLeaves } from "@/lib/tecdoc/tree"
import { freeTextCommit, type AttrOption } from "@/components/app/part-attribute-commit"
import type { CategoryLeaf, CategoryNode, PartBrandSummary } from "@/lib/tecdoc/types"

/**
 * Parça satırının Marka/Kategori alanı: katalog (cache'li TecDoc) önerisi sunar
 * AMA serbest metin de kabul eder. Base UI Combobox katı liste-seçim olduğu için
 * (free-form değil) Autocomplete kullanılır. Yazılan metin bir öneriyle
 * eşleşmezse liste altında `＋ "{yazılan}" ekle` aksiyonu belirir; commit yalnız
 * bu aksiyon ile (Enter/blur otomatik commit YOK — kazara kayıt önlenir).
 * Araç TecDoc'a bağlı değilse (vehicleTypeId=null) fetch yapılmaz; saf serbest
 * metin girişi olur.
 */
export function PartAttributeField({
  kind,
  vehicleTypeId,
  value,
  disabled,
  onSelect,
  onCommitFreeText,
  onClear,
  onOpenPicker,
}: {
  kind: "brand" | "category"
  vehicleTypeId: number | null
  value: string
  disabled?: boolean
  onSelect: (id: number, name: string) => void
  onCommitFreeText: (value: string) => void
  onClear: () => void
  onOpenPicker?: () => void
}) {
  const [options, setOptions] = useState<AttrOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState(value)

  // Dış value (kayıtlı row.brand/category) → iç query senkronu (React↔prop).
  useEffect(() => {
    if (value !== query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(value)
    }
    // yalnız dış value değişimini izler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Katalog seçeneklerini yükle — yalnız araç bağlıysa (kotasız cache).
  useEffect(() => {
    if (vehicleTypeId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptions([])
      setLoaded(true)
      return
    }
    let active = true
    setLoaded(false)
    const url =
      kind === "brand"
        ? `/api/tecdoc/brands?vehicleId=${vehicleTypeId}`
        : `/api/tecdoc/categories?vehicleId=${vehicleTypeId}`
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return
        if (!data) { setLoaded(true); return }
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
  const commit = freeTextCommit(query, options, value)
  const linked = vehicleTypeId != null
  const showFooter = commit.show || (linked && !!onOpenPicker)

  return (
    <Autocomplete
      items={options}
      value={query}
      autoHighlight
      openOnInputClick
      itemToStringValue={(o: AttrOption) => o.label}
      onValueChange={(v: string) => setQuery(v)}
    >
      <InputGroup>
        <AutocompleteInput
          render={
            <InputGroupInput placeholder={placeholder} disabled={disabled} className="text-xs" />
          }
        />
        {value && !disabled && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label="Temizle"
              // Input blur'ı popup'ı onClick'ten önce kapatmasın diye focus'u koru.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onClear(); setQuery("") }}
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      <AutocompleteContent>
        <AutocompleteEmpty>{loaded ? "Bulunamadı" : "Yükleniyor…"}</AutocompleteEmpty>
        <AutocompleteList>
          {(o: AttrOption) => (
            <AutocompleteItem
              key={o.id}
              value={o}
              onClick={() => { onSelect(o.id, o.label); setQuery(o.label) }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.sub && (
                  <span className="block truncate text-[11px] text-muted-foreground">{o.sub}</span>
                )}
              </span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
        {showFooter && (
          <div className="space-y-0.5 border-t border-border p-1">
            {commit.show && (
              <InputGroupButton
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onCommitFreeText(commit.value); setQuery(commit.value) }}
              >
                <Plus />
                <span className="truncate">&ldquo;{commit.value}&rdquo; ekle</span>
              </InputGroupButton>
            )}
            {linked && onOpenPicker && (
              <InputGroupButton
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onOpenPicker}
              >
                <Search />
                Katalogda ara →
              </InputGroupButton>
            )}
          </div>
        )}
      </AutocompleteContent>
    </Autocomplete>
  )
}
