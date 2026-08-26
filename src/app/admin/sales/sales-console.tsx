"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { format, startOfDay } from "date-fns"
import { tr } from "date-fns/locale"
import { useForm } from "react-hook-form"
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
import { Phone, Mail, MessageSquare, FileText, MapPin, Clock, Users, TrendingUp, CheckCircle2, Gift, Copy, Check, Pencil, Ban, Building2, CalendarDays } from "lucide-react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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
  usedCount: number
  maxUses: number
  expiresAt: string
  disabledAt: string | null
  usedAt: string | null
  createdAt: string
  leadName: string | null
  advisorName: string | null
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
  initialLeadId,
}: {
  leads: Lead[]
  commissions: Commission[]
  discountCodes: DiscountCode[]
  advisors: Advisor[]
  isAdmin: boolean
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

  useEffect(() => {
    if (!initialLeadId) return
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(salesLeadAnchorId(initialLeadId))
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      target?.scrollIntoView({ behavior, block: "center" })
    })
    return () => cancelAnimationFrame(frame)
  }, [initialLeadId])

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
    const lost = leads.filter((l) => l.status === "lost").length
    const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0
    return { total, won, active, lost, conversionRate }
  }, [leads])

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
    <div className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Toplam Aday", value: stats.total, icon: Users, color: "text-foreground" },
          { label: "Aktif Aday", value: stats.active, icon: TrendingUp, color: "text-primary-strong" },
          { label: "Kazanılan", value: stats.won, icon: CheckCircle2, color: "text-success-strong" },
          { label: "Dönüşüm", value: `%${stats.conversionRate}`, icon: TrendingUp, color: "text-primary-strong" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* New Lead Form */}
      <section className="rounded-xl border bg-card">
        <Button
          type="button"
          onClick={() => setShowNewLeadForm(!showNewLeadForm)}
          variant="ghost"
          className="flex h-auto w-full items-center justify-between p-4 text-left"
        >
          <div>
            <h2 className="font-semibold text-foreground">Yeni Servis Adayı</h2>
            <p className="text-sm text-muted-foreground">Satış havuzuna yeni bir aday ekleyin.</p>
          </div>
          <span className="text-muted-foreground">{showNewLeadForm ? "−" : "+"}</span>
        </Button>
        {showNewLeadForm && (
          <div className="border-t px-4 pb-4 pt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(submitLead)} className="grid gap-3 sm:grid-cols-2">
                {(["businessName", "contactName", "phone", "email", "city"] as const).map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {({ businessName: "Servis Adı", contactName: "Yetkili", phone: "Telefon", email: "E-posta", city: "Şehir" })[name]}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
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
                      <FormLabel>Not</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={pending}>Kaydet</Button>
                  <Button type="button" variant="ghost" onClick={() => { form.reset(); setShowNewLeadForm(false) }}>Vazgeç</Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </section>

      {/* Sales Pool */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Satış Havuzu</h2>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Tüm danışmanların adayları." : "Size atanmış servis adayları."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
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
                <SelectTrigger className="w-[160px]">
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
            defaultValue={initialLeadStatus ? [initialLeadStatus] : []}
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
                          isLinked={lead.id === initialLeadId}
                          isAdmin={isAdmin}
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
        isAdmin={isAdmin}
        pending={pending}
        startTransition={startTransition}
      />

      {/* Commission Queue */}
      {isAdmin && commissions.length > 0 && (
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

function LeadCard({
  lead,
  isLinked,
  isAdmin,
  pending,
  activity,
  onActivityChange,
  startTransition,
}: {
  lead: Lead
  isLinked: boolean
  isAdmin: boolean
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
          <Select
            value={lead.status}
            disabled={pending}
            onValueChange={(status) =>
              startTransition(async () => {
                const res = await setSalesLeadStatus(lead.id, status)
                if (!res.ok) toast.error(res.error)
              })
            }
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      <div className="flex gap-2">
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
      </div>

      {/* Admin Actions */}
      {isAdmin && lead.status !== "won" && (
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
  isAdmin: _isAdmin,
  pending,
  startTransition,
}: {
  discountCodes: DiscountCode[]
  leads: Lead[]
  isAdmin: boolean
  pending: boolean
  startTransition: ReturnType<typeof useTransition>[1]
}) {
  const form = useForm({
    resolver: zodResolver(salesDiscountCodeSchema),
    defaultValues: { discountPercent: 10, leadId: "" },
  })
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [generatedCode, setGeneratedCode] = useState<{ code: string; discountPercent: number; expiresAt: string } | null>(null)
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null)
  const [expiryDate, setExpiryDate] = useState("")
  const [calendarOpen, setCalendarOpen] = useState(false)

  function generateCode(values: { discountPercent: number; leadId?: string }) {
    startTransition(async () => {
      const res = await generateSalesDiscountCode({
        discountPercent: values.discountPercent,
        leadId: values.leadId || undefined,
      })
      if (!res.ok) { toast.error(res.error); return }
      setGeneratedCode({ code: res.code!, discountPercent: res.discountPercent!, expiresAt: res.expiresAt! })
      form.reset({ discountPercent: 10, leadId: "" })
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
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">İndirim Kodları</h2>
        <p className="text-sm text-muted-foreground">Müşterileriniz için 7 gün geçerli indirim kodları oluşturun.</p>
      </div>

      {/* Generate Form */}
      <div className="rounded-xl border bg-card p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(generateCode)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <FormField
              control={form.control}
              name="discountPercent"
              render={({ field }) => (
                <FormItem className="w-full sm:w-40">
                  <FormLabel>İndirim (%)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={99} value={String(field.value)} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="leadId"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Aday (Opsiyonel)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Genel kod" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Genel Kod</SelectItem>
                      {leads.filter((l) => !["won", "lost"].includes(l.status)).map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>{lead.businessName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={pending}>
              <Gift className="mr-1 h-4 w-4" />
              Kod Oluştur
            </Button>
          </form>
        </Form>

        {generatedCode && (
          <div className="mt-4 rounded-lg border border-success/20 bg-success/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-success-strong">Oluşturulan Kod</p>
                <p className="mt-1 text-2xl font-bold tracking-wider text-success-strong">{generatedCode.code}</p>
                <p className="text-sm text-success-strong">
                  %{generatedCode.discountPercent} indirim · Geçerlilik: {formatDate(generatedCode.expiresAt)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyCode(generatedCode.code)}>
                {copiedCode === generatedCode.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Code List */}
      {discountCodes.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Kod</th>
                  <th className="px-4 py-2.5 font-medium">İndirim</th>
                  <th className="px-4 py-2.5 font-medium">Durum</th>
                  <th className="px-4 py-2.5 font-medium">Oluşturan</th>
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
                  return (
                    <tr key={dc.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-mono font-semibold text-foreground">{dc.code}</td>
                      <td className="px-4 py-2.5">%{dc.discountPercent}</td>
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
                      <td className="px-4 py-2.5 text-muted-foreground">{dc.advisorName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatDate(dc.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        {!inactive && !used && (
                          <div className="flex items-center justify-end gap-1">
                            {active && (
                              <Button variant="ghost" size="icon-sm" onClick={() => copyCode(dc.code)} aria-label="Kodu kopyala">
                                {copiedCode === dc.code ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </Button>
                            )}
                            <Button variant="ghost" size="icon-sm" onClick={() => openExpiryEditor(dc)} aria-label="Geçerlilik tarihini düzenle">
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => deactivateCode(dc)} aria-label="Kodu pasife al">
                              <Ban className="h-3 w-3" />
                            </Button>
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
