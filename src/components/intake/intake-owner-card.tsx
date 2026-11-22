"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPhoneTR, toTrUpper } from "@/lib/format"
import type { ExistingCustomer } from "@/lib/customers/duplicate-phone"
import type { OwnerFields } from "@/lib/intake/entry-wizard"

/**
 * Araç bilgileri ekranında plakanın hemen altındaki müşteri kartı (odaklı plaka
 * akışı). Plaka kayıtlı değilse boş gelir — yeni müşteri bu bilgilerle açılır.
 * Kayıtlıysa aracın sahibiyle dolu gelir ve düzenlenebilir; değişiklik o
 * müşterinin kaydını günceller (sahip değişmez). Saf sunum: state sihirbazda.
 */
export function IntakeOwnerCard({
  value,
  onChange,
  registeredVehicleLabel,
  loading = false,
  duplicates = [],
  onUseExisting,
  onConfirmDuplicate,
}: {
  value: OwnerFields
  onChange: (next: OwnerFields) => void
  /** Plaka kayıtlıysa aracın etiketi ("34ABC123 — Renault Clio"). */
  registeredVehicleLabel?: string
  /** Kayıtlı aracın sahibi yükleniyor. */
  loading?: boolean
  /** Telefon başka müşteride kayıtlıysa sunucudan dönen eşleşmeler. */
  duplicates?: ExistingCustomer[]
  /** Yeni müşteri yerine telefonla bulunan müşteriyi kullan (yalnız kayıtsız plakada). */
  onUseExisting?: (customer: ExistingCustomer) => void
  /** Aynı telefonla yine de kaydet. */
  onConfirmDuplicate: () => void
}) {
  const registered = !!registeredVehicleLabel
  const set = (patch: Partial<OwnerFields>) => onChange({ ...value, ...patch })

  return (
    <section aria-labelledby="intake-owner-title" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0">
        <h3 id="intake-owner-title" className="font-semibold text-foreground">
          {registered ? "Kayıtlı müşteri" : "Müşteri bilgileri"}
        </h3>
        {registered && <p className="text-sm text-muted-foreground">Plaka kayıtlı: {registeredVehicleLabel}</p>}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Müşteri bilgileri yükleniyor…
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {value.type === "corporate" ? (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="owner-company">Firma adı *</Label>
              <Input
                id="owner-company"
                value={value.companyName}
                onChange={(e) => set({ companyName: toTrUpper(e.target.value) })}
                autoComplete="organization"
              />
            </div>
          ) : (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="owner-name">Ad Soyad *</Label>
              <Input
                id="owner-name"
                value={value.name}
                onChange={(e) => set({ name: toTrUpper(e.target.value) })}
                autoComplete="name"
              />
            </div>
          )}
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

      {duplicates.length > 0 && (
        <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <p className="text-sm font-medium text-foreground">Bu telefon başka müşteride kayıtlı:</p>
          {duplicates.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card p-2">
              <span className="min-w-0 text-sm text-foreground">{c.label}</span>
              {!registered && onUseExisting && (
                <Button type="button" size="sm" variant="outline" onClick={() => onUseExisting(c)}>
                  Bu müşteriyi kullan
                </Button>
              )}
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={onConfirmDuplicate}>
            Yine de bu numarayla kaydet
          </Button>
        </div>
      )}
    </section>
  )
}
