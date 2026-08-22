"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"
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
  Cog,
  PackageCheck,
  ScrollText,
} from "lucide-react"
import { VehicleIdentity } from "@/components/vehicles/vehicle-identity"
import { StatusBadge, PaymentBadge } from "@/components/shared/status-badge"
import { ReminderStatusBadge, ReminderTypeBadge } from "@/components/reminders/reminder-status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { formatTRY } from "@/lib/format"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import {
  DAMAGE_TYPES,
  DAMAGE_SEVERITY,
  PHOTO_TYPES,
  arrivalReasonLabel,
  vehicleTypeLabel,
  fuelTypeLabel,
  transmissionLabel,
} from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { ReminderRow } from "@/lib/reminders/queries"
import {
  CrossWorkshopHistoryCard,
  WorkshopChip,
} from "@/components/vehicles/cross-workshop-history"
import type { CrossWorkshopHistory } from "@/lib/vehicle-history/types"

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
    fuelLevelAtIntake: number | null
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
      createdAt: string
      grandTotal: number
      changedPartLabels: string[]
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

type VehicleIntake = VehicleData["intakes"][number]
type OwnWorkOrderIntake = VehicleIntake & { order: NonNullable<VehicleIntake["order"]> }

export function VehicleDetail({
  vehicle: v,
  workshopName,
  crossWorkshop,
}: {
  vehicle: VehicleData
  /** Kendi iş emirlerinin künye çipinde basılan atölye adı. */
  workshopName: string
  /** Aracın başka servislerdeki geçmişi (BAK-77). */
  crossWorkshop: CrossWorkshopHistory
}) {
  const router = useRouter()
  const [confirmVinOpen, setConfirmVinOpen] = useState(false)
  const [confirmingVin, setConfirmingVin] = useState(false)

  async function handleConfirmVin() {
    setConfirmingVin(true)
    const { confirmVehicleVinAction } = await import("@/app/(app)/vehicles/actions")
    const res = await confirmVehicleVinAction(v.id)
    if (res?.error) {
      toast.error(res.error)
      setConfirmingVin(false)
      return
    }
    toast.success("Şase numarası teyit edildi")
    setConfirmVinOpen(false)
    setConfirmingVin(false)
    router.refresh()
  }

  const workOrders = v.intakes.filter((i): i is OwnWorkOrderIntake => i.order !== null)

  const allDamageMarks = v.intakes.flatMap((i) =>
    i.damageMarks.map((dm) => ({ ...dm, orderId: i.order?.id ?? null, intakeDate: i.createdAt }))
  )
  const allPhotos = v.intakes.flatMap((i) =>
    i.photos.map((p) => ({ ...p, orderId: i.order?.id ?? null }))
  )

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/vehicles" className="hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-4" />
          Araçlar
        </Link>
        <span className="mx-1">/</span>
        <span className="text-foreground font-medium truncate">{v.plate}</span>
      </div>

      <header className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <VehicleIdentity plate={v.plate} brand={v.brand} model={v.model} />
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href={`/orders/new?vehicleId=${v.id}`} aria-label="Yeni iş emri oluştur">
                <Wrench className="size-4" />
                <span className="hidden sm:inline">Yeni İş Emri</span>
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/vehicles/${v.id}/edit`} aria-label="Aracı düzenle">
                <Pencil className="size-4" />
                <span className="hidden sm:inline">Düzenle</span>
              </Link>
            </Button>
            <Button variant="navy" asChild>
              <Link href={`/vehicles/${v.id}/passport`} aria-label="Araç pasaportunu aç">
                <ScrollText className="size-4" />
                <span className="hidden sm:inline">Pasaport</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Car className="size-4 text-muted-foreground" />
                Araç Özeti
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-3 sm:grid-cols-3">
                <VehicleMetric icon={Car} label="Araç" value={[v.brand, v.model].filter(Boolean).join(" ") || "—"} />
                <VehicleMetric icon={Gauge} label="Kilometre" value={v.mileage ? `${v.mileage.toLocaleString("tr-TR")} km` : "—"} />
                <VehicleMetric icon={Calendar} label="Model yılı" value={v.modelYear ? String(v.modelYear) : "—"} />
              </div>
              <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
                <CompactDetail label="Tip" value={vehicleTypeLabel(v.vehicleType) || "—"} />
                <CompactDetail label="Renk" value={v.color || "—"} />
                <CompactDetail label="Yakıt" value={fuelTypeLabel(v.fuelType) || "—"} />
                <CompactDetail label="Şanzıman" value={transmissionLabel(v.transmission) || "—"} />
                <CompactDetail label="Şase No" value={v.vin || "—"} mono />
                <CompactDetail label="Motor No" value={v.engineNo || "—"} mono />
              </dl>
              {v.vin ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                  <span className={v.vinConfirmed ? "inline-flex items-center gap-1.5 text-success-strong" : "inline-flex items-center gap-1.5 text-warning-strong"}>
                    <ShieldCheck className="size-4" />
                    {v.vinConfirmed ? "Şase numarası teyit edildi" : "Şase numarası teyit bekliyor"}
                  </span>
                  {!v.vinConfirmed ? <Button variant="outline" size="sm" onClick={() => setConfirmVinOpen(true)}>Teyit Et</Button> : null}
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-1 gap-1 border-t border-border pt-3 text-xs text-muted-foreground sm:grid-cols-2">
                <span>Kayıt: {formatDate(v.createdAt)}</span>
                <span>Güncelleme: {formatDateTime(v.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          <SectionCard title="Müşteri Bilgisi" icon={User} count={0}>
            <div className="flex items-start gap-3">
              <Link
                href={`/customers/${v.customer.id}`}
                className="flex items-center gap-3 hover:bg-muted rounded-lg p-2 -m-2 transition-colors flex-1"
              >
                <div className="size-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                  <User className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                    {customerDisplayName(v.customer)}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span onClick={() => window.location.href = `tel:${v.customer.phone}`} className="inline-flex items-center gap-1 hover:text-primary cursor-pointer">
                      <Phone className="size-3" />
                      {v.customer.phone}
                    </span>
                    {v.customer.email ? (
                      <span className="truncate">{v.customer.email}</span>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground shrink-0 ml-auto" />
              </Link>
            </div>
          </SectionCard>

          <SectionCard
            title="İş Emri Geçmişi"
            icon={Wrench}
            count={workOrders.length + crossWorkshop.orders.length}
            action={
              <Link
                href={`/orders/new?vehicleId=${v.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary"
              >
                <Plus className="size-3.5" />
                Yeni İş Emri
              </Link>
            }
          >
            <Tabs defaultValue="own">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="own">Kendi ({workOrders.length})</TabsTrigger>
                <TabsTrigger value="other">Başkası ({crossWorkshop.orders.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="own" className="pt-3">
                {workOrders.length === 0 ? <OrderHistoryEmpty message="Bu araç için kendi iş emriniz bulunmuyor" /> : (
                  <div className="grid gap-3">
                    {workOrders.map((intake) => (
                      <OwnWorkOrderCard key={intake.order.id} intake={intake} workshopName={workshopName} />
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="other" className="pt-3">
                {crossWorkshop.orders.length === 0 ? <OrderHistoryEmpty message="Teslim edilmiş başka servis kaydı bulunmuyor" /> : (
                  <div className="grid gap-3">
                    {crossWorkshop.orders.map((order) => <OtherWorkOrderCard key={order.key} order={order} />)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </SectionCard>

          <CrossWorkshopHistoryCard history={crossWorkshop} showOrders={false} />

          <SectionCard
            title="Bakım Hatırlatmaları"
            icon={BellRing}
            count={v.reminders.length}
            action={
              <Link
                href={`/reminders/new?customerId=${v.customer.id}&vehicleId=${v.id}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary"
              >
                <Plus className="size-3.5" />
                Yeni Hatırlatma
              </Link>
            }
          >
            {v.reminders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <BellRing className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm">Bu araç için bakım hatırlatması bulunmuyor</p>
              </div>
            ) : (
              <div className="divide-y divide-border -mx-4 sm:-mx-5">
                {v.reminders.map((r) => (
                  <Link
                    key={r.id}
                    href={`/reminders/${r.id}`}
                    className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{r.title}</span>
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
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Hasar Geçmişi" icon={AlertTriangle} count={allDamageMarks.length}>
            {allDamageMarks.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <AlertTriangle className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm">Bu araç için kayıtlı hasar bulunmuyor</p>
              </div>
            ) : (
              <div className="divide-y divide-border -mx-4 sm:-mx-5">
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
                            <span className="text-xs font-semibold text-foreground">{dm.zone}</span>
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
                            <p className="text-xs text-muted-foreground mt-0.5">{dm.note}</p>
                          ) : null}
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(dm.createdAt)}</span>
                      </div>
                      <div className="mt-1">
                        <Link
                          href={`/orders/${dm.orderId}`}
                          className="text-[11px] text-primary hover:text-primary"
                        >
                          İş emri →
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
              <div className="text-center py-6 text-muted-foreground">
                <Camera className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm">Bu araç için fotoğraf bulunmuyor</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allPhotos.map((p) => {
                  const pt = PHOTO_TYPES[p.type as keyof typeof PHOTO_TYPES]
                  return (
                    <Link
                      key={p.id}
                      href={`/orders/${p.orderId}`}
                      className="block rounded-lg border border-border overflow-hidden hover:border-border transition-colors"
                    >
                      <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                        {p.fileUrl ? (
                          <Image
                            src={p.fileUrl}
                            alt={p.label || pt?.label || "Fotoğraf"}
                            width={160}
                            height={120}
                            unoptimized
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Camera className="size-6 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="text-[11px] font-medium text-foreground truncate">
                          {pt?.label || p.label || p.type}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(p.createdAt)}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </SectionCard>

          {v.notes ? (
            <SectionCard title="Notlar" icon={FileText}>
              <p className="text-sm text-foreground whitespace-pre-wrap">{v.notes}</p>
            </SectionCard>
          ) : null}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Hash className="size-4 text-muted-foreground" />
                Araç Durumu
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <StatusIndicator
                label="İşlem"
                value={v.intakes.length > 0 ? "İşlem var" : "Pasif"}
                color={v.intakes.length > 0 ? "text-foreground bg-success/10 border-success/20" : "text-muted-foreground bg-muted border-border"}
              />
              {workOrders.length > 0 && (
                <StatusIndicator
                  label="Açık İş Emri"
                  value={workOrders.filter((i) => i.order && !["delivered", "cancelled"].includes(i.order.status)).length > 0 ? "Var" : "Yok"}
                  color={workOrders.filter((i) => i.order && !["delivered", "cancelled"].includes(i.order.status)).length > 0 ? "text-foreground bg-warning/10 border-warning/20" : "text-muted-foreground bg-muted border-border"}
                />
              )}
              {v.intakes.some((i) => i.status === "waiting_approval") && (
                  <StatusIndicator
                    label="Onay Bekliyor"
                    value="Var"
                    color="text-foreground bg-warning/10 border-warning/20"
                  />
              )}
              <StatusIndicator
                label="Hasar Kaydı"
                value={allDamageMarks.length > 0 ? `${allDamageMarks.length} hasar` : "Yok"}
                color={allDamageMarks.length > 0 ? "text-foreground bg-destructive/10 border-destructive/20" : "text-muted-foreground bg-muted border-border"}
              />
              <StatusIndicator
                label="Fotoğraf"
                value={allPhotos.length > 0 ? `${allPhotos.length} fotoğraf` : "Yok"}
                color={allPhotos.length > 0 ? "text-foreground bg-primary/10 border-primary/20" : "text-muted-foreground bg-muted border-border"}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Link href={`/vehicles/${v.id}/edit`}>
              <Button variant="outline" className="w-full gap-2">
                <Pencil className="size-4" />
                Aracı Düzenle
              </Button>
            </Link>
            <Link href={`/orders/new?vehicleId=${v.id}`}>
              <Button variant="outline" className="w-full gap-2">
                <ClipboardList className="size-4" />
                Yeni İş Emri
              </Button>
            </Link>
          </div>
        </aside>
      </div>

      <AlertDialog
        open={confirmVinOpen}
        onOpenChange={(open) => {
          if (!open && !confirmingVin) setConfirmVinOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Şase numarasını teyit et</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-foreground">{v.vin}</span> numaralı
              şasenin ruhsatla teyit edildiğini onaylıyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmingVin}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmVin} disabled={confirmingVin}>
              {confirmingVin ? "Teyit ediliyor…" : "Teyit Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function OwnWorkOrderCard({ intake, workshopName }: { intake: OwnWorkOrderIntake; workshopName: string }) {
  const { order } = intake
  return (
    <Link
      href={`/orders/${order.id}`}
      className="group rounded-lg border border-border p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-foreground">{order.workOrderNo || "—"}</span>
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <WorkshopChip name={workshopName} />
            <span>{formatDate(order.createdAt)}</span>
            {intake.mileageAtIntake ? <span>{intake.mileageAtIntake.toLocaleString("tr-TR")} km</span> : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
          <span className="text-xs text-muted-foreground sm:hidden">Toplam</span>
          <p className="text-sm font-semibold text-foreground">{order.grandTotal > 0 ? formatTRY(order.grandTotal) : "—"}</p>
          {order.estimatedDeliveryAt ? <p className="text-[11px] text-muted-foreground">Tahmini: {formatDate(order.estimatedDeliveryAt)}</p> : null}
        </div>
      </div>
      {intake.customerComplaint ? <p className="mt-3 text-sm text-muted-foreground">{intake.customerComplaint}</p> : null}
      <ChangedParts labels={order.changedPartLabels} />
    </Link>
  )
}

function OtherWorkOrderCard({ order }: { order: CrossWorkshopHistory["orders"][number] }) {
  return (
    <article className="rounded-lg border border-border p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <WorkshopChip name={order.workshopName} city={order.workshopCity} />
        </div>
        <span className="text-xs text-muted-foreground">{formatDate(order.servicedAt)}</span>
      </div>
      <div className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
        <p>{order.complaint || "Şikâyet bilgisi yok"}</p>
        <p className="sm:text-right">
          {[order.arrivalReason ? arrivalReasonLabel(order.arrivalReason) : null, order.mileage ? `${order.mileage.toLocaleString("tr-TR")} km` : null]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
      </div>
      <ChangedParts labels={order.itemLabels} />
      <p className="mt-3 text-[11px] text-muted-foreground">Diğer servisin fiyat bilgisi paylaşılmaz.</p>
    </article>
  )
}

function ChangedParts({ labels }: { labels: string[] }) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <PackageCheck className="size-3.5 text-muted-foreground" />
        Değişen parçalar
      </p>
      {labels.length > 0 ? (
        <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          {labels.map((label, index) => <li key={`${label}-${index}`} className="flex min-w-0 items-start gap-2"><Cog className="mt-0.5 size-3 shrink-0" /><span>{label}</span></li>)}
        </ul>
      ) : <p className="mt-1 text-xs text-muted-foreground">Değişen parça kaydı yok.</p>}
    </div>
  )
}

function OrderHistoryEmpty({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-border py-7 text-center text-muted-foreground"><Wrench className="mx-auto mb-2 size-7" /><p className="text-sm">{message}</p></div>
}

function VehicleMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground"><Icon className="size-4" /></span>
      <div className="min-w-0"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><p className="truncate text-sm font-semibold text-foreground">{value}</p></div>
    </div>
  )
}

function CompactDetail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex min-w-0 items-baseline justify-between gap-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={cn("truncate text-right font-medium text-foreground", mono && "font-mono text-xs")}>{value}</dd></div>
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
