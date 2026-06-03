"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Loader2, Info, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { PlateBadge } from "@/components/app/plate-badge"

type CustomerOption = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string | null
  phone: string
}

type VehicleOption = {
  id: string
  customerId: string
  plate: string
  brand: string
  model: string
  mileage: number | null
}

type Props = {
  customers: CustomerOption[]
  vehicles: VehicleOption[]
  initial?: {
    customerId?: string
    vehicleId?: string
    title?: string
    type?: string
    dueDate?: string
    dueMileage?: string
    currentMileage?: string
    lastServiceDate?: string
    lastServiceMileage?: string
    reminderDaysBefore?: string
    reminderKmBefore?: string
    preferredChannel?: string
    customerNote?: string
    internalNote?: string
  }
  mode?: "create" | "edit"
  reminderId?: string
}

function customerLabel(c: CustomerOption): string {
  if (c.type === "corporate") return c.companyName || "Kurumsal"
  return c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone
}

export function ReminderCreateForm({ customers, vehicles, initial, mode = "create", reminderId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [customerId, setCustomerId] = useState(initial?.customerId || "")
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId || "")
  const [title, setTitle] = useState(initial?.title || "")
  const [type, setType] = useState(initial?.type || "other")
  const [dueDate, setDueDate] = useState(initial?.dueDate || "")
  const [dueMileage, setDueMileage] = useState(initial?.dueMileage || "")
  const [currentMileage, setCurrentMileage] = useState(initial?.currentMileage || "")
  const [lastServiceDate, setLastServiceDate] = useState(initial?.lastServiceDate || "")
  const [lastServiceMileage, setLastServiceMileage] = useState(initial?.lastServiceMileage || "")
  const [reminderDaysBefore, setReminderDaysBefore] = useState(initial?.reminderDaysBefore || "")
  const [reminderKmBefore, setReminderKmBefore] = useState(initial?.reminderKmBefore || "")
  const [preferredChannel, setPreferredChannel] = useState(initial?.preferredChannel || "none")
  const [customerNote, setCustomerNote] = useState(initial?.customerNote || "")
  const [internalNote, setInternalNote] = useState(initial?.internalNote || "")

  const customerVehicles = useMemo(() => {
    if (!customerId) return vehicles
    return vehicles.filter((v) => v.customerId === customerId)
  }, [customerId, vehicles])

  const selectedVehicle = useMemo(() => {
    return vehicles.find((v) => v.id === vehicleId)
  }, [vehicleId, vehicles])

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === customerId)
  }, [customerId, customers])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const form = new FormData(e.currentTarget)
      const action = mode === "edit" && reminderId
        ? await import("@/app/app/reminders/actions").then((m) => m.updateReminderAction)
        : await import("@/app/app/reminders/actions").then((m) => m.createReminderAction)

      if (mode === "edit" && reminderId) {
        form.set("id", reminderId)
      }

      await action(form)
      // success = redirect happens server-side
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="vehicleId" value={vehicleId} />
      {mode === "edit" && reminderId ? <input type="hidden" name="id" value={reminderId} /> : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Müşteri & Araç</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div>
                <Label htmlFor="customer-search">Müşteri</Label>
                <select
                  id="customer-search"
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value)
                    setVehicleId("")
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  required
                >
                  <option value="">Müşteri seçin...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {customerLabel(c)} ({c.phone})
                    </option>
                  ))}
                </select>
                <Link href="/app/customers/new" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1">
                  <Plus className="size-3" />
                  Yeni müşteri ekle
                </Link>
              </div>

              <div>
                <Label htmlFor="vehicle-search">Araç</Label>
                <select
                  id="vehicle-search"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  required
                >
                  <option value="">{customerId ? "Araç seçin..." : "Önce müşteri seçin"}</option>
                  {customerVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} - {v.brand} {v.model}
                    </option>
                  ))}
                </select>
                <Link href="/app/vehicles/new" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1">
                  <Plus className="size-3" />
                  Yeni araç ekle
                </Link>
              </div>

              {selectedVehicle ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <PlateBadge plate={selectedVehicle.plate} />
                    <span className="text-sm font-medium text-slate-700">{selectedVehicle.brand} {selectedVehicle.model}</span>
                  </div>
                  {selectedVehicle.mileage != null ? (
                    <p className="text-xs text-slate-500">Mevcut KM: {selectedVehicle.mileage.toLocaleString("tr-TR")} km</p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Hatırlatma Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div>
                <Label htmlFor="title">Başlık</Label>
                <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn: 15.000 km bakımı" required className="mt-1" />
              </div>

              <div>
                <Label htmlFor="type">Bakım Türü</Label>
                <Select value={type} onValueChange={(v) => v && setType(v)}>
                  <SelectTrigger id="type" name="type" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="periodic_maintenance">Periyodik Bakım</SelectItem>
                    <SelectItem value="oil_change">Yağ Bakımı</SelectItem>
                    <SelectItem value="inspection">Muayene</SelectItem>
                    <SelectItem value="tire_change">Lastik Değişimi</SelectItem>
                    <SelectItem value="brake_check">Fren Kontrolü</SelectItem>
                    <SelectItem value="battery_check">Akü Kontrolü</SelectItem>
                    <SelectItem value="insurance">Sigorta</SelectItem>
                    <SelectItem value="other">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dueDate">Planlanan Tarih</Label>
                  <Input id="dueDate" name="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="dueMileage">Planlanan KM</Label>
                  <Input id="dueMileage" name="dueMileage" type="number" min="1" value={dueMileage} onChange={(e) => setDueMileage(e.target.value)}                                 placeholder="Orn: 15000" className="mt-1" />
                </div>
              </div>
              <p className="text-xs text-slate-400">Planlanan tarih veya KM&apos;den en az biri zorunludur.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currentMileage">Mevcut KM</Label>
                  <Input id="currentMileage" name="currentMileage" type="number" min="0" value={currentMileage} onChange={(e) => setCurrentMileage(e.target.value)} placeholder="Örn: 12000" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="lastServiceDate">Son Bakım Tarihi</Label>
                  <Input id="lastServiceDate" name="lastServiceDate" type="date" value={lastServiceDate} onChange={(e) => setLastServiceDate(e.target.value)} className="mt-1" />
                </div>
              </div>

              <div>
                <Label htmlFor="lastServiceMileage">Son Bakım KM</Label>
                <Input id="lastServiceMileage" name="lastServiceMileage" type="number" min="0" value={lastServiceMileage} onChange={(e) => setLastServiceMileage(e.target.value)} placeholder="Örn: 10000" className="mt-1" />
              </div>

              <div>
                <Label htmlFor="customerNote">Müşteri Notu</Label>
                <Textarea id="customerNote" name="customerNote" value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} rows={2} className="mt-1" />
              </div>

              <div>
                <Label htmlFor="internalNote">İç Not</Label>
                <Textarea id="internalNote" name="internalNote" value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Hatırlatma Ayarları</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reminderDaysBefore">Kaç gün önce uyarı?</Label>
                  <Input id="reminderDaysBefore" name="reminderDaysBefore" type="number" min="0" max="365" value={reminderDaysBefore} onChange={(e) => setReminderDaysBefore(e.target.value)} placeholder="Örn: 7" className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="reminderKmBefore">Kaç km önce uyarı?</Label>
                  <Input id="reminderKmBefore" name="reminderKmBefore" type="number" min="0" max="50000" value={reminderKmBefore} onChange={(e) => setReminderKmBefore(e.target.value)} placeholder="Örn: 1000" className="mt-1" />
                </div>
              </div>

              <div>
                <Label htmlFor="preferredChannel">Tercih Edilen Kanal</Label>
                <Select value={preferredChannel} onValueChange={(v) => { if (v) setPreferredChannel(v) }}>
                  <SelectTrigger id="preferredChannel" name="preferredChannel" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Yok</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="phone">Telefon</SelectItem>
                    <SelectItem value="email">E-posta</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <Info className="size-3" />
                  Bu sürümde gerçek SMS/WhatsApp gönderimi yapılmaz. Hatırlatma kaydı ve takip altyapısı hazırlanır.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Özet</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Müşteri</p>
                <p className="font-medium text-slate-700">{selectedCustomer ? customerLabel(selectedCustomer) : "Seçilmedi"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Araç</p>
                <p className="font-medium text-slate-700">{selectedVehicle ? `${selectedVehicle.plate} - ${selectedVehicle.brand} ${selectedVehicle.model}` : "Seçilmedi"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Bakım Türü</p>
                <p className="font-medium text-slate-700">{typeLabel(type)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Kanal</p>
                <p className="font-medium text-slate-700">{channelLabel(preferredChannel)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <Info className="size-4 mt-0.5 shrink-0" />
                <p>Bu sürümde gerçek SMS/WhatsApp gönderimi yapılmaz. Hatırlatma kaydı ve takip altyapısı hazırlanır.</p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="sticky bottom-0 sm:bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 -mx-4 sm:-mx-6 sm:px-6 flex items-center justify-between gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:static lg:shadow-none lg:border-t lg:border-slate-200 lg:bg-transparent lg:p-0 lg:-mx-0">
        <Link
          href="/app/reminders"
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          İptal
        </Link>
        <Button type="submit" disabled={loading} className="gap-1.5 h-10">
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {mode === "edit" ? "Güncelle" : "Hatırlatma Kaydet"}
        </Button>
      </div>
    </form>
  )
}

function typeLabel(t: string): string {
  const labels: Record<string, string> = {
    periodic_maintenance: "Periyodik Bakım",
    oil_change: "Yağ Bakımı",
    inspection: "Muayene",
    tire_change: "Lastik Değişimi",
    brake_check: "Fren Kontrolü",
    battery_check: "Akü Kontrolü",
    insurance: "Sigorta",
    other: "Diğer",
  }
  return labels[t] || t
}

function channelLabel(c: string): string {
  const labels: Record<string, string> = {
    none: "Yok",
    sms: "SMS",
    whatsapp: "WhatsApp",
    phone: "Telefon",
    email: "E-posta",
  }
  return labels[c] || c
}
