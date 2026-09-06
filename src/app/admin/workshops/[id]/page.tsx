import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight, Handshake } from "lucide-react"
import { can, getAdminContext } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { getEffectiveSeatLimit, getPlanState } from "@/lib/plan"
import { formatMinor } from "@/lib/billing/pricing"
import { cn } from "@/lib/utils"
import { ROLE_LABELS } from "@/lib/roles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WorkshopActions } from "@/app/admin/workshop-actions"
import { ImpersonateButton } from "@/app/admin/impersonate-button"
import { BakimxDiscountForm } from "@/app/admin/bakimx-discount-form"
import { WorkshopUserActions } from "@/app/admin/workshop-user-actions"
import { DeleteWorkshopButton } from "@/app/admin/delete-workshop-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WorkshopActivityTables } from "@/app/admin/workshop-activity-tables"
import { AcquisitionEditor } from "@/app/admin/acquisition-editor"
import { ACQUISITION_SOURCE_LABELS } from "@/lib/acquisition-sources"
import { salesAdvisorDisplayName, salesLeadAdminHref, workshopAdminHref } from "@/lib/sales/links"
import { UsageDateFilter, WorkshopOrderFilters } from "@/app/admin/workshop-detail-filters"
import {
  hasWorkshopOrderFilters,
  normalizeWorkshopOrderPage,
  parseWorkshopDateRange,
  parseWorkshopOrderFilters,
  type WorkshopDetailSearchParams,
  WORKSHOP_ORDER_PAGE_SIZE,
} from "@/lib/admin/workshop-detail-query"

export const dynamic = "force-dynamic"

const TIER_LABELS: Record<string, string> = { lite: "Lite", starter: "Başlangıç", pro: "Profesyonel", premium: "Premium" }
const CYCLE_LABELS: Record<string, string> = { monthly: "Aylık", yearly: "Yıllık" }
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Ödeme bekliyor",
  confirmed: "Teyit edildi",
  cancelled: "İptal",
}
const APPROVAL_LABELS: Record<string, string> = { pending: "Onay bekliyor", approved: "Onaylı", rejected: "Reddedildi" }
const SUB_LABELS: Record<string, string> = { trialing: "Denemede", active: "Aktif", past_due: "Ödeme gecikti", canceled: "İptal" }

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card size="sm" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
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

function pageHref(id: string, searchParams: WorkshopDetailSearchParams, page: number): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item))
    else if (value) query.set(key, value)
  }
  if (page > 1) query.set("orderPage", String(page))
  else query.delete("orderPage")
  const suffix = query.toString()
  return `/admin/workshops/${id}${suffix ? `?${suffix}` : ""}`
}

export default async function WorkshopDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<WorkshopDetailSearchParams> }) {
  const ctx = await getAdminContext()
  const { id } = await params
  const query = await searchParams
  const usageRange = parseWorkshopDateRange(query.from, query.to)
  const orderFilters = parseWorkshopOrderFilters(query)
  const periodWhere = { workshopId: id, ...(usageRange.range ? { createdAt: usageRange.range } : {}) }
  const billingOrderWhere = {
    workshopId: id,
    ...(orderFilters.range ? { createdAt: orderFilters.range } : {}),
    ...(orderFilters.status ? { status: orderFilters.status } : {}),
    ...(orderFilters.plan ? { planTier: orderFilters.plan } : {}),
    ...(orderFilters.cycle ? { billingCycle: orderFilters.cycle } : {}),
  }

  const workshop = await prisma.workshop.findFirst({
    where: { id, kind: "customer" },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      acquisitionAdvisor: {
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      },
      referredByWorkshop: { select: { id: true, name: true } },
    },
  })
  if (!workshop) notFound()

  const [customerTotal, vehicleTotal, serviceOrderTotal, appointmentTotal, customerCount, vehicleCount, orderCount, appointmentCount, billingOrderFilteredCount, salesLead, advisors] =
    await Promise.all([
      prisma.customer.count({ where: { workshopId: id } }), prisma.vehicle.count({ where: { workshopId: id } }), prisma.serviceOrder.count({ where: { workshopId: id } }), prisma.appointment.count({ where: { workshopId: id } }),
      prisma.customer.count({ where: periodWhere }), prisma.vehicle.count({ where: periodWhere }), prisma.serviceOrder.count({ where: periodWhere }), prisma.appointment.count({ where: periodWhere }),
      prisma.billingOrder.count({ where: billingOrderWhere }),
      prisma.salesLead.findUnique({ where: { workshopId: id }, select: { id: true } }),
      prisma.salesAdvisor.findMany({ where: { disabledAt: null }, include: { user: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    ])

  const orderPage = normalizeWorkshopOrderPage(orderFilters.requestedPage, billingOrderFilteredCount)
  const orderPageCount = Math.max(1, Math.ceil(billingOrderFilteredCount / WORKSHOP_ORDER_PAGE_SIZE))
  const orderFiltersActive = hasWorkshopOrderFilters(orderFilters)
  const orders = await prisma.billingOrder.findMany({
    where: billingOrderWhere,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (orderPage - 1) * WORKSHOP_ORDER_PAGE_SIZE,
    take: WORKSHOP_ORDER_PAGE_SIZE,
  })
  const canManageTeam = can(ctx, "manageWorkshops")
  const canSendReset = can(ctx, "sendPasswordReset")
  const plan = getPlanState(workshop)
  const activeUsers = workshop.users.filter((u) => u.isActive).length
  const seatLimit = getEffectiveSeatLimit(workshop)
  const ownerEmail = workshop.users.find((u) => u.role === "owner")?.email ?? workshop.users[0]?.email ?? null
  const acquisitionAdvisorName = workshop.acquisitionAdvisor
    ? salesAdvisorDisplayName(workshop.acquisitionAdvisor.user)
    : null
  const [billingCount, paymentCount, supportCount] = await Promise.all([
    prisma.billingOrder.count({ where: { workshopId: id } }), prisma.paymentTransaction.count({ where: { workshopId: id } }), prisma.supportRequest.count({ where: { workshopId: id } }),
  ])
  const deleteBlockers = [[customerTotal, "müşteri"], [vehicleTotal, "araç"], [serviceOrderTotal, "iş emri"], [appointmentTotal, "randevu"], [billingCount, "fatura/sipariş"], [paymentCount, "ödeme"], [supportCount, "destek kaydı"]].filter(([count]) => Number(count) > 0).map(([, label]) => label as string)

  const APPROVAL_BADGE: Record<string, string> = {
    pending: "bg-warning/10 text-warning-strong",
    approved: "bg-success/10 text-success-strong",
    rejected: "bg-destructive/10 text-destructive-strong",
  }
  const SUB_BADGE: Record<string, string> = {
    trialing: "bg-primary/10 text-primary-strong",
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
              <p className="text-sm text-primary mt-1">Deneme: {plan.trialDaysLeft} iş günü kaldı</p>
            )}
            {plan.subscriptionDaysLeft != null && (
              <p className={cn("text-sm mt-1", plan.subscriptionDaysLeft <= 7 ? "text-warning-strong" : "text-muted-foreground")}>
                Abonelik: {plan.subscriptionDaysLeft} gün kaldı
              </p>
            )}
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Handshake className="size-4 shrink-0" />
              <span>Satış temsilcisi:</span>
              {acquisitionAdvisorName ? (
                salesLead ? (
                  <Link
                    href={salesLeadAdminHref(salesLead.id)}
                    className="font-medium text-primary hover:underline"
                  >
                    {acquisitionAdvisorName}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{acquisitionAdvisorName}</span>
                )
              ) : (
                <span className="font-medium text-foreground">Atanmadı</span>
              )}
            </p>
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
              planTier: workshop.planTier,
              subscriptionStatus: workshop.subscriptionStatus,
              currentPeriodEnd: workshop.currentPeriodEnd?.toISOString() ?? null,
              activeUsers,
            }}
          />
        )}
        {can(ctx, "manageWorkshops") && <DeleteWorkshopButton workshopId={workshop.id} name={workshop.name} blockers={deleteBlockers} />}
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

        <Section title="Referans Kaynağı">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Referans</p>
              <Badge variant="outline" className="bg-muted text-muted-foreground">
                {ACQUISITION_SOURCE_LABELS[workshop.acquisitionSource]}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Temsilci</p>
              <Badge
                variant="outline"
                className={acquisitionAdvisorName ? "bg-primary/10 text-primary-strong" : "bg-muted text-muted-foreground"}
              >
                {acquisitionAdvisorName ?? "Atanmadı"}
              </Badge>
            </div>
          </div>
          {(workshop.referralCodeUsed || workshop.referredByWorkshop) && (
            <div className="space-y-3 border-t pt-3">
              {workshop.referralCodeUsed && (
                <Field label="Kullanılan referans kodu" value={<span className="font-mono">{workshop.referralCodeUsed}</span>} />
              )}
              {workshop.referredByWorkshop && (
                <Field
                  label="Davet eden iş yeri"
                  value={
                    <Link href={workshopAdminHref(workshop.referredByWorkshop.id)} className="text-primary hover:underline">
                      {workshop.referredByWorkshop.name}
                    </Link>
                  }
                />
              )}
            </div>
          )}
          {can(ctx, "manageWorkshops") && <AcquisitionEditor workshopId={id} source={workshop.acquisitionSource} advisorId={workshop.acquisitionAdvisorId} advisors={advisors.map((a) => ({ id: a.id, label: [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") || a.user.email || "—" }))} />}
        </Section>

        <Section title="Ekip & Koltuk" className="w-full md:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Aktif koltuk</p><p className="mt-1 text-xl font-semibold tabular-nums">{activeUsers} <span className="text-sm font-medium text-muted-foreground">/ {seatLimit}</span></p></div>
            <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Ek koltuk</p><p className="mt-1 text-xl font-semibold tabular-nums">{workshop.extraSeats}</p></div>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>Kullanıcı</TableHead><TableHead>Rol</TableHead><TableHead>Durum</TableHead><TableHead className="text-right">İşlem</TableHead></TableRow></TableHeader>
              <TableBody>{workshop.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className={cn("max-w-48 truncate font-medium", !u.isActive && "text-muted-foreground line-through")}>{u.email ?? u.username ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="bg-muted text-muted-foreground">{ROLE_LABELS[u.role]}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={u.isActive ? "bg-success/10 text-success-strong" : "bg-destructive/10 text-destructive-strong"}>{u.isActive ? "Aktif" : "Pasif"}</Badge></TableCell>
                  <TableCell className="text-right">{(canManageTeam || (canSendReset && u.isActive && u.email)) && <WorkshopUserActions workshopId={workshop.id} user={{ id: u.id, email: u.email, isActive: u.isActive, role: u.role }} canManage={canManageTeam} canSendReset={canSendReset} />}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
        </Section>

        {can(ctx, "manageWorkshops") && (
          <Section title="GetirBakım İskontosu">
            <BakimxDiscountForm workshopId={workshop.id} currentDiscountBps={workshop.bakimxDiscountBps} />
          </Section>
        )}

        <Section title="Kullanım">
          <UsageDateFilter key={`usage-${usageRange.from}-${usageRange.to}`} from={usageRange.from} to={usageRange.to} />
          <Field label="Müşteri" value={String(customerCount)} />
          <Field label="Araç" value={String(vehicleCount)} />
          <Field label="İş emri" value={String(orderCount)} />
          <Field label="Randevu" value={String(appointmentCount)} />
        </Section>

        <Section title="Sipariş Geçmişi" className="w-full md:col-span-2">
          <WorkshopOrderFilters
            key={`orders-${orderFilters.from}-${orderFilters.to}-${orderFilters.status}-${orderFilters.plan}-${orderFilters.cycle}`}
            from={orderFilters.from}
            to={orderFilters.to}
            status={orderFilters.status}
            plan={orderFilters.plan}
            cycle={orderFilters.cycle}
            hasFilters={orderFiltersActive}
          />
          {orders.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {orderFiltersActive ? "Filtrelere uyan sipariş bulunamadı." : "Sipariş yok."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Paket</TableHead>
                    <TableHead>Faturalama</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                    <TableHead>Durum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.createdAt.toLocaleDateString("tr-TR")}</TableCell>
                      <TableCell className="font-medium">{TIER_LABELS[order.planTier] ?? order.planTier}</TableCell>
                      <TableCell>{CYCLE_LABELS[order.billingCycle] ?? order.billingCycle}</TableCell>
                      <TableCell className="text-right font-medium">{formatMinor(order.amountMinor)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px]",
                            order.status === "confirmed"
                              ? "bg-success/10 text-success-strong"
                              : order.status === "cancelled"
                                ? "bg-muted text-muted-foreground"
                                : "bg-warning/10 text-warning-strong",
                          )}
                        >
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Toplam {billingOrderFilteredCount} kayıt</p>
            {orderPageCount > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild={orderPage > 1} disabled={orderPage <= 1}>
                  {orderPage > 1 ? (
                    <Link href={pageHref(id, query, orderPage - 1)}>
                      <ChevronLeft /> Önceki
                    </Link>
                  ) : (
                    <span><ChevronLeft /> Önceki</span>
                  )}
                </Button>
                <span className="text-xs text-muted-foreground">{orderPage} / {orderPageCount}</span>
                <Button variant="outline" size="sm" asChild={orderPage < orderPageCount} disabled={orderPage >= orderPageCount}>
                  {orderPage < orderPageCount ? (
                    <Link href={pageHref(id, query, orderPage + 1)}>
                      Sonraki <ChevronRight />
                    </Link>
                  ) : (
                    <span>Sonraki <ChevronRight /></span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </Section>
      </div>

      <WorkshopActivityTables workshopId={id} />
    </div>
  )
}
