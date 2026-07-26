"use client"

import { useState } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

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
  sms: "bg-success/10 text-success",
  whatsapp: "bg-success/10 text-success",
  email: "bg-primary/10 text-primary",
}

const STATUS_LABELS: Record<string, string> = {
  sent: "Gönderildi",
  failed: "Başarısız",
  pending: "Bekliyor",
}

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-success/10 text-success border-success/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-warning/10 text-warning border-warning/20",
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
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground font-medium">Gönderildi</p>
          <p className="text-2xl font-bold text-success">{stats.sent}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground font-medium">Başarısız</p>
          <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground font-medium">Bekliyor</p>
          <p className="text-2xl font-bold text-warning">{stats.pending}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <ToggleGroup value={[filter]} onValueChange={(v) => { if (v.length) setFilter(v[0] as "all" | "sms" | "whatsapp" | "email") }} variant="outline">
          {(["all", "sms", "whatsapp", "email"] as const).map((f) => (
            <ToggleGroupItem key={f} value={f} className="px-3 py-1.5 text-xs">
              {f === "all" ? "Tümü" : TYPE_LABELS[f] || f}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup value={[statusFilter]} onValueChange={(v) => { if (v.length) setStatusFilter(v[0] as "all" | "sent" | "failed" | "pending") }} variant="outline">
          {(["all", "sent", "failed", "pending"] as const).map((s) => (
            <ToggleGroupItem key={s} value={s} className="px-3 py-1.5 text-xs">
              {s === "all" ? "Tüm Durum" : STATUS_LABELS[s] || s}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">İletişim kaydı bulunamadı</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tür</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alıcı</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Şablon</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Durum</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sağlayıcı</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tarih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-muted">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${TYPE_COLORS[log.type] || "bg-muted text-muted-foreground"}`}>
                        {TYPE_LABELS[log.type] || log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{log.recipient}</td>
                    <td className="px-4 py-3 text-muted-foreground">{TEMPLATE_LABELS[log.templateKey || ""] || log.templateKey || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${STATUS_COLORS[log.status] || "bg-muted text-muted-foreground border-border"}`}>
                        {STATUS_LABELS[log.status] || log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{log.provider}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
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