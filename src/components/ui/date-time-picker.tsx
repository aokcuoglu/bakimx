"use client"

import * as React from "react"
import { format, isValid } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarIcon, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function parseLocalDateTime(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return isValid(date) ? date : undefined
}

function toLocalDateTimeValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

export interface DateTimePickerProps {
  value?: string | null
  onChange?: (value: string) => void
  placeholder?: string
  id?: string
  disabled?: boolean
  className?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean | "true" | "false"
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Tarih ve saat seçin",
  id,
  disabled,
  className,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseLocalDateTime(value)
  const currentYear = new Date().getFullYear()

  function selectDate(date: Date | undefined) {
    if (!date) {
      onChange?.("")
      return
    }

    const next = selected ? new Date(selected) : new Date()
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate())
    next.setSeconds(0, 0)
    onChange?.(toLocalDateTimeValue(next))
  }

  function selectTime(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.value) return
    const [hours, minutes] = event.target.value.split(":").map(Number)
    const next = selected ? new Date(selected) : new Date()
    next.setHours(hours, minutes, 0, 0)
    onChange?.(toLocalDateTimeValue(next))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            className={cn(
              "w-full justify-start gap-2 font-normal",
              !selected && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="size-4 opacity-60" />
        <span className="truncate">
          {selected ? format(selected, "dd.MM.yyyy HH:mm", { locale: tr }) : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={new Date(currentYear - 60, 0)}
          endMonth={new Date(currentYear, 11)}
          locale={tr}
          onSelect={selectDate}
        />
        <div className="flex items-center gap-2 border-t border-border p-3">
          <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <label htmlFor={`${id ?? "date-time"}-time`} className="text-sm font-medium">
            Saat
          </label>
          <Input
            id={`${id ?? "date-time"}-time`}
            type="time"
            step={60}
            value={selected ? format(selected, "HH:mm") : ""}
            onChange={selectTime}
            disabled={disabled}
            className="ml-auto w-28"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
