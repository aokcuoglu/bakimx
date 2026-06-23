"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import {
  communicationSettingsFormSchema,
  normalizeSmsProvider,
  normalizeWhatsAppProvider,
  normalizeEmailProvider,
  type CommunicationSettingsFormValues,
} from "@/lib/validations/settings"

type SettingsData = {
  smsProvider: string
  smsSenderName: string | null
  whatsappProvider: string
  whatsappPhoneNumber: string | null
  emailProvider: string
  emailFromAddress: string | null
  emailFromName: string | null
}

function toDefaults(settings: SettingsData): CommunicationSettingsFormValues {
  // Normalize legacy DB provider values (iletimerkezi/sendgrid/custom) to
  // "mock" so the form never initializes with a value that no longer has a
  // matching Select option — that would lock the user out of saving.
  return {
    smsProvider: normalizeSmsProvider(settings.smsProvider),
    smsSenderName: settings.smsSenderName || "",
    smsApiKey: "",
    whatsappProvider: normalizeWhatsAppProvider(settings.whatsappProvider),
    whatsappPhoneNumber: settings.whatsappPhoneNumber || "",
    whatsappApiKey: "",
    emailProvider: normalizeEmailProvider(settings.emailProvider),
    emailFromName: settings.emailFromName || "",
    emailFromAddress: settings.emailFromAddress || "",
    emailApiKey: "",
  }
}

export function CommunicationSettingsForm({ settings }: { settings: SettingsData }) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const form = useForm<CommunicationSettingsFormValues, unknown, CommunicationSettingsFormValues>({
    resolver: typedResolver(communicationSettingsFormSchema),
    defaultValues: toDefaults(settings),
  })

  const smsProvider = form.watch("smsProvider")
  const whatsappProvider = form.watch("whatsappProvider")
  const emailProvider = form.watch("emailProvider")

  async function onSubmit(values: CommunicationSettingsFormValues) {
    setError("")
    setLoading(true)

    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) {
      formData.set(key, String(value ?? ""))
    }

    try {
      const res = await fetch("/api/settings/communication", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        toast.success("İletişim ayarları güncellendi")
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>SMS Ayarları</CardTitle>
            <CardDescription>SMS sağlayıcısı ve gönderici bilgilerini yapılandırın</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="smsProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMS Sağlayıcı</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "mock")}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mock">Mock (Test)</SelectItem>
                          <SelectItem value="netgsm">Netgsm</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="smsSenderName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gönderici Adı (Başlık)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="BASLIGIMIZ" disabled={smsProvider === "mock"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="smsApiKey"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>SMS API Anahtarı</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Yeni anahtar girin" disabled={smsProvider === "mock"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {smsProvider === "mock" && (
              <Alert>
                <AlertDescription>
                  Mock sağlayıcı aktif. SMS&apos;ler gerçek gönderilmez, iletişim loglarına kaydedilir.
                </AlertDescription>
              </Alert>
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
              <FormField
                control={form.control}
                name="whatsappProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Sağlayıcı</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "mock")}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mock">Mock (Test)</SelectItem>
                          <SelectItem value="business_api">WhatsApp Business API</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsappPhoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp Telefon Numarası</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+905XXXXXXXXX" disabled={whatsappProvider === "mock"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsappApiKey"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>WhatsApp API Anahtarı</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Yeni anahtar girin" disabled={whatsappProvider === "mock"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {whatsappProvider === "mock" && (
              <Alert>
                <AlertDescription>
                  Mock sağlayıcı aktif. WhatsApp mesajları gerçek gönderilmez, iletişim loglarına kaydedilir.
                </AlertDescription>
              </Alert>
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
              <FormField
                control={form.control}
                name="emailProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-posta Sağlayıcı</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "mock")}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mock">Mock (Test)</SelectItem>
                          <SelectItem value="resend">Resend</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailFromName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gönderici Adı</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="İş Yeri Adı" disabled={emailProvider === "mock"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailFromAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gönderici E-posta</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="info@isyeri.com" disabled={emailProvider === "mock"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-posta API Anahtarı</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Yeni anahtar girin" disabled={emailProvider === "mock"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {emailProvider === "mock" && (
              <Alert>
                <AlertDescription>
                  Mock sağlayıcı aktif. E-postalar gerçek gönderilmez, iletişim loglarına kaydedilir.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
          {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
          İletişim Ayarlarını Kaydet
        </Button>
      </form>
    </Form>
  )
}