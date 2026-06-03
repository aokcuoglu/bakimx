"use client"

import Link from "next/link"
import {
  Car,
  ArrowLeft,
  Plus,
  Pencil,
  Wrench,
  ClipboardList,
  Hash,
  ShieldCheck,
  Phone,
  User,
  FileText,
  Camera,
  AlertTriangle,
  ChevronRight,
  BellRing,
  Calendar,
  Gauge,
} from "lucide-react"
import { PlateBadge } from "@/components/app/plate-badge"
import { StatusBadge, PaymentBadge } from "@/components/app/status-badge"
import { ReminderStatusBadge, ReminderTypeBadge } from "@/components/app/reminder-status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatTRY } from "@/lib/format"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import { INTAKE_STATUS, DAMAGE_TYPES, DAMAGE_SEVERITY, PHOTO_TYPES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { ReminderRow } from "@/lib/reminders/queries"

type VehicleData = {
  id: string
  plate: string
  brand: string
  model: string
  vehicleType: string | null
  modelYear: number | null
  mileage: number | null
  vin: string | null
  vinConfirmed: boolean
  color: string | null
  engineNo: string | null
  fuelType: string | null
  transmission: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  reminders: ReminderRow[]
  customer: {
    id: string
    type: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    phone: string
    email: string | null
    city: string | null
  }
  intakes: Array<{
    id: string
    status: string
    mileageAtIntake: number | null
    customerComplaint: string
    internalNote: string | null
    createdAt: string
    approvedAt: string | null
    order: {
      id: string
      workOrderNo: string | null
      status: string
      paymentStatus: string
      estimatedDeliveryAt: string | null
      grandTotal: number
    } | null
    damageMarks: Array<{
      id: string
      zone: string
      damageType: string
      severity: string
      note: string | null
      createdAt: string
    }>
    photos: Array<{
      id: string
      type: string
      label: string
      fileUrl: string | null
      createdAt: string
    }>
  }>
}

function customerDisplayName(c: VehicleData["customer"]) {
  if (c.type === "corporate") return c.companyName || "Kurumsal Müşteri"
  return c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Müşteri"
}

export function VehicleDetail({ vehicle: v }: { vehicle: VehicleData }) {
  const workOrders = v.intakes.filter((i) => i.order)
  const allDamageMarks = v.intakes.flatMap((i) =>
    i.damageMarks.map((dm) => ({ ...dm, intakeId: i.id, intakeDate: i.createdAt }))
  )
  const allPhotos = v.intakes.flatMap((i) =>
    i.photos.map((p) => ({ ...p, intakeId: i.id }))
  )

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/app/vehicles" className="hover:text-slate-700 inline-flex items-center gap-1">
          <ArrowLeft className="size-4" />
          Araçlar
        </Link>
        <span className="mx-1">/</span>
        <span className="text-slate-700 font-medium truncate">{v.plate}</span>
      </div>

      <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-12 rounded-xl bg-[#0B1F3A] flex items-center justify-center text-white shrink-0">
              <Car className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <PlateBadge plate={v.plate} className="h-8 min-w-[6rem] text-sm" />
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                  {v.brand} {v.model}
                </h2>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm text-slate-500 flex-wrap">
                {v.vehicleType ? <span>{v.vehicleType}</span> : null}
                {v.modelYear ? <span>{v.modelYear}</span> : null}
                {v.color ? <span>{v.color}</span> : null}
                {v.fuelType ? <span>{v.fuelType}</span> : null}
                {v.transmission ? <span>{v.transmission}</span> : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/app/orders/new?vehicleId=${v.id}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors touch-manipulation"
            >
              <Wrench className="size-4" />
              <span className="hidden sm:inline">Yeni İş Emri</span>
            </Link>
            <Link
              href={`/app/intakes/new?vehicleId=${v.id}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors touch-manipulation"
            >
              <ClipboardList className="size-4" />
              <span className="hidden sm:inline">Yeni Kabul</span>
            </Link>
            <Link
              href={`/app/vehicles/${v.id}/edit`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors touch-manipulation"
            >
              <Pencil className="size-4" />
              <span className="hidden sm:inline">Düzenle</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Car className="size-4 text-slate-500" />
                Araç Özeti
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <SummaryItem label="Plaka" value={v.plate} />
                <SummaryItem label="Marka" value={v.brand} />
                <SummaryItem label="Model" value={v.model} />
                <SummaryItem label="Araç Tipi" value={v.vehicleType || "—"} />
                <SummaryItem label="Model Yılı" value={v.modelYear ? v.modelYear.toString() : "—"} />
                <SummaryItem
                  label="Kilometre"
                  value={v.mileage ? `${v.mileage.toLocaleString("tr-TR")} km` : "—"}
                />
                <SummaryItem label="Renk" value={v.color || "—"} />
                <SummaryItem label="Yakıt" value={v.fuelType || "—"} />
                <SummaryItem label="Şanzıman" value={v.transmission || "—"} />
                <SummaryItem
                  label="Şase No"
                  value={
                    <span className="font-mono text-xs">{v.vin || "—"}</span>
                  }
                />
                <SummaryItem
                  label="Şase Teyit"
                  value={
                    v.vinConfirmed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <ShieldCheck className="size-3" />
                        Teyit Edildi
                      </span>
                    ) : v.vin ? (
                      <span className="text-amber-600">Teyit Bekliyor</span>
                    ) : (
                      "—"
                    )
                  }
                />
                <SummaryItem label="Motor No" value={v.engineNo || "—"} />
              </dl>
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 text-xs text-slate-500">
                <span>Kayıt: {formatDate(v.createdAt)}</span>
                <span>Güncelleme: {formatDateTime(v.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          <SectionCard title="Müşteri Bilgisi" icon={User} count={0}>
            <div className="flex items-start gap-3">
              <Link
                href={`/app/customers/${v.customer.id}`}
                className="flex items-center gap-3 hover:bg-slate-50 rounded-lg p-2 -m-2 transition-colors flex-1"
              >
                <div className="size-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold shrink-0">
                  <User className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                    {customerDisplayName(v.customer)}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span onClick={() => window.location.href = `tel:${v.customer.phone}`} className="inline-flex items-center gap-1 hover:text-blue-600 cursor-pointer">
                      <Phone className="size-3" />
                      {v.customer.phone}
                    </span>
                    {v.customer.email ? (
                      <span className="truncate">{v.customer.email}</span>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="size-4 text-slate-400 shrink-0 ml-auto" />
              </Link>
            </div>
          </SectionCard>

          <SectionCard
            title="İş Emri Geçmişi"
            icon={Wrench}
            count={workOrders.length}
            action={
              <Link
                href={`/app/orders/new?vehicleId=${v.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="size-3.5" />
                Yeni İş Emri
              </Link>
            }
          >
            {workOrders.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Wrench className="size-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Bu araç için iş emri bulunmuyor</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 -mx-4 sm:-mx-5">
                {workOrders.map((i) =>
                  i.order ? (
                    <Link
                      key={i.order.id}
                      href={`/app/orders/${i.order.id}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-semibold text-slate-500">
                            {i.order.workOrderNo || "—"}
                          </span>
                          <StatusBadge status={i.order.status} />
                          <PaymentBadge status={i.order.paymentStatus} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{i.customerComplaint}</p>
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
                  ) : null
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Araç Kabul Geçmişi"
            icon={ClipboardList}
            count={v.intakes.length}
            action={
              <Link
                href={`/app/intakes/new?vehicleId=${v.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="size-3.5" />
                Yeni Kabul
              </Link>
            }
          >
            {v.intakes.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <ClipboardList className="size-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Bu araç için kabul kaydı bulunmuyor</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 -mx-4 sm:-mx-5">
                {v.intakes.map((i) => {
                  const intakeStatus = INTAKE_STATUS[i.status as keyof typeof INTAKE_STATUS]
                  return (
                    <Link
                      key={i.id}
                      href={`/app/intakes/${i.id}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium border",
                              intakeStatus?.color || "bg-slate-100 text-slate-700 border-slate-200"
                            )}
                          >
                            {intakeStatus?.label || i.status}
                          </span>
                          {i.approvedAt ? (
                            <span className="text-[11px] text-emerald-600 font-medium">Onaylandı</span>
                          ) : i.status === "waiting_approval" ? (
                            <span className="text-[11px] text-amber-600 font-medium">Onay Bekliyor</span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{i.customerComplaint}</p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{formatDate(i.createdAt)}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Bakım Hatırlatmaları"
            icon={BellRing}
            count={v.reminders.length}
            action={
              <Link
                href={`/app/reminders/new?customerId=${v.customer.id}&vehicleId=${v.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                <Plus className="size-3.5" />
                Yeni Hatırlatma
              </Link>
            }
          >
            {v.reminders.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <BellRing className="size-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Bu araç için bakım hatırlatması bulunmuyor</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 -mx-4 sm:-mx-5">
                {v.reminders.map((r) => (
                  <Link
                    key={r.id}
                    href={`/app/reminders/${r.id}`}
                    className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900">{r.title}</span>
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
                    <ChevronRight className="size-4 text-slate-400 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Hasar Geçmişi" icon={AlertTriangle} count={allDamageMarks.length}>
            {allDamageMarks.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <AlertTriangle className="size-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Bu araç için kayıtlı hasar bulunmuyor</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 -mx-4 sm:-mx-5">
                {allDamageMarks.map((dm) => {
                  const dt = DAMAGE_TYPES[dm.damageType as keyof typeof DAMAGE_TYPES]
                  const sev = DAMAGE_SEVERITY[dm.severity as keyof typeof DAMAGE_SEVERITY]
                  return (
                    <div
                      key={dm.id}
                      className="px-4 sm:px-5 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-700">{dm.zone}</span>
                            <span
                              className="inline-flex items-center h-4 px-1.5 rounded text-[10px] font-medium text-white"
                              style={{ backgroundColor: dt?.color || "#6B7280" }}
                            >
                              {dt?.label || dm.damageType}
                            </span>
                            <span
                              className="inline-flex items-center h-4 px-1.5 rounded text-[10px] font-medium text-white"
                              style={{ backgroundColor: sev?.color || "#9CA3AF" }}
                            >
                              {sev?.label || dm.severity}
                            </span>
                          </div>
                          {dm.note ? (
                            <p className="text-xs text-slate-500 mt-0.5">{dm.note}</p>
                          ) : null}
                        </div>
                        <span className="text-[11px] text-slate-400 shrink-0">{formatDate(dm.createdAt)}</span>
                      </div>
                      <div className="mt-1">
                        <Link
                          href={`/app/intakes/${dm.intakeId}`}
                          className="text-[11px] text-blue-600 hover:text-blue-700"
                        >
                          Kabul detayı →
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Fotoğraf Geçmişi" icon={Camera} count={allPhotos.length}>
            {allPhotos.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <Camera className="size-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">Bu araç için fotoğraf bulunmuyor</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allPhotos.map((p) => {
                  const pt = PHOTO_TYPES[p.type as keyof typeof PHOTO_TYPES]
                  return (
                    <Link
                      key={p.id}
                      href={`/app/intakes/${p.intakeId}`}
                      className="block rounded-lg border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
                    >
                      <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center">
                        {p.fileUrl ? (
                          <img
                            src={p.fileUrl}
                            alt={p.label || pt?.label || "Fotoğraf"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Camera className="size-6 text-slate-300" />
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-[11px] font-medium text-slate-700 truncate">
                          {pt?.label || p.label || p.type}
                        </p>
                        <p className="text-[10px] text-slate-400">{formatDate(p.createdAt)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {v.notes ? (
            <SectionCard title="Notlar" icon={FileText}>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{v.notes}</p>
            </SectionCard>
          ) : null}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Hash className="size-4 text-slate-500" />
                Araç Durumu
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <StatusIndicator
                label="İşlem"
                value={v.intakes.length > 0 ? "İşlem var" : "Pasif"}
                color={v.intakes.length > 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-50 border-slate-200"}
              />
              {workOrders.length > 0 && (
                <StatusIndicator
                  label="Açık İş Emri"
                  value={workOrders.filter((i) => i.order && !["delivered", "cancelled"].includes(i.order.status)).length > 0 ? "Var" : "Yok"}
                  color={workOrders.filter((i) => i.order && !["delivered", "cancelled"].includes(i.order.status)).length > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "text-slate-500 bg-slate-50 border-slate-200"}
                />
              )}
              {v.intakes.some((i) => i.status === "waiting_approval") && (
                <StatusIndicator
                  label="Onay Bekliyor"
                  value="Var"
                  color="text-amber-700 bg-amber-50 border-amber-200"
                />
              )}
              <StatusIndicator
                label="Hasar Kaydı"
                value={allDamageMarks.length > 0 ? `${allDamageMarks.length} hasar` : "Yok"}
                color={allDamageMarks.length > 0 ? "text-rose-700 bg-rose-50 border-rose-200" : "text-slate-500 bg-slate-50 border-slate-200"}
              />
              <StatusIndicator
                label="Fotoğraf"
                value={allPhotos.length > 0 ? `${allPhotos.length} fotoğraf` : "Yok"}
                color={allPhotos.length > 0 ? "text-blue-700 bg-blue-50 border-blue-200" : "text-slate-500 bg-slate-50 border-slate-200"}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Link href={`/app/vehicles/${v.id}/edit`}>
              <Button variant="outline" className="w-full gap-2">
                <Pencil className="size-4" />
                Aracı Düzenle
              </Button>
            </Link>
            <Link href={`/app/intakes/new?vehicleId=${v.id}`}>
              <Button variant="outline" className="w-full gap-2">
                <ClipboardList className="size-4" />
                Yeni Araç Kabulü
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
      <dt className="text-[11px] text-slate-500 font-medium">{label}</dt>
      <dd className="text-sm font-semibold text-slate-800 mt-0.5">{value}</dd>
    </div>
  )
}

function StatusIndicator({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-sm", color)}>
      <span className="font-medium">{label}</span>
      <span className="font-semibold text-xs">{value}</span>
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
