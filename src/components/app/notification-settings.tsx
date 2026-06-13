"use client"

import { useState } from "react"
import type { TemplateChannel } from "@/lib/communications/templates"

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
  sms: "bg-green-50 text-green-700 border-green-200",
  whatsapp: "bg-emerald-50 text-emerald-700 border-emerald-200",
  email: "bg-blue-50 text-blue-700 border-blue-200",
}

const PROVIDER_LABELS: Record<string, string> = {
  mock: "Mock (Test)",
  netgsm: "Netgsm",
  business: "WhatsApp Business API",
  resend: "Resend",
}

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
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Aktif Sağlayıcılar</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["sms", "whatsapp", "email"] as const).map((ch) => (
            <div key={ch} className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CHANNEL_COLORS[ch as TemplateChannel]}`}>
                {CHANNEL_LABELS[ch as TemplateChannel]}
              </span>
              <span className="text-sm text-slate-600">
                {PROVIDER_LABELS[providers[ch]] || providers[ch]}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Sağlayıcılar ortam değişkenleri ile yapılandırılır. Varsayılan: mock (test modu)
        </p>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-2.5 text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {templates.map((template) => (
          <div key={template.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedKey(expandedKey === template.key ? null : template.key)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="text-left">
                <h3 className="text-sm font-semibold text-slate-900">{template.label}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{template.description}</p>
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
                <svg className={`size-4 text-slate-400 transition-transform ${expandedKey === template.key ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </button>

            {expandedKey === template.key && (
              <div className="border-t border-slate-100 px-5 py-4 space-y-4">
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
                              className="text-xs text-slate-500 hover:text-rose-600 transition-colors disabled:opacity-50"
                            >
                              Varsayılana Sıfırla
                            </button>
                          )}
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => startEdit(template.key, ch)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                            >
                              Düzenle
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={ch === "email" ? 8 : 3}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSave(template.key, ch)}
                              disabled={saving || !editContent.trim()}
                              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {saving ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingChannel(null)}
                              className="px-3 py-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              İptal
                            </button>
                          </div>
                          <p className="text-xs text-slate-400">
                            Kullanılabilir değişkenler: {"{customerName}"}, {"{workshopName}"}, {"{vehiclePlate}"}, {"{appointmentDate}"}, {"{approvalLink}"}, {"{portalLink}"}, {"{quoteNo}"}, {"{workOrderNo}"}, {"{totalAmount}"}, {"{maintenanceType}"}, {"{dueDate}"}, {"{customMessage}"}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                          <p className="text-xs text-slate-600 font-mono whitespace-pre-wrap line-clamp-3">
                            {savedContent || defaultContent}
                          </p>
                          {savedContent && (
                            <p className="text-[10px] text-blue-600 mt-1 font-medium">Özel şablon</p>
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