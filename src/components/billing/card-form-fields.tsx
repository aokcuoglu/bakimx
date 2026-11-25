"use client"

import { useId, useState } from "react"
import { CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
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
  presentation = "default",
  summary,
}: {
  action: string
  /** Akışa özel gizli alanlar — satış: `{ reference }`, doğrulama: `{ vtoken }`. */
  hidden: Record<string, string>
  /** Buton içeriği (ikon dahil) idle durumunda. */
  submitLabel: React.ReactNode
  /** Buton içeriği submit sonrası (BrandSpinner otomatik eklenir). */
  submittingLabel: React.ReactNode
  presentation?: "default" | "attio"
  summary?: React.ReactNode
}) {
  const [holderName, setHolderName] = useState("")
  const [cardDisplay, setCardDisplay] = useState("") // 4'lü gruplu görünen değer
  const [month, setMonth] = useState("")
  const [year, setYear] = useState("")
  const [expiryDisplay, setExpiryDisplay] = useState("")
  const [cvv, setCvv] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const cardErrorId = useId()

  const cardDigits = stripNonDigits(cardDisplay)
  const expiryDigits = stripNonDigits(expiryDisplay)
  const effectiveMonth = presentation === "attio" ? expiryDigits.slice(0, 2) : month
  const effectiveYear = presentation === "attio"
    ? expiryDigits.length === 6 ? expiryDigits.slice(2) : expiryDigits.length === 4 ? `20${expiryDigits.slice(2)}` : ""
    : year
  const cardError = errors.number || errors.expiry || errors.cvv

  function validate(): Errors {
    const e: Errors = {}
    if (holderName.trim().length < 2) e.holderName = "Kart üzerindeki ismi girin."
    if (cardDigits.length < 12 || cardDigits.length > 19 || !luhnValid(cardDigits))
      e.number = "Geçerli bir kart numarası girin."
    if (!effectiveMonth || !effectiveYear || Number(effectiveMonth) < 1 || Number(effectiveMonth) > 12)
      e.expiry = "Geçerli bir son kullanma tarihi girin."
    else if (isExpiryPast(Number(effectiveMonth), Number(effectiveYear)))
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
    <form method="POST" action={action} onSubmit={onSubmit} className={presentation === "attio" ? "grid sm:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)]" : "space-y-3"} noValidate>
      {/* Submit edilen değerler YALNIZ bu hidden input'lardan gider (asla
          disable edilmez); görünen input'lar salt-formatlama/otomatik-doldurma
          içindir. Böylece submit anındaki React re-render zamanlamasına bağlı
          kalmadan tüm alanlar POST gövdesine girer. */}
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="holderName" value={holderName} />
      <input type="hidden" name="number" value={cardDigits} />
      <input type="hidden" name="expireMonth" value={effectiveMonth} />
      <input type="hidden" name="expireYear" value={effectiveYear} />
      <input type="hidden" name="cvv" value={cvv} />

      {presentation === "attio" ? (
        <>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-2 border-b pb-3 text-sm font-semibold">
              <span className="flex size-7 items-center justify-center rounded-md border bg-muted/30"><CreditCard className="size-4" aria-hidden="true" /></span>
              <h3>Ödeme bilgileri</h3>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Ödeme bilgileri (zorunlu)</Label>
              <Input
                aria-label="Kart üzerindeki isim"
                autoComplete="cc-name"
                value={holderName}
                onChange={(ev) => setHolderName(ev.target.value)}
                placeholder="Ad Soyad"
                disabled={submitting}
                aria-invalid={!!errors.holderName}
              />
              {errors.holderName && <p className="text-xs text-destructive-strong">{errors.holderName}</p>}
              <InputGroup aria-label="Kart bilgileri" aria-describedby={cardError ? cardErrorId : undefined}>
                <InputGroupAddon><CreditCard aria-hidden="true" /></InputGroupAddon>
                <InputGroupInput
                  aria-label="Kart numarası"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardDisplay}
                  onChange={(ev) => setCardDisplay(formatCardNumber(ev.target.value))}
                  placeholder="Kart numarası"
                  disabled={submitting}
                  aria-invalid={!!cardError}
                  aria-describedby={cardError ? cardErrorId : undefined}
                />
                <InputGroupInput
                  aria-label="Son kullanma tarihi"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  value={expiryDisplay}
                  onChange={(ev) => {
                    const digits = stripNonDigits(ev.target.value).slice(0, 6)
                    setExpiryDisplay(digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits)
                  }}
                  placeholder="AA / YY"
                  disabled={submitting}
                  className="w-20 flex-none px-1 text-center"
                  aria-describedby={cardError ? cardErrorId : undefined}
                />
                <InputGroupInput
                  aria-label="CVV"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={4}
                  value={cvv}
                  onChange={(ev) => setCvv(stripNonDigits(ev.target.value).slice(0, 4))}
                  placeholder="CVV"
                  disabled={submitting}
                  className="w-14 flex-none px-1 text-center"
                  aria-describedby={cardError ? cardErrorId : undefined}
                />
              </InputGroup>
              {cardError && (
                <p id={cardErrorId} className="text-xs text-destructive-strong">{cardError}</p>
              )}
            </div>
          </div>
          <aside className="flex flex-col gap-4 border-t bg-muted/20 p-4 sm:border-t-0 sm:border-l sm:p-5">
            {summary}
            <Button variant="navy" type="submit" size="sm" disabled={submitting} className="mt-auto w-full">
              {submitting ? <><BrandSpinner size={18} /> {submittingLabel}</> : submitLabel}
            </Button>
          </aside>
        </>
      ) : (
      <>
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

      <Button variant="foreground" type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
        {submitting ? (
          <>
            <BrandSpinner size={18} /> {submittingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
      </>
      )}
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
