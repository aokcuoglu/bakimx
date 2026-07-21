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
import { freeTextCommit, type AttrOption } from "@/components/app/part-attribute-commit"
import { usePartAttrOptions } from "@/components/app/part-attr-options"

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
  // Seçenekler artık her hücrede ayrı fetch edilmez: grid seviyesindeki
  // PartAttrOptionsProvider araç başına TEK sefer çeker, buradan paylaşılır.
  const { options, loaded } = usePartAttrOptions(kind)
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

  const placeholder = kind === "brand" ? "Marka" : "Kategori"
  const commit = freeTextCommit(query, options)
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
