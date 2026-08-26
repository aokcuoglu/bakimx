"use client"

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"

/**
 * Sabit listeden çoklu değer seçen chips'li combobox (Base UI `multiple`).
 * Seçilenler chip olarak görünür, chip'ten ×  ile çıkarılır. Serbest metin kabul etmez.
 */
export function MultiStringCombobox({
  id,
  items,
  value,
  placeholder,
  disabled,
  onValueChange,
}: {
  id?: string
  items: string[]
  value: string[]
  placeholder: string
  disabled?: boolean
  onValueChange: (value: string[]) => void
}) {
  const anchorRef = useComboboxAnchor()

  return (
    <Combobox
      multiple
      items={items}
      value={value}
      disabled={disabled}
      itemToStringValue={(s: string) => s}
      onValueChange={(v: string[]) => onValueChange(v)}
    >
      {/* İlk satır diğer form kontrolleriyle 32px hizalanır; chip eklenince büyür. */}
      <ComboboxChips ref={anchorRef} className="w-full min-h-8">
        {value.map((item) => (
          <ComboboxChip key={item} aria-label={item}>
            {item}
          </ComboboxChip>
        ))}
        <ComboboxChipsInput
          id={id}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={disabled}
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchorRef}>
        <ComboboxEmpty className="py-2 text-sm text-muted-foreground">Sonuç yok</ComboboxEmpty>
        <ComboboxList>
          {(s: string) => (
            <ComboboxItem key={s} value={s}>
              {s}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
