"use client"

import { useEffect, useRef, useState } from "react"
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
  ariaLabel?: string
  options: Option[]
  className?: string
  /**
   * Seçim değişince bağlı GET formunu kendiliğinden gönderir ("Filtrele"
   * düğmesine basmaya gerek kalmaz). Varsayılan kapalı: bileşen beş sayfada
   * paylaşılıyor, davranış değişikliği yalnız açıkça isteyen sayfaya girsin.
   */
  autoSubmit?: boolean
}

export function FilterSelect({
  name,
  defaultValue = "",
  placeholder,
  ariaLabel,
  options,
  className,
  autoSubmit = false,
}: FilterSelectProps) {
  const [value, setValue] = useState(defaultValue)
  const hiddenRef = useRef<HTMLInputElement>(null)
  const pendingSubmit = useRef(false)

  // Submit, state DOM'a yansıdıktan SONRA tetiklenmeli; aynı tick'te
  // requestSubmit çağrılırsa gizli input hâlâ eski değeri taşır.
  useEffect(() => {
    if (!pendingSubmit.current) return
    pendingSubmit.current = false
    hiddenRef.current?.form?.requestSubmit()
  }, [value])

  return (
    <>
      <input type="hidden" name={name} value={value} ref={hiddenRef} />
      <Select
        value={value}
        onValueChange={(v) => {
          const next = v
          if (autoSubmit && next !== value) pendingSubmit.current = true
          setValue(next)
        }}
      >
        <SelectTrigger className={className} aria-label={ariaLabel ?? placeholder ?? name}>
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
