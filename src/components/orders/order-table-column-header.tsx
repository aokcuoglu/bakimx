"use client"

import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

type ColumnKind = "text" | "number" | "date" | "stage"

/** Sıralama yönünün kolon türüne göre okunur adı. */
const SORT_LABELS: Record<ColumnKind, { asc: string; desc: string }> = {
  text: { asc: "A → Z", desc: "Z → A" },
  number: { asc: "Küçükten büyüğe", desc: "Büyükten küçüğe" },
  date: { asc: "Eskiden yeniye", desc: "Yeniden eskiye" },
  // Durum / Ödeme: etiket alfabesi değil, iş akışı sırası (enum sırası).
  stage: { asc: "İş akışı sırası", desc: "Ters sıra" },
}

/**
 * Tablo kolon başlığı: tıklayınca açılan panelde sıralama (sunucuda, tüm
 * kayıtlar üzerinde) ve kolonu gizleme. Kolon içi arama kaldırıldı (#831):
 * üstteki arama ve filtreler tek giriş. Başlık etkin sıralamayı ok ile gösterir.
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
  const canSort = column.getCanSort()
  const labels = SORT_LABELS[kind]

  if (!canSort) {
    return <span className={cn(align === "right" && "ml-auto")}>{title}</span>
  }

  const state = sorted === "asc" ? labels.asc : sorted === "desc" ? labels.desc : null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={state ? `${title} — ${state}` : `${title}: sırala`}
          className={cn(
            "-ml-1.5 gap-1 px-1.5 text-muted-foreground",
            align === "right" && "ml-auto",
            sorted && "text-foreground",
          )}
        >
          {title}
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
              className="w-full justify-start gap-1.5 px-2 data-[state=on]:bg-primary/10 data-[state=on]:text-primary-strong"
            >
              <ArrowUp aria-hidden="true" />
              {labels.asc}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="desc"
              size="sm"
              className="w-full justify-start gap-1.5 px-2 data-[state=on]:bg-primary/10 data-[state=on]:text-primary-strong"
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
            className="w-full justify-start gap-1.5 px-2 text-muted-foreground"
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
