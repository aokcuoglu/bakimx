"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Workshop = {
  id: string
  name: string
  phone: string
  city: string
  address: string
  logoUrl: string | null
  taxNumber: string | null
  invoiceTitle: string | null
}

export function WorkshopForm({ workshop }: { workshop: Workshop }) {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSuccess(false)
    setError("")

    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch("/api/workshop", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
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
      </CardHeader>
      <CardContent>
        <form id="workshop-form" onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          {success && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">Bilgiler güncellendi</div>}

          <div className="space-y-2">
            <Label htmlFor="name">İş Yeri Adı *</Label>
            <Input id="name" name="name" defaultValue={workshop.name} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefon *</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={workshop.phone} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Şehir *</Label>
            <Input id="city" name="city" defaultValue={workshop.city} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adres *</Label>
            <Input id="address" name="address" defaultValue={workshop.address} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input id="logoUrl" name="logoUrl" type="url" defaultValue={workshop.logoUrl || ""} placeholder="https://..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxNumber">Vergi Numarası</Label>
            <Input id="taxNumber" name="taxNumber" defaultValue={workshop.taxNumber || ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceTitle">Fatura Ünvanı</Label>
            <Input id="invoiceTitle" name="invoiceTitle" defaultValue={workshop.invoiceTitle || ""} />
          </div>

          <Button type="submit" form="workshop-form" className="w-full">
            Güncelle
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}