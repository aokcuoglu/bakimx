"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import {
  stripNonDigits,
  luhnValid,
  formatCardNumber,
  isExpiryPast,
} from "@/lib/billing/card-input"

/**
 * Paylaşılan kart formu (satış + kayıt kart doğrulaması ORTAK). NATIVE
 * `<form method="POST">` ile 3DS'e tam sayfa navigasyon yapar — kart verisi
 * JSON/fetch ile HİÇBİR yere gönderilmez, yalnız bu form gövdesiyle sunucuya
 * gider. React state kartı SADECE görsel formatlama ve istemci doğrulaması için
 * tutar; loglanmaz/saklanmaz. `hidden` prop akışa özel gizli alanları
 * (reference | vtoken) besler; `action` hedef initiate route'unu belirler.
 */

// SKT yıl seçenekleri: bu yıl + 15 yıl.
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 16 }, (_, i) => CURRENT_YEAR + i)
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))

type Errors = Partial<Record<"holderName" | "number" | "expiry" | "cvv", string>>

export function CardFormFields({
  action,
  hidden,
  submitLabel,
  submittingLabel,
}: {
  action: string
  /** Akışa özel gizli alanlar — satış: `{ reference }`, doğrulama: `{ vtoken }`. */
  hidden: Record<string, string>
  /** Buton içeriği (ikon dahil) idle durumunda. */
  submitLabel: React.ReactNode
  /** Buton içeriği submit sonrası (BrandSpinner otomatik eklenir). */
  submittingLabel: React.ReactNode
}) {
  const [holderName, setHolderName] = useState("")
  const [cardDisplay, setCardDisplay] = useState("") // 4'lü gruplu görünen değer
  const [month, setMonth] = useState("")
  const [year, setYear] = useState("")
  const [cvv, setCvv] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)

  const cardDigits = stripNonDigits(cardDisplay)

  function validate(): Errors {
    const e: Errors = {}
    if (holderName.trim().length < 2) e.holderName = "Kart üzerindeki ismi girin."
    if (cardDigits.length < 12 || cardDigits.length > 19 || !luhnValid(cardDigits))
      e.number = "Geçerli bir kart numarası girin."
    if (!month || !year) e.expiry = "Son kullanma tarihini seçin."
    else if (isExpiryPast(Number(month), Number(year)))
      e.expiry = "Kartın son kullanma tarihi geçmiş."
    if (!/^\d{3,4}$/.test(cvv)) e.cvv = "CVV 3 veya 4 haneli olmalı."
    return e
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const e = validate()
    if (Object.keys(e).length > 0) {
      event.preventDefault()
      setErrors(e)
      return
    }
    // Geçerli → native POST'un devam etmesine izin ver; tam sayfa 3DS'e gider.
    setErrors({})
    setSubmitting(true)
  }

  return (
    <form method="POST" action={action} onSubmit={onSubmit} className="space-y-3" noValidate>
      {/* Submit edilen değerler YALNIZ bu hidden input'lardan gider (asla
          disable edilmez); görünen input'lar salt-formatlama/otomatik-doldurma
          içindir. Böylece submit anındaki React re-render zamanlamasına bağlı
          kalmadan tüm alanlar POST gövdesine girer. */}
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="holderName" value={holderName} />
      <input type="hidden" name="number" value={cardDigits} />
      <input type="hidden" name="expireMonth" value={month} />
      <input type="hidden" name="expireYear" value={year} />
      <input type="hidden" name="cvv" value={cvv} />

      <Field label="Kart üzerindeki isim" error={errors.holderName}>
        <Input
          autoComplete="cc-name"
          value={holderName}
          onChange={(ev) => setHolderName(ev.target.value)}
          placeholder="AD SOYAD"
          disabled={submitting}
        />
      </Field>

      <Field label="Kart numarası" error={errors.number}>
        <Input
          inputMode="numeric"
          autoComplete="cc-number"
          value={cardDisplay}
          onChange={(ev) => setCardDisplay(formatCardNumber(ev.target.value))}
          placeholder="0000 0000 0000 0000"
          disabled={submitting}
        />
      </Field>

      <div className="grid grid-cols-[1fr_1fr_1fr] gap-3">
        <Field label="Ay" error={undefined}>
          <Select value={month} onValueChange={(v) => setMonth(v)} disabled={submitting}>
            <SelectTrigger className="w-full" aria-label="Son kullanma ayı">
              <SelectValue placeholder="AA" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Yıl" error={undefined}>
          <Select value={year} onValueChange={(v) => setYear(v)} disabled={submitting}>
            <SelectTrigger className="w-full" aria-label="Son kullanma yılı">
              <SelectValue placeholder="YYYY" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="CVV" error={undefined}>
          <Input
            inputMode="numeric"
            autoComplete="cc-csc"
            maxLength={4}
            value={cvv}
            onChange={(ev) => setCvv(stripNonDigits(ev.target.value).slice(0, 4))}
            placeholder="123"
            disabled={submitting}
          />
        </Field>
      </div>
      {/* SKT/CVV için ortak hata satırı (üçlü grid altında tek yerde) */}
      {(errors.expiry || errors.cvv) && (
        <p className="text-xs leading-4 text-destructive-strong">{errors.expiry || errors.cvv}</p>
      )}

      <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
        {submitting ? (
          <>
            <BrandSpinner size={18} /> {submittingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="min-h-[16px] text-xs leading-4 text-destructive-strong">{error}</p>}
    </div>
  )
}
