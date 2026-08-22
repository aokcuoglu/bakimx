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
  className,
}: {
  value: OrderItemUnit
  onValueChange: (value: OrderItemUnit) => void
  isOptionDisabled?: (value: OrderItemUnit) => boolean
  ariaLabel?: string
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
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn(
            "h-8 justify-between gap-1.5 rounded-lg bg-transparent px-2.5 text-sm font-normal whitespace-nowrap hover:bg-transparent dark:bg-input/30 dark:hover:bg-input/50",
            className,
          )}
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
            className="h-8 pl-8"
            autoFocus
          />
        </div>
        <div role="listbox" aria-label="Birimler" className="max-h-60 overflow-y-auto py-0.5">
          {visibleUnits.length === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">Birim bulunamadı</p>
          ) : visibleUnits.map((unit) => {
            const disabled = isOptionDisabled?.(unit)
            return (
              <button
                key={unit}
                type="button"
                role="option"
                aria-selected={unit === value}
                disabled={disabled}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50"
                onClick={() => {
                  onValueChange(unit)
                  changeOpen(false)
                }}
              >
                <Check className={cn("size-4", unit === value ? "opacity-100" : "opacity-0")} />
                {ORDER_ITEM_UNIT_LABELS[unit]}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
