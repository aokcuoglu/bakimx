import Link from "next/link"
import type { Prisma } from "@prisma/client"
import { Filter } from "lucide-react"
import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/shared/filter-select"
import { COMMUNICATION_STATUSES } from "@/lib/communications/status-labels"
import { CommunicationLogTable } from "./communication-log-table"

const PAGE_SIZE = 10
type Search = { workshopId?: string; type?: string; status?: string; page?: string }

export default async function AdminCommunicationsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdminCapability("viewAudit")
  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const where: Prisma.CommunicationLogWhereInput = { workshop: { kind: "customer" }, ...(sp.workshopId ? { workshopId: sp.workshopId } : {}), ...(sp.type ? { type: sp.type as "sms" | "whatsapp" | "email" } : {}), ...(sp.status ? { status: sp.status } : {}) }
  const [logs, total, workshops] = await Promise.all([
    prisma.communicationLog.findMany({ where, orderBy: { sentAt: "desc" }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE, include: { workshop: { select: { name: true } } } }),
    prisma.communicationLog.count({ where }),
    prisma.workshop.findMany({ where: { kind: "customer" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const href = (next: Search) => {
    const q = new URLSearchParams()
    for (const [key, value] of Object.entries(next)) if (value && !(key === "page" && value === "1")) q.set(key, value)
    return `/admin/communications${q.size ? `?${q}` : ""}`
  }

  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">Platform operasyonları</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">İletişim Kayıtları</h1>
        <p className="text-sm text-muted-foreground">{total} gönderim denemesi. Gönderilmeyen kayıtların sebebi görünür tutulur.</p>
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-sm font-semibold text-foreground">İletişim gönderimleri</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Tüm kanallardaki iletişim denemeleri sayfalanır ve filtrelenir.</p>
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
            <label><span className="sr-only">İş yeri</span><FilterSelect name="workshopId" defaultValue={sp.workshopId ?? ""} placeholder="Tüm iş yerleri" className="h-8 w-44 bg-background" autoSubmit options={[{ value: "", label: "Tüm iş yerleri" }, ...workshops.map((workshop) => ({ value: workshop.id, label: workshop.name }))]} /></label>
            <label><span className="sr-only">Kanal</span><FilterSelect name="type" defaultValue={sp.type ?? ""} placeholder="Tüm kanallar" className="h-8 w-36 bg-background" autoSubmit options={[{ value: "", label: "Tüm kanallar" }, { value: "sms", label: "SMS" }, { value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "E-posta" }]} /></label>
            <label><span className="sr-only">Durum</span><FilterSelect name="status" defaultValue={sp.status ?? ""} placeholder="Tüm durumlar" className="h-8 w-36 bg-background" autoSubmit options={[{ value: "", label: "Tüm durumlar" }, ...COMMUNICATION_STATUSES.map((status) => ({ value: status, label: status === "sent" ? "Gönderildi" : status === "failed" ? "Başarısız" : status === "pending" ? "Bekliyor" : "Gönderilmedi" }))]} /></label>
          </form>
        </div>

        <CommunicationLogTable rows={logs.map((log) => ({ id: log.id, workshopId: log.workshopId, workshopName: log.workshop.name, type: log.type, recipient: log.recipient, templateKey: log.templateKey, provider: log.provider, status: log.status, reason: log.errorMessage, sentAt: log.sentAt.toISOString(), entityType: log.entityType, entityId: log.entityId }))} />
      </section>

      <div className="flex items-center justify-between gap-3 pt-1 text-sm">
        <span className="text-muted-foreground">Sayfa {page} / {pages} · {total} kayıt</span>
        <div className="flex gap-2">
          {page > 1 ? <Button variant="outline" size="sm" asChild><Link href={href({ ...sp, page: String(page - 1) })}>Önceki</Link></Button> : <Button variant="outline" size="sm" disabled>Önceki</Button>}
          {page < pages ? <Button variant="outline" size="sm" asChild><Link href={href({ ...sp, page: String(page + 1) })}>Sonraki</Link></Button> : <Button variant="outline" size="sm" disabled>Sonraki</Button>}
        </div>
      </div>
    </div>
  )
}
