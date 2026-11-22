"use client"

import { useState, type Ref } from "react"
import { AlertTriangle, Building2, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPhoneTR, toTrUpper } from "@/lib/format"
import { IntakeCompanySheet } from "@/components/intake/intake-company-sheet"
import type { ExistingCustomer } from "@/lib/customers/duplicate-phone"
import type { OwnerFields } from "@/lib/intake/entry-wizard"

/**
 * Araç bilgileri ekranında plakanın hemen altındaki müşteri kartı (odaklı plaka
 * akışı). Plaka kayıtlı değilse boş gelir — yeni müşteri bu bilgilerle açılır.
 * Kayıtlıysa aracın sahibiyle dolu gelir ve düzenlenebilir; değişiklik o
 * müşterinin kaydını günceller (sahip değişmez). "Kurumsal" düğmesi firma adı
 * sheet'ini açar ve müşteri tipini değiştirir: Ad Soyad yetkili olarak kalır,
 * üstüne Firma adı eklenir. Form state'i sihirbazda; burada yalnız sheet'in
 * açık/kapalı durumu tutulur.
 */
export function IntakeOwnerCard({
  value,
  onChange,
  registeredVehicleLabel,
  loading = false,
}: {
  value: OwnerFields
  onChange: (next: OwnerFields) => void
  /** Plaka kayıtlıysa aracın etiketi ("34ABC123 — Renault Clio"). */
  registeredVehicleLabel?: string
  /** Kayıtlı aracın sahibi yükleniyor. */
  loading?: boolean
}) {
  const registered = !!registeredVehicleLabel
  const corporate = value.type === "corporate"
  const [companyOpen, setCompanyOpen] = useState(false)
  const set = (patch: Partial<OwnerFields>) => onChange({ ...value, ...patch })

  return (
    <section aria-labelledby="intake-owner-title" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="intake-owner-title" className="font-semibold text-foreground">
            {registered ? "Kayıtlı müşteri" : "Müşteri bilgileri"}
          </h3>
        </div>
        {/* Kurumsal değilken: firma seçme sheet'ini açar. Kurumsalken: tekrar
            basınca bireysele döner (firma değiştirmek için Firma adı alanına
            dokunulur). Ad Soyad her iki durumda korunur. */}
        <Button
          type="button"
          size="sm"
          variant={corporate ? "secondary" : "outline"}
          aria-haspopup={corporate ? undefined : "dialog"}
          className="shrink-0"
          disabled={loading}
          aria-pressed={corporate}
          onClick={() => (corporate ? set({ type: "individual" }) : setCompanyOpen(true))}
        >
          {corporate ? <Check aria-hidden /> : <Building2 aria-hidden />}
          Kurumsal
        </Button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Müşteri bilgileri yükleniyor…
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* Kurumsalda Firma adı en üstte; Ad Soyad her iki tipte de kalır,
              kurumsalda firmanın yetkilisidir (isteğe bağlı). */}
          {corporate && (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="owner-company">Firma adı *</Label>
              {/* Salt okunur: dokununca otomatik tamamlamalı sheet açılır. */}
              <Input
                id="owner-company"
                value={value.companyName}
                readOnly
                onClick={() => setCompanyOpen(true)}
                placeholder="Firma seçin"
                className="cursor-pointer"
              />
            </div>
          )}
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="owner-name">{corporate ? "Ad Soyad" : "Ad Soyad *"}</Label>
            <Input
              id="owner-name"
              value={value.name}
              onChange={(e) => set({ name: toTrUpper(e.target.value) })}
              autoComplete="name"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="owner-phone">Telefon *</Label>
            <Input
              id="owner-phone"
              value={value.phone}
              onChange={(e) => set({ phone: formatPhoneTR(e.target.value) })}
              inputMode="tel"
              autoComplete="tel"
              placeholder="0544 515 74 08"
            />
          </div>
        </div>
      )}

      <IntakeCompanySheet
        open={companyOpen}
        onOpenChange={setCompanyOpen}
        companyName={corporate ? value.companyName : ""}
        onSelect={(companyName) => set({ type: "corporate", companyName })}
      />
    </section>
  )
}

/**
 * Telefon başka müşteride kayıtlı uyarısı. Kaydet düğmesi ekranın altında
 * olduğu için kartın içinde değil, adımın EN ÜSTÜNDE gösterilir; sade tek
 * satır metin + iki küçük eylem.
 */
export function IntakeDuplicatePhoneNotice({
  duplicates,
  onUseExisting,
  onConfirm,
  ref,
}: {
  /** Telefonun kayıtlı olduğu müşteriler (boşsa hiçbir şey çizilmez). */
  duplicates: ExistingCustomer[]
  /** Yeni müşteri yerine bulunan müşteriyi kullan (yalnız kayıtsız plakada). */
  onUseExisting?: (customer: ExistingCustomer) => void
  /** Aynı telefonla yine de kaydet. */
  onConfirm: () => void
  ref?: Ref<HTMLDivElement>
}) {
  if (duplicates.length === 0) return null
  const single = duplicates.length === 1

  return (
    <div ref={ref} role="alert" className="scroll-mt-20 space-y-3 rounded-xl bg-card p-4">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-strong" aria-hidden />
        <span className="min-w-0">
          {single
            ? <>Bu numara <span className="font-semibold">{duplicates[0].label}</span> adına kayıtlı.</>
            : <>Bu numara şu müşterilere kayıtlı: <span className="font-semibold">{duplicates.map((c) => c.label).join(", ")}</span>.</>}
        </span>
      </p>
      {onUseExisting && !single && (
        <div className="flex flex-wrap gap-2">
          {duplicates.map((c) => (
            <Button key={c.id} type="button" size="sm" variant="secondary" onClick={() => onUseExisting(c)}>
              {c.label}
            </Button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {onUseExisting && single && (
          <Button type="button" size="sm" variant="foreground" className="flex-1" onClick={() => onUseExisting(duplicates[0])}>
            Bu müşteriyi kullan
          </Button>
        )}
        <Button type="button" size="sm" variant="secondary" className="flex-1" onClick={onConfirm}>
          Yine de kaydet
        </Button>
      </div>
    </div>
  )
}
