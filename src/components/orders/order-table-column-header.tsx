"use client"

import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * shadcn data table kolon başlığı: sıralama menüsü ve başlığın içinde
 * açılan metin filtresi. Radix DropdownMenu `asChild` ile bağlanır.
 */
export function OrderTableColumnHeader<TData, TValue>({
  column,
  title,
  align = "left",
}: {
  column: Column<TData, TValue>
  title: string
  align?: "left" | "right"
}) {
  const sorted = column.getIsSorted()
  const filterValue = (column.getFilterValue() as string) ?? ""
  const canSort = column.getCanSort()
  const canFilter = column.getCanFilter()

  if (!canSort && !canFilter) {
    return <span className={cn(align === "right" && "ml-auto")}>{title}</span>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "-ml-1 px-1.5 text-xs font-medium text-muted-foreground",
            align === "right" && "ml-auto",
            (sorted || filterValue) && "text-foreground",
          )}
        >
          {title}
          {sorted === "desc" ? (
            <ArrowDown className="size-3.5" />
          ) : sorted === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : canSort ? (
            <ChevronsUpDown className="size-3.5" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align === "right" ? "end" : "start"} className="w-52">
        {canSort ? (
          <>
            <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
              <ArrowUp />
              Artan
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
              <ArrowDown />
              Azalan
            </DropdownMenuItem>
          </>
        ) : null}
        {canFilter ? (
          <>
            {canSort ? <DropdownMenuSeparator /> : null}
            <div className="px-2 py-1.5" onKeyDown={(event) => event.stopPropagation()}>
              <Input
                value={filterValue}
                onChange={(event) => column.setFilterValue(event.target.value)}
                placeholder="Filtrele"
                aria-label={`${title} filtresi`}
              />
            </div>
            {filterValue ? (
              <DropdownMenuItem onClick={() => column.setFilterValue("")}>
                Filtreyi temizle
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
        {column.getCanHide() ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
              <EyeOff />
              Gizle
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
