"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

type SettingsData = {
  smsProvider: string
  smsSenderName: string | null
  whatsappProvider: string
  whatsappPhoneNumber: string | null
  emailProvider: string
  emailFromAddress: string | null
  emailFromName: string | null
}

export function CommunicationSettingsForm({ settings }: { settings: SettingsData }) {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [smsProvider, setSmsProvider] = useState(settings.smsProvider)
  const [whatsappProvider, setWhatsappProvider] = useState(settings.whatsappProvider)
  const [emailProvider, setEmailProvider] = useState(settings.emailProvider)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSuccess(false)
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set("smsProvider", smsProvider)
    formData.set("whatsappProvider", whatsappProvider)
    formData.set("emailProvider", emailProvider)

    try {
      const res = await fetch("/api/settings/communication", {
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">İletişim ayarları güncellendi</div>}

      <Card>
        <CardHeader>
          <CardTitle>SMS Ayarları</CardTitle>
          <CardDescription>SMS sağlayıcısı ve gönderici bilgilerini yapılandırın</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smsProvider">SMS Sağlayıcı</Label>
              <Select value={smsProvider} onValueChange={(v) => setSmsProvider(v ?? "mock")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock (Test)</SelectItem>
                  <SelectItem value="netgsm">Netgsm</SelectItem>
                  <SelectItem value="iletimerkezi">İletimerkezi</SelectItem>
                  <SelectItem value="custom">Özel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smsSenderName">Gönderici Adı (Başlık)</Label>
              <Input id="smsSenderName" name="smsSenderName" defaultValue={settings.smsSenderName || ""} placeholder="BASLIGIMIZ" disabled={smsProvider === "mock"} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="smsApiKey">SMS API Anahtarı</Label>
              <Input id="smsApiKey" name="smsApiKey" type="password" placeholder="Yeni anahtar girin" disabled={smsProvider === "mock"} />
            </div>
          </div>

          {smsProvider === "mock" && (
            <div className="p-3 rounded-lg bg-blue-50 text-blue-800 text-xs">
              Mock sağlayıcı aktif. SMS&apos;ler gerçek gönderilmez, iletişim loglarına kaydedilir.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Ayarları</CardTitle>
          <CardDescription>WhatsApp Business API yapılandırması</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whatsappProvider">WhatsApp Sağlayıcı</Label>
              <Select value={whatsappProvider} onValueChange={(v) => setWhatsappProvider(v ?? "mock")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock (Test)</SelectItem>
                  <SelectItem value="business_api">WhatsApp Business API</SelectItem>
                  <SelectItem value="custom">Özel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappPhoneNumber">WhatsApp Telefon Numarası</Label>
              <Input id="whatsappPhoneNumber" name="whatsappPhoneNumber" defaultValue={settings.whatsappPhoneNumber || ""} placeholder="+905XXXXXXXXX" disabled={whatsappProvider === "mock"} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="whatsappApiKey">WhatsApp API Anahtarı</Label>
              <Input id="whatsappApiKey" name="whatsappApiKey" type="password" placeholder="Yeni anahtar girin" disabled={whatsappProvider === "mock"} />
            </div>
          </div>

          {whatsappProvider === "mock" && (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs">
              Mock sağlayıcı aktif. WhatsApp mesajları gerçek gönderilmez, iletişim loglarına kaydedilir.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>E-posta Ayarları</CardTitle>
          <CardDescription>E-posta gönderim sağlayıcısı yapılandırması</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emailProvider">E-posta Sağlayıcı</Label>
              <Select value={emailProvider} onValueChange={(v) => setEmailProvider(v ?? "mock")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock (Test)</SelectItem>
                  <SelectItem value="resend">Resend</SelectItem>
                  <SelectItem value="sendgrid">SendGrid</SelectItem>
                  <SelectItem value="custom">Özel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailFromName">Gönderici Adı</Label>
              <Input id="emailFromName" name="emailFromName" defaultValue={settings.emailFromName || ""} placeholder="İş Yeri Adı" disabled={emailProvider === "mock"} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailFromAddress">Gönderici E-posta</Label>
              <Input id="emailFromAddress" name="emailFromAddress" type="email" defaultValue={settings.emailFromAddress || ""} placeholder="info@isyeri.com" disabled={emailProvider === "mock"} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailApiKey">E-posta API Anahtarı</Label>
              <Input id="emailApiKey" name="emailApiKey" type="password" placeholder="Yeni anahtar girin" disabled={emailProvider === "mock"} />
            </div>
          </div>

          {emailProvider === "mock" && (
            <div className="p-3 rounded-lg bg-blue-50 text-blue-800 text-xs">
              Mock sağlayıcı aktif. E-postalar gerçek gönderilmez, iletişim loglarına kaydedilir.
            </div>
          )}
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Kaydediliyor..." : "İletişim Ayarlarını Kaydet"}
      </Button>
    </form>
  )
}