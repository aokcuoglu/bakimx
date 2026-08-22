"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { ORDER_ITEM_UNIT_LABELS, ORDER_ITEM_UNITS, type OrderItemUnit } from "@/lib/orders/quantity"

export function OrderItemUnitCombobox({
  value,
  onValueChange,
  isOptionDisabled,
  ariaLabel = "Birim",
  className,
}: {
  value: OrderItemUnit
  onValueChange: (value: OrderItemUnit) => void
  isOptionDisabled?: (value: OrderItemUnit) => boolean
  ariaLabel?: string
  className?: string
}) {
  return (
    <Combobox
      items={[...ORDER_ITEM_UNITS]}
      value={value}
      itemToStringLabel={(unit: OrderItemUnit) => ORDER_ITEM_UNIT_LABELS[unit]}
      itemToStringValue={(unit: OrderItemUnit) => unit}
      filter={(unit: OrderItemUnit, query: string) =>
        ORDER_ITEM_UNIT_LABELS[unit].toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr"))}
      onValueChange={(unit: OrderItemUnit | null) => {
        if (unit) onValueChange(unit)
      }}
    >
      <ComboboxInput aria-label={ariaLabel} placeholder="Birim ara" className={className} />
      <ComboboxContent>
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
