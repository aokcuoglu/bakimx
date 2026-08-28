import Link from "next/link"
import type { Prisma, SalesLeadStatus } from "@prisma/client"
import { ArrowLeft, Building2, CalendarClock, Mail, MapPin, Phone, UserRound } from "lucide-react"
import { prisma } from "@/lib/db"
import { getSalesAccess, salesLeadScope } from "@/lib/sales/access"
import { istanbulDayBounds } from "@/lib/sales/time"
import { salesLeadAdminHref, salesAdvisorDisplayName } from "@/lib/sales/links"
import { salesLeadFilterSchema } from "@/lib/validations/sales"
import { SalesLeadFilters, type SalesLeadFilterValues } from "@/components/sales/sales-lead-filters"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

const STATUS_LABELS: Record<SalesLeadStatus, string> = {
  new: "Yeni",
  contacted: "İletişim",
  demo_scheduled: "Demo planlandı",
  demo_completed: "Demo yapıldı",
  proposal: "Teklif",
  onboarding: "Kayıt aşamasında",
  won: "Kazanıldı",
  lost: "Kaybedildi",
}

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : ""
}

function displayDate(value: Date) {
  return value.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function SalesLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const access = await getSalesAccess()
  const raw = await searchParams
  const parsed = salesLeadFilterSchema.safeParse({
    q: first(raw.q),
    status: first(raw.status) || "all",
    follow: first(raw.follow) || "all",
    advisorId: first(raw.advisorId) || "all",
    createdFrom: first(raw.createdFrom),
    createdTo: first(raw.createdTo),
  })
  const filters: SalesLeadFilterValues = parsed.success
    ? parsed.data
    : { q: "", status: "all", follow: "all", advisorId: "all", createdFrom: "", createdTo: "" }
  const now = new Date()
  const { start: todayStart, end: tomorrow } = istanbulDayBounds(now)

  const where: Prisma.SalesLeadWhereInput = { ...salesLeadScope(access) }
  if (filters.q) {
    where.OR = [
      { businessName: { contains: filters.q, mode: "insensitive" } },
      { contactName: { contains: filters.q, mode: "insensitive" } },
      { phone: { contains: filters.q } },
      { email: { contains: filters.q, mode: "insensitive" } },
    ]
  }
  if (filters.status !== "all") where.status = filters.status
  if (access.kind === "admin" && filters.advisorId !== "all") {
    where.advisorId = filters.advisorId === "unassigned" ? null : filters.advisorId
  }
  if (filters.follow === "overdue") where.nextActionAt = { lt: now }
  if (filters.follow === "today") where.nextActionAt = { gte: todayStart, lt: tomorrow }
  if (filters.follow === "upcoming") where.nextActionAt = { gte: tomorrow }
  if (filters.follow === "none") where.nextActionAt = null
  if (filters.createdFrom || filters.createdTo) {
    where.createdAt = {
      ...(filters.createdFrom ? { gte: new Date(`${filters.createdFrom}T00:00:00+03:00`) } : {}),
      ...(filters.createdTo ? { lt: new Date(new Date(`${filters.createdTo}T00:00:00+03:00`).getTime() + 86_400_000) } : {}),
    }
  }

  const [leads, advisors] = await Promise.all([
    prisma.salesLead.findMany({
      where,
      orderBy: [{ nextActionAt: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        businessName: true,
        contactName: true,
        phone: true,
        email: true,
        city: true,
        district: true,
        status: true,
        source: true,
        nextActionAt: true,
        createdAt: true,
        advisor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
        _count: { select: { activities: true, tasks: true } },
      },
    }),
    access.kind === "admin"
      ? prisma.salesAdvisor.findMany({
          where: { disabledAt: null, user: { isActive: true } },
          orderBy: { createdAt: "asc" },
          select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } },
        })
      : Promise.resolve([]),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="link" className="mb-1 h-auto p-0 text-muted-foreground">
            <Link href="/admin/sales"><ArrowLeft className="size-4" /> Bugünüm</Link>
          </Button>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Satış Adayları</h1>
          <p className="text-sm text-muted-foreground">{access.kind === "advisor" ? "Yalnız size atanmış adaylar." : "Ekip havuzu ve atanmamış adaylar."}</p>
        </div>
        <Badge variant="secondary">{leads.length} kayıt</Badge>
      </div>

      <SalesLeadFilters
        initialValues={filters}
        advisors={advisors.map((advisor) => ({ id: advisor.id, name: salesAdvisorDisplayName(advisor.user) ?? "—" }))}
      />

      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Building2 className="mx-auto size-9 text-muted-foreground-strong" />
          <p className="mt-2 text-sm text-muted-foreground">Filtrelerle eşleşen satış adayı yok.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {leads.map((lead) => (
            <article key={lead.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Button asChild variant="link" className="h-auto justify-start p-0 text-base font-semibold">
                    <Link href={salesLeadAdminHref(lead.id)}>{lead.businessName}</Link>
                  </Button>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><UserRound className="size-3.5" />{lead.contactName}</p>
                </div>
                <Badge
                  variant={lead.status === "lost" ? "destructive" : "outline"}
                  className={lead.status === "won" ? "border-success/20 bg-success/10 text-success-strong" : undefined}
                >
                  {STATUS_LABELS[lead.status]}
                </Badge>
              </div>
              <div className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                <span className="flex items-center gap-1"><Phone className="size-3.5" />{lead.phone}</span>
                {lead.email && <span className="flex items-center gap-1"><Mail className="size-3.5" />{lead.email}</span>}
                {(lead.city || lead.district) && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{[lead.district, lead.city].filter(Boolean).join(", ")}</span>}
                {lead.nextActionAt && <span className="flex items-center gap-1"><CalendarClock className="size-3.5" />{displayDate(lead.nextActionAt)}</span>}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                <span>{lead.advisor ? salesAdvisorDisplayName(lead.advisor.user) : "Atanmamış"}</span>
                <span>{lead._count.activities} görüşme · {lead._count.tasks} görev · {displayDate(lead.createdAt)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
