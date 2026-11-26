"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { TemplateChannel } from "@/lib/communications/templates"
import { NOTIFICATION_PROVIDER_LABELS } from "@/lib/provider-labels"
import {
  notificationTemplateFormSchema,
  type NotificationTemplateFormValues,
} from "@/lib/validations/notification-template"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

type TemplateData = {
  key: string
  label: string
  description: string
  channels: TemplateChannel[]
  savedTemplates: Record<TemplateChannel, { id: string; content: string }>
  defaults: Record<TemplateChannel, string>
}

type Providers = {
  sms: string
  email: string
}

const CHANNEL_LABELS: Record<TemplateChannel, string> = {
  sms: "SMS",
  email: "E-posta",
}

const CHANNEL_BADGE: Record<TemplateChannel, string> = {
  sms: "border-success/20 bg-success/10 text-success-strong",
  email: "border-primary/20 bg-primary/10 text-primary-strong",
}

const PROVIDER_LABELS = NOTIFICATION_PROVIDER_LABELS

const TEST_RECIPIENT_PLACEHOLDER: Record<TemplateChannel, string> = {
  sms: "5xx xxx xx xx",
  email: "ornek@eposta.com",
}

type TestResult = { type: "success" | "error"; text: string }

export function NotificationSettings({
  templates,
  providers,
}: {
  templates: TemplateData[]
  providers: Providers
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [editingChannel, setEditingChannel] = useState<TemplateChannel | null>(null)
  const router = useRouter()
  const [resettingKey, setResettingKey] = useState<string | null>(null)
  const [testRecipient, setTestRecipient] = useState<Record<TemplateChannel, string>>({ sms: "", email: "" })
  const [testResult, setTestResult] = useState<Partial<Record<TemplateChannel, TestResult>>>({})
  const [testingChannel, setTestingChannel] = useState<TemplateChannel | null>(null)

  async function handleTestSend(channel: TemplateChannel) {
    const recipient = testRecipient[channel].trim()
    if (!recipient) {
      setTestResult((prev) => ({ ...prev, [channel]: { type: "error", text: "Alıcı bilgisi girin" } }))
      return
    }
    setTestingChannel(channel)
    setTestResult((prev) => ({ ...prev, [channel]: undefined }))
    try {
      const formData = new FormData()
      formData.set("channel", channel)
      formData.set("recipient", recipient)
      const res = await fetch("/api/communications/test", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        const providerLabel = PROVIDER_LABELS[data.provider] || data.provider
        const text = data.provider === "mock"
          ? "Gönderim kapalı — mesaj iletilmedi, yalnızca iletişim kaydına yazıldı."
          : `Gönderildi — ${providerLabel}.`
        setTestResult((prev) => ({ ...prev, [channel]: { type: "success", text } }))
      } else {
        setTestResult((prev) => ({ ...prev, [channel]: { type: "error", text: data.error || "Gönderilemedi" } }))
      }
    } catch {
      setTestResult((prev) => ({ ...prev, [channel]: { type: "error", text: "Bağlantı hatası" } }))
    }
    setTestingChannel(null)
  }

  async function handleReset(templateKey: string, channel: TemplateChannel) {
    setResettingKey(`${templateKey}:${channel}`)
    try {
      const formData = new FormData()
      formData.set("templateKey", templateKey)
      formData.set("channel", channel)
      const res = await fetch("/api/communications/templates", { method: "DELETE", body: formData })
      const data = await res.json()
      if (data.success) {
        toast.success("Şablon varsayılana sıfırlandı")
        router.refresh()
      } else {
        toast.error(data.error || "Sıfırlanamadı")
      }
    } catch {
      toast.error("Bağlantı hatası")
    }
    setResettingKey(null)
  }

  function startEdit(templateKey: string, channel: TemplateChannel) {
    setEditingChannel(channel)
    setExpandedKey(templateKey)
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Aktif Sağlayıcılar</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["sms", "email"] as const).map((ch) => {
            const result = testResult[ch]
            const isTesting = testingChannel === ch
            return (
              <div key={ch} className="flex flex-col gap-2 p-3 rounded-md bg-muted border border-border">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={CHANNEL_BADGE[ch]}>
                    {CHANNEL_LABELS[ch]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {PROVIDER_LABELS[providers[ch]] || providers[ch]}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type={ch === "email" ? "email" : "tel"}
                    inputMode={ch === "email" ? "email" : "tel"}
                    value={testRecipient[ch]}
                    onChange={(e) => setTestRecipient((prev) => ({ ...prev, [ch]: e.target.value }))}
                    placeholder={TEST_RECIPIENT_PLACEHOLDER[ch]}
                    className="min-w-0 flex-1"
                    aria-label={`${CHANNEL_LABELS[ch]} test alıcısı`}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestSend(ch)}
                    disabled={isTesting}
                  >
                    {isTesting ? "..." : "Test"}
                  </Button>
                </div>
                {result && (
                  <p className={`text-xs ${result.type === "success" ? "text-success-strong" : "text-destructive-strong"}`}>
                    {result.text}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Sağlayıcılar ortam değişkenleri ile yapılandırılır. Sağlayıcı tanımlı değilse gönderim kapalıdır. Test butonu, ayarlı sağlayıcı üzerinden örnek mesaj gönderir.
        </p>
      </div>

      <Accordion
        type="single"
        collapsible
        variant="card"
        value={expandedKey ?? ""}
        onValueChange={(value) => {
          setExpandedKey(value || null)
          setEditingChannel(null)
        }}
      >
        {templates.map((template) => (
          <AccordionItem key={template.key} value={template.key}>
            <AccordionTrigger className="gap-3">
              <span className="block min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{template.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{template.description}</span>
              </span>
              <span className="flex gap-1">
                {template.channels.map((ch) => (
                  <Badge key={ch} variant="outline" className={CHANNEL_BADGE[ch]}>
                    {CHANNEL_LABELS[ch]}
                  </Badge>
                ))}
              </span>
            </AccordionTrigger>

            <AccordionContent>
              <div className="space-y-4">
                {template.channels.map((ch) => {
                  const savedContent = template.savedTemplates[ch]?.content
                  const defaultContent = template.defaults[ch]
                  const isEditing = editingChannel === ch && expandedKey === template.key

                  return (
                    <div key={ch} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={CHANNEL_BADGE[ch]}>
                          {CHANNEL_LABELS[ch]}
                        </Badge>
                        <div className="flex gap-2">
                          {savedContent && (
                            <Button
                              type="button"
                              onClick={() => handleReset(template.key, ch)}
                              disabled={isEditing || resettingKey === `${template.key}:${ch}`}
                              variant="ghost"
                              size="sm"
                            >
                              Varsayılana Sıfırla
                            </Button>
                          )}
                          {!isEditing && (
                            <Button
                              type="button"
                              onClick={() => startEdit(template.key, ch)}
                              variant="ghost"
                              size="sm"
                            >
                              Düzenle
                            </Button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <TemplateEditForm
                          templateKey={template.key}
                          channel={ch}
                          disabled={resettingKey === `${template.key}:${ch}`}
                          initialContent={savedContent || defaultContent}
                          onSaved={() => setEditingChannel(null)}
                          onCancel={() => setEditingChannel(null)}
                        />
                      ) : (
                        <div className="rounded-lg bg-muted border border-border px-3 py-2">
                          <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap line-clamp-3">
                            {savedContent || defaultContent}
                          </p>
                          {savedContent && (
                            <p className="text-xs font-medium text-primary-strong mt-1">Özel şablon</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

function TemplateEditForm({
  templateKey,
  channel,
  disabled,
  initialContent,
  onSaved,
  onCancel,
}: {
  templateKey: string
  channel: TemplateChannel
  disabled: boolean
  initialContent: string
  onSaved: () => void
  onCancel: () => void
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<NotificationTemplateFormValues>({
    resolver: zodResolver(notificationTemplateFormSchema),
    defaultValues: { content: initialContent },
  })

  async function onSubmit(values: NotificationTemplateFormValues) {
    setServerError(null)
    try {
      const formData = new FormData()
      formData.set("templateKey", templateKey)
      formData.set("channel", channel)
      formData.set("content", values.content)
      const res = await fetch("/api/communications/templates", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        toast.success("Şablon kaydedildi")
        onSaved()
        router.refresh()
      } else {
        setServerError(data.error || "Kaydedilemedi")
      }
    } catch {
      setServerError("Bağlantı hatası")
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Şablon metni</FormLabel>
              <FormControl>
                <Textarea
                  rows={channel === "email" ? 8 : 3}
                  className="font-mono"
                  {...field}
                  onChange={(e) => {
                    setServerError(null)
                    field.onChange(e)
                  }}
                />
              </FormControl>
              <FormDescription className="text-xs">
                Kullanılabilir değişkenler: {"{customerName}"}, {"{workshopName}"}, {"{vehiclePlate}"}, {"{appointmentDay}"}, {"{appointmentDate}"}, {"{appointmentTime}"},{"{approvalLink}"}, {"{portalLink}"}, {"{quoteNo}"}, {"{workOrderNo}"}, {"{totalAmount}"}, {"{maintenanceType}"}, {"{dueDate}"}, {"{customMessage}"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="foreground" size="sm" disabled={disabled || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Kaydediliyor..." : "Kaydet"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            İptal
          </Button>
        </div>
      </form>
    </Form>
  )
}
