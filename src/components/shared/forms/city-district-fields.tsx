"use client"

import { useId } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { TR_CITIES } from "@/lib/tr-cities"
import { getDistricts } from "@/lib/tr-districts"

function StringCombobox({
  id,
  items,
  value,
  placeholder,
  disabled,
  onValueChange,
}: {
  id?: string
  items: string[]
  value: string
  placeholder: string
  disabled?: boolean
  onValueChange: (value: string) => void
}) {
  return (
    <Combobox
      items={items}
      value={value || null}
      itemToStringValue={(s: string) => s}
      onValueChange={(v: string | null) => onValueChange(v ?? "")}
    >
      <ComboboxInput id={id} placeholder={placeholder} disabled={disabled} className="w-full" />
      <ComboboxContent>
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

export function CityDistrictFields({
  city,
  district,
  onCityChange,
  onDistrictChange,
  cityError,
  districtError,
  className,
}: {
  city: string
  district: string
  onCityChange: (city: string) => void
  onDistrictChange: (district: string) => void
  cityError?: string
  districtError?: string
  className?: string
}) {
  const uid = useId()
  // Legacy güvenliği: kayıtlı serbest-metin değer kanonik listede yoksa yine de göster.
  const cityItems =
    city && !TR_CITIES.includes(city as (typeof TR_CITIES)[number]) ? [city, ...TR_CITIES] : [...TR_CITIES]
  const baseDistricts = getDistricts(city)
  const districtItems =
    district && !baseDistricts.includes(district) ? [district, ...baseDistricts] : baseDistricts

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", className)}>
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-city`}>İl</Label>
        <StringCombobox
          id={`${uid}-city`}
          items={cityItems}
          value={city}
          placeholder="İl seçin"
          onValueChange={(v) => {
            onCityChange(v)
            onDistrictChange("") // cascade reset — yalnız kullanıcı değişiminde
          }}
        />
        {cityError && <p className="text-sm text-destructive">{cityError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-district`}>İlçe</Label>
        <StringCombobox
          id={`${uid}-district`}
          items={districtItems}
          value={district}
          placeholder={city ? "İlçe seçin" : "Önce il seçin"}
          disabled={!city}
          onValueChange={(v) => onDistrictChange(v)}
        />
        {districtError && <p className="text-sm text-destructive">{districtError}</p>}
      </div>
    </div>
  )
}
