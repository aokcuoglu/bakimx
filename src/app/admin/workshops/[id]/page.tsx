import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { can, getAdminContext } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { getPlanState, getSeatLimit, type PlanTier } from "@/lib/plan"
import { getEffectiveFeatures } from "@/lib/features"
import { formatMinor } from "@/lib/billing/pricing"
import { cn } from "@/lib/utils"
import { ROLE_LABELS } from "@/lib/roles"
import { Badge } from "@/components/ui/badge"
import { WorkshopActions } from "@/app/admin/workshop-actions"
import { WorkshopFlags } from "@/app/admin/workshop-flags"
import { ImpersonateButton } from "@/app/admin/impersonate-button"
import { BakimxDiscountForm } from "@/app/admin/bakimx-discount-form"
import { SendPasswordResetButton } from "@/app/admin/workshop-user-actions"

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
  workshop_bakimx_discount_updated: "BakımX iskontosu güncellendi",
  password_reset_sent: "Şifre sıfırlama bağlantısı gönderildi",
}
const APPROVAL_LABELS: Record<string, string> = { pending: "Onay bekliyor", approved: "Onaylı", rejected: "Reddedildi" }
const SUB_LABELS: Record<string, string> = { trialing: "Denemede", active: "Aktif", past_due: "Ödeme gecikti", canceled: "İptal" }

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
  const ctx = await getAdminContext()
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

  const canSendReset = can(ctx, "sendPasswordReset")
  const plan = getPlanState(workshop)
  const activeUsers = workshop.users.filter((u) => u.isActive).length
  const seatLimit = getSeatLimit(workshop.planTier as PlanTier, workshop.extraSeats)
  const ownerEmail = workshop.users.find((u) => u.role === "owner")?.email ?? workshop.users[0]?.email ?? null

  const APPROVAL_BADGE: Record<string, string> = {
    pending: "bg-warning/10 text-warning-strong",
    approved: "bg-success/10 text-success-strong",
    rejected: "bg-destructive/10 text-destructive-strong",
  }
  const SUB_BADGE: Record<string, string> = {
    trialing: "bg-primary/10 text-primary",
    active: "bg-success/10 text-success-strong",
    past_due: "bg-warning/10 text-warning-strong",
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
              <Badge variant="outline" className={cn("text-[11px]", APPROVAL_BADGE[workshop.approvalStatus] ?? "bg-muted")}>
                {APPROVAL_LABELS[workshop.approvalStatus] ?? workshop.approvalStatus}
              </Badge>
              <Badge variant="outline" className={cn("text-[11px]", SUB_BADGE[workshop.subscriptionStatus] ?? "bg-muted")}>
                {SUB_LABELS[workshop.subscriptionStatus] ?? workshop.subscriptionStatus}
              </Badge>
              <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground">
                {TIER_LABELS[workshop.planTier] ?? workshop.planTier}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {[workshop.city, workshop.district].filter(Boolean).join(" / ")}
              {ownerEmail && <span> · {ownerEmail}</span>}
            </p>
            {plan.isTrialing && plan.trialDaysLeft != null && (
              <p className="text-sm text-primary mt-1">Deneme: {plan.trialDaysLeft} gün kaldı</p>
            )}
            {plan.subscriptionDaysLeft != null && (
              <p className={cn("text-sm mt-1", plan.subscriptionDaysLeft <= 7 ? "text-warning-strong" : "text-muted-foreground")}>
                Abonelik: {plan.subscriptionDaysLeft} gün kaldı
              </p>
            )}
          </div>
          {can(ctx, "impersonate") && (
            <div className="shrink-0">
              <ImpersonateButton workshopId={workshop.id} />
            </div>
          )}
        </div>
        {can(ctx, "manageWorkshops") && (
          <WorkshopActions
            w={{
              id: workshop.id,
              approvalStatus: workshop.approvalStatus,
              requestedPlanTier: workshop.requestedPlanTier,
              extraSeats: workshop.extraSeats,
            }}
          />
        )}
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
          <div className="pt-1 space-y-2.5">
            {workshop.users.map((u) => (
              <div key={u.id} className="flex items-start justify-between gap-2 text-sm">
                <span className={cn("min-w-0 break-words text-foreground", !u.isActive && "text-muted-foreground line-through")}>
                  {/* E-postasız üye kullanıcı adıyla listelenir (BAK-40). */}
                  {u.email ?? u.username ?? "—"}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground">{ROLE_LABELS[u.role]}</Badge>
                    {!u.isActive && (
                      <Badge variant="outline" className="text-[11px] bg-destructive/10 text-destructive-strong">
                        pasif
                      </Badge>
                    )}
                  </span>
                  {/* Buton yalnız akışa GİREBİLEN koltuklarda: e-postasız veya pasif
                      hesap token almaz (canReceivePasswordReset), aksiyon zaten reddeder. */}
                  {canSendReset && u.isActive && u.email && (
                    <SendPasswordResetButton workshopId={workshop.id} userId={u.id} label={u.email} />
                  )}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {can(ctx, "manageFlags") && (
          <Section title="Özellik Bayrakları">
            <WorkshopFlags workshopId={workshop.id} flags={flagRows} />
          </Section>
        )}

        {can(ctx, "manageWorkshops") && (
          <Section title="BakımX İskontosu">
            <BakimxDiscountForm workshopId={workshop.id} currentDiscountBps={workshop.bakimxDiscountBps} />
          </Section>
        )}

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
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px]",
                        o.status === "confirmed"
                          ? "bg-success/10 text-success-strong"
                          : o.status === "cancelled"
                            ? "bg-muted text-muted-foreground"
                            : "bg-warning/10 text-warning-strong"
                      )}
                    >
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
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px]",
                          c.status === "failed"
                            ? "bg-destructive/10 text-destructive-strong"
                            : c.status === "sent"
                              ? "bg-success/10 text-success-strong"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
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
                      <Badge
                        variant="outline"
                        className={cn("text-[11px]", s.status === "failed" ? "bg-destructive/10 text-destructive-strong" : "bg-muted text-muted-foreground")}
                      >
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
