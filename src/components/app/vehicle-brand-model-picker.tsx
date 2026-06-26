"use client"

import { useEffect, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

type Brand = { id: number; name: string }
type Model = { id: number; name: string }

export function VehicleBrandModelPicker({
  brand,
  model,
  onBrandChange,
  onModelChange,
  disabled,
  required,
}: {
  brand: string
  model: string
  onBrandChange: (name: string) => void
  onModelChange: (name: string) => void
  disabled?: boolean
  required?: boolean
}) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [brandId, setBrandId] = useState<number | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const didPrefill = useRef(false)

  // Load brands once.
  useEffect(() => {
    let active = true
    fetch("/api/vehicle-catalog/brands")
      .then((r) => r.json())
      .then((d) => { if (active) setBrands(Array.isArray(d?.brands) ? d.brands : []) })
      .catch(() => { if (active) setBrands([]) })
    return () => { active = false }
  }, [])

  // Resolve a brand name to its catalog id, then load that brand's models.
  function selectBrandId(name: string) {
    const hit = brands.find((b) => b.name.toLocaleLowerCase("tr") === name.trim().toLocaleLowerCase("tr"))
    setBrandId(hit ? hit.id : null)
    if (!hit) { setModels([]) }
    return hit?.id ?? null
  }

  // On edit prefill: once brands are loaded, if an initial brand matches, load its models.
  useEffect(() => {
    if (didPrefill.current || brands.length === 0) return
    didPrefill.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (brand.trim()) selectBrandId(brand)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands])

  // Fetch models whenever the resolved brandId changes (debounced re-fetch on model typing below).
  useEffect(() => {
    if (brandId == null) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingModels(true)
    fetch(`/api/vehicle-catalog/models?brandId=${brandId}`)
      .then((r) => r.json())
      .then((d) => { if (active) setModels(Array.isArray(d?.models) ? d.models : []) })
      .catch(() => { if (active) setModels([]) })
      .finally(() => { if (active) setLoadingModels(false) })
    return () => { active = false }
  }, [brandId])

  const modelDisabled = disabled || brand.trim().length === 0

  return (
    <>
      <div className="space-y-1">
        <Label>Marka {required && "*"}</Label>
        <Combobox
          items={brands}
          filter={(item: Brand, query: string) =>
            item.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr"))}
          itemToStringValue={(b: Brand) => b.name}
          inputValue={brand}
          onInputValueChange={(v: string) => { onBrandChange(v); selectBrandId(v) }}
          onValueChange={(b: Brand | null) => {
            if (!b) return
            onBrandChange(b.name)
            setBrandId(b.id)
            onModelChange("")
          }}
          disabled={disabled}
        >
          <ComboboxInput placeholder="Marka seçin veya yazın" disabled={disabled} />
          <ComboboxContent>
            <ComboboxEmpty className="py-2 text-sm text-muted-foreground">
              Listede yok — yazdığınız değer kullanılacak
            </ComboboxEmpty>
            <ComboboxList>
              {(b: Brand) => (
                <ComboboxItem key={b.id} value={b}>{b.name}</ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      <div className="space-y-1">
        <Label>Model {required && "*"}</Label>
        <Combobox
          items={models}
          filter={(item: Model, query: string) =>
            item.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr"))}
          itemToStringValue={(m: Model) => m.name}
          inputValue={model}
          onInputValueChange={(v: string) => onModelChange(v)}
          onValueChange={(m: Model | null) => { if (m) onModelChange(m.name) }}
          disabled={modelDisabled}
        >
          <ComboboxInput
            placeholder={brand.trim().length === 0 ? "Önce marka girin" : loadingModels ? "Yükleniyor…" : "Model seçin veya yazın"}
            disabled={modelDisabled}
          />
          <ComboboxContent>
            <ComboboxEmpty className="py-2 text-sm text-muted-foreground">
              Listede yok — yazdığınız değer kullanılacak
            </ComboboxEmpty>
            <ComboboxList>
              {(m: Model) => (
                <ComboboxItem key={m.id} value={m}>{m.name}</ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </>
  )
}
