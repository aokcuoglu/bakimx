"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { PartsLaborEditor, type PartsLaborRow } from "@/components/orders/parts-labor-grid"
import type { PickerVehicle } from "@/components/parts/tecdoc-part-picker"
import type { LaborCatalogRow } from "@/lib/labor/types"
import type { QuoteItemFormValues } from "@/lib/validations/quote"
import { quoteItemToRow, rowsToQuoteItems, toQuoteItemType, type QuoteEditorRow } from "@/lib/quotes/items"

/**
 * TEKLİF adaptörü — iş emrindeki `PartsLaborEditor`'ü form durumuna bağlar (#179).
 *
 * ⚠️ Stok invaryantı: teklif bir ÖNERİDİR. Bu adaptör hiçbir koşulda sunucuya
 * yazmaz; satırlar yalnız yerel durumda tutulur ve `onChange` ile form değerine
 * yansır. Kalıcılaşma tek noktada, teklif gönderiminde olur ve `createQuoteAction`
 * stok hareketi YAPMAZ — stok yalnız teklif iş emrine çevrildiğinde düşer
 * (`convertQuoteToWorkOrderAction`). Bu davranışı `quote-stock-invariant.test.ts`
 * koruyor.
 *
 * `PartsLaborGrid` (iş emri adaptörü) burada bilinçli olarak KULLANILMAZ: o
 * bileşen her satır için `/api/orders/items` uçlarına yazar, `partId` doluysa
 * stok düşürür ve zorunlu bir `orderId` ister — henüz kaydedilmemiş bir teklifte
 * hiçbiri yoktur.
 */
export function QuoteItemsEditor({
  value,
  onChange,
  vehicle,
  laborCatalog,
  disabled = false,
}: {
  value: QuoteItemFormValues[]
  onChange: (items: QuoteItemFormValues[]) => void
  /** Araç seçiliyse zengin katalog (TecDoc) araması açılır; yoksa manuel akış çalışır. */
  vehicle?: PickerVehicle
  laborCatalog: LaborCatalogRow[]
  disabled?: boolean
}) {
  // Satırlar burada YAŞAR; form değeri türetilir. Ters yön (form → satır) bilerek
  // yok: her yazımda satırları yeniden kurmak düzenleme sırasında odak ve
  // satır-yerel durumu (fiyat taslağı) sıfırlardı.
  const [rows, setRows] = useState<PartsLaborRow[]>(() =>
    value.map((item, i) => toEditorRow(quoteItemToRow(item, `q${i}`)))
  )
  // Satırların ayna kopyası: `addItem` async, composer arka arkaya iki kalem
  // gönderirse render arası kalan bayat closure ilkini yutardı. İşleyiciler
  // daima ref'ten okur (render sırasında OKUNMAZ).
  const rowsRef = useRef(rows)
  const nextId = useRef(value.length)

  const [flash, setFlash] = useState<{ rowId: string; kind: "saved" | "added" } | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current) }, [])

  const publish = useCallback(
    (next: PartsLaborRow[]) => {
      rowsRef.current = next
      setRows(next)
      onChange(rowsToQuoteItems(next.map(fromEditorRow)))
    },
    [onChange]
  )

  function flashRow(rowId: string, kind: "saved" | "added") {
    setFlash({ rowId, kind })
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 2000)
  }

  async function addItem(draft: PartsLaborRow): Promise<boolean> {
    const name = draft.name.trim()
    if (!name) return false
    const id = `q${nextId.current++}`
    publish([
      ...rowsRef.current,
      {
        ...draft,
        id,
        name,
        // Tip daraltması: dış işçilik teklif kalemi olamaz (QuoteItemType = part|labor).
        // Composer'da o mod zaten kapalı; burada ikinci kez güvenceye alınır.
        type: toQuoteItemType(draft.type),
        __draft: false,
      },
    ])
    flashRow(id, "added")
    return true
  }

  const onCell = (row: PartsLaborRow, patch: Partial<PartsLaborRow>) => {
    publish(rowsRef.current.map((r) => (r.id === row.id ? { ...r, ...patch } : r)))
  }

  function removeRow(row: PartsLaborRow) {
    publish(rowsRef.current.filter((r) => r.id !== row.id))
  }

  return (
    <PartsLaborEditor
      rows={rows}
      vehicle={vehicle}
      locked={false}
      loading={disabled}
      laborCatalog={laborCatalog}
      // Dış işçilik iş emri yürütme kavramı; teklif kalemi tipi part|labor.
      allowExternalLabor={false}
      // Marka/Kategori QuoteItem'da saklanamaz → düzenlenebilir gösterilmez.
      showAttributes={false}
      flash={flash}
      onAdd={addItem}
      onCell={onCell}
      onRemove={removeRow}
    />
  )
}

/** Teklif satırı → düzenleyici satırı (düzenleyicinin beklediği alanlar tamamlanır). */
function toEditorRow(row: QuoteEditorRow): PartsLaborRow {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    totalPrice: row.totalPrice,
    note: row.note,
    brand: null,
    category: null,
    categoryId: null,
    source: null,
    __partId: row.partId,
  }
}

/** Düzenleyici satırı → teklif satırı. Saklanamayan alanlar burada düşer. */
function fromEditorRow(row: PartsLaborRow): QuoteEditorRow {
  return {
    id: row.id,
    type: toQuoteItemType(row.type),
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    totalPrice: row.totalPrice,
    note: row.note,
    partId: row.__partId ?? null,
  }
}
