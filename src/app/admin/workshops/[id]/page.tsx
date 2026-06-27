import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { getPlanState, getSeatLimit, type PlanTier } from "@/lib/plan"
import { getEffectiveFeatures } from "@/lib/features"
import { formatMinor } from "@/lib/billing/pricing"
import { cn } from "@/lib/utils"
import { WorkshopActions } from "@/app/admin/workshop-actions"
import { WorkshopFlags } from "@/app/admin/workshop-flags"
import { ImpersonateButton } from "@/app/admin/impersonate-button"

export const dynamic = "force-dynamic"

const TIER_LABELS: Record<string, string> = { starter: "Başlangıç", pro: "Profesyonel", premium: "Premium" }
const CYCLE_LABELS: Record<string, string> = { monthly: "Aylık", yearly: "Yıllık" }
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Ödeme bekliyor",
  confirmed: "Teyit edildi",
  cancelled: "İptal",
}
const ACTION_LABELS: Record<string, string> = {
  admin_workshop_approved: "İş yeri onaylandı",
  admin_workshop_rejected: "İş yeri reddedildi",
  admin_plan_activated: "Plan etkinleştirildi",
  admin_extra_seats_set: "Ek koltuk ayarlandı",
  billing_order_confirmed: "Havale teyit edildi",
  billing_order_cancelled: "Sipariş iptal edildi",
}
const ROLE_LABELS: Record<string, string> = { owner: "Sahip", manager: "Yönetici", staff: "Personel" }

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", className)}>
      {children}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value || "—"}</span>
    </div>
  )
}

export default async function WorkshopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const workshop = await prisma.workshop.findUnique({
    where: { id },
    include: { users: { orderBy: { createdAt: "asc" } } },
  })
  if (!workshop) notFound()

  const [customerCount, vehicleCount, orderCount, appointmentCount, orders, auditLogs, commLogs, reminderLogs, syncLogs, features] =
    await Promise.all([
      prisma.customer.count({ where: { workshopId: id } }),
      prisma.vehicle.count({ where: { workshopId: id } }),
      prisma.serviceOrder.count({ where: { workshopId: id } }),
      prisma.appointment.count({ where: { workshopId: id } }),
      prisma.billingOrder.findMany({ where: { workshopId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.auditLog.findMany({
        where: { workshopId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { actorUser: { select: { email: true } } },
      }),
      prisma.communicationLog.findMany({ where: { workshopId: id }, orderBy: { sentAt: "desc" }, take: 10 }),
      prisma.reminderExecutionLog.findMany({ where: { workshopId: id }, orderBy: { executedAt: "desc" }, take: 5 }),
      prisma.calendarSyncLog.findMany({ where: { workshopId: id }, orderBy: { syncedAt: "desc" }, take: 5 }),
      getEffectiveFeatures(id, workshop.planTier as PlanTier),
    ])

  const flagRows = features.map((f) => ({
    key: f.key,
    label: f.label,
    tierGrants: f.tierGrants,
    effective: f.effective,
    override: f.override
      ? { enabled: f.override.enabled, expiresAt: f.override.expiresAt?.toISOString() ?? null, reason: f.override.reason }
      : null,
  }))

  const plan = getPlanState(workshop)
  const activeUsers = workshop.users.filter((u) => u.isActive).length
  const seatLimit = getSeatLimit(workshop.planTier as PlanTier, workshop.extraSeats)
  const ownerEmail = workshop.users.find((u) => u.role === "owner")?.email ?? workshop.users[0]?.email ?? null

  const APPROVAL_BADGE: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-rose-100 text-rose-800",
  }
  const SUB_BADGE: Record<string, string> = {
    trialing: "bg-blue-100 text-blue-800",
    active: "bg-emerald-100 text-emerald-800",
    past_due: "bg-amber-100 text-amber-800",
    canceled: "bg-muted text-muted-foreground",
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/workshops" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> İş yerleri
      </Link>

      {/* Header */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{workshop.name}</h1>
              <Badge className={APPROVAL_BADGE[workshop.approvalStatus] ?? "bg-muted"}>{workshop.approvalStatus}</Badge>
              <Badge className={SUB_BADGE[workshop.subscriptionStatus] ?? "bg-muted"}>{workshop.subscriptionStatus}</Badge>
              <Badge className="bg-muted text-muted-foreground">{TIER_LABELS[workshop.planTier] ?? workshop.planTier}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {[workshop.city, workshop.district].filter(Boolean).join(" / ")}
              {ownerEmail && <span> · {ownerEmail}</span>}
            </p>
            {plan.isTrialing && plan.trialDaysLeft != null && (
              <p className="text-sm text-blue-700 mt-1">Deneme: {plan.trialDaysLeft} gün kaldı</p>
            )}
            {plan.subscriptionDaysLeft != null && (
              <p className={cn("text-sm mt-1", plan.subscriptionDaysLeft <= 7 ? "text-amber-600" : "text-muted-foreground")}>
                Abonelik: {plan.subscriptionDaysLeft} gün kaldı
              </p>
            )}
          </div>
          <div className="shrink-0">
            <ImpersonateButton workshopId={workshop.id} />
          </div>
        </div>
        <WorkshopActions
          w={{
            id: workshop.id,
            approvalStatus: workshop.approvalStatus,
            requestedPlanTier: workshop.requestedPlanTier,
            extraSeats: workshop.extraSeats,
          }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Abonelik & Fatura">
          <Field label="Paket" value={TIER_LABELS[workshop.planTier] ?? workshop.planTier} />
          <Field label="Döngü" value={workshop.billingCycle ? CYCLE_LABELS[workshop.billingCycle] : null} />
          <Field
            label="Dönem bitişi"
            value={workshop.currentPeriodEnd ? workshop.currentPeriodEnd.toLocaleDateString("tr-TR") : null}
          />
          <Field
            label="Talep edilen paket"
            value={workshop.requestedPlanTier ? TIER_LABELS[workshop.requestedPlanTier] : null}
          />
          <Field label="Fatura ünvanı" value={workshop.invoiceTitle} />
          <Field label="VKN" value={workshop.taxNumber} />
        </Section>

        <Section title="Ekip & Koltuk">
          <Field label="Aktif kullanıcı" value={`${activeUsers} / ${seatLimit}`} />
          <Field label="Ek koltuk" value={String(workshop.extraSeats)} />
          <div className="pt-1 space-y-1.5">
            {workshop.users.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-sm">
                <span className={cn("text-foreground", !u.isActive && "text-muted-foreground line-through")}>
                  {u.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Badge className="bg-muted text-muted-foreground">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                  {!u.isActive && <Badge className="bg-rose-100 text-rose-800">pasif</Badge>}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Özellik Bayrakları">
          <WorkshopFlags workshopId={workshop.id} flags={flagRows} />
        </Section>

        <Section title="Kullanım">
          <Field label="Müşteri" value={String(customerCount)} />
          <Field label="Araç" value={String(vehicleCount)} />
          <Field label="İş emri" value={String(orderCount)} />
          <Field label="Randevu" value={String(appointmentCount)} />
        </Section>

        <Section title="Sipariş Geçmişi">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sipariş yok.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {o.createdAt.toLocaleDateString("tr-TR")} · {TIER_LABELS[o.planTier] ?? o.planTier}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{formatMinor(o.amountMinor)}</span>
                    <Badge className={o.status === "confirmed" ? "bg-emerald-100 text-emerald-800" : o.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-800"}>
                      {ORDER_STATUS_LABELS[o.status] ?? o.status}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Son İşlemler (Denetim)">
        {auditLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">İşlem kaydı yok.</p>
        ) : (
          <div className="space-y-1.5">
            {auditLogs.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{ACTION_LABELS[l.action] ?? l.action}</span>
                <span className="text-right text-xs text-muted-foreground">
                  {l.actorUser?.email ?? "sistem"} · {l.createdAt.toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="İletişim & İşler">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Son iletişim</p>
            {commLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kayıt yok.</p>
            ) : (
              <div className="space-y-1">
                {commLogs.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">
                      {c.type} · {c.templateKey ?? "—"}
                    </span>
                    <span className="flex items-center gap-2 text-xs">
                      <Badge className={c.status === "failed" ? "bg-rose-100 text-rose-800" : c.status === "sent" ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}>
                        {c.status}
                      </Badge>
                      <span className="text-muted-foreground">{c.sentAt.toLocaleDateString("tr-TR")}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {reminderLogs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Hatırlatma işleri</p>
              <div className="space-y-1">
                {reminderLogs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{r.jobType}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.sentCount} gönderildi · {r.failedCount} başarısız · {r.executedAt.toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {syncLogs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Takvim senkron</p>
              <div className="space-y-1">
                {syncLogs.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{s.provider} · {s.direction}</span>
                    <span className="flex items-center gap-2 text-xs">
                      <Badge className={s.status === "failed" ? "bg-rose-100 text-rose-800" : "bg-muted text-muted-foreground"}>
                        {s.status}
                      </Badge>
                      <span className="text-muted-foreground">{s.syncedAt.toLocaleDateString("tr-TR")}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
