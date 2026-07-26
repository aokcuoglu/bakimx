"use client"

import { useState } from "react"
import type { TemplateChannel } from "@/lib/communications/templates"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

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
  whatsapp: string
  email: string
}

const CHANNEL_LABELS: Record<TemplateChannel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "E-posta",
}

const CHANNEL_COLORS: Record<TemplateChannel, string> = {
  sms: "bg-success/10 text-foreground border-success/20",
  whatsapp: "bg-success/10 text-foreground border-success/20",
  email: "bg-primary/10 text-foreground border-primary/20",
}

const PROVIDER_LABELS: Record<string, string> = {
  mock: "Mock (Test)",
  netgsm: "Netgsm",
  business: "WhatsApp Business API",
  resend: "Resend",
  gmail: "Gmail",
}

const TEST_RECIPIENT_PLACEHOLDER: Record<TemplateChannel, string> = {
  sms: "5xx xxx xx xx",
  whatsapp: "5xx xxx xx xx",
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
  const [editContent, setEditContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [testRecipient, setTestRecipient] = useState<Record<TemplateChannel, string>>({ sms: "", whatsapp: "", email: "" })
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
          ? `Test modu (${providerLabel}) — gerçek gönderim yapılmadı.`
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

  async function handleSave(templateKey: string, channel: TemplateChannel) {
    setSaving(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.set("templateKey", templateKey)
      formData.set("channel", channel)
      formData.set("content", editContent)
      const res = await fetch("/api/communications/templates", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: "success", text: "Şablon kaydedildi" })
        setEditingChannel(null)
      } else {
        setMessage({ type: "error", text: data.error || "Kaydedilemedi" })
      }
    } catch {
      setMessage({ type: "error", text: "Bağlantı hatası" })
    }
    setSaving(false)
  }

  async function handleReset(templateKey: string, channel: TemplateChannel) {
    setSaving(true)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.set("templateKey", templateKey)
      formData.set("channel", channel)
      const res = await fetch("/api/communications/templates", { method: "DELETE", body: formData })
      const data = await res.json()
      if (data.success) {
        setMessage({ type: "success", text: "Şablon varsayılana sıfırlandı" })
      } else {
        setMessage({ type: "error", text: data.error || "Sıfırlanamadı" })
      }
    } catch {
      setMessage({ type: "error", text: "Bağlantı hatası" })
    }
    setSaving(false)
  }

  function startEdit(templateKey: string, channel: TemplateChannel) {
    const template = templates.find((t) => t.key === templateKey)
    const content = template?.savedTemplates[channel]?.content || template?.defaults[channel] || ""
    setEditingChannel(channel)
    setEditContent(content)
    setExpandedKey(templateKey)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Aktif Sağlayıcılar</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["sms", "whatsapp", "email"] as const).map((ch) => {
            const result = testResult[ch]
            const isTesting = testingChannel === ch
            return (
              <div key={ch} className="flex flex-col gap-2 p-3 rounded-lg bg-muted border border-border">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CHANNEL_COLORS[ch]}`}>
                    {CHANNEL_LABELS[ch]}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {PROVIDER_LABELS[providers[ch]] || providers[ch]}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type={ch === "email" ? "email" : "tel"}
                    inputMode={ch === "email" ? "email" : "tel"}
                    value={testRecipient[ch]}
                    onChange={(e) => setTestRecipient((prev) => ({ ...prev, [ch]: e.target.value }))}
                    placeholder={TEST_RECIPIENT_PLACEHOLDER[ch]}
                    className="min-w-0 flex-1 rounded-md border border-border bg-white px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
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
                  <p className={`text-xs ${result.type === "success" ? "text-success" : "text-destructive"}`}>
                    {result.text}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground/70 mt-2">
          Sağlayıcılar ortam değişkenleri ile yapılandırılır. Varsayılan: mock (test modu). Test butonu, ayarlı sağlayıcı üzerinden örnek mesaj gönderir.
        </p>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-2.5 text-sm ${message.type === "success" ? "bg-success/10 text-foreground border border-success/20" : "bg-destructive/10 text-foreground border border-destructive/20"}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {templates.map((template) => (
          <div key={template.key} className="bg-white rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedKey(expandedKey === template.key ? null : template.key)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted transition-colors"
            >
              <div className="text-left">
                <h3 className="text-sm font-semibold text-foreground">{template.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {template.channels.map((ch) => (
                    <span
                      key={ch}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${CHANNEL_COLORS[ch]}`}
                    >
                      {CHANNEL_LABELS[ch]}
                    </span>
                  ))}
                </div>
                <svg className={`size-4 text-muted-foreground/70 transition-transform ${expandedKey === template.key ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </button>

            {expandedKey === template.key && (
              <div className="border-t border-border px-5 py-4 space-y-4">
                {template.channels.map((ch) => {
                  const savedContent = template.savedTemplates[ch]?.content
                  const defaultContent = template.defaults[ch]
                  const isEditing = editingChannel === ch && expandedKey === template.key

                  return (
                    <div key={ch} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CHANNEL_COLORS[ch]}`}>
                          {CHANNEL_LABELS[ch]}
                        </span>
                        <div className="flex gap-2">
                          {savedContent && (
                            <button
                              type="button"
                              onClick={() => handleReset(template.key, ch)}
                              disabled={saving}
                              className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            >
                              Varsayılana Sıfırla
                            </button>
                          )}
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => startEdit(template.key, ch)}
                              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                            >
                              Düzenle
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={ch === "email" ? 8 : 3}
                            className="bg-muted font-mono border-border focus-visible:border-primary focus-visible:ring-primary/30"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => handleSave(template.key, ch)}
                              disabled={saving || !editContent.trim()}
                              size="sm"
                            >
                              {saving ? "Kaydediliyor..." : "Kaydet"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingChannel(null)}
                            >
                              İptal
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground/70">
                            Kullanılabilir değişkenler: {"{customerName}"}, {"{workshopName}"}, {"{vehiclePlate}"}, {"{appointmentDate}"}, {"{approvalLink}"}, {"{portalLink}"}, {"{quoteNo}"}, {"{workOrderNo}"}, {"{totalAmount}"}, {"{maintenanceType}"}, {"{dueDate}"}, {"{customMessage}"}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-muted border border-border px-3 py-2">
                          <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap line-clamp-3">
                            {savedContent || defaultContent}
                          </p>
                          {savedContent && (
                            <p className="text-[10px] text-primary mt-1 font-medium">Özel şablon</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}