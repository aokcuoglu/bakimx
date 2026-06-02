"use client"

import { useState, useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createAppointmentAction } from "@/app/app/appointments/actions"
import { Loader2, Info, User, CalendarClock, Bell, Plus, Search } from "lucide-react"
import { customerDisplayName } from "@/lib/format"

type CustomerOption = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string
  phone: string
}

type VehicleOption = {
  id: string
  customerId: string
  plate: string
  brand: string
  model: string
}

type ActionState = {
  error: string | null
  success: boolean
  id?: string
  appointmentNo?: string
}

export function AppointmentCreateForm({
  customers,
  vehicles,
}: {
  customers: CustomerOption[]
  vehicles: VehicleOption[]
}) {
  const router = useRouter()
  async function wrappedAction(_prev: ActionState | null, formData: FormData): Promise<ActionState | null> {
    return createAppointmentAction(formData) as unknown as Promise<ActionState | null>
  }
  const [state, formAction, pending] = useActionState(wrappedAction, null)
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return true
    const q = customerSearch.toLowerCase()
    const name = customerDisplayName(c).toLowerCase()
    return name.includes(q) || c.phone.includes(q)
  })

  const customerVehicles = vehicles.filter((v) => v.customerId === selectedCustomerId)

  useEffect(() => {
    if (state?.success && state.id) {
      router.push(`/app/appointments/${state.id}`)
    }
  }, [state, router])

  return (
    <form action={formAction} className="space-y-5 sm:space-y-6">
      {state?.error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="size-4 text-slate-500" />
            Müşteri & Araç
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customerSearch">Müşteri Ara</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                id="customerSearch"
                type="search"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="İsim veya telefon ile ara..."
                className="pl-9"
              />
            </div>
            <select
              name="customerId"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value="">Müşteri Seçin</option>
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {customerDisplayName(c)} - {c.phone}
                </option>
              ))}
            </select>
            <div className="flex justify-end">
              <Link
                href="/app/customers/new"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="size-3" />
                Yeni Müşteri Ekle
              </Link>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicleId">Araç</Label>
            <select
              id="vehicleId"
              name="vehicleId"
              disabled={!selectedCustomerId}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Araç Seçin (Opsiyonel)</option>
              {customerVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} - {v.brand} {v.model}
                </option>
              ))}
            </select>
            <div className="flex justify-end">
              <Link
                href={selectedCustomerId ? `/app/vehicles/new?customerId=${selectedCustomerId}` : "/app/vehicles/new"}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="size-3" />
                Yeni Araç Ekle
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="size-4 text-slate-500" />
            Randevu Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointmentAt">Randevu Tarihi *</Label>
              <Input id="appointmentAt" name="appointmentAt" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentTime">Randevu Saati *</Label>
              <Input id="appointmentTime" name="appointmentTime" type="time" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimatedDurationMinutes">Tahmini Süre</Label>
            <select
              id="estimatedDurationMinutes"
              name="estimatedDurationMinutes"
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value="">Seçiniz</option>
              <option value="15">15 dk</option>
              <option value="30">30 dk</option>
              <option value="45">45 dk</option>
              <option value="60">1 saat</option>
              <option value="90">1.5 saat</option>
              <option value="120">2 saat</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Başlık</Label>
            <Input id="title" name="title" placeholder="Örn: Periyodik Bakım" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerRequest">Müşteri Talebi</Label>
            <Textarea
              id="customerRequest"
              name="customerRequest"
              placeholder="Müşterinin randevu talebini açıklayın..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="internalNote">İç Not</Label>
            <Textarea
              id="internalNote"
              name="internalNote"
              placeholder="Teknisyen için özel not..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="size-4 text-slate-500" />
            Hatırlatma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="reminderEnabled"
              value="true"
              className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
            />
            <span className="text-sm text-slate-700 font-medium">Randevu hatırlatması planla</span>
          </label>
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
            <Info className="size-4 shrink-0 mt-0.5" />
            <span>Hatırlatma entegrasyonu yakında. Bu sürümde gerçek SMS/WhatsApp gönderimi yapılmaz.</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button type="submit" disabled={pending} className="flex-1 h-11">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}
          {pending ? "Kaydediliyor..." : "Randevu Kaydet"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} className="h-11">
          İptal
        </Button>
      </div>
    </form>
  )
}
