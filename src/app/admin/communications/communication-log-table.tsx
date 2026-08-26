"use client"

import { useState } from "react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { communicationStatusLabel } from "@/lib/communications/status-labels"
import { communicationTemplateLabel } from "@/lib/communications/template-labels"
import { cn } from "@/lib/utils"

export type CommunicationRow = { id: string; workshopId: string; workshopName: string; type: string; recipient: string; templateKey: string | null; provider: string; status: string; reason: string | null; sentAt: string; entityType: string | null; entityId: string | null }
const statusClass = (status: string) => status === "sent" ? "bg-success/10 text-success-strong" : status === "failed" ? "bg-destructive/10 text-destructive-strong" : status === "skipped" ? "bg-muted text-muted-foreground" : "bg-warning/10 text-warning-strong"

const channelLabel = (type: string) => ({ sms: "SMS", whatsapp: "WhatsApp", email: "E-posta" }[type] ?? "İletişim")
const providerLabel = (provider: string) => ({ mock: "Demo sağlayıcı", none: "Sağlayıcı kullanılmadı" }[provider] ?? provider)
const entityLabel = (entityType: string) => ({ appointment: "Randevu", intake: "Araç kabulü", quote: "Teklif", order: "İş emri", reminder: "Bakım hatırlatması", vehicle: "Araç", test: "Test gönderimi", CollectionReminder: "Tahsilat hatırlatması" }[entityType] ?? "İlişkili kayıt")

export function CommunicationLogTable({ rows }: { rows: CommunicationRow[] }) {
  const [selected, setSelected] = useState<CommunicationRow | null>(null)
  return <>
    {rows.length === 0 ? (
      <p className="py-8 text-center text-sm text-muted-foreground">Bu filtreyle eşleşen iletişim kaydı yok.</p>
    ) : (
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader><TableRow><TableHead>Tür</TableHead><TableHead>Kayıt</TableHead><TableHead>Durum</TableHead><TableHead className="text-right">Tarih</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((row) => <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelected(row)}>
            <TableCell className="text-muted-foreground">{channelLabel(row.type)}</TableCell>
            <TableCell><p className="font-medium text-foreground">{communicationTemplateLabel(row.templateKey)}</p><p className="text-xs text-muted-foreground">{row.recipient || "Alıcı bilgisi yok"} · {row.workshopName}</p></TableCell>
            <TableCell><Badge variant="outline" className={cn("text-[11px]", statusClass(row.status))}>{communicationStatusLabel(row.status)}</Badge>{row.reason && <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">{row.reason}</p>}</TableCell>
            <TableCell className="text-right text-muted-foreground">{new Date(row.sentAt).toLocaleDateString("tr-TR")}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
    )}
    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>İletişim kaydı</DialogTitle><DialogDescription>{selected?.recipient || "Alıcı bilgisi yok"}</DialogDescription></DialogHeader>{selected && <div className="space-y-2 text-sm"><p><strong>Kanal:</strong> {channelLabel(selected.type)}</p><p><strong>Şablon:</strong> {communicationTemplateLabel(selected.templateKey)}</p><p><strong>Durum:</strong> {communicationStatusLabel(selected.status)}</p><p><strong>Neden / hata:</strong> {selected.reason ?? "—"}</p><p><strong>Sağlayıcı:</strong> {providerLabel(selected.provider)}</p>{selected.entityType && <p><strong>İlişki:</strong> {entityLabel(selected.entityType)} · {selected.entityId ?? "—"}</p>}<p className="text-muted-foreground">İzin değişikliği müşteri kaydından yapılır; yönetim konsolu izinleri değiştirmez.</p><Button variant="outline" asChild><Link href={`/admin/workshops/${selected.workshopId}`}>İş yerini aç</Link></Button></div>}</DialogContent></Dialog>
  </>
}
