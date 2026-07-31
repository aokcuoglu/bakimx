"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QuickSupplierModal } from "@/components/suppliers/quick-supplier-modal"
import { normalizeSupplierPriceRows } from "@/lib/parts/supplier-prices"
import { Plus, Trash2, Star, Store } from "lucide-react"

export type SupplierOption = { id: string; name: string; phone: string | null }

/** Fiyat bu katmanda TRY (lira); kuruşa çevrim gönderim anında yapılır. */
export type SupplierPriceFormRow = {
  supplierId: string
  purchasePrice: number
  supplierSku: string
  isPreferred: boolean
}

const EMPTY_ROW: SupplierPriceFormRow = { supplierId: "", purchasePrice: 0, supplierSku: "", isPreferred: false }

export function PartSupplierPricesField({
  suppliers,
  value,
  onChange,
  errors,
}: {
  suppliers: SupplierOption[]
  value: SupplierPriceFormRow[]
  onChange: (rows: SupplierPriceFormRow[]) => void
  /** Satır indeksine göre doğrulama mesajı (ör. "Tedarikçi seçilmelidir"). */
  errors?: (string | undefined)[]
}) {
  const [options, setOptions] = useState<SupplierOption[]>(suppliers)
  const [modalOpen, setModalOpen] = useState(false)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)

  function patchRow(index: number, patch: Partial<SupplierPriceFormRow>) {
    onChange(value.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRow() {
    onChange([...value, { ...EMPTY_ROW, isPreferred: value.length === 0 }])
  }

  function removeRow(index: number) {
    const next = value.filter((_, i) => i !== index)
    // Varsayılan satır silindiyse kalan ilk satır varsayılan olur.
    onChange(next.length > 0 && !next.some((r) => r.isPreferred) ? next.map((r, i) => ({ ...r, isPreferred: i === 0 })) : next)
  }

  function setPreferred(index: number) {
    onChange(value.map((r, i) => ({ ...r, isPreferred: i === index })))
  }

  function openModal(index: number | null) {
    setTargetIndex(index)
    setModalOpen(true)
  }

  function handleCreated(supplier: SupplierOption) {
    setOptions((prev) => [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name, "tr")))
    if (targetIndex != null) {
      patchRow(targetIndex, { supplierId: supplier.id })
    } else {
      onChange(normalizeSupplierPriceRows([...value, { ...EMPTY_ROW, supplierId: supplier.id }]))
    }
    setTargetIndex(null)
  }

  const usedIds = new Set(value.map((r) => r.supplierId).filter(Boolean))

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <Store className="size-6 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Bu parça için henüz tedarikçi eklenmedi.</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            Alış fiyatı tedarikçi bazlı tutulur; en az bir tedarikçi ekleyin.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((row, index) => {
            const selected = options.find((o) => o.id === row.supplierId)
            const rowError = errors?.[index]
            return (
              <div key={index} className="rounded-lg border p-3 space-y-3 md:space-y-0 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end md:gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tedarikçi *</Label>
                  <Select
                    value={row.supplierId}
                    onValueChange={(v: string | null) => {
                      if (v === "__new__") {
                        openModal(index)
                        return
                      }
                      patchRow(index, { supplierId: v ?? "" })
                    }}
                  >
                    <SelectTrigger className="w-full" aria-invalid={!!rowError}>
                      <SelectValue placeholder="Tedarikçi seçin">
                        {(v: string | null) => {
                          if (!v) return null
                          const s = options.find((o) => o.id === v)
                          return s ? s.name : v
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {options
                        .filter((o) => o.id === row.supplierId || !usedIds.has(o.id))
                        .map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                            {o.phone ? ` — ${o.phone}` : ""}
                          </SelectItem>
                        ))}
                      <SelectItem value="__new__">+ Yeni tedarikçi oluştur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Alış Fiyatı (₺)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.purchasePrice}
                    onChange={(e) => patchRow(index, { purchasePrice: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Tedarikçi Parça Kodu</Label>
                  <Input
                    value={row.supplierSku}
                    onChange={(e) => patchRow(index, { supplierSku: e.target.value })}
                    placeholder="Opsiyonel"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={row.isPreferred ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreferred(index)}
                    aria-pressed={row.isPreferred}
                    aria-label="Varsayılan tedarikçi olarak işaretle"
                    title="Varsayılan tedarikçi"
                  >
                    <Star className="size-3.5" />
                    <span className="ml-1 md:hidden">Varsayılan</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeRow(index)}
                    aria-label={`${selected?.name ?? "Tedarikçi"} satırını sil`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {rowError && (
                  <p className="md:col-span-4 text-xs text-destructive">
                    {index + 1}. tedarikçi satırı: {rowError}
                  </p>
                )}

                {row.isPreferred && (
                  <div className="md:col-span-4 flex items-start gap-1.5 min-w-0">
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      Varsayılan
                    </Badge>
                    <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
                      Parçanın alış fiyatı bu satırdan alınır
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={value.length >= 20}>
          <Plus className="size-3.5 mr-1" />
          Tedarikçi ekle
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => openModal(null)} disabled={value.length >= 20}>
          <Plus className="size-3.5 mr-1" />
          Yeni tedarikçi oluştur
        </Button>
      </div>

      <QuickSupplierModal open={modalOpen} onOpenChange={setModalOpen} onCreated={handleCreated} />
    </div>
  )
}
