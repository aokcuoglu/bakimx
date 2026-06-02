"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, ScanLine, Loader2 } from "lucide-react"
import { VEHICLE_TYPES, VEHICLE_FUEL_TYPES, VEHICLE_TRANSMISSIONS } from "@/lib/constants"
import Link from "next/link"

type Customer = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string
  phone: string
}

type VehicleFormProps = {
  customers: Customer[]
  initial?: {
    id?: string
    customerId: string
    plate: string
    brand: string
    model: string
    vehicleType: string | null
    modelYear: number | null
    mileage: number | null
    vin: string | null
    vinConfirmed: boolean
    color: string | null
    engineNo: string | null
    fuelType: string | null
    transmission: string | null
    notes: string | null
  }
  mode?: "create" | "edit"
}

export function VehicleCreateForm({ customers, initial, mode = "create" }: VehicleFormProps) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(initial?.customerId || "")
  const [vinConfirmed, setVinConfirmed] = useState(initial?.vinConfirmed || false)

  const isEdit = mode === "edit" && initial?.id

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    if (!selectedCustomer) {
      setError("Müşteri seçimi zorunludur")
      return
    }
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set("customerId", selectedCustomer)

    try {
      const url = isEdit ? `/api/vehicles/${initial.id}` : "/api/vehicles"
      const method = isEdit ? "PUT" : "POST"
      const res = await fetch(url, { method, body: formData })
      const data = await res.json()
      if (data.success) {
        router.push(isEdit ? `/app/vehicles/${initial.id}` : "/app/vehicles")
        router.refresh()
      } else {
        setError(data.error || (isEdit ? "Güncelleme başarısız" : "Oluşturma başarısız"))
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (isEdit) {
      router.push(`/app/vehicles/${initial.id}`)
    } else {
      router.back()
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        <form id="vehicle-form" onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">Müşteri Bağlantısı</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
              )}
              <div className="space-y-2">
                <Label>Müşteri *</Label>
                <Select value={selectedCustomer} onValueChange={(v) => setSelectedCustomer(v || "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Müşteri seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.type === "corporate"
                          ? c.companyName || "Kurumsal Müşteri"
                          : c.fullName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Müşteri"} — {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-slate-500">
                <Link href="/app/customers/new" className="text-blue-600 hover:text-blue-700 font-medium">
                  + Yeni müşteri ekle
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-5">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">Araç Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plate">Plaka *</Label>
                <Input id="plate" name="plate" placeholder="34 ABC 123" required defaultValue={initial?.plate || ""} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="brand">Marka *</Label>
                  <Input id="brand" name="brand" placeholder="Toyota" required defaultValue={initial?.brand || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input id="model" name="model" placeholder="Corolla" required defaultValue={initial?.model || ""} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="vehicleType">Araç Tipi</Label>
                  <select
                    id="vehicleType"
                    name="vehicleType"
                    defaultValue={initial?.vehicleType || ""}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelYear">Model Yılı</Label>
                  <Input id="modelYear" name="modelYear" type="number" placeholder="2023" defaultValue={initial?.modelYear || ""} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="mileage">Kilometre</Label>
                  <Input id="mileage" name="mileage" type="number" placeholder="50000" defaultValue={initial?.mileage || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Renk</Label>
                  <Input id="color" name="color" placeholder="Beyaz, Siyah..." defaultValue={initial?.color || ""} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-5">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">Teknik Bilgiler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vin">Şase No (VIN)</Label>
                <Input id="vin" name="vin" placeholder="1HGBH41JXMN109186" defaultValue={initial?.vin || ""} />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="vinConfirmed"
                  checked={vinConfirmed}
                  onChange={(e) => setVinConfirmed(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                />
                <span className="text-sm text-slate-700">Şase numarası ruhsatla teyit edildi</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="engineNo">Motor No</Label>
                  <Input id="engineNo" name="engineNo" placeholder="Motor numarası" defaultValue={initial?.engineNo || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fuelType">Yakıt Tipi</Label>
                  <select
                    id="fuelType"
                    name="fuelType"
                    defaultValue={initial?.fuelType || ""}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
                  >
                    <option value="">Seçiniz</option>
                    {VEHICLE_FUEL_TYPES.map((ft) => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transmission">Şanzıman</Label>
                <select
                  id="transmission"
                  name="transmission"
                  defaultValue={initial?.transmission || ""}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
                >
                  <option value="">Seçiniz</option>
                  {VEHICLE_TRANSMISSIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                  <ScanLine className="size-4" />
                  <span className="font-medium">Ruhsattan Oku</span>
                </div>
                <p className="text-xs text-slate-400">
                  Ruhsattan şase okuma özelliği yakında.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-5">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">Notlar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="notes">Araç Notu</Label>
                <Textarea id="notes" name="notes" placeholder="Araçla ilgili ek notlar..." rows={3} defaultValue={initial?.notes || ""} />
              </div>
            </CardContent>
          </Card>
        </form>

        <div className="hidden sm:flex gap-3 pt-2">
          <Button type="submit" form="vehicle-form" disabled={loading} className="gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Aracı Güncelle" : "Araç Kaydet"}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel}>
            İptal
          </Button>
        </div>

        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-3 safe-area-bottom flex gap-2">
          <Button type="submit" form="vehicle-form" disabled={loading} className="flex-1 gap-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Güncelle" : "Kaydet"}
          </Button>
          <Button type="button" variant="outline" onClick={handleCancel} className="flex-1">
            İptal
          </Button>
        </div>
      </div>

      <aside className="hidden lg:block space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">İpuçları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="flex items-start gap-2">
              <Camera className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <span>Plaka ve marka bilgileri zorunludur.</span>
            </div>
            <div className="flex items-start gap-2">
              <ScanLine className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <span>Şase numarası (VIN) ruhsattan manuel girilebilir. OCR özelliği yakında.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="size-4 text-slate-400 mt-0.5 shrink-0 flex items-center justify-center text-xs font-bold">i</span>
              <span>Tüm alanlar sonradan düzenlenebilir.</span>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
