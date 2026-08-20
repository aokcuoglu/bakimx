"use client"

import { useState } from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { communicationTemplateLabel } from "@/lib/communications/template-labels"
import {
  COMMUNICATION_STATUSES,
  communicationStatusLabel,
  type CommunicationStatus,
} from "@/lib/communications/status-labels"

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
  skipped: number
  byType: Record<string, number>
}

/** Sayaç kartları ve filtre çubuğu aynı diziden beslenir — biri güncellenip
 *  diğeri unutulamıyor (issue #246). */
const STATUSES = COMMUNICATION_STATUSES
type StatusKey = CommunicationStatus

const TYPE_LABELS: Record<string, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "E-posta",
}

const TYPE_COLORS: Record<string, string> = {
  sms: "bg-success/10 text-success-strong",
  whatsapp: "bg-success/10 text-success-strong",
  email: "bg-primary/10 text-primary-strong",
}

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-success/10 text-success-strong border-success/20",
  failed: "bg-destructive/10 text-destructive-strong border-destructive/20",
  pending: "bg-warning/10 text-warning-strong border-warning/20",
  skipped: "bg-muted text-muted-foreground border-border",
}

/** Sayaç kartlarının vurgu rengi — nötr "gönderilmedi" alarma benzemesin. */
const STAT_COLORS: Record<StatusKey, string> = {
  sent: "text-success-strong",
  failed: "text-destructive-strong",
  pending: "text-warning-strong",
  skipped: "text-muted-foreground",
}

export function CommunicationLogList({ logs, stats }: { logs: LogEntry[]; stats: Stats }) {
  const [filter, setFilter] = useState<"all" | "sms" | "whatsapp" | "email">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all")

  const filtered = logs.filter((log) => {
    if (filter !== "all" && log.type !== filter) return false
    if (statusFilter !== "all" && log.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map((s) => (
          <div key={s} className="bg-card rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground font-medium">{communicationStatusLabel(s)}</p>
            <p className={`text-2xl font-bold ${STAT_COLORS[s]}`}>{stats[s]}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {/* flex-wrap şart: ToggleGroup varsayılanda `w-fit flex-row` ve içeride
            sarmıyor — beşinci durum butonu eklenince 390px ekranda grup 456px'e
            çıkıp taşıyordu (buton erişilemez hâle geliyordu). */}
        <ToggleGroup type="single" className="flex-wrap" value={filter} onValueChange={(v) => { if (v) setFilter(v as "all" | "sms" | "whatsapp" | "email") }} variant="outline">
          {(["all", "sms", "whatsapp", "email"] as const).map((f) => (
            <ToggleGroupItem key={f} value={f} className="px-3 py-1.5 text-xs">
              {f === "all" ? "Tümü" : TYPE_LABELS[f] || f}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup type="single" className="flex-wrap" value={statusFilter} onValueChange={(v) => { if (v) setStatusFilter(v as "all" | StatusKey) }} variant="outline">
          {(["all", ...STATUSES] as const).map((s) => (
            <ToggleGroupItem key={s} value={s} className="px-3 py-1.5 text-xs">
              {s === "all" ? "Tüm Durum" : communicationStatusLabel(s)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">İletişim kaydı bulunamadı</p>
        </div>
      ) : (
        <>
        <div className="hidden md:block bg-card rounded-lg border border-border overflow-hidden">
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
                    <td className="px-4 py-3 text-muted-foreground">{communicationTemplateLabel(log.templateKey)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${STATUS_COLORS[log.status] || "bg-muted text-muted-foreground border-border"}`}>
                        {communicationStatusLabel(log.status)}
                      </span>
                      {/* "Gönderilmedi"/"Başarısız" tek başına sebebi söylemiyor;
                          kayıttaki açıklama ("Müşteri SMS onayı vermemiş") burada. */}
                      {log.errorMessage && (
                        <p className="text-[11px] text-muted-foreground mt-1">{log.errorMessage}</p>
                      )}
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

        {/* Mobil: altı kolonluk tablo dar ekrana sığmıyordu, kullanıcı her satır
            için yatay kaydırmak zorunda kalıyordu. Diğer liste ekranlarındaki
            (reminder-list, parts-list) `md:hidden` kart deseni (issue #247). */}
        <div className="md:hidden space-y-3">
          {filtered.map((log) => (
            <div key={log.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${TYPE_COLORS[log.type] || "bg-muted text-muted-foreground"}`}>
                    {TYPE_LABELS[log.type] || log.type}
                  </span>
                  <h3 className="text-sm font-semibold text-foreground mt-1.5">
                    {communicationTemplateLabel(log.templateKey)}
                  </h3>
                  {/* Alıcı boş olabilir (müşterinin e-postası yoksa) — boş satır bırakma. */}
                  {log.recipient && (
                    <p className="text-sm text-foreground/80 mt-0.5 break-all">{log.recipient}</p>
                  )}
                </div>
                <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${STATUS_COLORS[log.status] || "bg-muted text-muted-foreground border-border"}`}>
                  {communicationStatusLabel(log.status)}
                </span>
              </div>

              {log.errorMessage && (
                <p className="text-xs text-muted-foreground mt-2">{log.errorMessage}</p>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <span>{new Date(log.sentAt).toLocaleString("tr-TR")}</span>
                <span aria-hidden="true">·</span>
                <span>{log.provider}</span>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  )
}