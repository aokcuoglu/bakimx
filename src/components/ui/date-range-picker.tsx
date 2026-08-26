"use client"

import * as React from "react"
import { format, isSameDay } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarRange } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type DateRangeValue = {
  from?: Date
  to?: Date
}

export interface DateRangePickerProps {
  value: DateRangeValue | undefined
  onChange: (value: DateRangeValue | undefined) => void
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
}

function rangeLabel(value: DateRangeValue | undefined, placeholder: string): string {
  if (!value?.from && value?.to) return `… – ${format(value.to, "dd.MM.yyyy")}`
  if (!value?.from) return placeholder
  if (!value.to) return `${format(value.from, "dd.MM.yyyy")} – …`
  if (isSameDay(value.from, value.to)) return format(value.from, "dd.MM.yyyy")
  return `${format(value.from, "dd.MM.yyyy")} – ${format(value.to, "dd.MM.yyyy")}`
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Tarih aralığı seçin",
  disabled,
  id,
  className,
}: DateRangePickerProps) {
  const label = rangeLabel(value, placeholder)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={label}
          className={cn(
            "w-full justify-start gap-2 bg-transparent font-normal",
            !value?.from && "text-muted-foreground",
            className,
          )}
        >
          <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Tarih aralığı seçimi" className="w-auto bg-popover p-0" align="start">
        <Calendar
          autoFocus
          mode="range"
          min={0}
          selected={value ? { from: value.from ?? value.to, to: value.to } : undefined}
          defaultMonth={value?.from}
          locale={tr}
          onSelect={onChange}
        />
      </PopoverContent>
    </Popover>
  )
}
