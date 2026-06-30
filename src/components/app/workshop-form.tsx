"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { formatPhoneTR } from "@/lib/format"

type Workshop = {
  id: string
  name: string
  phone: string
  city: string
  district: string | null
  address: string
  email: string | null
  website: string | null
  logoUrl: string | null
  taxNumber: string | null
  taxOffice: string | null
  invoiceTitle: string | null
}

export function WorkshopForm({ workshop }: { workshop: Workshop }) {
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch("/api/workshop", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Bilgiler güncellendi")
      } else {
        setError(data.error || "Güncelleme başarısız")
      }
    } catch {
      setError("Bir hata oluştu")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>İş Yeri Bilgileri</CardTitle>
        <CardDescription>İş yeri temel bilgilerinizi güncelleyin</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="workshop-form" onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">İş Yeri Adı *</Label>
              <Input id="name" name="name" defaultValue={workshop.name} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefon *</Label>
              <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={formatPhoneTR(workshop.phone)} required onChange={(e) => { e.target.value = formatPhoneTR(e.target.value) }} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" name="email" type="email" defaultValue={workshop.email || ""} placeholder="info@isyeri.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Şehir *</Label>
              <Input id="city" name="city" defaultValue={workshop.city} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="district">İlçe</Label>
              <Input id="district" name="district" defaultValue={workshop.district || ""} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Adres *</Label>
              <Input id="address" name="address" defaultValue={workshop.address} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Web Sitesi</Label>
              <Input id="website" name="website" type="url" defaultValue={workshop.website || ""} placeholder="https://..." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input id="logoUrl" name="logoUrl" type="url" defaultValue={workshop.logoUrl || ""} placeholder="https://..." />
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Vergi Bilgileri</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxOffice">Vergi Dairesi</Label>
                <Input id="taxOffice" name="taxOffice" defaultValue={workshop.taxOffice || ""} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxNumber">Vergi Numarası</Label>
                <Input id="taxNumber" name="taxNumber" defaultValue={workshop.taxNumber || ""} />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="invoiceTitle">Fatura Ünvanı</Label>
                <Input id="invoiceTitle" name="invoiceTitle" defaultValue={workshop.invoiceTitle || ""} />
              </div>
            </div>
          </div>

          <Button type="submit" form="workshop-form" className="w-full">
            Güncelle
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}