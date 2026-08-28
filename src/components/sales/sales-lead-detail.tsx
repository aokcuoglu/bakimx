/* eslint-disable react-hooks/incompatible-library -- react-hook-form watch values intentionally drive conditional CRM fields. */
"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Copy,
  Link2,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react"
import {
  addSalesActivity,
  assignSalesLead,
  createSalesTask,
  generateSalesRegistrationLink,
  resolveSalesTask,
  setSalesLeadStatus,
} from "@/app/admin/sales/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { salesLeadAdminHref, workshopAdminHref } from "@/lib/sales/links"
import {
  salesActivitySchema,
  salesLeadAssignmentSchema,
  salesLeadStatusSchema,
  salesTaskSchema,
} from "@/lib/validations/sales"
import { z } from "zod"

type ActivityResult = "reached" | "no_answer" | "follow_up_required" | "demo_scheduled" | "proposal_sent" | "won" | "lost"
type ActivityType = "visit" | "phone" | "whatsapp" | "email" | "demo" | "note"
type TaskType = "call" | "visit" | "online_demo" | "follow_up"
type LeadStatus = "new" | "contacted" | "demo_scheduled" | "demo_completed" | "proposal" | "onboarding" | "won" | "lost"

export type SalesLeadDetailData = {
  id: string
  businessName: string
  contactName: string
  phone: string
  email: string | null
  city: string | null
  district: string | null
  address: string | null
  monthlyVehicles: string | null
  notes: string | null
  source: string
  status: LeadStatus
  lostReason: string | null
  nextActionAt: string | null
  attributionFrozenAt: string | null
  workshopId: string | null
  advisorId: string | null
  advisorName: string | null
  createdAt: string
  registrationLink: {
    state: "active" | "expired" | "revoked" | "used"
    expiresAt: string
    createdAt: string
  } | null
  tasks: {
    id: string
    type: TaskType
    startsAt: string
    durationMinutes: number
    status: "scheduled" | "completed" | "cancelled" | "no_show"
    note: string | null
    resolvedAt: string | null
    completedByActivityId: string | null
    createdByName: string
  }[]
  assignments: {
    id: string
    fromAdvisorName: string | null
    toAdvisorName: string | null
    actorName: string
    createdAt: string
  }[]
  activities: {
    id: string
    type: ActivityType
    result: ActivityResult | null
    summary: string
    lostReason: string | null
    occurredAt: string
    nextActionAt: string | null
    createdByName: string
  }[]
}

const STATUS_OPTIONS: readonly [LeadStatus, string][] = [
  ["new", "Yeni"],
  ["contacted", "İletişim"],
  ["demo_scheduled", "Demo planlandı"],
  ["demo_completed", "Demo yapıldı"],
  ["proposal", "Teklif"],
  ["onboarding", "Kayıt aşamasında"],
]

const ACTIVITY_TYPES: readonly [ActivityType, string][] = [
  ["phone", "Telefon"],
  ["whatsapp", "WhatsApp"],
  ["email", "E-posta"],
  ["visit", "Ziyaret"],
  ["demo", "Demo"],
  ["note", "Not"],
]

const ACTIVITY_RESULTS: readonly [ActivityResult, string][] = [
  ["reached", "Ulaşıldı"],
  ["no_answer", "Cevap yok"],
  ["follow_up_required", "Takip gerekli"],
  ["demo_scheduled", "Demo planlandı"],
  ["proposal_sent", "Teklif iletildi"],
  ["won", "Kazanıldı"],
  ["lost", "Kaybedildi"],
]

const TASK_TYPES: readonly [TaskType, string][] = [
  ["call", "Arama"],
  ["visit", "Ziyaret"],
  ["online_demo", "Online demo"],
  ["follow_up", "Takip"],
]

const TASK_STATUS_LABELS = {
  scheduled: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  no_show: "Gelmedi",
} as const

const stageFormSchema = z.object({ status: salesLeadStatusSchema })

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function toIso(value: string | undefined): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function labelFor<T extends string>(options: readonly (readonly [T, string])[], value: T | null): string {
  return options.find(([key]) => key === value)?.[1] ?? "—"
}

export function SalesLeadDetail({
  lead,
  advisors,
  canManage,
  isAdmin,
  initialTaskId,
  activityPage,
  activityPages,
}: {
  lead: SalesLeadDetailData
  advisors: { id: string; name: string }[]
  canManage: boolean
  isAdmin: boolean
  initialTaskId: string | null
  activityPage: number
  activityPages: number
}) {
  const [pending, startTransition] = useTransition()
  const [generatedRegistrationUrl, setGeneratedRegistrationUrl] = useState<string | null>(null)
  const assignmentForm = useForm<{ advisorId: string | null }>({
    resolver: zodResolver(salesLeadAssignmentSchema),
    defaultValues: { advisorId: lead.advisorId },
  })
  const stageForm = useForm<{ status: LeadStatus }>({
    resolver: zodResolver(stageFormSchema),
    defaultValues: { status: lead.status },
  })
  const activityForm = useForm<{
    type: ActivityType
    result?: ActivityResult
    summary: string
    occurredAt?: string
    nextActionAt?: string
    nextTaskType?: TaskType
    nextTaskDurationMinutes?: number
    lostReason?: string
    taskId?: string
  }>({
    resolver: zodResolver(salesActivitySchema),
    defaultValues: {
      type: "phone",
      result: undefined,
      summary: "",
      occurredAt: localDateTimeValue(),
      nextActionAt: "",
      nextTaskType: "follow_up",
      nextTaskDurationMinutes: 30,
      lostReason: "",
      taskId: initialTaskId ?? undefined,
    },
  })
  const taskForm = useForm<{
    type: TaskType
    startsAt: string
    durationMinutes: number
    note: string
  }>({
    resolver: zodResolver(salesTaskSchema),
    defaultValues: {
      type: "call",
      startsAt: localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)),
      durationMinutes: 30,
      note: "",
    },
  })

  const activityType = activityForm.watch("type")
  const activityResult = activityForm.watch("result")
  const nextActionAt = activityForm.watch("nextActionAt")
  const selectedTaskId = activityForm.watch("taskId")

  useEffect(() => {
    if (!initialTaskId) return
    const frame = requestAnimationFrame(() => document.getElementById("activity-form")?.scrollIntoView({ block: "start" }))
    return () => cancelAnimationFrame(frame)
  }, [initialTaskId])

  useEffect(() => {
    assignmentForm.reset({ advisorId: lead.advisorId })
  }, [assignmentForm, lead.advisorId])

  useEffect(() => {
    stageForm.reset({ status: lead.status })
  }, [lead.status, stageForm])

  useEffect(() => {
    if (activityType === "note") activityForm.setValue("result", undefined)
  }, [activityForm, activityType])

  useEffect(() => {
    if (activityResult === "demo_scheduled") {
      activityForm.setValue("nextTaskType", "online_demo")
      activityForm.setValue("nextTaskDurationMinutes", 60)
    } else if (activityResult === "follow_up_required") {
      activityForm.setValue("nextTaskType", "follow_up")
      activityForm.setValue("nextTaskDurationMinutes", 30)
    } else if (activityResult === "won" || activityResult === "lost") {
      activityForm.setValue("nextActionAt", "")
    }
  }, [activityForm, activityResult])

  function selectTaskForCompletion(taskId: string) {
    activityForm.setValue("taskId", taskId)
    document.getElementById("activity-form")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="link" className="mb-1 h-auto p-0 text-muted-foreground">
          <Link href="/admin/sales/leads"><ArrowLeft className="size-4" /> Satış adayları</Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">{lead.businessName}</h1>
              <Badge variant={lead.status === "lost" ? "destructive" : "outline"} className={lead.status === "won" ? "border-success/20 bg-success/10 text-success-strong" : undefined}>
                {lead.status === "won" ? "Kazanıldı" : lead.status === "lost" ? "Kaybedildi" : STATUS_OPTIONS.find(([key]) => key === lead.status)?.[1] ?? lead.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{lead.advisorName ?? "Atanmamış"} · {formatDate(lead.createdAt)}</p>
          </div>
          {isAdmin && lead.workshopId && <Button asChild variant="outline"><Link href={workshopAdminHref(lead.workshopId)}>İş yerini aç</Link></Button>}
        </div>
      </div>

      {lead.attributionFrozenAt && (
        <Alert variant="success"><CheckCircle2 /><AlertTitle>Danışman atfı donduruldu</AlertTitle><AlertDescription>{formatDate(lead.attributionFrozenAt)} tarihindeki kazanımdan sonra atama değiştirilemez.</AlertDescription></Alert>
      )}
      {lead.status === "lost" && lead.lostReason && (
        <Alert variant="destructive"><AlertTitle>Kaybetme nedeni</AlertTitle><AlertDescription>{lead.lostReason}</AlertDescription></Alert>
      )}

      <section className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">Yetkili</p><p className="mt-1 flex items-center gap-1 text-sm text-foreground"><UserRound className="size-4" />{lead.contactName}</p></div>
        <div><p className="text-xs text-muted-foreground">Telefon</p><p className="mt-1 flex items-center gap-1 text-sm text-foreground"><Phone className="size-4" />{lead.phone}</p></div>
        <div><p className="text-xs text-muted-foreground">E-posta</p><p className="mt-1 flex items-center gap-1 text-sm text-foreground"><Mail className="size-4" />{lead.email ?? "—"}</p></div>
        <div><p className="text-xs text-muted-foreground">Konum</p><p className="mt-1 flex items-center gap-1 text-sm text-foreground"><MapPin className="size-4" />{[lead.address, lead.district, lead.city].filter(Boolean).join(", ") || "—"}</p></div>
        <div><p className="text-xs text-muted-foreground">Aylık araç hacmi</p><p className="mt-1 text-sm text-foreground">{lead.monthlyVehicles ?? "—"}</p></div>
        <div><p className="text-xs text-muted-foreground">Sonraki aksiyon</p><p className="mt-1 flex items-center gap-1 text-sm text-foreground"><CalendarClock className="size-4" />{lead.nextActionAt ? formatDate(lead.nextActionAt) : "—"}</p></div>
        {lead.notes && <div className="md:col-span-2 xl:col-span-3"><p className="text-xs text-muted-foreground">İlk not</p><p className="mt-1 text-sm text-foreground">{lead.notes}</p></div>}
      </section>

      {!lead.workshopId && canManage && lead.status !== "lost" && !lead.attributionFrozenAt && (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-foreground"><Link2 className="size-4" /> Güvenli müşteri kaydı</h2>
              <p className="mt-1 text-sm text-muted-foreground">Müşteri firma ve hesap bilgilerini kendisi tamamlar; iş yeri, owner ve danışman atfı birlikte oluşturulur.</p>
            </div>
            {lead.registrationLink && (
              <Badge variant={lead.registrationLink.state === "active" ? "secondary" : "outline"}>
                {lead.registrationLink.state === "active" ? "Aktif" : lead.registrationLink.state === "expired" ? "Süresi doldu" : lead.registrationLink.state === "used" ? "Kullanıldı" : "İptal edildi"}
              </Badge>
            )}
          </div>
          {!lead.advisorId ? (
            <Alert variant="warning" className="mt-4"><AlertTitle>Önce danışman atayın</AlertTitle><AlertDescription>Kayıt bağlantısı, doğrulanmış danışman atfını sunucuda taşıdığı için atanmamış adayda üretilemez.</AlertDescription></Alert>
          ) : (
            <div className="mt-4 space-y-3">
              {lead.registrationLink?.state === "active" && !generatedRegistrationUrl && (
                <p className="text-xs text-muted-foreground">Aktif bağlantının ham token’ı güvenlik gereği veritabanında tutulmaz. Yeni bağlantı üretmek mevcut bağlantıyı iptal eder.</p>
              )}
              {generatedRegistrationUrl && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input readOnly value={generatedRegistrationUrl} aria-label="Müşteri kayıt bağlantısı" className="font-mono text-xs" />
                  <Button type="button" variant="outline" onClick={async () => {
                    await navigator.clipboard.writeText(generatedRegistrationUrl)
                    toast.success("Kayıt bağlantısı kopyalandı.")
                  }}><Copy className="size-4" /> Kopyala</Button>
                </div>
              )}
              <Button type="button" disabled={pending} onClick={() => startTransition(async () => {
                const result = await generateSalesRegistrationLink(lead.id)
                if (!result.ok) {
                  toast.error(result.error)
                  return
                }
                if (!result.registrationPath) {
                  toast.error("Kayıt bağlantısı oluşturulamadı.")
                  return
                }
                const url = new URL(result.registrationPath, window.location.origin).toString()
                setGeneratedRegistrationUrl(url)
                await navigator.clipboard.writeText(url).catch(() => undefined)
                toast.success("Kayıt bağlantısı oluşturuldu ve panoya kopyalandı.")
              })}>
                <Link2 className="size-4" />
                {lead.registrationLink?.state === "active" ? "Bağlantıyı yenile" : "Kayıt bağlantısı oluştur"}
              </Button>
            </div>
          )}
        </section>
      )}

      {canManage && !lead.attributionFrozenAt && (
        <div className="grid gap-4 lg:grid-cols-2">
          {isAdmin && (
            <section className="rounded-xl border bg-card p-4">
              <h2 className="font-semibold text-foreground">Danışman ataması</h2>
              <Form {...assignmentForm}>
                <form
                  className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
                  onSubmit={assignmentForm.handleSubmit((values) => startTransition(async () => {
                    const result = await assignSalesLead(lead.id, values)
                    if (!result.ok) toast.error(result.error)
                    else toast.success("Danışman ataması güncellendi.")
                  }))}
                >
                  <FormField control={assignmentForm.control} name="advisorId" render={({ field }) => (
                    <FormItem className="flex-1"><FormLabel>Danışman</FormLabel><Select value={field.value ?? ""} onValueChange={(value) => field.onChange(value || null)}><FormControl><SelectTrigger><SelectValue placeholder="Atanmamış" /></SelectTrigger></FormControl><SelectContent><SelectItem value="">Atanmamış havuz</SelectItem>{advisors.map((advisor) => <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" disabled={pending}>Ata / devret</Button>
                </form>
              </Form>
            </section>
          )}

          <section className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold text-foreground">Huni aşaması</h2>
            <p className="text-xs text-muted-foreground">Kazanım ve kayıp görüşme sonucundan kaydedilir.</p>
            <Form {...stageForm}>
              <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={stageForm.handleSubmit((values) => startTransition(async () => {
                const result = await setSalesLeadStatus(lead.id, values.status)
                if (!result.ok) toast.error(result.error)
                else toast.success("Satış aşaması güncellendi.")
              }))}>
                <FormField control={stageForm.control} name="status" render={({ field }) => (
                  <FormItem className="flex-1"><FormLabel>Aşama</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{STATUS_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value} disabled={value === "onboarding"}>{label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <Button type="submit" disabled={pending}>Güncelle</Button>
              </form>
            </Form>
          </section>
        </div>
      )}

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-foreground">Satış görevleri</h2><p className="text-sm text-muted-foreground">Arama, ziyaret, online demo ve takip ajandası.</p></div><Badge variant="secondary">{lead.tasks.length}</Badge></div>
        {lead.tasks.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Henüz görev yok.</p> : (
          <div className="space-y-2">
            {lead.tasks.map((task) => (
              <article key={task.id} className="rounded-lg border bg-background p-3">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium text-foreground">{labelFor(TASK_TYPES, task.type)}</p><p className="text-xs text-muted-foreground">{formatDate(task.startsAt)} · {task.durationMinutes} dk · {task.createdByName}</p></div><Badge variant={task.status === "no_show" ? "destructive" : "outline"}>{TASK_STATUS_LABELS[task.status]}</Badge></div>
                {task.note && <p className="mt-2 text-sm text-foreground">{task.note}</p>}
                {canManage && task.status === "scheduled" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => selectTaskForCompletion(task.id)}>Görüşmeyle tamamla</Button>
                    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await resolveSalesTask(task.id, "no_show"); if (!result.ok) toast.error(result.error); else toast.success("Görev gelmedi olarak işaretlendi.") })}>Gelmedi</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { const result = await resolveSalesTask(task.id, "cancelled"); if (!result.ok) toast.error(result.error); else toast.success("Görev iptal edildi.") })}>İptal</Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {canManage && !lead.attributionFrozenAt && (
          <Form {...taskForm}>
            <form className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={taskForm.handleSubmit((values) => startTransition(async () => {
              const result = await createSalesTask(lead.id, { ...values, startsAt: toIso(values.startsAt) })
              if (!result.ok) toast.error(result.error)
              else { toast.success("Görev planlandı."); taskForm.reset({ type: "call", startsAt: localDateTimeValue(new Date(Date.now() + 60 * 60 * 1000)), durationMinutes: 30, note: "" }) }
            }))}>
              <FormField control={taskForm.control} name="type" render={({ field }) => <FormItem><FormLabel>Görev türü</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{TASK_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
              <FormField control={taskForm.control} name="startsAt" render={({ field }) => <FormItem><FormLabel>Başlangıç</FormLabel><FormControl><Input {...field} type="datetime-local" /></FormControl><FormMessage /></FormItem>} />
              <FormField control={taskForm.control} name="durationMinutes" render={({ field }) => <FormItem><FormLabel>Süre (dk)</FormLabel><FormControl><Input {...field} type="number" min={5} max={480} step={5} onChange={(event) => field.onChange(event.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={taskForm.control} name="note" render={({ field }) => <FormItem><FormLabel>Not</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" disabled={pending}>Görev ekle</Button></div>
            </form>
          </Form>
        )}
      </section>

      {canManage && !lead.attributionFrozenAt && (
        <section id="activity-form" className="scroll-m-24 rounded-xl border bg-card p-4">
          <h2 className="font-semibold text-foreground">Görüşme sonucu ekle</h2>
          {selectedTaskId && <Alert variant="info" className="mt-3"><Clock3 /><AlertTitle>Görev tamamlanacak</AlertTitle><AlertDescription>Bu görüşme seçili görevi tamamlayacak. <Button type="button" variant="link" className="h-auto p-0" onClick={() => activityForm.setValue("taskId", undefined)}>Görev bağını kaldır</Button></AlertDescription></Alert>}
          <Form {...activityForm}>
            <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={activityForm.handleSubmit((values) => startTransition(async () => {
              const result = await addSalesActivity(lead.id, { ...values, occurredAt: toIso(values.occurredAt), nextActionAt: toIso(values.nextActionAt) })
              if (!result.ok) toast.error(result.error)
              else { toast.success("Görüşme ve bağlı görevler kaydedildi."); activityForm.reset({ type: "phone", result: undefined, summary: "", occurredAt: localDateTimeValue(), nextActionAt: "", nextTaskType: "follow_up", nextTaskDurationMinutes: 30, lostReason: "", taskId: undefined }) }
            }))}>
              <FormField control={activityForm.control} name="type" render={({ field }) => <FormItem><FormLabel>Görüşme türü</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{ACTIVITY_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
              {activityType !== "note" && <FormField control={activityForm.control} name="result" render={({ field }) => <FormItem><FormLabel>Sonuç</FormLabel><Select value={field.value ?? ""} onValueChange={(value) => field.onChange(value || undefined)}><FormControl><SelectTrigger><SelectValue placeholder="Sonuç seçin" /></SelectTrigger></FormControl><SelectContent>{ACTIVITY_RESULTS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />}
              <FormField control={activityForm.control} name="occurredAt" render={({ field }) => <FormItem><FormLabel>Görüşme zamanı</FormLabel><FormControl><Input {...field} type="datetime-local" /></FormControl><FormMessage /></FormItem>} />
              <FormField control={activityForm.control} name="nextActionAt" render={({ field }) => <FormItem><FormLabel>Sonraki aksiyon</FormLabel><FormControl><Input {...field} type="datetime-local" /></FormControl><FormMessage /></FormItem>} />
              <FormField control={activityForm.control} name="summary" render={({ field }) => <FormItem className="sm:col-span-2 lg:col-span-4"><FormLabel>Görüşme özeti</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>} />
              {activityResult === "lost" && <FormField control={activityForm.control} name="lostReason" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Kaybetme nedeni</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl><FormMessage /></FormItem>} />}
              {nextActionAt && <>
                <FormField control={activityForm.control} name="nextTaskType" render={({ field }) => <FormItem><FormLabel>Sonraki görev türü</FormLabel><Select value={field.value ?? "follow_up"} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{TASK_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                <FormField control={activityForm.control} name="nextTaskDurationMinutes" render={({ field }) => <FormItem><FormLabel>Sonraki görev süresi</FormLabel><FormControl><Input {...field} type="number" min={5} max={480} step={5} onChange={(event) => field.onChange(event.target.valueAsNumber)} /></FormControl><FormMessage /></FormItem>} />
              </>}
              <div className="sm:col-span-2 lg:col-span-4"><Button type="submit" disabled={pending}>Görüşmeyi kaydet</Button></div>
            </form>
          </Form>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-3 rounded-xl border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-foreground">Tüm görüşmeler</h2><p className="text-sm text-muted-foreground">Sayfa {activityPage} / {activityPages}</p></div></div>
          {lead.activities.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Henüz görüşme yok.</p> : lead.activities.map((activity) => (
            <article key={activity.id} className="rounded-lg border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{labelFor(ACTIVITY_TYPES, activity.type)}</Badge>{activity.result && <Badge variant={activity.result === "lost" ? "destructive" : "secondary"}>{labelFor(ACTIVITY_RESULTS, activity.result)}</Badge>}</div><span className="text-xs text-muted-foreground">{formatDate(activity.occurredAt)}</span></div>
              <p className="mt-2 text-sm text-foreground">{activity.summary}</p>
              {activity.lostReason && <p className="mt-1 text-sm text-destructive-strong">Neden: {activity.lostReason}</p>}
              <p className="mt-2 text-xs text-muted-foreground">{activity.createdByName}{activity.nextActionAt ? ` · Sonraki aksiyon: ${formatDate(activity.nextActionAt)}` : ""}</p>
            </article>
          ))}
          <div className="flex items-center justify-between gap-2 border-t pt-3">
            {activityPage <= 1
              ? <Button type="button" variant="outline" size="sm" disabled>Önceki</Button>
              : <Button asChild variant="outline" size="sm"><Link href={`${salesLeadAdminHref(lead.id)}?page=${activityPage - 1}`}>Önceki</Link></Button>}
            {activityPage >= activityPages
              ? <Button type="button" variant="outline" size="sm" disabled>Sonraki</Button>
              : <Button asChild variant="outline" size="sm"><Link href={`${salesLeadAdminHref(lead.id)}?page=${activityPage + 1}`}>Sonraki</Link></Button>}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="font-semibold text-foreground">Atama geçmişi</h2>
          {lead.assignments.length === 0 ? <p className="text-sm text-muted-foreground">Henüz atama kaydı yok.</p> : lead.assignments.map((assignment) => (
            <article key={assignment.id} className="border-b pb-3 last:border-0 last:pb-0">
              <p className="text-sm text-foreground">{assignment.fromAdvisorName ?? "Atanmamış"} → {assignment.toAdvisorName ?? "Atanmamış"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{assignment.actorName} · {formatDate(assignment.createdAt)}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
