"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function TaxIdentityFields({
  identityNumber,
  taxNumber,
  taxOffice,
  onIdentityChange,
  onTaxNumberChange,
  onTaxOfficeChange,
  errors,
  showHeading = true,
  className,
}: {
  identityNumber: string
  taxNumber: string
  taxOffice: string
  onIdentityChange: (v: string) => void
  onTaxNumberChange: (v: string) => void
  onTaxOfficeChange: (v: string) => void
  errors?: { identityNumber?: string; taxNumber?: string; taxOffice?: string }
  showHeading?: boolean
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {showHeading && (
        <header>
          <h3 className="text-sm font-semibold text-foreground">Vergi / Kimlik Bilgileri</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Fatura ve resmi kayıtlar için</p>
        </header>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>TC Kimlik No</Label>
          <Input
            value={identityNumber}
            onChange={(e) => onIdentityChange(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={11}
            placeholder="12345678901"
          />
          {errors?.identityNumber && <p className="text-sm text-destructive">{errors.identityNumber}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Vergi No</Label>
          <Input
            value={taxNumber}
            onChange={(e) => onTaxNumberChange(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={10}
            placeholder="1234567890"
          />
          {errors?.taxNumber && <p className="text-sm text-destructive">{errors.taxNumber}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Vergi Dairesi</Label>
          <Input value={taxOffice} onChange={(e) => onTaxOfficeChange(e.target.value)} placeholder="Kadıköy VD" />
          {errors?.taxOffice && <p className="text-sm text-destructive">{errors.taxOffice}</p>}
        </div>
      </div>
    </div>
  )
}
