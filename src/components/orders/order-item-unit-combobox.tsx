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
 * Kullanıcının alana yazdığı metin, yazıldığı andaki birime bağlı. Taslak
 * yokken ya da birim o arada dışarıdan değiştiyse alan seçili birimin
 * etiketini gösterir.
 */
export type UnitDraft = { unit: OrderItemUnit; text: string } | null

/** Alanda görünen metin: geçerli taslak varsa o, yoksa seçili birimin etiketi. */
export function unitInputText(draft: UnitDraft, value: OrderItemUnit): string {
  return draft?.unit === value ? draft.text : ORDER_ITEM_UNIT_LABELS[value]
}

/**
 * Base UI metni değiştirdiğinde yeni taslak. Yalnız kullanıcının yazdığı ya da
 * sildiği metin (`input-change`, `input-clear`) taslaktır; Base UI'ın kendi
 * yazdığı metin (seçim `item-press`, kapanışta etikete dönüş `none`) taslağı
 * düşürür.
 */
export function nextUnitDraft(reason: string, text: string, value: OrderItemUnit): UnitDraft {
  return reason === "input-change" || reason === "input-clear" ? { unit: value, text } : null
}

/**
 * Seçimin kabulü: metni silmek seçimi `null` yapar (birim boş kalamaz) ve devre
 * dışı birim seçilemez — ikisi de yok sayılır.
 */
export function acceptedUnit(
  next: OrderItemUnit | null,
  isOptionDisabled?: (value: OrderItemUnit) => boolean
): OrderItemUnit | null {
  if (next == null || isOptionDisabled?.(next)) return null
  return next
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
  appearance,
  className,
}: {
  value: OrderItemUnit
  onValueChange: (value: OrderItemUnit) => void
  isOptionDisabled?: (value: OrderItemUnit) => boolean
  ariaLabel?: string
  /** Yanındaki girdinin boyu: kalem satırında `compact`, formda `default`. */
  size?: "default" | "compact"
  /** Görünüm (#952): tablo satırında `ghost`, formda `default`. */
  appearance?: "default" | "ghost"
  className?: string
}) {
  // Taslak: Base UI liste kapanınca metni etikete döndürüyor; ama liste hiç
  // açılmadan silinen metin (Tab ile gelip Backspace) boş kalıyordu. Odak
  // çıkınca taslak düşer, alan etikete döner.
  const [draft, setDraft] = useState<UnitDraft>(null)
  // Açık/kapalı burada tutulur: kapalı alanda Enter listeyi açar (eski düğme
  // tetikleyici gibi).
  const [open, setOpen] = useState(false)

  return (
    <Combobox
      items={ORDER_ITEM_UNITS}
      value={value}
      itemToStringLabel={(unit: OrderItemUnit) => ORDER_ITEM_UNIT_LABELS[unit]}
      filter={matchesOrderItemUnit}
      locale="tr"
      autoHighlight
      open={open}
      onOpenChange={setOpen}
      inputValue={unitInputText(draft, value)}
      onInputValueChange={(text, details) => setDraft(nextUnitDraft(details.reason, text, value))}
      onValueChange={(next: OrderItemUnit | null) => {
        const unit = acceptedUnit(next, isOptionDisabled)
        if (unit) onValueChange(unit)
      }}
    >
      <ComboboxInput
        size={size}
        appearance={appearance}
        className={className}
        aria-label={ariaLabel}
        inputMode="none"
        // Yazarak süzmek için metin odakta seçilir — yalnız ince işaretçide
        // (fare / dokunmatik yüzey). Dokunmatikte seçim iOS'ta seçim tutamaçları
        // ve kopyala menüsü açıyor; orada dokunuş yalnız listeyi açar.
        onFocus={(event) => {
          if (window.matchMedia("(pointer: fine)").matches) event.currentTarget.select()
        }}
        onBlur={() => setDraft(null)}
        // Enter çevreleyen formu (teklif formu) hiç göndermez: kapalı alanda
        // listeyi açar, açıkken Base UI vurgulu birimi seçer ya da listeyi kapatır.
        onKeyDown={(event) => {
          if (event.key !== "Enter") return
          event.preventDefault()
          if (!open) setOpen(true)
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
