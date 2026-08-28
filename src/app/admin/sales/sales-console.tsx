"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { format, startOfDay } from "date-fns"
import { tr } from "date-fns/locale"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { SalesTaskAgenda, type AgendaTask } from "@/components/sales/sales-task-agenda"
import { SalesLocationPicker } from "@/components/sales/sales-location-picker"
import { cn } from "@/lib/utils"
import type { SalesPlaceSelection } from "@/lib/sales/google-place"
import { salesLeadAdminHref, salesLeadAnchorId, workshopAdminHref } from "@/lib/sales/links"
import { SALES_DISCOUNT_FUNDING_LABELS, type SalesDiscountFunding } from "@/lib/sales/discount-policy"
import { formatMinor } from "@/lib/billing/pricing"
import type { SalesAdvisorPerformance } from "@/lib/sales/performance"
import { salesLeadSchema, salesDiscountCodeSchema, salesDiscountCodeUpdateSchema } from "@/lib/validations/sales"
import {
  addSalesActivity,
  createSalesLead,
  generateSalesDiscountCode,
  updateSalesDiscountCode,
  deactivateSalesDiscountCode,
  setSalesLeadStatus,
  updateSalesLeadLocation,
} from "./actions"
import { Phone, Mail, MessageSquare, FileText, MapPin, Clock, Users, TrendingUp, CheckCircle2, Gift, Copy, Check, Pencil, Ban, Building2, CalendarDays, Plus, Radar, Target, ArrowUpRight, WalletCards, ShieldCheck, ChartNoAxesCombined } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type Lead = {
  id: string
  businessName: string
  contactName: string
  phone: string
  email: string | null
  city: string | null
  district: string | null
  neighborhood: string | null
  route: string | null
  streetNumber: string | null
  postalCode: string | null
  address: string | null
  formattedAddress: string | null
  googlePlaceId: string | null
  latitude: number | null
  longitude: number | null
  locationSource: "google_place" | "manual_pin" | null
  locationConfirmedAt: string | null
  monthlyVehicles: string | null
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

const SalesTerritoryMap = dynamic(
  () => import("@/components/sales/sales-territory-map").then((module) => module.SalesTerritoryMap),
  {
    ssr: false,
    loading: () => (
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-label="Türkiye saha haritası yükleniyor">
        <div className="p-4 sm:p-5">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-6 w-64 max-w-full animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
        </div>
        <div className="h-80 animate-pulse border-y bg-muted sm:h-[26rem]" />
        <div className="h-14 animate-pulse bg-card" />
      </section>
    ),
  },
)

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
type SalesLeadFormValues = z.infer<typeof salesLeadSchema>

const EMPTY_SALES_LEAD_VALUES: SalesLeadFormValues = {
  placeSearch: "",
  businessName: "",
  contactName: "",
  phone: "",
  email: "",
  city: "",
  district: "",
  neighborhood: "",
  route: "",
  streetNumber: "",
  postalCode: "",
  address: "",
  formattedAddress: "",
  googlePlaceId: "",
  latitude: null,
  longitude: null,
  locationSource: null,
  locationConfirmed: false,
  monthlyVehicles: "",
  notes: "",
  allowDuplicate: false,
}

const statuses = [
  ["new", "Yeni", "bg-primary/10 text-primary-strong border-primary/20"],
  ["contacted", "İletişim", "bg-warning/10 text-warning-strong border-warning/20"],
  ["demo_scheduled", "Demo Planlandı", "bg-muted text-muted-foreground border-border"],
  ["demo_completed", "Demo Yapıldı", "bg-secondary text-secondary-foreground border-border"],
  ["proposal", "Teklif", "bg-accent text-accent-foreground border-border"],
  ["onboarding", "Kayıt Aşamasında", "bg-primary/10 text-primary-strong border-primary/20"],
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
  tasks,
  discountCodes,
  advisors,
  isAdmin,
  canManagePipeline,
  initialLeadId,
  monthlyPerformance,
  googleMapsApiKey,
  googleMapsMapId,
}: {
  leads: Lead[]
  tasks: AgendaTask[]
  discountCodes: DiscountCode[]
  advisors: Advisor[]
  isAdmin: boolean
  canManagePipeline: boolean
  initialLeadId: string | null
  monthlyPerformance: { periodLabel: string; row: SalesAdvisorPerformance } | null
  googleMapsApiKey: string | null
  googleMapsMapId: string | null
}) {
  const [pending, startTransition] = useTransition()
  const form = useForm<SalesLeadFormValues>({
    resolver: zodResolver(salesLeadSchema),
    defaultValues: EMPTY_SALES_LEAD_VALUES,
  })
  const [duplicateWarning, setDuplicateWarning] = useState<{
    duplicates: { id: string; businessName: string; phone: string; email: string | null; matchedBy: ("phone" | "email")[] }[]
  } | null>(null)
  const [activity, setActivity] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [advisorFilter, setAdvisorFilter] = useState<string>("all")
  const [showNewLeadForm, setShowNewLeadForm] = useState(false)
  const [locationLeadId, setLocationLeadId] = useState<string | null>(null)
  const initialLeadStatus = leads.find((lead) => lead.id === initialLeadId)?.status
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeadId)
  const [openStatuses, setOpenStatuses] = useState<string[]>(initialLeadStatus ? [initialLeadStatus] : [])
  const leadFormTriggerRef = useRef<HTMLElement | null>(null)

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

  function focusLead(lead: Pick<Lead, "id" | "status">) {
    setStatusFilter("all")
    setAdvisorFilter("all")
    setSelectedLeadId(lead.id)
    setOpenStatuses((current) => current.includes(lead.status) ? current : [...current, lead.status])
  }

  function submitLead(values: SalesLeadFormValues) {
    startTransition(async () => {
      const res = locationLeadId
        ? await updateSalesLeadLocation(locationLeadId, values)
        : await createSalesLead(values)
      if (!res.ok) {
        if (!locationLeadId && res.code === "duplicate" && res.duplicates) {
          setDuplicateWarning({ duplicates: res.duplicates })
          return
        }
        toast.error(res.error)
        return
      }
      form.reset()
      setDuplicateWarning(null)
      setLocationLeadId(null)
      setShowNewLeadForm(false)
      toast.success(locationLeadId ? "Şirket konumu doğrulandı." : "Servis adayı satış havuzuna eklendi.")
    })
  }

  function startLeadFromPlace(place: SalesPlaceSelection) {
    leadFormTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    form.reset({
      ...EMPTY_SALES_LEAD_VALUES,
      placeSearch: place.businessName,
      businessName: place.businessName,
      city: place.city,
      district: place.district,
      neighborhood: place.neighborhood,
      route: place.route,
      streetNumber: place.streetNumber,
      postalCode: place.postalCode,
      address: [place.neighborhood, [place.route, place.streetNumber].filter(Boolean).join(" No: ")].filter(Boolean).join(", ") || place.formattedAddress,
      formattedAddress: place.formattedAddress,
      googlePlaceId: place.placeId,
      latitude: place.latitude,
      longitude: place.longitude,
      locationSource: "google_place",
      locationConfirmed: false,
    })
    setLocationLeadId(null)
    setDuplicateWarning(null)
    setShowNewLeadForm(true)
  }

  function verifyLeadLocation(lead: Lead) {
    leadFormTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    form.reset({
      ...EMPTY_SALES_LEAD_VALUES,
      placeSearch: lead.businessName,
      businessName: lead.businessName,
      contactName: lead.contactName,
      phone: lead.phone,
      email: lead.email ?? "",
      city: lead.city ?? "",
      district: lead.district ?? "",
      neighborhood: lead.neighborhood ?? "",
      route: lead.route ?? "",
      streetNumber: lead.streetNumber ?? "",
      postalCode: lead.postalCode ?? "",
      address: lead.address ?? "",
      formattedAddress: lead.formattedAddress ?? "",
      googlePlaceId: lead.googlePlaceId ?? "",
      latitude: lead.latitude,
      longitude: lead.longitude,
      locationSource: lead.locationSource,
      locationConfirmed: Boolean(lead.locationConfirmedAt),
      monthlyVehicles: lead.monthlyVehicles ?? "",
      notes: lead.notes ?? "",
    })
    setLocationLeadId(lead.id)
    setDuplicateWarning(null)
    setShowNewLeadForm(true)
  }

  function closeLeadForm() {
    form.reset()
    setDuplicateWarning(null)
    setLocationLeadId(null)
    setShowNewLeadForm(false)
  }

  function markAddressAsManual() {
    const hasCoordinates = form.getValues("latitude") != null && form.getValues("longitude") != null
    form.setValue("googlePlaceId", "", { shouldDirty: true })
    form.setValue("formattedAddress", "", { shouldDirty: true })
    form.setValue("locationSource", hasCoordinates ? "manual_pin" : null, { shouldDirty: true })
    form.setValue("locationConfirmed", false, { shouldDirty: true, shouldValidate: true })
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
          <Button asChild variant="outline">
            <Link href="/admin/sales/performance"><ChartNoAxesCombined className="size-4" /> Performans</Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="outline">
              <Link href="/admin/sales/advisors"><Users className="size-4" /> Danışmanlar</Link>
            </Button>
          )}
          {canManagePipeline && (
            <Button type="button" onClick={(event) => {
              leadFormTriggerRef.current = event.currentTarget
              form.reset()
              setLocationLeadId(null)
              setShowNewLeadForm(true)
            }}>
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

      {monthlyPerformance && <MonthlyTargetProgress performance={monthlyPerformance} />}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SalesTerritoryMap
          leads={leads}
          selectedLeadId={selectedLeadId}
          onSelectLead={focusLead}
          onCreateLeadFromPlace={canManagePipeline ? startLeadFromPlace : undefined}
          apiKey={googleMapsApiKey}
          mapId={googleMapsMapId}
        />
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

      <SalesTaskAgenda canManage={canManagePipeline} tasks={tasks} />

      <Dialog open={showNewLeadForm} onOpenChange={(open) => { if (open) setShowNewLeadForm(true); else closeLeadForm() }}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            leadFormTriggerRef.current?.focus()
            leadFormTriggerRef.current = null
          }}
        >
          <DialogHeader>
            <DialogTitle>{locationLeadId ? "Şirket konumunu doğrula" : "Yeni şirket adayı"}</DialogTitle>
            <DialogDescription>
              {locationLeadId
                ? "Google Maps sonucunu seçin veya pini doğru noktaya taşıyıp konumu doğrulayın."
                : "Sahada görüşülecek servis veya işletmeyi satış portföyüne ekleyin."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form id="new-sales-lead-form" onSubmit={form.handleSubmit(submitLead)} className="grid gap-4 sm:grid-cols-2">
              <SalesLocationPicker apiKey={googleMapsApiKey} mapId={googleMapsMapId} />
              {!locationLeadId && (["businessName", "contactName", "phone", "email", "monthlyVehicles"] as const).map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {({
                            businessName: "Şirket / servis adı",
                            contactName: "Yetkili",
                            phone: "Telefon",
                            email: "E-posta",
                            monthlyVehicles: "Aylık araç hacmi",
                          })[name]}
                        </FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              {(["city", "district", "neighborhood", "route", "streetNumber", "postalCode"] as const).map((name) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem className={name === "route" ? "sm:col-span-2" : undefined}>
                      <FormLabel>
                        {({
                          city: "İl",
                          district: "İlçe",
                          neighborhood: "Mahalle",
                          route: "Cadde / sokak",
                          streetNumber: "Dış kapı no",
                          postalCode: "Posta kodu",
                        })[name]}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(event) => {
                            field.onChange(event)
                            markAddressAsManual()
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Adres özeti / tarif</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={2}
                        onChange={(event) => {
                          field.onChange(event)
                          markAddressAsManual()
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!locationLeadId && <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>İlk izlenim / not</FormLabel>
                    <FormControl><Textarea {...field} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />}
              {!locationLeadId && duplicateWarning && (
                <Alert variant="warning" className="sm:col-span-2">
                  <AlertTitle>Olası mükerrer aday bulundu</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-2">
                      {duplicateWarning.duplicates.map((duplicate) => (
                        <p key={duplicate.id}>
                          <Link href={salesLeadAdminHref(duplicate.id)} className="font-medium underline">
                            {duplicate.businessName}
                          </Link>{" "}
                          ({duplicate.matchedBy.includes("phone") ? "telefon" : ""}
                          {duplicate.matchedBy.length === 2 ? " ve " : ""}
                          {duplicate.matchedBy.includes("email") ? "e-posta" : ""})
                        </p>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </form>
          </Form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeLeadForm}>Vazgeç</Button>
            {!locationLeadId && duplicateWarning && (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => submitLead({ ...form.getValues(), allowDuplicate: true })}
              >
                Yine de ekle
              </Button>
            )}
            <Button type="submit" form="new-sales-lead-form" disabled={pending}>
              {locationLeadId ? "Konumu kaydet" : "Portföye ekle"}
            </Button>
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
                          onVerifyLocation={() => verifyLeadLocation(lead)}
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

function MonthlyTargetProgress({ performance }: {
  performance: { periodLabel: string; row: SalesAdvisorPerformance }
}) {
  const metrics = [
    { label: "Yeni aday", actual: performance.row.actual.newLeads, target: performance.row.target.newLeads },
    { label: "Nitelikli görüşme", actual: performance.row.actual.qualifiedInteractions, target: performance.row.target.qualifiedInteractions },
    { label: "Tamamlanan demo", actual: performance.row.actual.completedDemos, target: performance.row.target.completedDemos },
    { label: "Kazanılan şirket", actual: performance.row.actual.wonWorkshops, target: performance.row.target.wonWorkshops },
  ]
  const salesPercent = performance.row.target.netSalesMinor > 0
    ? Math.min(100, Math.round((performance.row.actual.netSalesMinor / performance.row.target.netSalesMinor) * 100))
    : 0

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="monthly-target-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-strong">{performance.periodLabel}</p>
          <h2 id="monthly-target-title" className="mt-1 text-lg font-semibold text-foreground">Aylık hedef ilerlemeniz</h2>
          <p className="mt-1 text-sm text-muted-foreground">CRM aktiviteleri ve onaylı tahsilat ledger’ı üzerinden güncellenir.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/sales/performance"><ChartNoAxesCombined className="size-4" /> Ayrıntılı performans</Link>
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => {
          const percent = metric.target > 0 ? Math.min(100, Math.round((metric.actual / metric.target) * 100)) : 0
          return (
            <div key={metric.label} className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground-strong">{metric.label}</p>
              <p className="mt-1 font-semibold tabular-nums text-foreground">{metric.actual} / {metric.target || "—"}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-label={`${metric.label} hedef ilerlemesi`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )
        })}
        <div className="rounded-xl bg-primary/10 p-3 text-primary-strong">
          <p className="text-xs">KDV hariç net satış</p>
          <p className="mt-1 font-semibold tabular-nums text-foreground">{formatMinor(performance.row.actual.netSalesMinor)}</p>
          <p className="mt-0.5 text-xs">Hedef {performance.row.target.netSalesMinor > 0 ? formatMinor(performance.row.target.netSalesMinor) : "tanımlanmadı"}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-label="Net satış hedef ilerlemesi" aria-valuenow={salesPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${salesPercent}%` }} />
          </div>
        </div>
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
  onVerifyLocation,
  startTransition,
}: {
  lead: Lead
  isLinked: boolean
  isAdmin: boolean
  canManagePipeline: boolean
  pending: boolean
  activity: string
  onActivityChange: (val: string) => void
  onVerifyLocation: () => void
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
            <Badge
              variant="outline"
              className={lead.locationConfirmedAt
                ? "bg-success/10 text-success-strong border-success/20 text-[11px]"
                : "bg-warning/10 text-warning-strong border-warning/20 text-[11px]"}
            >
              {lead.locationConfirmedAt ? "Konum doğrulandı" : "Konum bekliyor"}
            </Badge>
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
          {canManagePipeline && (
            <Button type="button" variant="outline" size="sm" onClick={onVerifyLocation}>
              <MapPin className="size-4" /> {lead.locationConfirmedAt ? "Konumu güncelle" : "Konumu doğrula"}
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href={salesLeadAdminHref(lead.id)}>Detay</Link>
          </Button>
          {isAdmin && lead.workshopId && (
            <Button asChild variant="outline" size="sm">
              <Link href={workshopAdminHref(lead.workshopId)}>
                <Building2 className="size-4" /> İş yerini aç
              </Link>
            </Button>
          )}
          {canManagePipeline && !["won", "lost"].includes(lead.status) && <Select
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
              {statuses.filter(([value]) => !["won", "lost"].includes(value)).map(([value, label]) => (
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
      {canManagePipeline && lead.status !== "won" && <div className="flex gap-2">
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
