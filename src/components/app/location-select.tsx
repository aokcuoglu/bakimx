"use client"

import * as React from "react"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { TR_CITIES } from "@/lib/tr-cities"
import { districtsForCity } from "@/lib/tr-districts"

type LocationComboboxProps = {
  id?: string
  value: string
  onValueChange: (next: string) => void
  onBlur?: () => void
  items: readonly string[]
  placeholder?: string
  disabled?: boolean
  emptyText?: string
  /** FormData ile gönderilen formlar için gizli input adı. */
  name?: string
  className?: string
}

/**
 * Sabit bir listeden (il ya da ilçe) tek değer seçtiren, aranabilir combobox.
 * Serbest metin değil: listede olmayan girdi odak/Enter'da geri alınır.
 */
function LocationCombobox({
  id,
  value,
  onValueChange,
  onBlur,
  items,
  placeholder,
  disabled,
  emptyText = "Sonuç yok",
  name,
  className,
}: LocationComboboxProps) {
  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Combobox
        items={items as string[]}
        value={value || null}
        onValueChange={(v: string | null) => onValueChange(v ?? "")}
        itemToStringValue={(s: string) => s}
        disabled={disabled}
      >
        <ComboboxInput
          id={id}
          placeholder={placeholder}
          disabled={disabled}
          onBlur={onBlur}
          className={className ?? "w-full"}
        />
        <ComboboxContent>
          <ComboboxEmpty>{emptyText}</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>
  )
}

/** 81 ili aranabilir listeden seçtirir. */
export function CitySelect({
  placeholder = "İl seçin",
  ...props
}: Omit<LocationComboboxProps, "items" | "emptyText">) {
  return (
    <LocationCombobox
      items={TR_CITIES}
      emptyText="İl bulunamadı"
      placeholder={placeholder}
      {...props}
    />
  )
}

/**
 * Seçili ile bağlı ilçe seçtirir. İl boşsa devre dışı; il değişince
 * artık geçerli olmayan ilçe otomatik temizlenir (ilk yüklemede korunur).
 */
export function DistrictSelect({
  city,
  value,
  onValueChange,
  placeholder = "İlçe seçin",
  ...props
}: Omit<LocationComboboxProps, "items" | "emptyText"> & { city: string }) {
  const districts = districtsForCity(city)
  const noCity = districts.length === 0

  // İl elle değiştirildiğinde, seçili ilçe yeni ilin ilçesi değilse temizle.
  // İlk mount'ta çalışmaz → kayıtlı (listede olmayan) ilçe düzenlemede korunur.
  const mounted = React.useRef(false)
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (value && !districts.includes(value)) onValueChange("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city])

  return (
    <LocationCombobox
      items={districts}
      value={value}
      onValueChange={onValueChange}
      disabled={noCity}
      placeholder={noCity ? "Önce il seçin" : placeholder}
      emptyText="İlçe bulunamadı"
      {...props}
    />
  )
}
