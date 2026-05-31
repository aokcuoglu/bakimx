"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        router.push("/app")
      } else {
        setError(data.error || "Kayıt başarısız")
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
        <CardTitle className="text-2xl">Kayıt Ol</CardTitle>
        <CardDescription>Yeni bir BakimX hesabı oluşturun</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="register-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Ad</Label>
              <Input id="firstName" name="firstName" placeholder="Ahmet" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Soyad</Label>
              <Input id="lastName" name="lastName" placeholder="Yılmaz" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input id="email" name="email" type="email" placeholder="ornek@email.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input id="password" name="password" type="password" placeholder="••••••" minLength={6} required />
          </div>
          <Separator />
          <p className="text-sm font-medium text-foreground">İş Yeri Bilgileri</p>
          <div className="space-y-2">
            <Label htmlFor="workshopName">İş yeri adı</Label>
            <Input id="workshopName" name="workshopName" placeholder="Yılmaz Oto Servis" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" name="phone" type="tel" placeholder="0555 123 4567" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Şehir</Label>
            <Input id="city" name="city" placeholder="İstanbul" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Adres</Label>
            <Input id="address" name="address" placeholder="Sanayi Mah. 123. Sk. No:5" required />
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-3">
        <Button type="submit" form="register-form" className="w-full" disabled={loading}>
          {loading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Giriş yapın
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}