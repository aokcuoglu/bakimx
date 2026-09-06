"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { parseOemNumbers } from "@/lib/catalog/bakimx-catalog"

interface TagInputProps {
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: boolean
  /** Virgül / noktalı virgül / satır sonu ile ayrılmış ham metin — `parseOemNumbers` ile tag listesine iner. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/**
 * Virgülle yazılmış tek bir metin alanı yerine, her kodun bağımsız ve tekil
 * silinebilir bir tag (chip) olduğu OEM / cross-reference girişi. Yanlışlıkla
 * bir virgülü silerek listenin tamamını bozmak imkânsız hâle gelir.
 *
 * FormControl (Slot) üzerinden gelen `id` / `aria-*` bağları içteki Input'a
 * iletilir; böylece FormLabel ile ilişki ve hata açıklaması korunur.
 */
export function TagInput({
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  value,
  onChange,
  placeholder,
}: TagInputProps) {
  const [draft, setDraft] = useState("")

  const tags = parseOemNumbers(value)

  const add = () => {
    const parsed = parseOemNumbers(draft)
    if (parsed.length === 0) return
    const next = [...tags]
    for (const tag of parsed) {
      if (!next.includes(tag)) next.push(tag)
    }
    onChange(next.join(", "))
    setDraft("")
  }

  const remove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag).join(", "))
  }

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Eklenen kodlar">
          {tags.map((tag) => (
            <Button
              key={tag}
              type="button"
              variant="secondary"
              size="xs"
              className="gap-1"
              onClick={() => remove(tag)}
              aria-label={`${tag} kodunu kaldır`}
            >
              {tag}
              <X className="size-3 text-muted-foreground" aria-hidden />
            </Button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()}>
          Ekle
        </Button>
      </div>
    </div>
  )
}