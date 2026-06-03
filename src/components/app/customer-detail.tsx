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
  Info,
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
  } | null
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
  showEditInitially = false,
}: {
  customer: CustomerDetailData
  vehicles: Vehicle[]
  intakes: Intake[]
  reminders?: ReminderRow[]
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

  const orderIntakes = intakes.filter((i) => i.order)
  const otherIntakes = intakes.filter((i) => !i.order)

  if (editing) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center text-sm text-slate-500">
            <Link href="/app/customers" className="hover:text-slate-700">Müşteriler</Link>
            <span className="mx-2">/</span>
            <Link href={`/app/customers/${customer.id}`} className="hover:text-slate-700">
              {displayName}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-slate-700 font-medium">Düzenle</span>
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
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/app/customers" className="hover:text-slate-700">Müşteriler</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700 font-medium">{displayName}</span>
      </div>

      <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-lg font-semibold shrink-0">
              {customer.type === "corporate" ? <Building2 className="size-5" /> : initials(displayName)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{displayName}</h2>
                <CustomerTypeBadge type={customer.type || "individual"} />
                {customer.tag ? <CustomerTagBadge tag={customer.tag} /> : null}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs sm:text-sm text-slate-500 flex-wrap">
                <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 hover:text-blue-600">
                  <Phone className="size-3.5" />
                  {customer.phone}
                </a>
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1 hover:text-blue-600 truncate">
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
            <Link
              href={`/app/orders/new?customerId=${customer.id}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors touch-manipulation"
            >
              <Wrench className="size-4" />
              Yeni İş Emri
            </Link>
            <button
              type="button"
              disabled
              title="WhatsApp paylaşımı yakında"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-400 text-sm font-medium cursor-not-allowed touch-manipulation"
            >
              <MessageCircle className="size-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
              Düzenle
            </Button>
          </div>
        </div>
        {customer.riskNote ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 text-sm flex items-start gap-2">
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
          <BalanceCard balance={balance} />

          <SectionCard
            title="Araçlar"
            icon={CarIcon}
            count={vehicles.length}
            action={
              <Link
                href={`/app/vehicles/new?customerId=${customer.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="size-3.5" />
                Araç Ekle
              </Link>
            }
          >
            {vehicles.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CarIcon className="size-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Henüz araç kaydı yok</p>
                <Link
                  href={`/app/vehicles/new?customerId=${customer.id}`}
                  className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="size-3.5" />
                  Araç ekle
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 -mx-4 sm:-mx-5">
                {vehicles.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/app/vehicles/${v.id}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PlateBadge plate={v.plate} />
                          <span className="text-sm font-medium text-slate-700 truncate">
                            {v.brand} {v.model}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {v.modelYear ? `${v.modelYear} • ` : ""}
                          {v.mileage ? `${v.mileage.toLocaleString("tr-TR")} km • ` : ""}
                          {v.vin ? `VIN: ${v.vin}` : "VIN girilmemiş"}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-slate-400" />
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
              <div className="text-center py-8 text-slate-500">
                <Wrench className="size-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Henüz iş emri yok</p>
                <Link
                  href={`/app/orders/new?customerId=${customer.id}`}
                  className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="size-3.5" />
                  Yeni İş Emri
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 -mx-4 sm:-mx-5">
                {orderIntakes.map((i) =>
                  i.order ? (
                    <li key={i.id}>
                      <Link
                        href={`/app/orders/${i.order.id}`}
                        className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-semibold text-slate-500">
                              {i.order.workOrderNo || "—"}
                            </span>
                            <PlateBadge plate={i.vehicle.plate} />
                            <StatusBadge status={i.order.status} />
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {i.vehicle.brand} {i.vehicle.model} • {i.customerComplaint}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {i.order.grandTotal > 0 ? formatTRY(i.order.grandTotal) : <span className="text-slate-400 font-normal">—</span>}
                          </p>
                          {i.order.estimatedDeliveryAt ? (
                            <p className="text-[11px] text-slate-500">
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
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="size-3.5" />
                Yeni Hatırlatma
              </Link>
            }
          >
            {reminders.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <BellRing className="size-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Henüz bakım hatırlatması yok</p>
                <Link
                  href={`/app/reminders/new?customerId=${customer.id}`}
                  className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="size-3.5" />
                  Yeni hatırlatma oluştur
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 -mx-4 sm:-mx-5">
                {reminders.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/app/reminders/${r.id}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PlateBadge plate={r.vehicle.plate} />
                          <span className="text-sm font-medium text-slate-900 truncate">{r.title}</span>
                          <ReminderStatusBadge status={r.status} />
                          <ReminderTypeBadge type={r.type} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
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
                      <ChevronRight className="size-4 text-slate-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {otherIntakes.length > 0 ? (
            <SectionCard title="Araç Kabulleri (İş Emri Yok)" icon={ClipboardList} count={otherIntakes.length}>
              <ul className="divide-y divide-slate-100 -mx-4 sm:-mx-5">
                {otherIntakes.map((i) => {
                  const intakeStatus = INTAKE_STATUS[i.status as keyof typeof INTAKE_STATUS]
                  return (
                    <li key={i.id}>
                      <Link
                        href={`/app/intakes/${i.id}`}
                        className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <PlateBadge plate={i.vehicle.plate} />
                            <span
                              className={cn(
                                "inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium border",
                                intakeStatus?.color || "bg-slate-100 text-slate-700 border-slate-200"
                              )}
                            >
                              {intakeStatus?.label || i.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{i.customerComplaint}</p>
                        </div>
                        <span className="text-xs text-slate-400">{formatDate(i.createdAt)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </SectionCard>
          ) : null}

          {customer.notes ? (
            <SectionCard title="Müşteri Notu" icon={FileText}>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{customer.notes}</p>
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
                        <span className="text-xs text-slate-500">%{customer.discountRate} iskonto</span>
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
              <ConsentRow icon={<MessageCircle className="size-4 text-emerald-600" />} label="WhatsApp izni" granted={customer.whatsappConsent} />
              <ConsentRow icon={<Smartphone className="size-4 text-sky-600" />} label="SMS izni" granted={customer.smsConsent} />
              <ConsentRow icon={<Mail className="size-4 text-indigo-600" />} label="E-posta izni" granted={customer.emailConsent} />
              <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <ShieldCheck className="size-4 text-slate-500" />
                  <span>KVKK Onay Tarihi</span>
                </div>
                <span className="text-xs font-medium text-slate-600">
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

          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 space-y-2">
            <p className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Tehlikeli Bölge</p>
            <p className="text-xs text-rose-700">
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
          <Icon className="size-4 text-slate-500" />
          {title}
          {typeof count === "number" ? (
            <span className="text-xs text-slate-500 font-normal">({count})</span>
          ) : null}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

function BalanceCard({ balance }: { balance: ReturnType<typeof summarizeCustomerOrders> }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="size-4 text-slate-500" />
          Bakiye Özeti
        </CardTitle>
        <Link
          href="/app/customers/balances"
          className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
        >
          Bakiye listesi
          <ExternalLink className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Stat label="İş Emri" value={balance.ordersCount.toString()} accent="bg-slate-50 text-slate-700" />
          <Stat label="Yapılan İş" value={balance.workDone.toString()} accent="bg-blue-50 text-blue-700" />
          <Stat label="Genel Toplam" value={balance.grandTotal > 0 ? formatTRY(balance.grandTotal) : "—"} accent="bg-indigo-50 text-indigo-700" />
          <Stat
            label="Bizim Alacağımız"
            value={balance.remaining > 0 ? formatTRY(balance.remaining) : formatTRY(0)}
            accent={balance.remaining > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-[11px] text-slate-500 flex items-start gap-2">
          <Info className="size-3.5 mt-0.5 shrink-0" />
          <span>
            Tahsilat modülü henüz aktif değil. Bu alan iş emri toplamlarına göre ön hazırlık olarak gösterilir.
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={cn("rounded-lg px-3 py-2.5 border border-slate-200/60", accent)}>
      <p className="text-[11px] font-medium opacity-80 uppercase tracking-wider">{label}</p>
      <p className="text-base font-bold mt-0.5 truncate">{value}</p>
    </div>
  )
}

function DefinitionRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs text-slate-500 shrink-0">{label}</dt>
      <dd className="text-sm text-slate-800 text-right break-words">{value}</dd>
    </div>
  )
}

function ConsentRow({ icon, label, granted }: { icon: React.ReactNode; label: string; granted: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
      <div className="flex items-center gap-2 text-slate-700">
        {icon}
        <span>{label}</span>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium",
          granted ? "text-emerald-700" : "text-slate-400"
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
