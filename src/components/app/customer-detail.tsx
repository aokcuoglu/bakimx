"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Building2,
  Car as CarIcon,
  ClipboardList,
  Mail,
  Phone,
  MapPin,
  MessageCircle,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  Pencil,
  Plus,
  Wrench,
  Wallet,
  FileText,
  X,
  Check,
  ChevronRight,
  Hash,
  ExternalLink,
  BellRing,
  Calendar,
  Gauge,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge, PlateBadge } from "@/components/app/status-badge"
import { ReminderStatusBadge, ReminderTypeBadge } from "@/components/app/reminder-status-badge"
import { CustomerTypeBadge, CustomerTagBadge, PriceGroupBadge } from "@/components/app/customer-badges"
import { CustomerCreateForm, type CustomerFormInitial } from "@/components/app/customer-create-form"
import { DeleteCustomerButton } from "@/components/app/delete-customer-button"
import { formatTRY } from "@/lib/format"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import { INTAKE_STATUS, CUSTOMER_SOURCES } from "@/lib/constants"
import { summarizeCustomerOrders } from "@/lib/customer-totals"
import { cn } from "@/lib/utils"
import type { ReminderRow } from "@/lib/reminders/queries"

type Vehicle = {
  id: string
  plate: string
  brand: string
  model: string
  modelYear: number | null
  mileage: number | null
  vin: string | null
}

type Intake = {
  id: string
  status: string
  createdAt: string
  customerComplaint: string
  vehicle: { id: string; plate: string; brand: string; model: string }
  order: {
    id: string
    workOrderNo: string | null
    status: string
    paymentStatus: string
    estimatedDeliveryAt: string | null
    grandTotal: number
    collections?: Array<{
      id: string
      amount: number
      method: string
      paymentDate: string
      referenceNo: string | null
      note: string | null
    }>
  } | null
}

type CollectionRow = {
  id: string
  amount: number
  method: string
  paymentDate: string
  referenceNo: string | null
  note: string | null
  serviceOrderId: string | null
}

type CustomerDetailData = Omit<CustomerFormInitial, "whatsappConsent" | "smsConsent" | "emailConsent"> & {
  id: string
  createdAt: string
  updatedAt: string
  whatsappConsent: boolean
  smsConsent: boolean
  emailConsent: boolean
}

export function CustomerDetail({
  customer,
  vehicles,
  intakes,
  reminders = [],
  collections = [],
  showEditInitially = false,
}: {
  customer: CustomerDetailData
  vehicles: Vehicle[]
  intakes: Intake[]
  reminders?: ReminderRow[]
  collections?: CollectionRow[]
  showEditInitially?: boolean
}) {
  const [editing, setEditing] = useState<boolean>(!!showEditInitially)

  const displayName = useMemo(() => {
    if (customer.type === "corporate") return customer.companyName || "Kurumsal Müşteri"
    return customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Müşteri"
  }, [customer])

  const balance = useMemo(() => {
    const orders: Array<{
      status: import("@prisma/client").OrderStatus
      paymentStatus: import("@prisma/client").PaymentStatus
      items: { totalPrice: number; unitPrice: null; quantity: number }[]
    }> = intakes
      .map((i) => i.order)
      .filter((o): o is NonNullable<typeof o> => o != null)
      .map((o) => ({
        status: o.status as import("@prisma/client").OrderStatus,
        paymentStatus: o.paymentStatus as import("@prisma/client").PaymentStatus,
        items: [{ totalPrice: o.grandTotal, unitPrice: null, quantity: 1 }],
      }))
    const last = intakes[0]?.createdAt ? new Date(intakes[0].createdAt) : null
    return summarizeCustomerOrders(orders, last || new Date(customer.createdAt))
  }, [intakes, customer.createdAt])

  const totalPaidFromCollections = useMemo(() => {
    return collections.reduce((sum, c) => sum + c.amount, 0)
  }, [collections])

  const orderIntakes = intakes.filter((i) => i.order)
  const otherIntakes = intakes.filter((i) => !i.order)

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <Link href="/app/customers" className="hover:text-foreground">Müşteriler</Link>
            <span className="mx-2">/</span>
            <Link href={`/app/customers/${customer.id}`} className="hover:text-foreground">
              {displayName}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground font-medium">Düzenle</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1.5">
            <X className="size-4" />
            Vazgeç
          </Button>
        </div>
        <CustomerCreateForm mode="edit" initial={customer} />
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/app/customers" className="hover:text-foreground">Müşteriler</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{displayName}</span>
      </div>

      <header className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-12 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-lg font-semibold shrink-0">
              {customer.type === "corporate" ? <Building2 className="size-5" /> : initials(displayName)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">{displayName}</h2>
                <CustomerTypeBadge type={customer.type || "individual"} />
                {customer.tag ? <CustomerTagBadge tag={customer.tag} /> : null}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs sm:text-sm text-muted-foreground flex-wrap">
                <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                  <Phone className="size-3.5" />
                  {customer.phone}
                </a>
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1 hover:text-primary truncate">
                    <Mail className="size-3.5" />
                    {customer.email}
                  </a>
                ) : null}
                {customer.city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {customer.city}
                    {customer.district ? ` / ${customer.district}` : ""}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
             <Button
               nativeButton={false}
               variant="outline"
               size="sm"
               render={<Link href={`/app/orders/new?customerId=${customer.id}`} />}
             >
               <Wrench className="size-4" />
               Yeni İş Emri
             </Button>
            <button
              type="button"
              disabled
              title="WhatsApp paylaşımı yakında"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-white text-muted-foreground/70 text-sm font-medium cursor-not-allowed touch-manipulation"
            >
              <MessageCircle className="size-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
              Düzenle
            </Button>
          </div>
        </div>
        {customer.riskNote ? (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/10 text-foreground px-3 py-2 text-sm flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Risk / Uyarı Notu</p>
              <p className="mt-0.5">{customer.riskNote}</p>
            </div>
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <BalanceCard balance={balance} totalPaid={totalPaidFromCollections} customerId={customer.id} />

          <SectionCard
            title="Araçlar"
            icon={CarIcon}
            count={vehicles.length}
            action={
              <Link
                href={`/app/vehicles/new?customerId=${customer.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary"
              >
                <Plus className="size-3.5" />
                Araç Ekle
              </Link>
            }
          >
            {vehicles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CarIcon className="size-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm">Henüz araç kaydı yok</p>
                <Link
                  href={`/app/vehicles/new?customerId=${customer.id}`}
                  className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:text-primary font-medium"
                >
                  <Plus className="size-3.5" />
                  Araç ekle
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border -mx-4 sm:-mx-5">
                {vehicles.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/app/vehicles/${v.id}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PlateBadge plate={v.plate} />
                          <span className="text-sm font-medium text-foreground truncate">
                            {v.brand} {v.model}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {v.modelYear ? `${v.modelYear} • ` : ""}
                          {v.mileage ? `${v.mileage.toLocaleString("tr-TR")} km • ` : ""}
                          {v.vin ? `VIN: ${v.vin}` : "VIN girilmemiş"}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground/70" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="İş Emirleri"
            icon={Wrench}
            count={orderIntakes.length}
          >
            {orderIntakes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wrench className="size-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm">Henüz iş emri yok</p>
                <Link
                  href={`/app/orders/new?customerId=${customer.id}`}
                  className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:text-primary font-medium"
                >
                  <Plus className="size-3.5" />
                  Yeni İş Emri
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border -mx-4 sm:-mx-5">
                {orderIntakes.map((i) =>
                  i.order ? (
                    <li key={i.id}>
                      <Link
                        href={`/app/orders/${i.order.id}`}
                        className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-semibold text-muted-foreground">
                              {i.order.workOrderNo || "—"}
                            </span>
                            <PlateBadge plate={i.vehicle.plate} />
                            <StatusBadge status={i.order.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {i.vehicle.brand} {i.vehicle.model} • {i.customerComplaint}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-foreground">
                            {i.order.grandTotal > 0 ? formatTRY(i.order.grandTotal) : <span className="text-muted-foreground/70 font-normal">—</span>}
                          </p>
                          {i.order.estimatedDeliveryAt ? (
                            <p className="text-[11px] text-muted-foreground">
                              Tahmini: {formatDate(i.order.estimatedDeliveryAt)}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ) : null
                )}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Bakım Hatırlatmaları"
            icon={BellRing}
            count={reminders.length}
            action={
              <Link
                href={`/app/reminders/new?customerId=${customer.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary"
              >
                <Plus className="size-3.5" />
                Yeni Hatırlatma
              </Link>
            }
          >
            {reminders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BellRing className="size-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm">Henüz bakım hatırlatması yok</p>
                <Link
                  href={`/app/reminders/new?customerId=${customer.id}`}
                  className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:text-primary font-medium"
                >
                  <Plus className="size-3.5" />
                  Yeni hatırlatma oluştur
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border -mx-4 sm:-mx-5">
                {reminders.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/app/reminders/${r.id}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PlateBadge plate={r.vehicle.plate} />
                          <span className="text-sm font-medium text-foreground truncate">{r.title}</span>
                          <ReminderStatusBadge status={r.status} />
                          <ReminderTypeBadge type={r.type} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {r.dueDate ? (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="size-3" />
                              {formatDate(r.dueDate)}
                            </span>
                          ) : null}
                          {r.dueMileage ? (
                            <span className="inline-flex items-center gap-1">
                              <Gauge className="size-3" />
                              {r.dueMileage.toLocaleString("tr-TR")} km
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground/70" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {otherIntakes.length > 0 ? (
            <SectionCard title="Araç Kabulleri (İş Emri Yok)" icon={ClipboardList} count={otherIntakes.length}>
              <ul className="divide-y divide-border -mx-4 sm:-mx-5">
                {otherIntakes.map((i) => {
                  const intakeStatus = INTAKE_STATUS[i.status as keyof typeof INTAKE_STATUS]
                  return (
                    <li key={i.id}>
                      <Link
                        href={`/app/intakes/${i.id}`}
                        className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <PlateBadge plate={i.vehicle.plate} />
                            <span
                              className={cn(
                                "inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium border",
                                intakeStatus?.color || "bg-muted text-foreground border-border"
                              )}
                            >
                              {intakeStatus?.label || i.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{i.customerComplaint}</p>
                        </div>
                        <span className="text-xs text-muted-foreground/70">{formatDate(i.createdAt)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </SectionCard>
          ) : null}

          {customer.notes ? (
            <SectionCard title="Müşteri Notu" icon={FileText}>
              <p className="text-sm text-foreground whitespace-pre-wrap">{customer.notes}</p>
            </SectionCard>
          ) : null}
        </div>

        <aside className="space-y-5">
          <SectionCard title="Müşteri Özeti" icon={Hash}>
            <dl className="text-sm space-y-2.5">
              <DefinitionRow label="Tip" value={customer.type === "corporate" ? "Kurumsal" : "Bireysel"} />
              {customer.companyName ? (
                <DefinitionRow label="Şirket" value={customer.companyName} />
              ) : null}
              {customer.contactName ? (
                <DefinitionRow label="Yetkili" value={customer.contactName} />
              ) : null}
              {customer.tag ? <DefinitionRow label="Etiket" value={<CustomerTagBadge tag={customer.tag} />} /> : null}
              {customer.source ? (
                <DefinitionRow
                  label="Kaynak"
                  value={CUSTOMER_SOURCES[customer.source as keyof typeof CUSTOMER_SOURCES]?.label || customer.source}
                />
              ) : null}
              {customer.priceGroup ? (
                <DefinitionRow
                  label="Fiyat Grubu"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <PriceGroupBadge group={customer.priceGroup} />
                      {customer.discountRate ? (
                        <span className="text-xs text-muted-foreground">%{customer.discountRate} iskonto</span>
                      ) : null}
                    </span>
                  }
                />
              ) : null}
              <DefinitionRow label="Kayıt Tarihi" value={formatDate(customer.createdAt)} />
              <DefinitionRow label="Son Güncelleme" value={formatDateTime(customer.updatedAt)} />
            </dl>
          </SectionCard>

          <SectionCard title="İletişim İzinleri" icon={ShieldCheck}>
            <ul className="space-y-2 text-sm">
              <ConsentRow icon={<MessageCircle className="size-4 text-success" />} label="WhatsApp izni" granted={customer.whatsappConsent} />
              <ConsentRow icon={<Smartphone className="size-4 text-primary" />} label="SMS izni" granted={customer.smsConsent} />
              <ConsentRow icon={<Mail className="size-4 text-primary" />} label="E-posta izni" granted={customer.emailConsent} />
              <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2">
                <div className="flex items-center gap-2 text-foreground">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  <span>KVKK Onay Tarihi</span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {customer.kvkkApprovedAt ? formatDate(customer.kvkkApprovedAt) : "Kayıt yok"}
                </span>
              </li>
            </ul>
          </SectionCard>

          {(customer.identityNumber || customer.taxNumber || customer.taxOffice || customer.city || customer.address) ? (
            <SectionCard title="Vergi / Adres" icon={MapPin}>
              <dl className="text-sm space-y-2.5">
                {customer.identityNumber ? (
                  <DefinitionRow label="TC Kimlik No" value={customer.identityNumber} />
                ) : null}
                {customer.taxNumber ? (
                  <DefinitionRow label="Vergi No" value={customer.taxNumber} />
                ) : null}
                {customer.taxOffice ? (
                  <DefinitionRow label="Vergi Dairesi" value={customer.taxOffice} />
                ) : null}
                {customer.city ? (
                  <DefinitionRow
                    label="Adres"
                    value={[customer.district, customer.city].filter(Boolean).join(" / ") + (customer.address ? ` — ${customer.address}` : "")}
                  />
                ) : null}
              </dl>
            </SectionCard>
          ) : null}

          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Tehlikeli Bölge</p>
            <p className="text-xs text-muted-foreground">
              Müşteriyi silmek ilişkili araç ve kabul/iş emri kayıtlarını otomatik silmez. Önce ilişkili kayıtları silmeniz gerekir.
            </p>
            <DeleteCustomerButton
              customerId={customer.id}
              customerLabel={displayName}
              variant="destructive"
              size="sm"
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

function SectionCard({
  title,
  icon: Icon,
  count,
  action,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  count?: number
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" />
          {title}
          {typeof count === "number" ? (
            <span className="text-xs text-muted-foreground font-normal">({count})</span>
          ) : null}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

function BalanceCard({ balance, totalPaid, customerId }: { balance: ReturnType<typeof summarizeCustomerOrders>; totalPaid: number; customerId: string }) {
  const actualRemaining = Math.max(0, balance.grandTotal - totalPaid)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="size-4 text-muted-foreground" />
          Bakiye Özeti
        </CardTitle>
        <div className="flex items-center gap-2">
          <Link
            href={`/app/cashbox/payments/new?customerId=${customerId}`}
            className="text-xs text-primary hover:text-primary font-medium inline-flex items-center gap-1"
          >
            <Plus className="size-3" />
            Tahsilat Ekle
          </Link>
          <Link
            href="/app/customers/balances"
            className="text-xs text-muted-foreground hover:text-foreground font-medium inline-flex items-center gap-1"
          >
            Bakiye listesi
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat label="İş Emri" value={balance.ordersCount.toString()} accent="bg-muted text-foreground" />
          <Stat label="Genel Toplam" value={balance.grandTotal > 0 ? formatTRY(balance.grandTotal) : "—"} accent="bg-primary/10 text-foreground" />
          <Stat label="Tahsil Edilen" value={totalPaid > 0 ? formatTRY(totalPaid) : "—"} accent="bg-success/10 text-foreground" />
          <Stat
            label="Kalan Bakiye"
            value={actualRemaining > 0 ? formatTRY(actualRemaining) : formatTRY(0)}
            accent={actualRemaining > 0 ? "bg-destructive/10 text-foreground" : "bg-success/10 text-foreground"}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={cn("rounded-lg px-3 py-2.5 border border-border/60", accent)}>
      <p className="text-[11px] font-medium opacity-80 uppercase tracking-wider">{label}</p>
      <p className="text-base font-bold mt-0.5 truncate">{value}</p>
    </div>
  )
}

function DefinitionRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-sm text-foreground text-right break-words">{value}</dd>
    </div>
  )
}

function ConsentRow({ icon, label, granted }: { icon: React.ReactNode; label: string; granted: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2">
      <div className="flex items-center gap-2 text-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium",
          granted ? "text-success" : "text-muted-foreground/70"
        )}
      >
        {granted ? (
          <>
            <Check className="size-3.5" />
            Var
          </>
        ) : (
          <>
            <X className="size-3.5" />
            Yok
          </>
        )}
      </span>
    </li>
  )
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "?"
  )
}
