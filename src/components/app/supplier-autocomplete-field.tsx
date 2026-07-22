"use client"

import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "@/components/ui/autocomplete"
import { Input } from "@/components/ui/input"

export type SupplierOption = { id: string; name: string }

/**
 * Serbest-form tedarikçi alanı (Base UI Autocomplete). Kayıtlı tedarikçiler öneri
 * olarak listelenir ama metin bir seçime kilitlenmez — teknisyen tezgahta yeni/ad-hoc
 * bir tedarikçi adını serbest yazabilir. Seçim yapılırsa `onSelectSupplier` ile id
 * çözülür; serbest metinde id null'a döner (yalnız supplierName saklanır).
 */
export function SupplierAutocompleteField({
  suppliers,
  value,
  onChange,
  onSelectSupplier,
  placeholder = "Tedarikçi (opsiyonel)",
  id,
  disabled,
}: {
  suppliers: SupplierOption[]
  value: string
  onChange: (name: string) => void
  onSelectSupplier?: (id: string | null) => void
  placeholder?: string
  id?: string
  disabled?: boolean
}) {
  return (
    <Autocomplete
      items={suppliers}
      value={value}
      autoHighlight
      openOnInputClick
      itemToStringValue={(s: SupplierOption) => s.name}
      onValueChange={(v: string) => {
        onChange(v)
        const match = suppliers.find((s) => s.name.toLowerCase() === v.trim().toLowerCase())
        onSelectSupplier?.(match ? match.id : null)
      }}
    >
      <AutocompleteInput render={<Input id={id} placeholder={placeholder} disabled={disabled} />} />
      <AutocompleteContent>
        <AutocompleteEmpty>Kayıtlı tedarikçi yok — serbest yazabilirsiniz</AutocompleteEmpty>
        <AutocompleteList>
          {(s: SupplierOption) => (
            <AutocompleteItem
              key={s.id}
              value={s}
              onClick={() => {
                onChange(s.name)
                onSelectSupplier?.(s.id)
              }}
            >
              <span className="block truncate">{s.name}</span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  )
}
