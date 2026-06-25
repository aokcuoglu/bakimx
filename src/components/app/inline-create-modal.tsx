"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, User, X } from "lucide-react"
import { CustomerSearchOrCreate } from "./customer-search-or-create"

export type InlineCreateResult = {
  customerId: string
  vehicleId: string
  plate?: string
  brand?: string
  model?: string
  customerName?: string
}

export function InlineCreateModal({
  open,
  onOpenChange,
  initialPlate,
  fixedCustomer,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPlate?: string
  fixedCustomer?: { id: string; label: string }
  onCreated: (result: InlineCreateResult) => void
}) {
  const [owner, setOwner] = useState<{ id: string; label: string } | null>(fixedCustomer ?? null)
  const [plate, setPlate] = useState((initialPlate || "").toUpperCase())
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [modelYear, setModelYear] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Reset fields only on the OPEN transition (false→true), not on every
  // initialPlate/fixedCustomer change. While the modal is open the picker's
  // own combobox can clear its query (→ initialPlate becomes ""), and a reset
  // keyed on those props would wipe the just-selected owner + typed plate.
  const wasOpen = useRef(false)
  useEffect(() => {
    const justOpened = open && !wasOpen.current
    wasOpen.current = open
    if (!justOpened) return
    setTimeout(() => {
      setOwner(fixedCustomer ?? null)
      setPlate((initialPlate || "").toUpperCase())
      setBrand("")
      setModel("")
      setModelYear("")
      setError("")
      setLoading(false)
    }, 0)
  }, [open, initialPlate, fixedCustomer])

  async function handleCreate(edit: boolean) {
    setError("")
    if (!owner) { setError("Önce müşteri seçin veya oluşturun"); return }
    if (!plate.trim() || !brand.trim() || !model.trim()) { setError("Plaka, marka ve model zorunludur"); return }
    setLoading(true)
    try {
      const vf = new FormData()
      vf.set("customerId", owner.id)
      vf.set("plate", plate)
      vf.set("brand", brand)
      vf.set("model", model)
      if (modelYear) vf.set("modelYear", modelYear)
      const vRes = await fetch("/api/vehicles", { method: "POST", body: vf })
      const vData = await vRes.json() as { success?: boolean; id?: string; error?: string }
      if (!vData?.success || !vData.id) { setError(vData?.error || "Araç oluşturulamadı"); setLoading(false); return }
      setLoading(false)
      if (edit) { window.location.href = `/vehicles/${vData.id}`; return }
      onCreated({ customerId: owner.id, vehicleId: vData.id, plate, brand, model, customerName: owner.label })
      onOpenChange(false)
    } catch {
      setError("Bir hata oluştu"); setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni araç</DialogTitle>
          <DialogDescription>Sahibini seç/oluştur ve aracı kaydet.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Müşteri (sahip) *</Label>
            {owner ? (
              <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                <span className="flex items-center gap-2 text-sm font-medium"><User className="size-4 text-primary" /> {owner.label}</span>
                {!fixedCustomer && (
                  <Button type="button" size="icon-sm" variant="ghost" onClick={() => setOwner(null)} aria-label="Müşteriyi değiştir"><X className="size-4" /></Button>
                )}
              </div>
            ) : (
              <CustomerSearchOrCreate onSelected={(id, label) => setOwner({ id, label })} />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
            <div className="space-y-1"><Label>Plaka *</Label><Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} /></div>
            <div className="space-y-1"><Label>Yıl</Label><Input value={modelYear} onChange={(e) => setModelYear(e.target.value)} inputMode="numeric" /></div>
            <div className="space-y-1"><Label>Marka *</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
            <div className="space-y-1"><Label>Model *</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleCreate(true)} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : "Oluştur ve Düzenle"}</Button>
            <Button type="button" onClick={() => handleCreate(false)} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : "Oluştur"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
