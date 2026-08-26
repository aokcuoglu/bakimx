"use client"

import * as React from "react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarDays } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface DateRangePickerProps {
  value?: DateRange
  onChange?: (value: DateRange | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Tarih aralığı",
  disabled,
  className,
  "aria-label": ariaLabel = "Tarih aralığı",
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selectionStarted = React.useRef(false)
  const currentYear = new Date().getFullYear()

  const label = value?.from
    ? value.to
      ? `${format(value.from, "dd.MM.yyyy")} – ${format(value.to, "dd.MM.yyyy")}`
      : `${format(value.from, "dd.MM.yyyy")} – Bitiş tarihi`
    : placeholder

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) selectionStarted.current = false
        setOpen(nextOpen)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "w-64 justify-start gap-2 font-normal",
            !value?.from && "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Tarih aralığı seçimi"
        className="w-auto max-w-[calc(100vw-2rem)] p-0"
        align="end"
      >
        <Calendar
          mode="range"
          selected={value}
          defaultMonth={value?.from}
          captionLayout="dropdown"
          startMonth={new Date(currentYear - 10, 0)}
          endMonth={new Date(currentYear + 1, 11)}
          locale={tr}
          onSelect={(range) => {
            onChange?.(range)
            if (selectionStarted.current && range?.from && range.to) setOpen(false)
            selectionStarted.current = true
          }}
        />
        {(value?.from || value?.to) && (
          <div className="flex justify-between border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange?.(undefined)
                setOpen(false)
              }}
            >
              Temizle
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Tamam
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
