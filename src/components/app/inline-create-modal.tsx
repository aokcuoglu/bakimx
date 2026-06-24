"use client"

import { useEffect, useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"

export type InlineCreateResult = { customerId: string; vehicleId: string }

export function InlineCreateModal({
  open,
  onOpenChange,
  initialPlate,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPlate?: string
  onCreated: (result: InlineCreateResult) => void
}) {
  const [type, setType] = useState<"individual" | "corporate">("individual")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [isVip, setIsVip] = useState(false)
  const [identityNumber, setIdentityNumber] = useState("")
  const [taxNumber, setTaxNumber] = useState("")
  const [plate, setPlate] = useState((initialPlate || "").toUpperCase())
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [modelYear, setModelYear] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Reset the form each time the modal opens so a reopen never shows stale data
  // (the picker keeps this modal mounted and toggles `open`, passing the live query as initialPlate).
  useEffect(() => {
    if (!open) return
    // Use a microtask to batch state updates and avoid cascading renders
    queueMicrotask(() => {
      setType("individual")
      setFirstName("")
      setLastName("")
      setCompanyName("")
      setPhone("")
      setEmail("")
      setIsVip(false)
      setIdentityNumber("")
      setTaxNumber("")
      setPlate((initialPlate || "").toUpperCase())
      setBrand("")
      setModel("")
      setModelYear("")
      setError("")
      setLoading(false)
    })
  }, [open, initialPlate])

  async function handleCreate(edit: boolean) {
    setError("")
    if (!phone.trim()) { setError("Telefon zorunludur"); return }
    if (type === "individual" && !firstName.trim()) { setError("Ad zorunludur"); return }
    if (type === "corporate" && !companyName.trim()) { setError("Şirket adı zorunludur"); return }
    if (!plate.trim() || !brand.trim() || !model.trim()) { setError("Plaka, marka ve model zorunludur"); return }

    setLoading(true)
    try {
      const cf = new FormData()
      cf.set("type", type)
      if (type === "individual") { cf.set("firstName", firstName); cf.set("lastName", lastName) }
      else { cf.set("companyName", companyName) }
      cf.set("phone", phone)
      if (email) cf.set("email", email)
      if (isVip) cf.set("tag", "vip")
      if (identityNumber) cf.set("identityNumber", identityNumber)
      if (taxNumber) cf.set("taxNumber", taxNumber)
      const cRes = await fetch("/api/customers", { method: "POST", body: cf })
      const cData = await cRes.json() as { success?: boolean; id?: string; error?: string }
      if (!cData?.success) { setError(cData?.error || "Müşteri oluşturulamadı"); setLoading(false); return }
      const customerId: string = cData.id!

      const vf = new FormData()
      vf.set("customerId", customerId)
      vf.set("plate", plate)
      vf.set("brand", brand)
      vf.set("model", model)
      if (modelYear) vf.set("modelYear", modelYear)
      const vRes = await fetch("/api/vehicles", { method: "POST", body: vf })
      const vData = await vRes.json() as { success?: boolean; id?: string; error?: string }
      if (!vData?.success) { setError(vData?.error || "Araç oluşturulamadı (müşteri oluşturuldu)"); setLoading(false); return }
      const vehicleId: string = vData.id!

      setLoading(false)
      if (edit) { window.location.href = `/vehicles/${vehicleId}`; return }
      onCreated({ customerId, vehicleId })
      onOpenChange(false)
    } catch {
      setError("Bir hata oluştu")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni müşteri & araç</DialogTitle>
          <DialogDescription>Kaydı oluşturup seçili hale getirin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" variant={type === "individual" ? "default" : "outline"} className="flex-1" onClick={() => setType("individual")}>Bireysel</Button>
            <Button type="button" variant={type === "corporate" ? "default" : "outline"} className="flex-1" onClick={() => setType("corporate")}>Kurumsal</Button>
          </div>

          {type === "individual" ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Ad *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div className="space-y-1"><Label>Soyad</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
          ) : (
            <div className="space-y-1"><Label>Şirket adı *</Label><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Telefon *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></div>
            <div className="space-y-1"><Label>E-posta</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>{type === "individual" ? "TC Kimlik No" : "Vergi No (VKN)"}</Label>
              <Input value={type === "individual" ? identityNumber : taxNumber} onChange={(e) => (type === "individual" ? setIdentityNumber : setTaxNumber)(e.target.value)} inputMode="numeric" /></div>
            <label className="flex items-center gap-2 pt-6 text-sm"><Checkbox checked={isVip} onCheckedChange={(v) => setIsVip(v === true)} /> VIP müşteri</label>
          </div>

          <div className="border-t border-border pt-3 grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Plaka *</Label><Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} /></div>
            <div className="space-y-1"><Label>Yıl</Label><Input value={modelYear} onChange={(e) => setModelYear(e.target.value)} inputMode="numeric" /></div>
            <div className="space-y-1"><Label>Marka *</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
            <div className="space-y-1"><Label>Model *</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleCreate(true)} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Oluştur ve Düzenle"}
            </Button>
            <Button type="button" onClick={() => handleCreate(false)} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Oluştur"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
