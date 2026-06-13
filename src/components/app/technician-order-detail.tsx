"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  ArrowLeft, Pause, Play,
  Camera, Plus, Package, StickyNote, Timer,
  CheckSquare, Square, Trash2, Send,
  User, Phone, Car, CheckCircle2,
} from "lucide-react"
import {
  ORDER_STATUS, CHECKLIST_CATEGORIES,
  PARTS_REQUEST_STATUS,
} from "@/lib/constants"
import type { ChecklistCategoryKey } from "@/lib/constants"
import {
  startWorkAction, holdWorkAction, completeWorkAction,
  addChecklistItemAction, toggleChecklistItemAction, deleteChecklistItemAction,
  addInternalNoteAction, deleteInternalNoteAction,
  createPartsRequestAction, updatePartsRequestStatusAction,
  startLaborSessionAction, stopLaborSessionAction,
} from "@/app/app/technician/actions"

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
  items: { id: string; type: string; name: string; sku: string | null; unit: string | null; quantity: number; unitPrice: number | null; totalPrice: number | null; note: string | null }[]
  customer: { id: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null; type: string; phone: string; email: string | null }
  vehicle: { id: string; plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null; color: string | null; fuelType: string | null; transmission: string | null }
  intake: { id: string; status: string; mileageAtIntake: number | null; customerComplaint: string; internalNote: string | null; createdAt: string }
  damageMarks: { id: string; zone: string; damageType: string; severity: string; note: string | null }[]
  photos: { id: string; type: string; label: string; fileUrl: string | null; phase: string; serviceOrderId: string | null; note: string | null; createdAt: string }[]
  checklistItems: { id: string; category: string; description: string; isCompleted: boolean; completedAt: string | null; note: string | null; sortOrder: number }[]
  internalNotes: { id: string; content: string; isPinned: boolean; createdAt: string }[]
  partsRequests: { id: string; partName: string; partSku: string | null; quantity: number; note: string | null; status: string; createdAt: string }[]
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

export function TechnicianOrderDetail({
  order,
  technicians: _technicians,
}: {
  order: OrderData
  technicians: TechnicianInfo[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const statusInfo = (ORDER_STATUS as Record<string, { label: string; color: string }>)[order.status]
  const statusLabel = statusInfo?.label || order.status
  const statusColor = statusInfo?.color || "bg-slate-100 text-slate-800"

  const activeLabor = order.laborSessions.find((l) => !l.endTime)
  const totalLaborMinutes = order.laborSessions
    .filter((l) => l.durationMinutes)
    .reduce((sum, l) => sum + (l.durationMinutes || 0), 0)

  const inspectionItems = order.checklistItems.filter((c) => c.category === "inspection")
  const repairItems = order.checklistItems.filter((c) => c.category === "repair")
  const deliveryItems = order.checklistItems.filter((c) => c.category === "delivery")

  const beforePhotos = order.photos.filter((p) => p.phase === "intake")
  const duringPhotos = order.photos.filter((p) => p.phase === "repair_progress")
  const afterPhotos = order.photos.filter((p) => p.phase === "delivery")

  const canStart = ["approved", "waiting_approval"].includes(order.status)
  const canHold = order.status === "in_progress"
  const canComplete = order.status === "in_progress" || order.status === "waiting_parts"

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
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/app/technician" className="hover:text-slate-700 inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          Teknisyen Paneli
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700 font-medium">{order.workOrderNo}</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{order.workOrderNo}</h2>
            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", statusColor)}>
              {statusLabel}
            </span>
          </div>
          {order.assignedTechnicianName && (
            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
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

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Kontrol Listesi</h3>
        <ChecklistSection
          title="Kontrol"
          category="inspection"
          items={inspectionItems}
          orderId={order.id}
        />
        <ChecklistSection
          title="Onarım"
          category="repair"
          items={repairItems}
          orderId={order.id}
        />
        <ChecklistSection
          title="Teslim"
          category="delivery"
          items={deliveryItems}
          orderId={order.id}
        />
        <AddChecklistItemForm orderId={order.id} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Timer className="size-4 text-slate-500" />
            İşçilik Süresi
          </h3>
          {totalLaborMinutes > 0 && (
            <span className="text-sm font-medium text-slate-700">
              Toplam: {Math.floor(totalLaborMinutes / 60)}s {totalLaborMinutes % 60}dk
            </span>
          )}
        </div>

        {activeLabor ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-green-800 font-medium">İşçilik devam ediyor</span>
            <span className="text-xs text-green-600">
              Başlangıç: {new Date(activeLabor.startTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <button
              onClick={handleStopLabor}
              disabled={isPending}
              className="ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors touch-manipulation disabled:opacity-50"
            >
              <Pause className="size-4" />
              Durdur
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartLabor}
            disabled={isPending || !canStart && !canHold}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="size-4" />
            İşçilik Başlat
          </button>
        )}

        {order.laborSessions.filter((l) => l.endTime).length > 0 && (
          <div className="mt-3 space-y-1.5">
            {order.laborSessions.filter((l) => l.endTime).map((session) => (
              <div key={session.id} className="flex items-center justify-between text-xs text-slate-600 py-1.5 px-2 rounded bg-slate-50">
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

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
          <Camera className="size-4 text-slate-500" />
          Onarım Fotoğrafları
        </h3>
        <PhotoSection label="Onarım Öncesi" photos={beforePhotos} />
        <PhotoSection label="Onarım Sırasında" photos={duringPhotos} />
        <PhotoSection label="Onarım Sonrası" photos={afterPhotos} />
        <p className="text-xs text-slate-400 mt-2">Fotoğraf yüklemek için araç kabulünden veya iş emri detayından fotoğraf ekleyin.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <Package className="size-4 text-slate-500" />
            Parça Talepleri
          </h3>
        </div>
        <PartsRequestSection requests={order.partsRequests} orderId={order.id} />
        <AddPartsRequestForm orderId={order.id} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
          <StickyNote className="size-4 text-slate-500" />
          İç Notlar
          <span className="text-[10px] font-normal text-slate-400 ml-1">(Müşteriye görünmez)</span>
        </h3>
        <InternalNotesSection notes={order.internalNotes} orderId={order.id} />
        <AddInternalNoteForm orderId={order.id} />
      </div>

      {order.items.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">İş Kalemleri</h3>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className={cn(
                "flex items-start justify-between gap-3 py-2 px-3 rounded-lg",
                item.type === "part" ? "bg-blue-50" : "bg-purple-50"
              )}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">{item.name}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium",
                      item.type === "part" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    )}>
                      {item.type === "part" ? "Parça" : "İşçilik"}
                    </span>
                  </div>
                  {item.note && <p className="text-xs text-slate-500 mt-0.5">{item.note}</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-medium text-slate-900">
                    {item.totalPrice != null ? `₺${item.totalPrice.toLocaleString("tr-TR")}` : item.unitPrice ? `₺${(item.unitPrice * item.quantity).toLocaleString("tr-TR")}` : "—"}
                  </span>
                  <span className="text-xs text-slate-500 ml-1">×{item.quantity}</span>
                </div>
              </div>
            ))}
          </div>
          {order.totals.hasAnyPrice && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
              {order.totals.discountAmount > 0 && (
                <div className="flex justify-between text-xs text-slate-500">
                  <span>İndirim</span>
                  <span>-₺{order.totals.discountAmount.toLocaleString("tr-TR")}</span>
                </div>
              )}
              {order.totals.taxAmount > 0 && (
                <div className="flex justify-between text-xs text-slate-500">
                  <span>KDV (%{order.taxRate})</span>
                  <span>₺{order.totals.taxAmount.toLocaleString("tr-TR")}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold text-slate-900">
                <span>Toplam</span>
                <span>₺{order.totals.grandTotal.toLocaleString("tr-TR")}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {order.damageMarks.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Hasar Kayıtları</h3>
          <div className="space-y-1.5">
            {order.damageMarks.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded bg-rose-50">
                <span className="font-medium text-rose-800">{d.zone}</span>
                <span className="text-rose-600">·</span>
                <span className="text-rose-700">{d.damageType}</span>
                <span className="text-rose-400 text-xs">({d.severity})</span>
                {d.note && <span className="text-rose-500 text-xs ml-auto">{d.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-20 bg-white border-t border-slate-200 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex gap-2 sm:justify-center">
        {canStart && (
          <button
            onClick={handleStartWork}
            disabled={isPending}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 h-12 sm:h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors touch-manipulation disabled:opacity-50"
          >
            <Play className="size-5" />
            İşe Başla
          </button>
        )}
        {canHold && (
          <button
            onClick={handleHoldWork}
            disabled={isPending}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 h-12 sm:h-11 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors touch-manipulation disabled:opacity-50"
          >
            <Pause className="size-5" />
            Beklemeye Al
          </button>
        )}
        {canComplete && (
          <button
            onClick={handleCompleteWork}
            disabled={isPending}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 h-12 sm:h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors touch-manipulation disabled:opacity-50"
          >
            <CheckCircle2 className="size-5" />
            Tamamla
          </button>
        )}
        {!canStart && !canHold && !canComplete && (
          <div className="flex-1 text-center text-sm text-slate-500 py-2">
            Bu iş emri için şu anda işlem yapılamaz
          </div>
        )}
      </div>
    </div>
  )
}

function VehicleCard({ vehicle }: { vehicle: OrderData["vehicle"] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <Car className="size-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Araç</h3>
      </div>
      <div className="text-lg font-bold text-slate-900 mb-1">{vehicle.plate}</div>
      <div className="text-sm text-slate-600">{vehicle.brand} {vehicle.model}</div>
      {vehicle.modelYear && <div className="text-xs text-slate-500">Yıl: {vehicle.modelYear}</div>}
      {vehicle.mileage && <div className="text-xs text-slate-500">KM: {vehicle.mileage.toLocaleString("tr-TR")}</div>}
      {vehicle.fuelType && <div className="text-xs text-slate-500">Yakıt: {vehicle.fuelType}</div>}
      {vehicle.transmission && <div className="text-xs text-slate-500">Vites: {vehicle.transmission}</div>}
    </div>
  )
}

function CustomerCard({ customer }: { customer: OrderData["customer"] }) {
  const name = customer.type === "corporate"
    ? customer.companyName || "Kurumsal"
    : customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Müşteri"

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <User className="size-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Müşteri</h3>
      </div>
      <div className="text-base font-semibold text-slate-900">{name}</div>
      <div className="flex items-center gap-1.5 text-sm text-slate-600 mt-1">
        <Phone className="size-3.5" />
        <a href={`tel:${customer.phone}`} className="text-blue-600 hover:underline">{customer.phone}</a>
      </div>
      {customer.email && (
        <div className="text-xs text-slate-500 mt-1">{customer.email}</div>
      )}
    </div>
  )
}

function ComplaintCard({ complaint }: { complaint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-2">Müşteri Şikayeti</h3>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{complaint}</p>
    </div>
  )
}

function ChecklistSection({
  title, category, items, orderId: _orderId,
}: {
  title: string
  category: ChecklistCategoryKey
  items: OrderData["checklistItems"]
  orderId: string
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
        <span className="text-xs text-slate-400">
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
              disabled={isPending}
              className="mt-0.5 touch-manipulation"
            >
              {item.isCompleted
                ? <CheckSquare className="size-5 text-emerald-600" />
                : <Square className="size-5 text-slate-400 group-hover:text-slate-600" />
              }
            </button>
            <div className="flex-1 min-w-0">
              <span className={cn("text-sm", item.isCompleted ? "line-through text-slate-400" : "text-slate-700")}>
                {item.description}
              </span>
              {item.note && <p className="text-xs text-slate-500 mt-0.5">{item.note}</p>}
            </div>
            <button
              type="button"
              onClick={() => {
                startTransition(async () => {
                  await deleteChecklistItemAction(item.id)
                })
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
            >
              <Trash2 className="size-3.5" />
            </button>
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
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
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
      className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
    >
      <div className="flex gap-2">
        {(["inspection", "repair", "delivery"] as ChecklistCategoryKey[]).map((cat) => {
          const info = (CHECKLIST_CATEGORIES as Record<string, { label: string }>)[cat]
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors touch-manipulation",
                category === cat
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              )}
            >
              {info?.label || cat}
            </button>
          )
        })}
      </div>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Kontrol maddesi açıklaması..."
        className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        required
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !description.trim()}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors touch-manipulation disabled:opacity-50"
        >
          Ekle
        </button>
        <button
          type="button"
          onClick={() => { setShow(false); setDescription("") }}
          className="inline-flex items-center h-9 px-4 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors touch-manipulation"
        >
          İptal
        </button>
      </div>
    </form>
  )
}

function PhotoSection({ label, photos }: { label: string; photos: { id: string; fileUrl: string | null; label: string; note: string | null }[] }) {
  if (photos.length === 0) return null
  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-slate-500 mb-2">{label} ({photos.length})</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((p) => (
          p.fileUrl ? (
            <a key={p.id} href={p.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.fileUrl}
                alt={p.label}
                className="w-full aspect-square object-cover rounded-lg border border-slate-200"
              />
            </a>
          ) : (
            <div key={p.id} className="w-full aspect-square rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
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
}: {
  requests: OrderData["partsRequests"]
  orderId: string
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
          <div key={req.id} className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg bg-slate-50">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{req.partName}</span>
                {req.partSku && <span className="text-xs text-slate-500">({req.partSku})</span>}
                <span className="text-xs text-slate-500">×{req.quantity}</span>
              </div>
              {req.note && <p className="text-xs text-slate-500 mt-0.5">{req.note}</p>}
              <p className="text-[10px] text-slate-400 mt-0.5">{new Date(req.createdAt).toLocaleDateString("tr-TR")}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", statusInfo?.color)}>
                {statusInfo?.label || req.status}
              </span>
              {nextStatusMap[req.status] && (
                <button
                  onClick={() => {
                    startTransition(async () => {
                      await updatePartsRequestStatusAction(req.id, nextStatusMap[req.status])
                    })
                  }}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors touch-manipulation disabled:opacity-50"
                >
                  <CheckCircle2 className="size-3" />
                  {nextLabelMap[req.status]}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AddPartsRequestForm({ orderId }: { orderId: string }) {
  const [show, setShow] = useState(false)
  const [partName, setPartName] = useState("")
  const [partSku, setPartSku] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [note, setNote] = useState("")
  const [isPending, startTransition] = useTransition()

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
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
        fd.set("quantity", quantity)
        fd.set("note", note)
        startTransition(async () => {
          await createPartsRequestAction(fd)
          setPartName("")
          setPartSku("")
          setQuantity("1")
          setNote("")
          setShow(false)
        })
      }}
      className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
    >
      <input
        type="text"
        value={partName}
        onChange={(e) => setPartName(e.target.value)}
        placeholder="Parça adı *"
        className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        required
      />
      <div className="flex gap-2">
        <input
          type="text"
          value={partSku}
          onChange={(e) => setPartSku(e.target.value)}
          placeholder="SKU / OEM No"
          className="flex-1 h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        />
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min="1"
          className="w-20 h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        />
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Not (opsiyonel)"
        className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || !partName.trim()}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors touch-manipulation disabled:opacity-50"
        >
          <Send className="size-3.5" />
          Talep Et
        </button>
        <button
          type="button"
          onClick={() => { setShow(false); setPartName("") }}
          className="inline-flex items-center h-9 px-4 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors touch-manipulation"
        >
          İptal
        </button>
      </div>
    </form>
  )
}

function InternalNotesSection({
  notes,
  orderId: _orderId,
}: {
  notes: OrderData["internalNotes"]
  orderId: string
}) {
  const [_isPending, startTransition] = useTransition()

  if (notes.length === 0) return null

  return (
    <div className="space-y-2">
      {notes.map((note) => (
        <div key={note.id} className="flex items-start gap-2 py-2 px-3 rounded-lg bg-amber-50 border border-amber-200 group">
          <StickyNote className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-900 whitespace-pre-wrap">{note.content}</p>
            <p className="text-[10px] text-amber-500 mt-1">
              {new Date(note.createdAt).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <button
            onClick={() => {
              startTransition(async () => {
                await deleteInternalNoteAction(note.id)
              })
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-amber-400 hover:text-red-500 transition-opacity"
          >
            <Trash2 className="size-3.5" />
          </button>
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
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="İç not ekle..."
        className="flex-1 h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        required
      />
      <button
        type="submit"
        disabled={isPending || !content.trim()}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors touch-manipulation disabled:opacity-50"
      >
        <Plus className="size-4" />
        Ekle
      </button>
    </form>
  )
}