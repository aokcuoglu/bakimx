"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { ORDER_ITEM_UNIT_LABELS, ORDER_ITEM_UNITS, type OrderItemUnit } from "@/lib/orders/quantity"

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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const visibleUnits = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr")
    return normalized
      ? ORDER_ITEM_UNITS.filter((unit) => ORDER_ITEM_UNIT_LABELS[unit].toLocaleLowerCase("tr").includes(normalized))
      : ORDER_ITEM_UNITS
  }, [query])

  function changeOpen(next: boolean) {
    setOpen(next)
    if (!next) setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          // Alan görünümlü tetikleyici (#889): yanındaki girdiyle aynı boy,
          // çerçeve ve köşe.
          variant="field"
          size={size}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn("justify-between gap-1.5", className)}
        >
          <span className="truncate">{ORDER_ITEM_UNIT_LABELS[value]}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-1.5 p-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Birim ara..."
            aria-label="Birim ara"
            size="sm"
            className="pl-8"
            autoFocus
          />
        </div>
        <div role="listbox" aria-label="Birimler" className="max-h-60 overflow-y-auto py-0.5">
          {visibleUnits.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">Birim bulunamadı</p>
          ) : visibleUnits.map((unit) => {
            const disabled = isOptionDisabled?.(unit)
            return (
              <Button
                key={unit}
                type="button"
                variant="ghost"
                size="sm"
                role="option"
                aria-selected={unit === value}
                disabled={disabled}
                className="w-full justify-start gap-2 text-left"
                onClick={() => {
                  onValueChange(unit)
                  changeOpen(false)
                }}
              >
                <Check className={cn("size-4", unit === value ? "opacity-100" : "opacity-0")} />
                {ORDER_ITEM_UNIT_LABELS[unit]}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
