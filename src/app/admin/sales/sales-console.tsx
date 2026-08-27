"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { format, startOfDay } from "date-fns"
import { tr } from "date-fns/locale"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { salesLeadAnchorId, workshopAdminHref } from "@/lib/sales/links"
import { SALES_DISCOUNT_FUNDING_LABELS, type SalesDiscountFunding } from "@/lib/sales/discount-policy"
import { territoryPositionForCity } from "@/lib/sales/territory"
import { salesLeadSchema, salesDiscountCodeSchema, salesDiscountCodeUpdateSchema } from "@/lib/validations/sales"
import {
  addSalesActivity,
  convertSalesLead,
  createSalesLead,
  generateSalesDiscountCode,
  updateSalesDiscountCode,
  deactivateSalesDiscountCode,
  setSalesLeadStatus,
  updateSalesCommission,
} from "./actions"
import { Phone, Mail, MessageSquare, FileText, MapPin, Clock, Users, TrendingUp, CheckCircle2, Gift, Copy, Check, Pencil, Ban, Building2, CalendarDays, Plus, Radar, Target, ArrowUpRight, WalletCards, ShieldCheck } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type Lead = {
  id: string
  businessName: string
  contactName: string
  phone: string
  city: string | null
  notes: string | null
  status: string
  source: string
  nextActionAt: string | null
  createdAt: string
  advisorName: string | null
  advisorId: string | null
  workshopId: string | null
  activities: { id: string; type: string; summary: string; occurredAt: string }[]
}

type Commission = {
  id: string
  status: string
  businessName: string
  advisorName: string
  amountMinor: number | null
  note: string | null
}

type DiscountCode = {
  id: string
  code: string
  discountPercent: number
  fundingSource: SalesDiscountFunding
  usedCount: number
  maxUses: number
  expiresAt: string
  disabledAt: string | null
  usedAt: string | null
  createdAt: string
  leadName: string | null
  advisorName: string | null
  createdByName: string | null
}

type Advisor = { id: string; name: string }
const statuses = [
  ["new", "Yeni", "bg-primary/10 text-primary-strong border-primary/20"],
  ["contacted", "İletişim", "bg-warning/10 text-warning-strong border-warning/20"],
  ["demo_scheduled", "Demo Planlandı", "bg-muted text-muted-foreground border-border"],
  ["demo_completed", "Demo Yapıldı", "bg-secondary text-secondary-foreground border-border"],
  ["proposal", "Teklif", "bg-accent text-accent-foreground border-border"],
  ["won", "Kazanıldı", "bg-success/10 text-success-strong border-success/20"],
  ["lost", "Kaybedildi", "bg-destructive/10 text-destructive-strong border-destructive/20"],
] as const

const activityIcons: Record<string, typeof Phone> = {
  phone: Phone,
  whatsapp: MessageSquare,
  email: Mail,
  visit: MapPin,
  demo: FileText,
  note: FileText,
}

function getStatusConfig(status: string) {
  return statuses.find(([s]) => s === status) ?? ["new", "Yeni", "bg-primary/10 text-primary-strong border-primary/20"]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

function isExpired(iso: string) {
  return new Date(iso) < new Date()
}

export function SalesConsole({
  leads,
  commissions,
  discountCodes,
  advisors,
  isAdmin,
  canManagePipeline,
  canManageCommissions,
  initialLeadId,
}: {
  leads: Lead[]
  commissions: Commission[]
  discountCodes: DiscountCode[]
  advisors: Advisor[]
  isAdmin: boolean
  canManagePipeline: boolean
  canManageCommissions: boolean
  initialLeadId: string | null
}) {
  const [pending, startTransition] = useTransition()
  const form = useForm({
    resolver: zodResolver(salesLeadSchema),
    defaultValues: { businessName: "", contactName: "", phone: "", email: "", city: "", notes: "" },
  })
  const [activity, setActivity] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [advisorFilter, setAdvisorFilter] = useState<string>("all")
  const [showNewLeadForm, setShowNewLeadForm] = useState(false)
  const initialLeadStatus = leads.find((lead) => lead.id === initialLeadId)?.status
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeadId)
  const [openStatuses, setOpenStatuses] = useState<string[]>(initialLeadStatus ? [initialLeadStatus] : [])
  const newLeadButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!selectedLeadId) return
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(salesLeadAnchorId(selectedLeadId))
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      target?.scrollIntoView({ behavior, block: "center" })
    })
    return () => cancelAnimationFrame(frame)
  }, [advisorFilter, openStatuses, selectedLeadId, statusFilter])

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false
      if (advisorFilter !== "all" && lead.advisorName !== advisorFilter) return false
      return true
    })
  }, [leads, statusFilter, advisorFilter])

  const leadsByStatus = useMemo(() => {
    const grouped: Record<string, Lead[]> = {}
    for (const [value] of statuses) grouped[value] = []
    for (const lead of filteredLeads) grouped[lead.status]?.push(lead)
    return grouped
  }, [filteredLeads])

  const stats = useMemo(() => {
    const total = leads.length
    const won = leads.filter((l) => l.status === "won").length
    const active = leads.filter((l) => !["won", "lost"].includes(l.status)).length
    const engaged = leads.filter((l) => ["contacted", "demo_scheduled", "demo_completed", "proposal"].includes(l.status)).length
    const conversations = leads.reduce((sum, lead) => sum + lead.activities.length, 0)
    const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0
    return { total, won, active, engaged, conversations, conversionRate }
  }, [leads])

  const focusLeads = useMemo(() => {
    return leads
      .filter((lead) => !["won", "lost"].includes(lead.status))
      .sort((a, b) => {
        const aTime = a.nextActionAt ? new Date(a.nextActionAt).getTime() : Number.POSITIVE_INFINITY
        const bTime = b.nextActionAt ? new Date(b.nextActionAt).getTime() : Number.POSITIVE_INFINITY
        if (aTime !== bTime) return aTime - bTime
        return b.activities.length - a.activities.length
      })
      .slice(0, 4)
  }, [leads])

  function focusLead(lead: Lead) {
    setStatusFilter("all")
    setAdvisorFilter("all")
    setSelectedLeadId(lead.id)
    setOpenStatuses((current) => current.includes(lead.status) ? current : [...current, lead.status])
  }

  function submitLead(values: { businessName: string; contactName: string; phone: string; email: string; city: string; notes: string }) {
    startTransition(async () => {
      const res = await createSalesLead(values)
      if (!res.ok) { toast.error(res.error); return }
      form.reset()
      setShowNewLeadForm(false)
      toast.success("Servis adayı satış havuzuna eklendi.")
    })
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Badge variant="outline" className="mb-3 gap-1.5 bg-primary/10 text-primary-strong">
            <Radar className="size-3.5" /> Canlı saha görünümü
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Satış operasyon merkezi</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Şirketleri haritada görün, günün temaslarını öne alın ve fırsatları tek bir akıştan ilerletin.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button asChild variant="outline">
              <Link href="/admin/sales/advisors"><Users className="size-4" /> Danışmanlar</Link>
            </Button>
          )}
          {canManagePipeline && (
            <Button ref={newLeadButtonRef} type="button" onClick={() => setShowNewLeadForm(true)}>
              <Plus className="size-4" /> Yeni şirket adayı
            </Button>
          )}
        </div>
      </header>

      <section aria-label="Satış özeti" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SalesMetric label="Toplam portföy" value={stats.total} detail="Tüm şirket adayları" icon={Users} tone="primary" />
        <SalesMetric label="Aktif fırsat" value={stats.active} detail="Takipteki şirketler" icon={Target} tone="warning" />
        <SalesMetric label="Görüşme kaydı" value={stats.conversations} detail="Son kayıtlı temaslar" icon={MessageSquare} tone="muted" />
        <SalesMetric label="Dönüşüm" value={`%${stats.conversionRate}`} detail={`${stats.won} kazanılan şirket`} icon={TrendingUp} tone="success" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SalesTerritoryMap leads={leads} selectedLeadId={selectedLeadId} onSelectLead={focusLead} />
        <aside className="flex flex-col rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="focus-queue-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-strong">Öncelik sırası</p>
              <h2 id="focus-queue-title" className="mt-1 text-lg font-semibold text-foreground">Bugünün odağı</h2>
            </div>
            <div className="flex size-9 items-center justify-center rounded-xl bg-warning/10 text-warning-strong">
              <Target className="size-4" />
            </div>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Yaklaşan takipler ve ilerlemeye en yakın fırsatlar.</p>
          <div className="mt-4 space-y-2">
            {focusLeads.length === 0 ? (
              <div className="rounded-xl border border-dashed p-5 text-center">
                <CheckCircle2 className="mx-auto size-6 text-success-strong" />
                <p className="mt-2 text-sm font-medium text-foreground">Takip kuyruğu temiz</p>
                <p className="mt-1 text-xs text-muted-foreground">Yeni bir şirket adayı ekleyerek başlayın.</p>
              </div>
            ) : focusLeads.map((lead, index) => {
              const [, statusLabel] = getStatusConfig(lead.status)
              return (
                <Button
                  key={lead.id}
                  type="button"
                  variant="ghost"
                  onClick={() => focusLead(lead)}
                  className="h-auto w-full justify-start gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left hover:border-border"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground-strong">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{lead.businessName}</span>
                    <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                      {lead.nextActionAt ? formatDateTime(lead.nextActionAt) : statusLabel}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </Button>
              )
            })}
          </div>
          <div className="mt-auto border-t pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Huni nabzı</p>
              <span className="text-xs text-muted-foreground">Anlık portföy</span>
            </div>
            <div className="mt-3 space-y-3">
              {[
                { label: "Portföy", value: stats.total, bar: "bg-primary" },
                { label: "Görüşmede", value: stats.engaged, bar: "bg-warning" },
                { label: "Kazanılan", value: stats.won, bar: "bg-success" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", item.bar)} style={{ width: `${Math.max(item.value > 0 ? 8 : 0, Math.round((item.value / Math.max(1, stats.total)) * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <Dialog open={showNewLeadForm} onOpenChange={setShowNewLeadForm}>
        <DialogContent
          className="sm:max-w-2xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            newLeadButtonRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>Yeni şirket adayı</DialogTitle>
            <DialogDescription>Sahada görüşülecek servis veya işletmeyi satış portföyüne ekleyin.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="new-sales-lead-form" onSubmit={form.handleSubmit(submitLead)} className="grid gap-4 sm:grid-cols-2">
              {(["businessName", "contactName", "phone", "email", "city"] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {({ businessName: "Şirket / servis adı", contactName: "Yetkili", phone: "Telefon", email: "E-posta", city: "Şehir" })[name]}
                      </FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>İlk izlenim / not</FormLabel>
                    <FormControl><Textarea {...field} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { form.reset(); setShowNewLeadForm(false) }}>Vazgeç</Button>
            <Button type="submit" form="new-sales-lead-form" disabled={pending}>Portföye ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales Pool */}
      <section id="sales-pipeline" className="space-y-4 scroll-m-24">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-strong">Fırsat akışı</p>
            <h2 className="mt-1 text-xl font-bold text-foreground">Şirket portföyü</h2>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Tüm danışmanların adayları." : "Size atanmış servis adayları."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" aria-label="Durum filtresi">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {statuses.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={advisorFilter} onValueChange={setAdvisorFilter}>
                <SelectTrigger className="w-[160px]" aria-label="Danışman filtresi">
                  <SelectValue placeholder="Danışman" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Danışmanlar</SelectItem>
                  {advisors.map((a) => (
                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {filteredLeads.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground-strong" />
            <p className="mt-2 text-sm text-muted-foreground">Henüz servis adayı yok.</p>
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={openStatuses}
            onValueChange={setOpenStatuses}
            className="space-y-2"
          >
            {statuses.map(([statusValue, statusLabel, statusColor]) => {
              const statusLeads = leadsByStatus[statusValue] ?? []
              if (statusLeads.length === 0) return null
              return (
                <AccordionItem key={statusValue} value={statusValue} className="rounded-xl border bg-card">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-[11px] ${statusColor}`}>{statusLabel}</Badge>
                      <span className="text-sm text-muted-foreground">{statusLeads.length} aday</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3">
                      {statusLeads.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          isLinked={lead.id === selectedLeadId}
                          isAdmin={isAdmin}
                          canManagePipeline={canManagePipeline}
                          pending={pending}
                          activity={activity[lead.id] ?? ""}
                          onActivityChange={(val) => setActivity((v) => ({ ...v, [lead.id]: val }))}
                          startTransition={startTransition}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </section>

      {/* Discount Codes */}
      <DiscountCodeSection
        discountCodes={discountCodes}
        leads={leads}
        advisors={advisors}
        isAdmin={isAdmin}
        canManagePipeline={canManagePipeline}
        pending={pending}
        startTransition={startTransition}
      />

      {/* Commission Queue */}
      {canManageCommissions && commissions.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Hakediş Kuyruğu</h2>
            <p className="text-sm text-muted-foreground">İlk ücretli abonelikten oluşan, manuel fiyatlanacak taslaklar.</p>
          </div>
          {commissions.map((commission) => (
            <CommissionRow key={commission.id} commission={commission} pending={pending} startTransition={startTransition} />
          ))}
        </section>
      )}
    </div>
  )
}

function SalesMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string
  value: number | string
  detail: string
  icon: typeof Users
  tone: "primary" | "warning" | "success" | "muted"
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary-strong",
    warning: "bg-warning/10 text-warning-strong",
    success: "bg-success/10 text-success-strong",
    muted: "bg-muted text-muted-foreground-strong",
  }[tone]

  return (
    <article className="relative overflow-hidden rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">{value}</p>
        </div>
        <div className={cn("flex size-9 items-center justify-center rounded-xl", toneClass)}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p>
    </article>
  )
}

function mapPinVariant(status: string): "default" | "warning" | "success" | "destructive" | "secondary" {
  if (status === "won") return "success"
  if (status === "lost") return "destructive"
  if (["contacted", "demo_scheduled"].includes(status)) return "warning"
  if (["demo_completed", "proposal"].includes(status)) return "secondary"
  return "default"
}

function SalesTerritoryMap({
  leads,
  selectedLeadId,
  onSelectLead,
}: {
  leads: Lead[]
  selectedLeadId: string | null
  onSelectLead: (lead: Lead) => void
}) {
  const pins = useMemo(() => {
    const cityCounts = new Map<string, number>()
    return leads.flatMap((lead) => {
      const position = territoryPositionForCity(lead.city)
      if (!position) return []
      const cityKey = lead.city?.toLocaleLowerCase("tr-TR") ?? ""
      const occurrence = cityCounts.get(cityKey) ?? 0
      cityCounts.set(cityKey, occurrence + 1)
      const offsets = [[0, 0], [-1.7, 2.2], [1.7, 2.2], [-2.4, -1.7], [2.4, -1.7]] as const
      const [offsetX, offsetY] = offsets[occurrence % offsets.length]
      return [{ lead, x: position.x + offsetX, y: position.y + offsetY }]
    })
  }, [leads])
  const unmappedCount = leads.length - pins.length

  return (
    <section className="relative overflow-hidden rounded-2xl bg-navy p-4 text-navy-foreground shadow-sm sm:p-6" aria-labelledby="territory-map-title">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-navy-foreground/5 blur-3xl" />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-foreground">Türkiye saha ağı</p>
          <h2 id="territory-map-title" className="mt-1 text-xl font-semibold sm:text-2xl">Görüşme yapılan şirketler</h2>
          <p className="mt-1 max-w-xl text-sm text-navy-foreground">Bir pini seçerek şirketin satış kartına geçin.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-xl border border-navy-foreground/15 bg-navy-foreground/10 px-3 py-2">
          <MapPin className="size-4 text-primary" />
          <span className="text-sm font-semibold tabular-nums">{pins.length}</span>
          <span className="text-xs text-navy-foreground">haritada</span>
        </div>
      </div>

      <div className="relative mt-4 aspect-[2/1] min-h-56 w-full sm:min-h-72" aria-label={`${pins.length} şirket adayı Türkiye haritasında gösteriliyor`}>
        <svg aria-hidden viewBox="0 0 100 80" preserveAspectRatio="none" className="absolute inset-0 size-full text-navy-foreground">
          <path
            d="M3 31 L7 26 11 27 13 23 18 25 20 21 24 22 27 26 33 25 37 22 42 24 46 20 51 22 55 19 60 22 65 18 70 22 76 20 80 24 85 22 89 26 95 25 98 29 96 34 99 37 96 42 98 47 94 50 92 57 87 55 84 60 80 58 75 62 70 58 65 60 60 55 55 57 50 54 45 58 40 54 36 60 31 56 27 60 23 57 19 62 15 58 11 60 9 55 6 54 8 49 5 46 7 41 4 38 6 34 Z"
            fill="currentColor"
            fillOpacity="0.09"
            stroke="currentColor"
            strokeOpacity="0.28"
            strokeWidth="0.45"
            vectorEffect="non-scaling-stroke"
          />
          <path d="M17 29 C35 20 55 31 76 20 M28 53 C48 40 66 56 88 42" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="1.4 2.3" vectorEffect="non-scaling-stroke" />
        </svg>

        {pins.map(({ lead, x, y }) => (
          <Tooltip key={lead.id}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant={mapPinVariant(lead.status)}
                aria-label={`${lead.businessName}, ${lead.city ?? "şehir belirtilmedi"}`}
                aria-pressed={lead.id === selectedLeadId}
                onClick={() => onSelectLead(lead)}
                className={cn(
                  "absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-navy shadow-lg transition-transform hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100",
                  lead.id === selectedLeadId && "ring-4 ring-navy-foreground/25",
                )}
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <MapPin className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              <span className="font-medium">{lead.businessName}</span>
              <span>· {lead.city}</span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="relative mt-3 flex flex-col gap-3 border-t border-navy-foreground/10 pt-3 text-xs text-navy-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Yeni</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" /> Görüşmede</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> Kazanıldı</span>
        </div>
        {unmappedCount > 0 && <span>{unmappedCount} aday şehir bilgisi bekliyor</span>}
      </div>
    </section>
  )
}

function LeadCard({
  lead,
  isLinked,
  isAdmin,
  canManagePipeline,
  pending,
  activity,
  onActivityChange,
  startTransition,
}: {
  lead: Lead
  isLinked: boolean
  isAdmin: boolean
  canManagePipeline: boolean
  pending: boolean
  activity: string
  onActivityChange: (val: string) => void
  startTransition: ReturnType<typeof useTransition>[1]
}) {
  const [, statusLabel, statusColor] = getStatusConfig(lead.status)
  const [showActivities, setShowActivities] = useState(false)

  return (
    <div
      id={salesLeadAnchorId(lead.id)}
      className={cn(
        "rounded-lg border bg-background p-4 space-y-3 scroll-m-24",
        isLinked && "border-primary ring-2 ring-primary/20"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{lead.businessName}</h3>
            <Badge variant="outline" className={`text-[11px] ${statusColor}`}>{statusLabel}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{lead.contactName}</span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>
            {lead.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{lead.city}</span>}
          </div>
          {lead.advisorName && (
            <p className="mt-1 text-xs text-muted-foreground">Danışman: {lead.advisorName}</p>
          )}
          {lead.nextActionAt && !isExpired(lead.nextActionAt) && (
            <p className="mt-1 flex items-center gap-1 text-xs text-warning-strong">
              <Clock className="h-3 w-3" />
              Takip: {formatDateTime(lead.nextActionAt)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && lead.workshopId && (
            <Button asChild variant="outline" size="sm">
              <Link href={workshopAdminHref(lead.workshopId)}>
                <Building2 className="size-4" /> İş yerini aç
              </Link>
            </Button>
          )}
          {canManagePipeline && <Select
            value={lead.status}
            disabled={pending}
            onValueChange={(status) =>
              startTransition(async () => {
                const res = await setSalesLeadStatus(lead.id, status)
                if (!res.ok) toast.error(res.error)
              })
            }
          >
            <SelectTrigger className="w-[130px]" aria-label={`${lead.businessName} durumu`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>}
        </div>
      </div>

      {lead.notes && (
        <p className="text-sm text-muted-foreground italic">&ldquo;{lead.notes}&rdquo;</p>
      )}

      {/* Activity Summary */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          onClick={() => setShowActivities(!showActivities)}
          variant="ghost"
          className="h-auto p-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileText className="h-3 w-3" />
          {lead.activities.length} görüşme
          <span className="text-muted-foreground-strong">{showActivities ? "▲" : "▼"}</span>
        </Button>
        {lead.activities.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Son: {formatDateTime(lead.activities[0].occurredAt)}
          </span>
        )}
      </div>

      {showActivities && lead.activities.length > 0 && (
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          {lead.activities.map((a) => {
            const Icon = activityIcons[a.type] ?? FileText
            return (
              <div key={a.id} className="flex items-start gap-2">
                <Icon className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{a.summary}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(a.occurredAt)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Activity Input */}
      {canManagePipeline && <div className="flex gap-2">
        <Input
          value={activity}
          onChange={(e) => onActivityChange(e.target.value)}
          placeholder="Görüşme notu ekle..."
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          disabled={pending || !activity.trim()}
          onClick={() =>
            startTransition(async () => {
              const res = await addSalesActivity(lead.id, { type: "note", summary: activity })
              if (!res.ok) toast.error(res.error)
              else {
                onActivityChange("")
                toast.success("Görüşme kaydedildi.")
              }
            })
          }
        >
          Ekle
        </Button>
      </div>}

      {/* Admin Actions */}
      {isAdmin && canManagePipeline && lead.status !== "won" && (
        <div className="flex gap-2 pt-1">
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await convertSalesLead(lead.id)
                if (!res.ok) toast.error(res.error)
                else toast.success("İş yeri kaydı oluşturuldu.")
              })
            }
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            İş yerine dönüştür
          </Button>
        </div>
      )}
    </div>
  )
}

function DiscountCodeSection({
  discountCodes,
  leads,
  advisors,
  isAdmin,
  canManagePipeline,
  pending,
  startTransition,
}: {
  discountCodes: DiscountCode[]
  leads: Lead[]
  advisors: Advisor[]
  isAdmin: boolean
  canManagePipeline: boolean
  pending: boolean
  startTransition: ReturnType<typeof useTransition>[1]
}) {
  const form = useForm({
    resolver: zodResolver(salesDiscountCodeSchema),
    defaultValues: {
      discountPercent: 10,
      leadId: "",
      advisorId: "",
      fundingSource: isAdmin ? "bakimx_funded" as const : "advisor_margin" as const,
    },
  })
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [generatedCode, setGeneratedCode] = useState<{ code: string; discountPercent: number; expiresAt: string; fundingSource: SalesDiscountFunding } | null>(null)
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null)
  const [expiryDate, setExpiryDate] = useState("")
  const [calendarOpen, setCalendarOpen] = useState(false)

  const selectedAdvisorId = useWatch({ control: form.control, name: "advisorId" })
  const eligibleLeads = leads.filter((lead) =>
    !["won", "lost"].includes(lead.status) && (!isAdmin || (selectedAdvisorId && lead.advisorId === selectedAdvisorId))
  )

  function generateCode(values: { discountPercent: number; leadId?: string; advisorId?: string; fundingSource?: SalesDiscountFunding }) {
    startTransition(async () => {
      const res = await generateSalesDiscountCode({
        discountPercent: values.discountPercent,
        leadId: values.leadId || undefined,
        advisorId: values.advisorId || undefined,
        fundingSource: isAdmin ? "bakimx_funded" : "advisor_margin",
      })
      if (!res.ok) { toast.error(res.error); return }
      setGeneratedCode({ code: res.code!, discountPercent: res.discountPercent!, expiresAt: res.expiresAt!, fundingSource: res.fundingSource! })
      form.reset({
        discountPercent: 10,
        leadId: "",
        advisorId: "",
        fundingSource: isAdmin ? "bakimx_funded" : "advisor_margin",
      })
      toast.success(`İndirim kodu oluşturuldu: ${res.code}`)
    })
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
    toast.success("Kod kopyalandı!")
  }

  function openExpiryEditor(code: DiscountCode) {
    setEditingCode(code)
    setExpiryDate(format(new Date(code.expiresAt), "yyyy-MM-dd"))
    setCalendarOpen(false)
  }

  function saveExpiry() {
    if (!editingCode) return
    const parsed = salesDiscountCodeUpdateSchema.safeParse({ expiresAt: expiryDate })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Geçerli bir tarih seçin")
      return
    }
    startTransition(async () => {
      const res = await updateSalesDiscountCode(editingCode.id, parsed.data)
      if (!res.ok) { toast.error(res.error); return }
      setEditingCode(null)
      toast.success("İndirim kodunun geçerlilik tarihi güncellendi.")
    })
  }

  function deactivateCode(code: DiscountCode) {
    startTransition(async () => {
      const res = await deactivateSalesDiscountCode(code.id)
      if (!res.ok) { toast.error(res.error); return }
      toast.success("İndirim kodu pasife alındı.")
    })
  }

  return (
    <section className="space-y-4" aria-labelledby="discount-codes-title">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-strong">
          <WalletCards className="size-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-strong">Teklif araçları</p>
          <h2 id="discount-codes-title" className="mt-1 text-xl font-bold text-foreground">İndirim bütçesi</h2>
          <p className="mt-1 text-sm text-muted-foreground">Kodun yüzdesi kadar ekonomik yük, kartta görünen kaynaktan karşılanır.</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-warning/20 bg-warning/10 p-4 text-warning-strong">
          <div className="flex items-center gap-2 font-semibold"><WalletCards className="size-4" /> Danışman bütçeli</div>
          <p className="mt-2 text-sm leading-5">Danışmanın kendi oluşturduğu kod, kendi satış kârlılığından karşılanır ve yalnız kendi portföyünde yönetilir.</p>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-primary-strong">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> BakımX destekli</div>
          <p className="mt-2 text-sm leading-5">BakımX ekibinin tahsis ettiği kodu danışman potansiyel müşterisiyle paylaşır; bütçe ve yönetim platformda kalır.</p>
        </div>
      </div>

      {/* Generate Form */}
      {canManagePipeline && <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Yeni kod tahsisi</h3>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "BakımX bütçesinden bir danışmana özel kod verin." : "Kendi satış marjınızdan müşteriye özel kod oluşturun."}
            </p>
          </div>
          <Badge variant="outline" className={isAdmin ? "bg-primary/10 text-primary-strong" : "bg-warning/10 text-warning-strong"}>
            {isAdmin ? "BakımX destekli" : "Danışman bütçeli"}
          </Badge>
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(generateCode)}
            className={cn(
              "grid gap-3 md:grid-cols-2 xl:items-end",
              isAdmin ? "xl:grid-cols-[10rem_1fr_1fr_auto]" : "xl:grid-cols-[10rem_1fr_auto]",
            )}
          >
            <FormField
              control={form.control}
              name="discountPercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>İndirim (%)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={99} value={String(field.value)} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isAdmin && <FormField
              control={form.control}
              name="advisorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Danışman</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      form.setValue("leadId", "")
                    }}
                  >
                    <SelectTrigger aria-label="Danışman"><SelectValue placeholder="Danışman seçin" /></SelectTrigger>
                    <SelectContent>
                      {advisors.map((advisor) => <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />}
            <FormField
              control={form.control}
              name="leadId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Şirket adayı (opsiyonel)</FormLabel>
                  <Select value={field.value} disabled={isAdmin && !selectedAdvisorId} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Şirket adayı (opsiyonel)">
                      <SelectValue placeholder={isAdmin && !selectedAdvisorId ? "Önce danışman seçin" : "Portföy geneli"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Portföy geneli</SelectItem>
                      {eligibleLeads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>{lead.businessName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={pending}>
              <Gift className="size-4" /> Kod oluştur
            </Button>
          </form>
        </Form>

        {generatedCode && (
          <div className="mt-4 rounded-xl border border-success/20 bg-success/10 p-4 text-success-strong">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Paylaşıma hazır</p>
                <p className="mt-1 text-2xl font-bold tracking-wider">{generatedCode.code}</p>
                <p className="text-sm">
                  %{generatedCode.discountPercent} · {SALES_DISCOUNT_FUNDING_LABELS[generatedCode.fundingSource]} · {formatDate(generatedCode.expiresAt)} tarihine kadar
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyCode(generatedCode.code)}>
                {copiedCode === generatedCode.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>}

      {/* Code List */}
      {discountCodes.length > 0 && (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Kod</th>
                  <th className="px-4 py-2.5 font-medium">İndirim</th>
                  <th className="px-4 py-2.5 font-medium">Bütçe kaynağı</th>
                  <th className="px-4 py-2.5 font-medium">Durum</th>
                  <th className="px-4 py-2.5 font-medium">Tahsis</th>
                  <th className="px-4 py-2.5 font-medium">Oluşturma</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {discountCodes.map((dc) => {
                  const expired = isExpired(dc.expiresAt)
                  const used = dc.usedCount >= dc.maxUses
                  const inactive = Boolean(dc.disabledAt)
                  const active = !inactive && !expired && !used
                  const canManageCode = isAdmin || dc.fundingSource === "advisor_margin"
                  return (
                    <tr key={dc.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-mono font-semibold text-foreground">{dc.code}</td>
                      <td className="px-4 py-2.5">%{dc.discountPercent}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={dc.fundingSource === "bakimx_funded" ? "bg-primary/10 text-primary-strong" : "bg-warning/10 text-warning-strong"}
                        >
                          {SALES_DISCOUNT_FUNDING_LABELS[dc.fundingSource]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        {inactive ? (
                          <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground">Pasif</Badge>
                        ) : used ? (
                          <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground">Kullanıldı</Badge>
                        ) : expired ? (
                          <Badge variant="outline" className="text-[11px] bg-destructive/10 text-destructive-strong">Süresi Doldu</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] bg-success/10 text-success-strong">Aktif</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{dc.advisorName ?? "Atanmamış"}</p>
                        <p className="text-xs text-muted-foreground">{dc.leadName ?? `Oluşturan: ${dc.createdByName ?? "Eski kayıt"}`}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <p>{formatDate(dc.createdAt)}</p>
                        <p className="text-xs">Son: {formatDate(dc.expiresAt)}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        {canManagePipeline && !inactive && !used && (
                          <div className="flex items-center justify-end gap-1">
                            {active && (
                              <Button variant="ghost" size="icon-sm" onClick={() => copyCode(dc.code)} aria-label="Kodu kopyala">
                                {copiedCode === dc.code ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            )}
                            {canManageCode && <>
                              <Button variant="ghost" size="icon-sm" onClick={() => openExpiryEditor(dc)} aria-label="Geçerlilik tarihini düzenle">
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => deactivateCode(dc)} aria-label="Kodu pasife al">
                                <Ban className="h-3 w-3" />
                              </Button>
                            </>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {discountCodes.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
          <Gift className="mx-auto size-7 text-muted-foreground-strong" />
          <p className="mt-2 font-medium text-foreground">Henüz indirim kodu yok</p>
          <p className="mt-1 text-sm text-muted-foreground">İlk kod oluşturulduğunda bütçe kaynağıyla birlikte burada görünür.</p>
        </div>
      )}

      <Dialog open={Boolean(editingCode)} onOpenChange={(open) => !open && setEditingCode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Geçerlilik tarihini düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{editingCode?.code} kodunun son geçerlilik tarihini seçin.</p>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2 font-normal">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  {expiryDate
                    ? format(new Date(`${expiryDate}T00:00:00`), "dd MMMM yyyy", { locale: tr })
                    : "Tarih seçin"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiryDate ? new Date(`${expiryDate}T00:00:00`) : undefined}
                  defaultMonth={expiryDate ? new Date(`${expiryDate}T00:00:00`) : new Date()}
                  disabled={{ before: startOfDay(new Date()) }}
                  captionLayout="dropdown"
                  locale={tr}
                  onSelect={(date) => {
                    if (!date) return
                    setExpiryDate(format(date, "yyyy-MM-dd"))
                    setCalendarOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCode(null)}>Vazgeç</Button>
            <Button onClick={saveExpiry} disabled={pending}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function CommissionRow({
  commission,
  pending,
  startTransition,
}: {
  commission: Commission
  pending: boolean
  startTransition: ReturnType<typeof useTransition>[1]
}) {
  const [amount, setAmount] = useState(commission.amountMinor ? String(commission.amountMinor / 100) : "")
  const [note, setNote] = useState(commission.note ?? "")

  const update = (status: "approved" | "paid" | "void") =>
    startTransition(async () => {
      const lira = Number(amount.replace(",", "."))
      const res = await updateSalesCommission(commission.id, { amountMinor: Math.round(lira * 100), note }, status)
      if (!res.ok) toast.error(res.error)
      else toast.success("Hakediş güncellendi.")
    })

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
      <div className="min-w-48">
        <p className="font-semibold text-foreground">{commission.businessName}</p>
        <p className="text-sm text-muted-foreground">{commission.advisorName} · {commission.status}</p>
      </div>
      <label className="flex-1 text-xs text-muted-foreground">
        Tutar (TL)
        <Input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="flex-1 text-xs text-muted-foreground">
        Not
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={() => update("approved")}>Onayla</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => update("paid")}>Ödendi</Button>
      </div>
    </article>
  )
}
