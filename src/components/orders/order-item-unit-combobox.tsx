"use client"

import { useState } from "react"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { ORDER_ITEM_UNIT_LABELS, ORDER_ITEM_UNITS, type OrderItemUnit } from "@/lib/orders/quantity"

/** Küçük harf + Türkçe harfler tabana: "ş" → "s", "ı" / "I" → "i", "ü" → "u". */
function foldTurkish(text: string): string {
  return text.toLocaleLowerCase("tr").replace(/ı/g, "i").normalize("NFD").replace(/\p{M}/gu, "")
}

/**
 * Birim listesinin filtresi: "sise" "Şişe"yi, "TAKIM" ve "takim" "Takım"ı bulur.
 * Base UI'ın varsayılan `Intl.Collator` filtresi `tr` yerelinde ş/s, ü/u, ç/c'yi
 * ayrı harf sayıyor ("sise" hiçbir şey bulmuyordu), yerelsizken de ı/i'yi
 * ("takim" → Takım yok).
 */
export function matchesOrderItemUnit(unit: OrderItemUnit, query: string): boolean {
  return foldTurkish(ORDER_ITEM_UNIT_LABELS[unit]).includes(foldTurkish(query.trim()))
}

/**
 * Kalem birimi seçici — ortak `ui/combobox` (#927). Kapalıyken yanındaki
 * girdiyle aynı ölçüde bir alandır (`size`); liste dar hücrede de okunur
 * genişlikte açılır (`minWidth="menu"`).
 *
 * Telefonda "dokun → listeden seç": `inputMode="none"` sanal klavyeyi açmaz,
 * donanım klavyesi yine süzer. Alan Radix diyaloglarının içinde de durduğu için
 * arama kutusu popup'ta değil, alanın kendisidir (body'ye taşınan popup'taki
 * girdi Radix odak tuzağına odağını kaptırırdı).
 */
export function OrderItemUnitCombobox({
  value,
  onValueChange,
  isOptionDisabled,
  ariaLabel = "Birim",
  size = "default",
  className,
}: {
  value: OrderItemUnit
  onValueChange: (value: OrderItemUnit) => void
  isOptionDisabled?: (value: OrderItemUnit) => boolean
  ariaLabel?: string
  /** Yanındaki girdinin boyu: kalem satırında `compact`, formda `default`. */
  size?: "default" | "compact"
  className?: string
}) {
  // Girdi metni yalnız kullanıcı yazarken / silerken seçili birimin etiketinden
  // ayrılır. Base UI liste kapanınca metni etikete döndürüyor; ama liste hiç
  // açılmadan silinen metin (Tab ile gelip Backspace) boş kalıyordu. Taslak
  // yalnız kullanıcının yazdığı metindir: odak çıkınca ya da Base UI metni
  // kendisi yazınca (seçim, kapanış) düşer.
  const [draft, setDraft] = useState<{ unit: OrderItemUnit; text: string } | null>(null)
  const inputValue = draft?.unit === value ? draft.text : ORDER_ITEM_UNIT_LABELS[value]
  const typedByUser = (reason: string) => reason === "input-change" || reason === "input-clear"

  return (
    <Combobox
      items={ORDER_ITEM_UNITS}
      value={value}
      itemToStringLabel={(unit: OrderItemUnit) => ORDER_ITEM_UNIT_LABELS[unit]}
      filter={matchesOrderItemUnit}
      locale="tr"
      autoHighlight
      inputValue={inputValue}
      onInputValueChange={(text, details) =>
        setDraft(typedByUser(details.reason) ? { unit: value, text } : null)}
      onValueChange={(next: OrderItemUnit | null) => {
        // Metni silmek seçimi `null` yapar: birim boş kalamaz, yok sayılır.
        if (next == null || isOptionDisabled?.(next)) return
        onValueChange(next)
      }}
    >
      <ComboboxInput
        size={size}
        className={className}
        aria-label={ariaLabel}
        inputMode="none"
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => setDraft(null)}
        // Enter yalnız listeden seçer; liste kapalıyken (ya da vurgu yokken)
        // çevreleyen formu (teklif formu) göndermez.
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault()
        }}
      />
      <ComboboxContent minWidth="menu">
        <ComboboxEmpty>Birim bulunamadı</ComboboxEmpty>
        <ComboboxList>
          {(unit: OrderItemUnit) => (
            <ComboboxItem key={unit} value={unit} disabled={isOptionDisabled?.(unit)}>
              {ORDER_ITEM_UNIT_LABELS[unit]}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
