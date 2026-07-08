"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// Ruhsat tarih alanları DB'de GG.AA.YYYY (dd.MM.yyyy) string tutulur; bu bileşen
// depolama formatını bozmadan (string girer, string çıkar) shadcn takvimini gösterir.
const STORAGE_FORMAT = "dd.MM.yyyy"

function parseTrDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const d = parse(value.trim(), STORAGE_FORMAT, new Date())
  return isValid(d) ? d : undefined
}

export interface DatePickerProps {
  value?: string | null
  onChange?: (value: string) => void
  placeholder?: string
  id?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Tarih seçin",
  id,
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseTrDate(value)
  const currentYear = new Date().getFullYear()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start gap-2 font-normal",
              !selected && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="size-4 opacity-60" />
        {selected ? format(selected, STORAGE_FORMAT) : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={new Date(currentYear - 60, 0)}
          endMonth={new Date(currentYear + 10, 11)}
          locale={tr}
          onSelect={(date) => {
            onChange?.(date ? format(date, STORAGE_FORMAT) : "")
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
