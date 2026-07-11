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
import type { PartBrandSummary } from "@/lib/tecdoc/types"
import { trIncludes } from "@/lib/tr-search"

/**
 * Parça markası seçici.
 * - Katalog-bağlı araç (vehicleTypeId != null): araç/kategori-scoped liste, KATI
 *   (yalnız listeden seçim). Kategori değişince uyumsuz marka otomatik temizlenir.
 * - Katalog-bağlı değil (vehicleTypeId == null): global liste + serbest metin fallback.
 *
 * Arama metni (query) committed değerden (value) ayrı tutulur: strict modda da
 * yazarak filtrelenebilir; commit yalnız listeden seçimle olur. Popup kapanınca
 * seçilmeyen arama metni committed değere geri döner.
 */
export function PartBrandCombobox({
  value,
  vehicleTypeId,
  categoryId,
  onChange,
  placeholder = "Bosch, Mann, OEM...",
}: {
  value: string
  vehicleTypeId: number | null
  categoryId: number | null
  onChange: (name: string, supplierId: number | null) => void
  placeholder?: string
}) {
  const strict = vehicleTypeId != null
  const [brands, setBrands] = useState<PartBrandSummary[]>([])
  // Arama kutusu metni — committed value'dan ayrı; value değişince senkronlanır.
  const [query, setQuery] = useState(value ?? "")
  // Son commit'lenen değeri senkron tutar — kapanışta güvenilir revert için:
  // seçimde onOpenChange, onValueChange'den hemen sonra senkron çalışır ve o an
  // `value` prop'u henüz bayattır (parent re-render olmadı), ref ise günceldir.
  const committedRef = useRef(value ?? "")
  useEffect(() => {
    committedRef.current = value ?? ""
    const t = setTimeout(() => setQuery(value ?? ""), 0)
    return () => clearTimeout(t)
  }, [value])
  // Auto-clear yalnız kategori GERÇEKTEN değişince tetiklensin (ilk mount'ta değil).
  const prevCategoryId = useRef<number | null>(categoryId)

  useEffect(() => {
    let active = true
    const url =
      vehicleTypeId != null && categoryId != null
        ? `/api/tecdoc/brands?vehicleId=${vehicleTypeId}&categoryId=${categoryId}`
        : vehicleTypeId != null
          ? `/api/tecdoc/brands?vehicleId=${vehicleTypeId}`
          : "/api/tecdoc/brands"
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        const list: PartBrandSummary[] = Array.isArray(d?.brands) ? d.brands : []
        setBrands(list)
        // GÜVENİLİR yön auto-clear: kategori değişti, mevcut marka yeni sette yok,
        // liste boş değil (transient/boş cevapta silme yok) → temizle.
        const categoryChanged = prevCategoryId.current !== categoryId
        prevCategoryId.current = categoryId
        if (
          strict && categoryChanged && value &&
          categoryId != null && list.length > 0 &&
          !list.some((b) => b.name === value)
        ) {
          onChange("", null)
        }
      })
      .catch(() => { if (active) setBrands([]) })
    return () => { active = false }
    // value/onChange kasıtlı olarak dep dışı: yalnız scope değişiminde fetch + kontrol.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleTypeId, categoryId])

  return (
    <Combobox
      items={brands}
      filter={(item: PartBrandSummary, q: string) => trIncludes(item.name, q)}
      itemToStringLabel={(b: PartBrandSummary) => b.name}
      itemToStringValue={(b: PartBrandSummary) => b.name}
      inputValue={query}
      onInputValueChange={(v: string) => {
        setQuery(v)
        // Serbest metin fallback: yazılan metin doğrudan committed değer olur.
        if (!strict) onChange(v, null)
      }}
      onValueChange={(b: PartBrandSummary | null) => {
        if (b) { committedRef.current = b.name; setQuery(b.name); onChange(b.name, b.supplierId) }
      }}
      onOpenChange={(open: boolean) => {
        // Kapanışta seçilmeyen arama metnini committed değere geri al (strict için önemli).
        // value prop'u değil committedRef okunur — seçim anındaki bayat-closure flicker'ını önler.
        if (!open) setQuery(committedRef.current)
      }}
    >
      <ComboboxInput
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (strict) return // katı modda Base UI varsayılanı (Enter'da revert) istenir
          if (e.key !== "Enter") return
          if (e.currentTarget.getAttribute("aria-activedescendant")) return
          // Serbest metinde Enter: yazılan değeri koru.
          e.preventBaseUIHandler()
          e.preventDefault()
        }}
      />
      <ComboboxContent>
        <ComboboxEmpty className="py-2 text-sm text-muted-foreground">
          {strict ? "Uygun marka bulunamadı" : "Listede yok — yazdığınız değer kullanılacak"}
        </ComboboxEmpty>
        <ComboboxList>
          {(b: PartBrandSummary) => (
            <ComboboxItem key={b.supplierId} value={b}>{b.name}</ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
