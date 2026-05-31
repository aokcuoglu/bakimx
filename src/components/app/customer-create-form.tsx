"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function CustomerCreateForm() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        router.push("/app/customers")
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
        <CardTitle>Müşteri Bilgileri</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Ad *</Label>
              <Input id="firstName" name="firstName" placeholder="Ahmet" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Soyad *</Label>
              <Input id="lastName" name="lastName" placeholder="Yılmaz" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon *</Label>
            <Input id="phone" name="phone" type="tel" placeholder="0555 123 4567" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" name="email" type="email" placeholder="ornek@email.com" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" form="customer-form" disabled={loading}>
              {loading ? "Oluşturuluyor..." : "Müşteri Oluştur"}
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