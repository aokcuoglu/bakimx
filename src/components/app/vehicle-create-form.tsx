"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Customer = {
  id: string
  firstName: string
  lastName: string
  phone: string
}

export function VehicleCreateForm({ customers }: { customers: Customer[] }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    if (!selectedCustomer) {
      setError("Müşteri seçimi gerekli")
      return
    }
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set("customerId", selectedCustomer)

    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        router.push("/app/vehicles")
        router.refresh()
      } else {
        setError(data.error || "Oluşturma başarısız")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Araç Bilgileri</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="vehicle-form" onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

          <div className="space-y-2">
            <Label>Müşteri *</Label>
            <Select value={selectedCustomer} onValueChange={(v) => setSelectedCustomer(v || "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Müşteri seçin" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} - {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plate">Plaka *</Label>
            <Input id="plate" name="plate" placeholder="34 ABC 123" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="brand">Marka *</Label>
              <Input id="brand" name="brand" placeholder="Toyota" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model *</Label>
              <Input id="model" name="model" placeholder="Corolla" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="modelYear">Model Yılı</Label>
              <Input id="modelYear" name="modelYear" type="number" placeholder="2023" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mileage">Kilometre</Label>
              <Input id="mileage" name="mileage" type="number" placeholder="50000" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicleType">Araç Tipi</Label>
            <Input id="vehicleType" name="vehicleType" placeholder="Sedan, SUV, Hatchback..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vin">VIN / Şasi No</Label>
            <Input id="vin" name="vin" placeholder="1HGBH41JXMN109186" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" form="vehicle-form" disabled={loading}>
              {loading ? "Oluşturuluyor..." : "Araç Oluştur"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              İptal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}