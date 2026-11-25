"use client"

import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff, ListFilter, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

type ColumnKind = "text" | "number" | "date"

/** Sıralama yönünün kolon türüne göre okunur adı. */
const SORT_LABELS: Record<ColumnKind, { asc: string; desc: string }> = {
  text: { asc: "A → Z", desc: "Z → A" },
  number: { asc: "Küçükten büyüğe", desc: "Büyükten küçüğe" },
  date: { asc: "Eskiden yeniye", desc: "Yeniden eskiye" },
}

/**
 * Tablo kolon başlığı: tıklayınca açılan panelde kolonda arama (metin filtresi)
 * ve sıralama. Başlık, etkin sıralamayı ok ile, etkin filtreyi huni ile gösterir —
 * eskiden ikisi de bir açılır menünün içinde, başlıkta yalnız ⇅ görünüyordu.
 */
export function OrderTableColumnHeader<TData, TValue>({
  column,
  title,
  align = "left",
  kind = "text",
}: {
  column: Column<TData, TValue>
  title: string
  align?: "left" | "right"
  kind?: ColumnKind
}) {
  const sorted = column.getIsSorted()
  const filterValue = (column.getFilterValue() as string) ?? ""
  const canSort = column.getCanSort()
  const canFilter = column.getCanFilter()
  const labels = SORT_LABELS[kind]

  if (!canSort && !canFilter) {
    return <span className={cn(align === "right" && "ml-auto")}>{title}</span>
  }

  const state = [
    sorted === "asc" ? labels.asc : sorted === "desc" ? labels.desc : null,
    filterValue ? `"${filterValue}" ile filtreli` : null,
  ].filter(Boolean).join(", ")

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={state ? `${title} — ${state}` : `${title}: sırala veya filtrele`}
          className={cn(
            "-ml-1.5 h-8 gap-1 rounded-full px-1.5 text-[13px] font-medium text-muted-foreground",
            align === "right" && "ml-auto",
            (sorted || filterValue) && "text-foreground",
          )}
        >
          {title}
          {filterValue ? <ListFilter className="size-3.5 text-primary-strong" aria-hidden="true" /> : null}
          {sorted === "desc" ? (
            <ArrowDown className="size-3.5" aria-hidden="true" />
          ) : sorted === "asc" ? (
            <ArrowUp className="size-3.5" aria-hidden="true" />
          ) : canSort ? (
            <ChevronsUpDown className="size-3.5" aria-hidden="true" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align === "right" ? "end" : "start"} className="w-64 space-y-2 p-2">
        {canFilter ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              autoFocus
              value={filterValue}
              onChange={(event) => column.setFilterValue(event.target.value)}
              placeholder={`${title} içinde ara`}
              aria-label={`${title} kolonunda ara`}
              className="h-9 pl-8 pr-8"
            />
            {filterValue ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                aria-label="Aramayı temizle"
                onClick={() => column.setFilterValue("")}
              >
                <X />
              </Button>
            ) : null}
          </div>
        ) : null}

        {canSort ? (
          <ToggleGroup
            type="single"
            value={sorted || ""}
            onValueChange={(value) => {
              if (value === "asc") column.toggleSorting(false)
              else if (value === "desc") column.toggleSorting(true)
              else column.clearSorting()
            }}
            aria-label={`${title} sıralaması`}
            className="grid w-full grid-cols-2 gap-1"
          >
            <ToggleGroupItem
              value="asc"
              size="sm"
              className="h-8 w-full justify-start gap-1.5 rounded-md px-2 text-[13px] data-[state=on]:bg-primary/10 data-[state=on]:text-primary-strong"
            >
              <ArrowUp aria-hidden="true" />
              {labels.asc}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="desc"
              size="sm"
              className="h-8 w-full justify-start gap-1.5 rounded-md px-2 text-[13px] data-[state=on]:bg-primary/10 data-[state=on]:text-primary-strong"
            >
              <ArrowDown aria-hidden="true" />
              {labels.desc}
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null}

        {column.getCanHide() ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground"
            onClick={() => column.toggleVisibility(false)}
          >
            <EyeOff aria-hidden="true" />
            Kolonu gizle
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
