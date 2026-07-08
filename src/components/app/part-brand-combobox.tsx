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
import type { PartBrandSummary } from "@/lib/tecdoc/types"

/**
 * Parça markası seçici — TecDoc supplier listesi + serbest giriş.
 * Liste boş olsa da yazılan değer geçerlidir (onChange serbest metni de iletir).
 */
export function PartBrandCombobox({
  value,
  onChange,
  placeholder = "Bosch, Mann, OEM...",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [brands, setBrands] = useState<PartBrandSummary[]>([])
  useEffect(() => {
    let active = true
    fetch("/api/tecdoc/brands")
      .then((r) => r.json())
      .then((d) => { if (active) setBrands(Array.isArray(d?.brands) ? d.brands : []) })
      .catch(() => { if (active) setBrands([]) })
    return () => { active = false }
  }, [])

  return (
    <Combobox
      items={brands}
      filter={(item: PartBrandSummary, query: string) =>
        item.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr"))}
      itemToStringLabel={(b: PartBrandSummary) => b.name}
      itemToStringValue={(b: PartBrandSummary) => b.name}
      inputValue={value}
      onInputValueChange={(v: string) => onChange(v)}
      onValueChange={(b: PartBrandSummary | null) => { if (b) onChange(b.name) }}
    >
      <ComboboxInput placeholder={placeholder} />
      <ComboboxContent>
        <ComboboxEmpty className="py-2 text-sm text-muted-foreground">
          Listede yok — yazdığınız değer kullanılacak
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
