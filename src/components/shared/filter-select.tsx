"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Option = { value: string; label: string }

type FilterSelectProps = {
  name: string
  defaultValue?: string
  placeholder?: string
  options: Option[]
  className?: string
}

export function FilterSelect({
  name,
  defaultValue = "",
  placeholder,
  options,
  className,
}: FilterSelectProps) {
  const [value, setValue] = useState(defaultValue)

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Select items={options} value={value} onValueChange={(v) => setValue(v ?? "")}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
