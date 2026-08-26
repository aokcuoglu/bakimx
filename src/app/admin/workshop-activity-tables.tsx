"use client"

import { useState, useTransition, type ReactNode } from "react"
import { format, isValid, parse } from "date-fns"
import { Filter, LoaderCircle, Play } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  ACTIVITY_STATUS_OPTIONS,
  AUDIT_ACTION_OPTIONS,
  communicationActivityStatusLabel,
} from "@/lib/admin/activity-labels"
import { WORKSHOP_ACTIVITY_PAGE_SIZE } from "@/lib/admin/workshop-activity-query"
import {
  queryWorkshopAudit,
  queryWorkshopCommunications,
  type AuditActivityRow,
  type CommunicationActivityKind,
  type CommunicationActivityRow,
} from "@/app/admin/workshop-activity-actions"

type QueryState<Row> = {
  hasRun: boolean
  rows: Row[]
  page: number
  total: number
}

const emptyQueryState = <Row,>(): QueryState<Row> => ({ hasRun: false, rows: [], page: 1, total: 0 })

const statusClass = (status: string) => status === "sent" || status === "success"
  ? "bg-success/10 text-success-strong"
  : status === "failed"
    ? "bg-destructive/10 text-destructive-strong"
    : status === "partial"
      ? "bg-warning/10 text-warning-strong"
      : "bg-muted text-muted-foreground"

function Filters({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

function parseFilterDate(value: string): Date | undefined {
  if (!value) return undefined
  const date = parse(value, "yyyy-MM-dd", new Date())
  return isValid(date) && format(date, "yyyy-MM-dd") === value ? date : undefined
}

function DateFilters({
  from,
  to,
  disabled,
  onChange,
}: {
  from: string
  to: string
  disabled: boolean
  onChange: (from: string, to: string) => void
}) {
  const fromDate = parseFilterDate(from)
  const toDate = parseFilterDate(to)

  return <DateRangePicker
    value={fromDate || toDate ? { from: fromDate, to: toDate } : undefined}
    disabled={disabled}
    className="w-64"
    onChange={(range) => onChange(
      range?.from ? format(range.from, "yyyy-MM-dd") : "",
      range?.to ? format(range.to, "yyyy-MM-dd") : "",
    )}
  />
}

function QueryPrompt({ colSpan, pending, onRun }: { colSpan: number; pending: boolean; onRun: () => void }) {
  return <TableRow>
    <TableCell colSpan={colSpan} className="h-36 text-center">
      <Button type="button" disabled={pending} onClick={onRun}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
        {pending ? "Running…" : "Run Query"}
      </Button>
    </TableCell>
  </TableRow>
}

function Pagination({
  page,
  total,
  pending,
  onPageChange,
}: {
  page: number
  total: number
  pending: boolean
  onPageChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / WORKSHOP_ACTIVITY_PAGE_SIZE))
  if (pages === 1) return null

  return <div className="flex items-center justify-between gap-3 pt-1 text-sm">
    <span className="text-muted-foreground">Sayfa {page} / {pages} · {total} kayıt</span>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={pending || page === 1} onClick={() => onPageChange(page - 1)}>Önceki</Button>
      <Button variant="outline" size="sm" disabled={pending || page === pages} onClick={() => onPageChange(page + 1)}>Sonraki</Button>
    </div>
  </div>
}

export function WorkshopActivityTables({ workshopId }: { workshopId: string }) {
  const [auditAction, setAuditAction] = useState("")
  const [auditFrom, setAuditFrom] = useState("")
  const [auditTo, setAuditTo] = useState("")
  const [auditState, setAuditState] = useState<QueryState<AuditActivityRow>>(emptyQueryState)
  const [auditPending, startAuditTransition] = useTransition()

  const [communicationKind, setCommunicationKind] = useState<CommunicationActivityKind | "">("")
  const [communicationStatus, setCommunicationStatus] = useState("")
  const [communicationFrom, setCommunicationFrom] = useState("")
  const [communicationTo, setCommunicationTo] = useState("")
  const [communicationState, setCommunicationState] = useState<QueryState<CommunicationActivityRow>>(emptyQueryState)
  const [communicationPending, startCommunicationTransition] = useTransition()

  function invalidateAudit() {
    setAuditState(emptyQueryState())
  }

  function invalidateCommunication() {
    setCommunicationState(emptyQueryState())
  }

  function runAudit(page = 1) {
    startAuditTransition(async () => {
      try {
        const result = await queryWorkshopAudit({ workshopId, action: auditAction, from: auditFrom, to: auditTo, page })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setAuditState({ hasRun: true, rows: result.rows, page: result.page, total: result.total })
      } catch {
        toast.error("Denetim sorgusu çalıştırılamadı.")
      }
    })
  }

  function runCommunications(page = 1) {
    startCommunicationTransition(async () => {
      try {
        const result = await queryWorkshopCommunications({ workshopId, kind: communicationKind, status: communicationStatus, from: communicationFrom, to: communicationTo, page })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setCommunicationState({ hasRun: true, rows: result.rows, page: result.page, total: result.total })
      } catch {
        toast.error("İletişim ve işler sorgusu çalıştırılamadı.")
      }
    })
  }

  return <div className="space-y-6">
    <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Son İşlemler (Denetim)</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Filtreleri seçin; kayıtlar yalnızca sorguyu çalıştırdığınızda yüklenir.</p>
        </div>
        <Filters>
          <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
          <Select value={auditAction} disabled={auditPending} onValueChange={(value) => { setAuditAction(value); invalidateAudit() }}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Tüm işlemler" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tüm işlemler</SelectItem>
              {AUDIT_ACTION_OPTIONS.map((action) => <SelectItem key={action.value} value={action.value}>{action.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateFilters
            from={auditFrom}
            to={auditTo}
            disabled={auditPending}
            onChange={(from, to) => { setAuditFrom(from); setAuditTo(to); invalidateAudit() }}
          />
        </Filters>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table aria-busy={auditPending}>
          <TableHeader><TableRow><TableHead>İşlem</TableHead><TableHead>Yapan</TableHead><TableHead className="text-right">Tarih</TableHead></TableRow></TableHeader>
          <TableBody>
            {!auditState.hasRun
              ? <QueryPrompt colSpan={3} pending={auditPending} onRun={() => runAudit()} />
              : auditState.rows.length
                ? auditState.rows.map((row) => <TableRow key={row.id}><TableCell className="font-medium">{row.action}</TableCell><TableCell className="text-muted-foreground">{row.actor}</TableCell><TableCell className="text-right text-muted-foreground">{new Date(row.createdAt).toLocaleString("tr-TR")}</TableCell></TableRow>)
                : <TableRow><TableCell colSpan={3} className="h-36 text-center text-muted-foreground">Bu filtreyle eşleşen işlem yok.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {auditState.hasRun && <Pagination page={auditState.page} total={auditState.total} pending={auditPending} onPageChange={runAudit} />}
    </section>

    <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <h2 className="text-sm font-semibold text-foreground">İletişim & İşler</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Filtreleri seçin; kayıtlar yalnızca sorguyu çalıştırdığınızda yüklenir.</p>
        </div>
        <Filters>
          <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
          <Select value={communicationKind} disabled={communicationPending} onValueChange={(value) => { setCommunicationKind(value as CommunicationActivityKind | ""); invalidateCommunication() }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Tüm türler" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tüm türler</SelectItem>
              <SelectItem value="communication">İletişim</SelectItem>
              <SelectItem value="reminder">Hatırlatma</SelectItem>
              <SelectItem value="calendar">Takvim</SelectItem>
            </SelectContent>
          </Select>
          <Select value={communicationStatus} disabled={communicationPending} onValueChange={(value) => { setCommunicationStatus(value); invalidateCommunication() }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Tüm durumlar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tüm durumlar</SelectItem>
              {ACTIVITY_STATUS_OPTIONS.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <DateFilters
            from={communicationFrom}
            to={communicationTo}
            disabled={communicationPending}
            onChange={(from, to) => { setCommunicationFrom(from); setCommunicationTo(to); invalidateCommunication() }}
          />
        </Filters>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table aria-busy={communicationPending}>
          <TableHeader><TableRow><TableHead>Tür</TableHead><TableHead>Kayıt</TableHead><TableHead>Durum</TableHead><TableHead className="text-right">Tarih</TableHead></TableRow></TableHeader>
          <TableBody>
            {!communicationState.hasRun
              ? <QueryPrompt colSpan={4} pending={communicationPending} onRun={() => runCommunications()} />
              : communicationState.rows.length
                ? communicationState.rows.map((row) => <TableRow key={row.id}><TableCell className="text-muted-foreground">{row.kind}</TableCell><TableCell><p className="font-medium">{row.subject}</p><p className="text-xs text-muted-foreground">{row.detail}</p></TableCell><TableCell><Badge variant="outline" className={cn("capitalize", statusClass(row.status))}>{communicationActivityStatusLabel(row.status)}</Badge></TableCell><TableCell className="text-right text-muted-foreground">{new Date(row.createdAt).toLocaleString("tr-TR")}</TableCell></TableRow>)
                : <TableRow><TableCell colSpan={4} className="h-36 text-center text-muted-foreground">Bu filtreyle eşleşen kayıt yok.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      {communicationState.hasRun && <Pagination page={communicationState.page} total={communicationState.total} pending={communicationPending} onPageChange={runCommunications} />}
    </section>
  </div>
}
