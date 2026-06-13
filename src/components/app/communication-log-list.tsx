"use client"

import { useState } from "react"

type LogEntry = {
  id: string
  type: string
  provider: string
  recipient: string
  status: string
  templateKey: string | null
  entityType: string | null
  entityId: string | null
  providerId: string | null
  errorMessage: string | null
  sentAt: string
  createdAt: string
}

type Stats = {
  sent: number
  failed: number
  pending: number
  byType: Record<string, number>
}

const TYPE_LABELS: Record<string, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "E-posta",
}

const TYPE_COLORS: Record<string, string> = {
  sms: "bg-green-100 text-green-800",
  whatsapp: "bg-emerald-100 text-emerald-800",
  email: "bg-blue-100 text-blue-800",
}

const STATUS_LABELS: Record<string, string> = {
  sent: "Gönderildi",
  failed: "Başarısız",
  pending: "Bekliyor",
}

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
}

const TEMPLATE_LABELS: Record<string, string> = {
  appointment_created: "Randevu Oluşturuldu",
  appointment_reminder: "Randevu Hatırlatması",
  intake_approval: "Araç Kabul Onayı",
  quote_ready: "Teklif Hazır",
  work_order_completed: "İş Emri Tamamlandı",
  maintenance_reminder: "Bakım Hatırlatması",
  payment_reminder: "Ödeme Hatırlatması",
  vehicle_passport_share: "Araç Pasaportu Paylaşım",
}

export function CommunicationLogList({ logs, stats }: { logs: LogEntry[]; stats: Stats }) {
  const [filter, setFilter] = useState<"all" | "sms" | "whatsapp" | "email">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "failed" | "pending">("all")

  const filtered = logs.filter((log) => {
    if (filter !== "all" && log.type !== filter) return false
    if (statusFilter !== "all" && log.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Gönderildi</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.sent}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Başarısız</p>
          <p className="text-2xl font-bold text-rose-600">{stats.failed}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">Bekliyor</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {(["all", "sms", "whatsapp", "email"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f === "all" ? "Tümü" : TYPE_LABELS[f] || f}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["all", "sent", "failed", "pending"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === s ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {s === "all" ? "Tüm Durum" : STATUS_LABELS[s] || s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">İletişim kaydı bulunamadı</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tür</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Alıcı</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Şablon</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sağlayıcı</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${TYPE_COLORS[log.type] || "bg-slate-100 text-slate-600"}`}>
                        {TYPE_LABELS[log.type] || log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-900">{log.recipient}</td>
                    <td className="px-4 py-3 text-slate-600">{TEMPLATE_LABELS[log.templateKey || ""] || log.templateKey || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${STATUS_COLORS[log.status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                        {STATUS_LABELS[log.status] || log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{log.provider}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(log.sentAt).toLocaleString("tr-TR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}