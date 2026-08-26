"use client"

import { useMemo, useState } from "react"
import { Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { communicationActivityStatusLabel } from "@/lib/admin/activity-labels"

type AuditRow = { id: string; action: string; actor: string; createdAt: string }
type CommunicationRow = { id: string; kind: "İletişim" | "Hatırlatma" | "Takvim"; subject: string; status: string; detail: string; createdAt: string }

const statusClass = (status: string) => status === "sent" || status === "success" ? "bg-success/10 text-success-strong" : status === "failed" ? "bg-destructive/10 text-destructive-strong" : "bg-muted text-muted-foreground"
const PAGE_SIZE = 10
function Filters({ children }: { children: React.ReactNode }) { return <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">{children}</div> }
function Pagination({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (pages === 1) return null
  return <div className="flex items-center justify-between gap-3 pt-1 text-sm"><span className="text-muted-foreground">Sayfa {page} / {pages} · {total} kayıt</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Önceki</Button><Button variant="outline" size="sm" disabled={page === pages} onClick={() => onPageChange(page + 1)}>Sonraki</Button></div></div>
}

export function WorkshopActivityTables({ auditRows, communicationRows }: { auditRows: AuditRow[]; communicationRows: CommunicationRow[] }) {
  const [auditAction, setAuditAction] = useState("")
  const [communicationKind, setCommunicationKind] = useState("")
  const [communicationStatus, setCommunicationStatus] = useState("")
  const [auditPage, setAuditPage] = useState(1)
  const [communicationPage, setCommunicationPage] = useState(1)
  const auditActions = useMemo(() => [...new Set(auditRows.map((row) => row.action))], [auditRows])
  const filteredAudit = auditAction ? auditRows.filter((row) => row.action === auditAction) : auditRows
  const filteredCommunication = communicationRows.filter((row) => (!communicationKind || row.kind === communicationKind) && (!communicationStatus || row.status === communicationStatus))
  const paginatedAudit = filteredAudit.slice((auditPage - 1) * PAGE_SIZE, auditPage * PAGE_SIZE)
  const paginatedCommunication = filteredCommunication.slice((communicationPage - 1) * PAGE_SIZE, communicationPage * PAGE_SIZE)

  return <div className="space-y-6">
    <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold text-foreground">Son İşlemler (Denetim)</h2><p className="mt-0.5 text-xs text-muted-foreground">Tüm denetim kayıtları sayfalanır ve filtrelenir.</p></div><Filters><Filter className="size-4 text-muted-foreground" aria-hidden="true" /><Select value={auditAction} onValueChange={(value) => { setAuditAction(value); setAuditPage(1) }}><SelectTrigger className="h-8 w-56 bg-background"><SelectValue placeholder="Tüm işlemler" /></SelectTrigger><SelectContent><SelectItem value="">Tüm işlemler</SelectItem>{auditActions.map((action) => <SelectItem key={action} value={action}>{action}</SelectItem>)}</SelectContent></Select></Filters></div>
      <div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow><TableHead>İşlem</TableHead><TableHead>Yapan</TableHead><TableHead className="text-right">Tarih</TableHead></TableRow></TableHeader><TableBody>{paginatedAudit.length ? paginatedAudit.map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.action}</TableCell><TableCell className="text-muted-foreground">{row.actor}</TableCell><TableCell className="text-right text-muted-foreground">{new Date(row.createdAt).toLocaleString("tr-TR")}</TableCell></TableRow>) : <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Bu filtreyle eşleşen işlem yok.</TableCell></TableRow>}</TableBody></Table></div><Pagination page={auditPage} total={filteredAudit.length} onPageChange={setAuditPage} />
    </section>
    <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center"><div><h2 className="text-sm font-semibold text-foreground">İletişim & İşler</h2><p className="mt-0.5 text-xs text-muted-foreground">Tüm iletişim, hatırlatma ve takvim işleri sayfalanır.</p></div><Filters><Filter className="size-4 text-muted-foreground" aria-hidden="true" /><Select value={communicationKind} onValueChange={(value) => { setCommunicationKind(value); setCommunicationPage(1) }}><SelectTrigger className="h-8 w-36 bg-background"><SelectValue placeholder="Tüm türler" /></SelectTrigger><SelectContent><SelectItem value="">Tüm türler</SelectItem><SelectItem value="İletişim">İletişim</SelectItem><SelectItem value="Hatırlatma">Hatırlatma</SelectItem><SelectItem value="Takvim">Takvim</SelectItem></SelectContent></Select><Select value={communicationStatus} onValueChange={(value) => { setCommunicationStatus(value); setCommunicationPage(1) }}><SelectTrigger className="h-8 w-36 bg-background"><SelectValue placeholder="Tüm durumlar" /></SelectTrigger><SelectContent><SelectItem value="">Tüm durumlar</SelectItem>{[...new Set(communicationRows.map((row) => row.status))].map((status) => <SelectItem key={status} value={status}>{communicationActivityStatusLabel(status)}</SelectItem>)}</SelectContent></Select></Filters></div>
      <div className="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow><TableHead>Tür</TableHead><TableHead>Kayıt</TableHead><TableHead>Durum</TableHead><TableHead className="text-right">Tarih</TableHead></TableRow></TableHeader><TableBody>{paginatedCommunication.length ? paginatedCommunication.map((row) => <TableRow key={row.id}><TableCell className="text-muted-foreground">{row.kind}</TableCell><TableCell><p className="font-medium">{row.subject}</p><p className="text-xs text-muted-foreground">{row.detail}</p></TableCell><TableCell><Badge variant="outline" className={cn("capitalize", statusClass(row.status))}>{communicationActivityStatusLabel(row.status)}</Badge></TableCell><TableCell className="text-right text-muted-foreground">{new Date(row.createdAt).toLocaleDateString("tr-TR")}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Bu filtreyle eşleşen kayıt yok.</TableCell></TableRow>}</TableBody></Table></div><Pagination page={communicationPage} total={filteredCommunication.length} onPageChange={setCommunicationPage} />
    </section>
  </div>
}
