"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupplierAction, updateSupplierAction } from "@/app/app/suppliers/actions"
import { ArrowLeft, Loader2, Save, Truck, MapPin, Settings2, FileText } from "lucide-react"

type SupplierData = {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  phone2: string | null
  email: string | null
  website: string | null
  city: string | null
  address: string | null
  taxNumber: string | null
  taxOffice: string | null
  category: string | null
  paymentTermDays: number | null
  averageDeliveryDays: number | null
  performanceNote: string | null
  internalNote: string | null
  isActive: boolean
}

type ActionState = {
  error?: string
  success?: boolean
  id?: string
}

export function SupplierForm({ supplier }: { supplier?: SupplierData }) {
  const router = useRouter()
  const isEdit = !!supplier

  const action = async (_prev: ActionState | null, formData: FormData): Promise<ActionState | null> => {
    if (isEdit && supplier) {
      return updateSupplierAction(supplier.id, formData) as unknown as Promise<ActionState | null>
    }
    return createSupplierAction(formData) as unknown as Promise<ActionState | null>
  }

  const [state, formAction, pending] = useActionState(action, null as ActionState | null)

  useEffect(() => {
    if (state?.success && state.id) {
      router.push(`/app/suppliers/${state.id}`)
    }
  }, [state, router])

  return (
    <form action={formAction}>
      {state?.error && (
        <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">{state.error}</div>
      )}

      <div className="flex items-center gap-3 mb-5">
        <Link href={isEdit ? `/app/suppliers/${supplier?.id}` : "/app/suppliers"} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="size-4" />
        </Link>
        <h2 className="text-lg font-bold text-slate-900">{isEdit ? "Tedarikçi Düzenle" : "Yeni Tedarikçi"}</h2>
      </div>

      <div className="space-y-5 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Truck className="size-4 text-slate-500" />
              Tedarikçi Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="name">Tedarikçi Adı *</Label>
              <Input id="name" name="name" defaultValue={supplier?.name || ""} placeholder="Firma adı..." required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Yetkili Kişi</Label>
                <Input id="contactPerson" name="contactPerson" defaultValue={supplier?.contactPerson || ""} placeholder="Ad Soyad" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Kategori</Label>
                <Input id="category" name="category" defaultValue={supplier?.category || ""} placeholder="Yedek parça, yağ, lastik..." />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" name="phone" defaultValue={supplier?.phone || ""} placeholder="05XX XXX XX XX" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone2">Telefon 2</Label>
                <Input id="phone2" name="phone2" defaultValue={supplier?.phone2 || ""} placeholder="Opsiyonel" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input id="email" name="email" type="email" defaultValue={supplier?.email || ""} placeholder="info@firma.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Web Sitesi</Label>
                <Input id="website" name="website" defaultValue={supplier?.website || ""} placeholder="https://..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="isActive">Durum</Label>
              <select
                id="isActive"
                name="isActive"
                defaultValue={supplier?.isActive !== false ? "true" : "false"}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="size-4 text-slate-500" />
              Adres & Vergi Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">İl</Label>
                <Input id="city" name="city" defaultValue={supplier?.city || ""} placeholder="İstanbul, Ankara..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adres</Label>
                <Input id="address" name="address" defaultValue={supplier?.address || ""} placeholder="Açık adres..." />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="taxNumber">Vergi No</Label>
                <Input id="taxNumber" name="taxNumber" defaultValue={supplier?.taxNumber || ""} placeholder="TCKN / VKN" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxOffice">Vergi Dairesi</Label>
                <Input id="taxOffice" name="taxOffice" defaultValue={supplier?.taxOffice || ""} placeholder="Vergi dairesi adı" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Settings2 className="size-4 text-slate-500" />
              Operasyon Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="averageDeliveryDays">Ortalama Teslimat Süresi (gün)</Label>
                <Input id="averageDeliveryDays" name="averageDeliveryDays" type="number" min="0" defaultValue={supplier?.averageDeliveryDays ?? ""} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTermDays">Ödeme Vadesi (gün)</Label>
                <Input id="paymentTermDays" name="paymentTermDays" type="number" min="0" defaultValue={supplier?.paymentTermDays ?? ""} placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="performanceNote">Performans Notu</Label>
              <Textarea id="performanceNote" name="performanceNote" defaultValue={supplier?.performanceNote || ""} rows={2} placeholder="Tedarikçi performans değerlendirmesi..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="size-4 text-slate-500" />
              Notlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="internalNote">Dahili Not</Label>
              <Textarea id="internalNote" name="internalNote" defaultValue={supplier?.internalNote || ""} rows={3} placeholder="İç notlar..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pb-24 lg:pb-0">
          <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">
            {pending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
            {isEdit ? "Güncelle" : "Tedarikçi Oluştur"}
          </Button>
          <Link href={isEdit ? `/app/suppliers/${supplier?.id}` : "/app/suppliers"}>
            <Button type="button" variant="outline">
              İptal
            </Button>
          </Link>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-3 safe-area-bottom flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {isEdit ? "Güncelle" : "Tedarikçi Oluştur"}
        </Button>
        <Link href={isEdit ? `/app/suppliers/${supplier?.id}` : "/app/suppliers"} className="flex-1">
          <Button type="button" variant="outline" className="w-full">
            İptal
          </Button>
        </Link>
      </div>
    </form>
  )
}