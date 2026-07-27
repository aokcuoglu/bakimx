"use client"

import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/format"
import { bpsToPercent, parseTRYToKurus } from "@/lib/money"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import {
  ArrowLeft, Pause, Play,
  Camera, Plus, Package, StickyNote, Timer,
  CheckSquare, Square, Trash2, Send,
  User, Phone, Car, CheckCircle2, ShoppingCart,
} from "lucide-react"
import { BottomSheet } from "@/components/shared/bottom-sheet"
import { OrderItemsChecklist } from "@/components/technician/order-items-checklist"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SupplierAutocompleteField } from "@/components/suppliers/supplier-autocomplete-field"
import {
  ORDER_STATUS, CHECKLIST_CATEGORIES,
  PARTS_REQUEST_STATUS,
  fuelTypeLabel, transmissionLabel,
} from "@/lib/constants"
import type { ChecklistCategoryKey } from "@/lib/constants"
import {
  startWorkAction, holdWorkAction, completeWorkAction,
  addChecklistItemAction, toggleChecklistItemAction, deleteChecklistItemAction,
  addInternalNoteAction, deleteInternalNoteAction,
  createPartsRequestAction, updatePartsRequestStatusAction,
  startLaborSessionAction, stopLaborSessionAction,
} from "@/app/(app)/technician/actions"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PartSearchInput } from "@/components/parts/part-search-input"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { partNameWithBrand } from "@/lib/ocr/part-box-result"
import type { PartBoxOcrResult, PartNumberSuggestion } from "@/lib/ocr/types"
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/ocr/types"
import {
  countBlockingChecklist,
  countIncompleteItems,
  startWorkBlockMessage,
  completeWorkBlockMessage,
  START_GATE_CATEGORIES,
  COMPLETE_GATE_CATEGORIES,
} from "@/lib/technician/gates"

type OrderData = {
  id: string
  workOrderNo: string
  status: string
  paymentStatus: string
  technicianName: string | null
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
  assignedAt: string | null
  completedAt: string | null
  estimatedDeliveryAt: string | null
  createdAt: string
  notes: string | null
  discountAmount: number | null
  taxRate: number | null
  totals: {
    partsTotal: number
    laborTotal: number
    subtotal: number
    discountAmount: number
    taxAmount: number
    grandTotal: number
    hasAnyPrice: boolean
    partsCount: number
    laborCount: number
  }
  items: { id: string; type: string; name: string; sku: string | null; unit: string | null; quantity: number; unitPrice: number | null; totalPrice: number | null; note: string | null; source: string | null; purchasePriceKurus: number | null; supplierName: string | null; purchasedAt: string | null; completedAt: string | null }[]
  customer: { id: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null; type: string; phone: string; email: string | null }
  vehicle: { id: string; plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null; color: string | null; fuelType: string | null; transmission: string | null; catalogVehicleTypeId: number | null }
  intake: { id: string; status: string; mileageAtIntake: number | null; customerComplaint: string; internalNote: string | null; createdAt: string }
  damageMarks: { id: string; zone: string; damageType: string; severity: string; note: string | null }[]
  photos: { id: string; type: string; label: string; fileUrl: string | null; phase: string; serviceOrderId: string | null; serviceOrderItemId: string | null; note: string | null; createdAt: string }[]
  checklistItems: { id: string; category: string; description: string; isCompleted: boolean; isRequired: boolean; completedAt: string | null; note: string | null; sortOrder: number }[]
  internalNotes: { id: string; content: string; isPinned: boolean; createdAt: string }[]
  partsRequests: { id: string; partName: string; partSku: string | null; brand: string | null; quantity: number; note: string | null; status: string; createdAt: string }[]
  laborSessions: { id: string; startTime: string; endTime: string | null; durationMinutes: number | null; note: string | null }[]
  paidAmount: number
  remainingAmount: number
  vehicleId: string
}

type TechnicianInfo = {
  id: string
  fullName: string
  role: string
}

type SupplierInfo = {
  id: string
  name: string
}

export function TechnicianOrderDetail({
  order,
  technicians,
  suppliers,
}: {
  order: OrderData
  technicians: TechnicianInfo[]
  suppliers: SupplierInfo[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const statusInfo = (ORDER_STATUS as Record<string, { label: string; color: string }>)[order.status]
  const statusLabel = statusInfo?.label || order.status
  const statusColor = statusInfo?.color || "bg-muted text-foreground"

  const activeLabor = order.laborSessions.find((l) => !l.endTime)
  const totalLaborMinutes = order.laborSessions
    .filter((l) => l.durationMinutes)
    .reduce((sum, l) => sum + (l.durationMinutes || 0), 0)

  const inspectionItems = order.checklistItems.filter((c) => c.category === "inspection")
  const repairItems = order.checklistItems.filter((c) => c.category === "repair")
  const deliveryItems = order.checklistItems.filter((c) => c.category === "delivery")

  // Alış fotoğrafları (serviceOrderItemId != null) dahili-yalnızdır; onarım
  // galerilerine sızmaması için hepsinden dışlanır.
  const galleryPhotos = order.photos.filter((p) => p.serviceOrderItemId == null)
  const beforePhotos = galleryPhotos.filter((p) => p.phase === "intake")
  const duringPhotos = galleryPhotos.filter((p) => p.phase === "repair_progress")
  const afterPhotos = galleryPhotos.filter((p) => p.phase === "delivery")

  const purchasedItems = order.items.filter((i) => i.source === "purchase")

  const canStart = ["approved", "waiting_approval"].includes(order.status)
  const canHold = order.status === "in_progress"
  const canComplete = order.status === "in_progress" || order.status === "waiting_parts"
  const locked = isOrderLocked(order.status as OrderStatus)

  const startMissing = countBlockingChecklist(order.checklistItems, START_GATE_CATEGORIES)
  const completeChecklistMissing = countBlockingChecklist(order.checklistItems, COMPLETE_GATE_CATEGORIES)
  const completeItemsMissing = countIncompleteItems(order.items)
  const startBlockedMessage = startWorkBlockMessage(startMissing)
  const completeBlockedMessage = completeWorkBlockMessage(completeChecklistMissing, completeItemsMissing)

  function handleStartWork() {
    startTransition(async () => {
      await startWorkAction(order.id)
      router.refresh()
    })
  }

  function handleHoldWork() {
    startTransition(async () => {
      await holdWorkAction(order.id)
      router.refresh()
    })
  }

  function handleCompleteWork() {
    startTransition(async () => {
      await completeWorkAction(order.id)
      router.refresh()
    })
  }

  function handleStartLabor() {
    startTransition(async () => {
      await startLaborSessionAction(order.id)
      router.refresh()
    })
  }

  function handleStopLabor() {
    startTransition(async () => {
      await stopLaborSessionAction(order.id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/technician" className="hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          Teknisyen Paneli
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{order.workOrderNo}</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{order.workOrderNo}</h2>
            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", statusColor)}>
              {statusLabel}
            </span>
          </div>
          {order.assignedTechnicianName && (
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
              <User className="size-3.5" />
              {order.assignedTechnicianName}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <VehicleCard vehicle={order.vehicle} />
        <CustomerCard customer={order.customer} />
      </div>

      <ComplaintCard complaint={order.intake.customerComplaint} />

      <div className="rounded-lg border border-border bg-white p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Kontrol Listesi</h3>
        <ChecklistSection
          title="Kontrol"
          category="inspection"
          items={inspectionItems}
          orderId={order.id}
          locked={locked}
        />
        <ChecklistSection
          title="Onarım"
          category="repair"
          items={repairItems}
          orderId={order.id}
          locked={locked}
        />
        <ChecklistSection
          title="Teslim"
          category="delivery"
          items={deliveryItems}
          orderId={order.id}
          locked={locked}
        />
        {locked ? (
          <p className="text-xs text-muted-foreground/70 mt-2">Teslim edilmiş/iptal edilmiş iş emrinde kontrol maddesi eklenemez</p>
        ) : (
          <AddChecklistItemForm orderId={order.id} />
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Timer className="size-4 text-muted-foreground" />
            İşçilik Süresi
          </h3>
          {totalLaborMinutes > 0 && (
            <span className="text-sm font-medium text-foreground">
              Toplam: {Math.floor(totalLaborMinutes / 60)}s {totalLaborMinutes % 60}dk
            </span>
          )}
        </div>

        {activeLabor ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
            <div className="size-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-foreground font-medium">İşçilik devam ediyor</span>
            <span className="text-xs text-muted-foreground">
              Başlangıç: {new Date(activeLabor.startTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <Button
              variant="destructive"
              size="lg"
              onClick={handleStopLabor}
              disabled={isPending}
              className="ml-auto touch-manipulation"
            >
              <Pause className="size-4" />
              Durdur
            </Button>
          </div>
        ) : (
          <Button
            variant="success"
            size="lg"
            onClick={handleStartLabor}
            disabled={isPending || !canStart && !canHold}
            className="touch-manipulation"
          >
            <Play className="size-4" />
            İşçilik Başlat
          </Button>
        )}

        {order.laborSessions.filter((l) => l.endTime).length > 0 && (
          <div className="mt-3 space-y-1.5">
            {order.laborSessions.filter((l) => l.endTime).map((session) => (
              <div key={session.id} className="flex items-center justify-between text-xs text-muted-foreground py-1.5 px-2 rounded bg-muted">
                <span>
                  {new Date(session.startTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  {" → "}
                  {new Date(session.endTime!).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="font-medium">
                  {session.durationMinutes ? `${Math.floor(session.durationMinutes / 60)}s ${session.durationMinutes % 60}dk` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Camera className="size-4 text-muted-foreground" />
          Onarım Fotoğrafları
        </h3>
        <PhotoSection label="Onarım Öncesi" photos={beforePhotos} />
        <PhotoSection label="Onarım Sırasında" photos={duringPhotos} />
        <PhotoSection label="Onarım Sonrası" photos={afterPhotos} />
        <p className="text-xs text-muted-foreground/70 mt-2">Fotoğraf yüklemek için araç kabulünden veya iş emri detayından fotoğraf ekleyin.</p>
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Package className="size-4 text-muted-foreground" />
            Parça Talepleri
          </h3>
        </div>
        <PartsRequestSection requests={order.partsRequests} orderId={order.id} locked={locked} />
        {locked ? (
          <p className="text-xs text-muted-foreground/70 mt-2">Teslim edilmiş/iptal edilmiş iş emrinde parça talep edilemez</p>
        ) : (
          <AddPartsRequestForm orderId={order.id} vehicleTypeId={order.vehicle.catalogVehicleTypeId} />
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ShoppingCart className="size-4 text-muted-foreground" />
            Dışarıdan Alınan Parçalar
          </h3>
        </div>
        <PurchasedItemsSection items={purchasedItems} />
        {locked ? (
          <p className="text-xs text-muted-foreground/70 mt-2">Teslim edilmiş/iptal edilmiş iş emrine parça eklenemez</p>
        ) : (
          <AddPurchaseButton
            orderId={order.id}
            suppliers={suppliers}
            technicians={technicians}
            defaultTechnicianId={order.assignedTechnicianId}
          />
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <StickyNote className="size-4 text-muted-foreground" />
          İç Notlar
          <span className="text-[10px] font-normal text-muted-foreground/70 ml-1">(Müşteriye görünmez)</span>
        </h3>
        <InternalNotesSection notes={order.internalNotes} orderId={order.id} locked={locked} />
        {locked ? (
          <p className="text-xs text-muted-foreground/70 mt-2">Teslim edilmiş/iptal edilmiş iş emrine iç not eklenemez</p>
        ) : (
          <AddInternalNoteForm orderId={order.id} />
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Yapılacak İşler
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {order.items.filter((i) => i.completedAt).length}/{order.items.length}
          </span>
        </h3>
        <OrderItemsChecklist items={order.items} locked={locked} />
        {order.totals.hasAnyPrice && (
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            {order.totals.discountAmount > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>İndirim</span>
                <span>-{formatTRY(order.totals.discountAmount)}</span>
              </div>
            )}
            {order.totals.taxAmount > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>KDV (%{bpsToPercent(order.taxRate ?? 0)})</span>
                <span>{formatTRY(order.totals.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold text-foreground">
              <span>Toplam</span>
              <span>{formatTRY(order.totals.grandTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {order.damageMarks.length > 0 && (
        <div className="rounded-lg border border-border bg-white p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Hasar Kayıtları</h3>
          <div className="space-y-1.5">
            {order.damageMarks.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded bg-destructive/10">
                <span className="font-medium text-foreground">{d.zone}</span>
                <span className="text-foreground/60">·</span>
                <span className="text-foreground">{d.damageType}</span>
                <span className="text-foreground/50 text-xs">({d.severity})</span>
                {d.note && <span className="text-foreground/60 text-xs ml-auto">{d.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 border-t border-border -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 space-y-2">
        <div className="flex gap-2 sm:justify-center">
          {canStart && (
            <Button
              size="lg"
              onClick={handleStartWork}
              disabled={isPending || !!startBlockedMessage}
              className="flex-1 sm:flex-initial gap-2 px-6 font-semibold touch-manipulation"
            >
              <Play className="size-5" />
              İşe Başla
            </Button>
          )}
          {canHold && (
            <Button
              variant="warning"
              size="lg"
              onClick={handleHoldWork}
              disabled={isPending}
              className="flex-1 sm:flex-initial gap-2 px-6 font-semibold touch-manipulation"
            >
              <Pause className="size-5" />
              Beklemeye Al
            </Button>
          )}
          {canComplete && (
            <Button
              variant="success"
              size="lg"
              onClick={handleCompleteWork}
              disabled={isPending || !!completeBlockedMessage}
              className="flex-1 sm:flex-initial gap-2 px-6 font-semibold touch-manipulation"
            >
              <CheckCircle2 className="size-5" />
              Tamamla
            </Button>
          )}
          {!canStart && !canHold && !canComplete && (
            <div className="flex-1 text-center text-sm text-muted-foreground py-2">
              Bu iş emri için şu anda işlem yapılamaz
            </div>
          )}
        </div>
        {canStart && startBlockedMessage && (
          <p className="text-xs text-warning-foreground text-center">{startBlockedMessage}</p>
        )}
        {canComplete && completeBlockedMessage && (
          <p className="text-xs text-warning-foreground text-center">{completeBlockedMessage}</p>
        )}
      </div>
    </div>
  )
}

function VehicleCard({ vehicle }: { vehicle: OrderData["vehicle"] }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <Car className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Araç</h3>
      </div>
      <div className="text-lg font-bold text-foreground mb-1">{vehicle.plate}</div>
      <div className="text-sm text-muted-foreground">{vehicle.brand} {vehicle.model}</div>
      {vehicle.modelYear && <div className="text-xs text-muted-foreground">Yıl: {vehicle.modelYear}</div>}
      {vehicle.mileage && <div className="text-xs text-muted-foreground">KM: {vehicle.mileage.toLocaleString("tr-TR")}</div>}
      {vehicle.fuelType && <div className="text-xs text-muted-foreground">Yakıt: {fuelTypeLabel(vehicle.fuelType)}</div>}
      {vehicle.transmission && <div className="text-xs text-muted-foreground">Vites: {transmissionLabel(vehicle.transmission)}</div>}
    </div>
  )
}

function CustomerCard({ customer }: { customer: OrderData["customer"] }) {
  const name = customer.type === "corporate"
    ? customer.companyName || "Kurumsal"
    : customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Müşteri"

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <User className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Müşteri</h3>
      </div>
      <div className="text-base font-semibold text-foreground">{name}</div>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
        <Phone className="size-3.5" />
        <a href={`tel:${customer.phone}`} className="text-primary hover:underline">{customer.phone}</a>
      </div>
      {customer.email && (
        <div className="text-xs text-muted-foreground mt-1">{customer.email}</div>
      )}
    </div>
  )
}

function ComplaintCard({ complaint }: { complaint: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <h3 className="text-sm font-semibold text-foreground mb-2">Müşteri Şikayeti</h3>
      <p className="text-sm text-foreground whitespace-pre-wrap">{complaint}</p>
    </div>
  )
}

function ChecklistSection({
  title, category, items, orderId: _orderId, locked,
}: {
  title: string
  category: ChecklistCategoryKey
  items: OrderData["checklistItems"]
  orderId: string
  locked: boolean
}) {
  const categoryInfo = (CHECKLIST_CATEGORIES as Record<string, { label: string; color: string }>)[category]
  const [isPending, startTransition] = useTransition()

  if (items.length === 0) return null

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium", categoryInfo?.color)}>
          {categoryInfo?.label || title}
        </span>
        <span className="text-xs text-muted-foreground/70">
          {items.filter((i) => i.isCompleted).length}/{items.length}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <form
            key={item.id}
            action={() => {
              startTransition(async () => {
                await toggleChecklistItemAction(item.id, !item.isCompleted)
              })
            }}
            className="flex items-start gap-2 py-1.5 group"
          >
            <button
              type="submit"
              disabled={isPending || locked}
              className="mt-0.5 touch-manipulation"
            >
              {item.isCompleted
                ? <CheckSquare className="size-5 text-success" />
                : <Square className="size-5 text-muted-foreground/70 group-hover:text-muted-foreground" />
              }
            </button>
            <div className="flex-1 min-w-0">
              <span className={cn("text-sm", item.isCompleted ? "line-through text-muted-foreground/70" : "text-foreground")}>
                {item.description}
              </span>
              {item.note && <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>}
            </div>
            {!locked && !item.isRequired && (
              <button
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    await deleteChecklistItemAction(item.id)
                  })
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground/70 hover:text-destructive transition-opacity"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </form>
        ))}
      </div>
    </div>
  )
}

function AddChecklistItemForm({ orderId }: { orderId: string }) {
  const [show, setShow] = useState(false)
  const [category, setCategory] = useState<ChecklistCategoryKey>("inspection")
  const [description, setDescription] = useState("")
  const [isPending, startTransition] = useTransition()

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium mt-2"
      >
        <Plus className="size-4" />
        Kontrol Maddesi Ekle
      </button>
    )
  }

  return (
    <form
      action={() => {
        const fd = new FormData()
        fd.set("serviceOrderId", orderId)
        fd.set("category", category)
        fd.set("description", description)
        fd.set("sortOrder", "0")
        startTransition(async () => {
          await addChecklistItemAction(fd)
          setDescription("")
          setShow(false)
        })
      }}
      className="mt-3 p-3 rounded-lg bg-muted border border-border space-y-2"
    >
      <ToggleGroup value={[category]} onValueChange={(v) => { if (v.length) setCategory(v[0] as ChecklistCategoryKey) }}>
        {(["inspection", "repair", "delivery"] as ChecklistCategoryKey[]).map((cat) => {
          const info = (CHECKLIST_CATEGORIES as Record<string, { label: string }>)[cat]
          return (
            <ToggleGroupItem key={cat} value={cat} className="px-3 py-1.5 text-xs">
              {info?.label || cat}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
      <Input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Kontrol maddesi açıklaması..."
        required
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          size="lg"
          disabled={isPending || !description.trim()}
          className="touch-manipulation"
        >
          Ekle
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => { setShow(false); setDescription("") }}
          className="touch-manipulation"
        >
          İptal
        </Button>
      </div>
    </form>
  )
}

function PhotoSection({ label, photos }: { label: string; photos: { id: string; fileUrl: string | null; label: string; note: string | null }[] }) {
  if (photos.length === 0) return null
  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label} ({photos.length})</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((p) => (
          p.fileUrl ? (
            <a key={p.id} href={p.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.fileUrl}
                alt={p.label}
                className="w-full aspect-square object-cover rounded-lg border border-border"
              />
            </a>
          ) : (
            <div key={p.id} className="w-full aspect-square rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground/70">
              <Camera className="size-5" />
            </div>
          )
        ))}
      </div>
    </div>
  )
}

function PartsRequestSection({
  requests,
  orderId: _orderId,
  locked,
}: {
  requests: OrderData["partsRequests"]
  orderId: string
  locked: boolean
}) {
  const [isPending, startTransition] = useTransition()

  if (requests.length === 0) return null

  return (
    <div className="space-y-2">
      {requests.map((req) => {
        const statusInfo = (PARTS_REQUEST_STATUS as Record<string, { label: string; color: string }>)[req.status]
        const nextStatusMap: Record<string, string> = {
          requested: "prepared",
          prepared: "delivered",
        }
        const nextLabelMap: Record<string, string> = {
          requested: "Hazırlandı",
          prepared: "Teslim Edildi",
        }

        return (
          <div key={req.id} className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg bg-muted">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{req.partName}</span>
                {req.partSku && <span className="text-xs text-muted-foreground">({req.partSku})</span>}
                {req.brand && <span className="text-xs text-muted-foreground">{req.brand}</span>}
                <span className="text-xs text-muted-foreground">×{req.quantity}</span>
              </div>
              {req.note && <p className="text-xs text-muted-foreground mt-0.5">{req.note}</p>}
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{new Date(req.createdAt).toLocaleDateString("tr-TR")}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", statusInfo?.color)}>
                {statusInfo?.label || req.status}
              </span>
              {!locked && nextStatusMap[req.status] && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    startTransition(async () => {
                      await updatePartsRequestStatusAction(req.id, nextStatusMap[req.status])
                    })
                  }}
                  disabled={isPending}
                  className="touch-manipulation"
                >
                  <CheckCircle2 className="size-3" />
                  {nextLabelMap[req.status]}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AddPartsRequestForm({ orderId, vehicleTypeId }: { orderId: string; vehicleTypeId: number | null }) {
  const [show, setShow] = useState(false)
  const [partName, setPartName] = useState("")
  const [partSku, setPartSku] = useState("")
  const [brand, setBrand] = useState("")
  const [tecdocArticleId, setTecdocArticleId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState("1")
  const [note, setNote] = useState("")
  const [isPending, startTransition] = useTransition()

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium mt-2"
      >
        <Plus className="size-4" />
        Parça Talep Et
      </button>
    )
  }

  return (
    <form
      action={() => {
        const fd = new FormData()
        fd.set("serviceOrderId", orderId)
        fd.set("partName", partName)
        fd.set("partSku", partSku)
        fd.set("brand", brand)
        fd.set("tecdocArticleId", tecdocArticleId != null ? String(tecdocArticleId) : "")
        fd.set("quantity", quantity)
        fd.set("note", note)
        startTransition(async () => {
          await createPartsRequestAction(fd)
          setPartName("")
          setPartSku("")
          setBrand("")
          setTecdocArticleId(null)
          setQuantity("1")
          setNote("")
          setShow(false)
        })
      }}
      className="mt-3 p-3 rounded-lg bg-muted border border-border space-y-2"
    >
      <PartSearchInput
        value={partName}
        sku={partSku || null}
        vehicleTypeId={vehicleTypeId}
        placeholder="Parça adı *"
        onNameChange={(name) => {
          setPartName(name)
          // Serbest yazmaya dönülürse önceki katalog seçimi geçersizdir.
          setTecdocArticleId(null)
          setBrand("")
        }}
        onSelectArticle={(a: ArticleSearchResult) => {
          setPartName(a.productName)
          setPartSku(a.articleNo ?? "")
          setBrand(a.supplierName ?? "")
          setTecdocArticleId(a.tecdocArticleId ?? null)
        }}
        showClear={!!partName}
        onClear={() => { setPartName(""); setPartSku(""); setBrand(""); setTecdocArticleId(null) }}
      />
      <div className="flex gap-2">
        <Input
          type="text"
          value={partSku}
          onChange={(e) => {
            setPartSku(e.target.value)
            // Elle düzenlenen SKU önceki katalog seçimiyle uyuşmayabilir —
            // Parça adı alanındaki koruyucunun ikizi (bkz. onNameChange).
            setTecdocArticleId(null)
            setBrand("")
          }}
          placeholder="SKU / OEM No"
        />
        <Input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min="1"
          className="w-20"
        />
      </div>
      <Input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Not (opsiyonel)"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          size="lg"
          disabled={isPending || !partName.trim()}
          className="touch-manipulation"
        >
          <Send className="size-3.5" />
          Talep Et
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => { setShow(false); setPartName("") }}
          className="touch-manipulation"
        >
          İptal
        </Button>
      </div>
    </form>
  )
}

function PurchasedItemsSection({ items }: { items: OrderData["items"] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground/70">Henüz dışarıdan alınan parça yok.</p>
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-2 py-2 px-3 rounded-lg bg-muted border border-border"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">
              {item.supplierName ? `${item.supplierName} · ` : ""}
              {item.quantity} adet
              {item.purchasedAt ? ` · ${new Date(item.purchasedAt).toLocaleDateString("tr-TR")}` : ""}
            </p>
          </div>
          {item.purchasePriceKurus != null && (
            <span className="text-sm font-semibold text-foreground shrink-0">
              {formatTRY(item.purchasePriceKurus)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function todayTrString(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  return `${dd}.${mm}.${now.getFullYear()}`
}

function AddPurchaseButton({
  orderId,
  suppliers,
  technicians,
  defaultTechnicianId,
}: {
  orderId: string
  suppliers: SupplierInfo[]
  technicians: TechnicianInfo[]
  defaultTechnicianId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [sku, setSku] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState("1")
  const [price, setPrice] = useState("")
  const [purchasedAt, setPurchasedAt] = useState(todayTrString())
  const [technicianId, setTechnicianId] = useState(defaultTechnicianId || "")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<Pick<PartBoxOcrResult, "partName" | "brand" | "partNumbers"> | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)

  function resetForm() {
    setName("")
    setSku("")
    setSupplierName("")
    setSupplierId(null)
    setQuantity("1")
    setPrice("")
    setPurchasedAt(todayTrString())
    setTechnicianId(defaultTechnicianId || "")
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setError(null)
    setOcrLoading(false)
    setOcrResult(null)
    setOcrError(null)
  }

  function onPickFile(f: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
    setOcrResult(null)
    setOcrError(null)
    if (f) void runPartBoxOcr(f)
  }

  async function runPartBoxOcr(f: File) {
    setOcrLoading(true)
    setOcrError(null)
    try {
      const fd = new FormData()
      fd.set("image", f)
      const res = await fetch("/api/parts/ocr", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setOcrError(data?.error || "Kutu okunamadı, alanları elle girebilirsiniz.")
        return
      }
      setOcrResult({
        partName: data.result.partName,
        brand: data.result.brand,
        partNumbers: data.result.partNumbers ?? [],
      })
    } catch {
      setOcrError("Kutu okunamadı, alanları elle girebilirsiniz.")
    } finally {
      setOcrLoading(false)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!name.trim()) {
      setError("Parça adı zorunludur")
      return
    }
    const priceKurus = price.trim() ? parseTRYToKurus(price) : 0
    if (priceKurus == null) {
      setError("Geçerli bir alış fiyatı giriniz")
      return
    }

    const fd = new FormData()
    fd.set("serviceOrderId", orderId)
    fd.set("name", name.trim())
    fd.set("sku", sku.trim())
    fd.set("quantity", quantity || "1")
    fd.set("purchasePriceKurus", String(priceKurus))
    fd.set("supplierName", supplierName.trim())
    if (supplierId) fd.set("supplierId", supplierId)
    fd.set("purchasedAt", purchasedAt)
    if (technicianId) fd.set("purchasedById", technicianId)
    if (file) fd.set("file", file)

    setSubmitting(true)
    try {
      const res = await fetch("/api/orders/purchases", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Kaydedilemedi")
        setSubmitting(false)
        return
      }
      resetForm()
      setOpen(false)
      router.refresh()
    } catch {
      setError("Bağlantı hatası, lütfen tekrar deneyin")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium mt-2"
      >
        <Plus className="size-4" />
        Parça Aldım
      </button>

      <BottomSheet
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) resetForm()
        }}
        title="Dışarıdan Parça Alımı"
        description="Aldığınız parçayı bu iş emrine kalem olarak ekleyin."
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              size="lg"
              className="flex-1 touch-manipulation"
              disabled={submitting || !name.trim()}
              onClick={handleSubmit}
            >
              <Send className="size-3.5" />
              {submitting ? "Kaydediliyor…" : "Kalem Olarak Ekle"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="touch-manipulation"
              disabled={submitting}
              onClick={() => {
                setOpen(false)
                resetForm()
              }}
            >
              İptal
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-1">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Parça adı *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Ön fren balatası" />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Parça no / OEM</label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU / OEM" />
            </div>
            <div className="w-24 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Miktar</label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tedarikçi</label>
            <SupplierAutocompleteField
              suppliers={suppliers}
              value={supplierName}
              onChange={setSupplierName}
              onSelectSupplier={setSupplierId}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Alış fiyatı (₺)</label>
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Alış tarihi</label>
              <DatePicker value={purchasedAt} onChange={setPurchasedAt} />
            </div>
          </div>

          {technicians.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Alan teknisyen</label>
              <Select value={technicianId} onValueChange={(v) => setTechnicianId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seçiniz">
                    {(value) => technicians.find((t) => t.id === value)?.fullName || "Seçiniz"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Parça kutusu fotoğrafı</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            {previewUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Parça kutusu" className="w-full max-h-48 object-contain rounded-lg border border-border bg-muted" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 touch-manipulation"
                  onClick={() => onPickFile(null)}
                >
                  <Trash2 className="size-3.5" />
                  Kaldır
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 py-6 text-sm text-muted-foreground touch-manipulation"
              >
                <Camera className="size-6" />
                Fotoğraf çek / seç
              </button>
            )}
          </div>

          {ocrLoading && (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 py-6">
              <BrandSpinner size={36} label="Kutu okunuyor…" />
            </div>
          )}

          {ocrError && !ocrLoading && (
            <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
              {ocrError}
            </p>
          )}

          {ocrResult && !ocrLoading && (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
              <p className="text-xs font-medium text-primary">Kutudan okunan öneriler</p>

              {ocrResult.partName.value && (
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Parça adı</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setName(ocrResult.partName.value)}
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:border-primary hover:text-primary touch-manipulation"
                    >
                      {ocrResult.partName.value}
                    </button>
                    {ocrResult.brand.value && (
                      <button
                        type="button"
                        onClick={() => setName(partNameWithBrand(ocrResult.partName.value, ocrResult.brand.value))}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:border-primary hover:text-primary touch-manipulation"
                      >
                        {partNameWithBrand(ocrResult.partName.value, ocrResult.brand.value)}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {ocrResult.partNumbers.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Parça no (birini seçin)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ocrResult.partNumbers.map((pn: PartNumberSuggestion) => {
                      const low = pn.confidence != null && pn.confidence < LOW_CONFIDENCE_THRESHOLD
                      return (
                        <button
                          key={pn.value}
                          type="button"
                          onClick={() => setSku(pn.value)}
                          className={
                            "rounded-full border px-2.5 py-1 text-xs touch-manipulation hover:border-primary hover:text-primary " +
                            (low ? "border-amber-300 bg-amber-50 text-amber-700" : "border-border bg-background")
                          }
                          title={low ? "Düşük okuma güveni — kontrol edin" : undefined}
                        >
                          <span className="text-muted-foreground">{pn.label}</span>
                          <span className="mx-1 text-border">·</span>
                          {pn.value}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  )
}

function InternalNotesSection({
  notes,
  orderId: _orderId,
  locked,
}: {
  notes: OrderData["internalNotes"]
  orderId: string
  locked: boolean
}) {
  const [_isPending, startTransition] = useTransition()

  if (notes.length === 0) return null

  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <div key={note.id} className="flex items-start gap-2 py-2 px-3 rounded-lg bg-warning/10 border border-warning/20 group">
          <StickyNote className="size-4 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
            <p className="text-[10px] text-foreground/60 mt-1">
              {new Date(note.createdAt).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          {!locked && (
            <button
              onClick={() => {
                startTransition(async () => {
                  await deleteInternalNoteAction(note.id)
                })
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-warning/60 hover:text-destructive transition-opacity"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function AddInternalNoteForm({ orderId }: { orderId: string }) {
  const [content, setContent] = useState("")
  const [isPending, startTransition] = useTransition()

  return (
    <form
      action={() => {
        const fd = new FormData()
        fd.set("serviceOrderId", orderId)
        fd.set("content", content)
        startTransition(async () => {
          await addInternalNoteAction(fd)
          setContent("")
        })
      }}
      className="mt-3 flex gap-2"
    >
      <Input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="İç not ekle..."
        required
      />
      <Button
        type="submit"
        variant="warning"
        size="lg"
        disabled={isPending || !content.trim()}
        className="touch-manipulation"
      >
        <Plus className="size-4" />
        Ekle
      </Button>
    </form>
  )
}