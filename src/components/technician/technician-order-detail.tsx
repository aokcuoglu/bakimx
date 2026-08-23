"use client"

import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/format"
import { bpsToPercent } from "@/lib/money"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { useOrderSync } from "@/hooks/use-order-sync"
import {
  ArrowLeft, Pause, Play,
  Camera, Plus, StickyNote,
  Trash2,
  User, Phone, Car, CheckCircle2, ShoppingCart,
  ImageOff, Loader2, ListChecks, FileText,
  Package, Wrench, CalendarDays, Store,
} from "lucide-react"
import { toast } from "sonner"
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/photo-lightbox"
import { resolvePhotoSrc } from "@/lib/photos/photo-src"
import { groupPurchasePhotos, type PurchasePhoto } from "@/lib/photos/purchase-photos"
import { OrderItemsChecklist } from "@/components/technician/order-items-checklist"
import { OrderChecklist, useChecklistState } from "@/components/technician/order-checklist"
import { TechnicianPhotoUpload } from "@/components/technician/technician-photo-upload"
import type { PickerVehicle } from "@/components/parts/tecdoc-part-picker"
import {
  EditPurchaseButton,
  PurchaseFormSheet,
  type SupplierInfo,
  type TechnicianInfo,
} from "@/components/technician/purchase-form-sheet"
import { fuelTypeLabel, transmissionLabel } from "@/lib/constants"
import {
  startWorkAction, holdWorkAction, completeWorkAction,
  addInternalNoteAction, deleteInternalNoteAction,
} from "@/app/(app)/technician/actions"
import {
  LaborSessionCard,
  StopLaborButton,
  type TechnicianLaborSessionRow,
} from "@/components/technician/labor-session-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WizardActions } from "@/components/intake/wizard-ui"
import { AddExternalLaborButton } from "@/components/technician/external-labor-sheet"
import { findUndecidedPartsRequests } from "@/lib/orders/parts-request-guard"
import { isOrderLocked } from "@/lib/status-transitions"
import { purchaseDeleteDecision, type PurchaseDeleteDecision } from "@/lib/orders/purchase-delete"
import { removePurchaseItemAction } from "@/app/(app)/orders/actions"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PhotoDeleteButton } from "@/components/intake/photo-delete-button"
import type { OrderStatus } from "@prisma/client"
import type { OrderItem } from "@/components/orders/order-management-panel"
import type { LaborCatalogRow } from "@/lib/labor/types"
import { TechnicianPartsLaborSection } from "@/components/technician/technician-parts-labor-section"
import { workOrderPath } from "@/lib/technician/cross-links"
import { StatusBadge } from "@/components/shared/status-badge"
import { PageLoading } from "@/components/shared/page-loading"
import {
  countRemainingChecklist,
  countIncompleteItems,
  startChecklistReminder,
  completeChecklistReminder,
  completeWorkBlockMessage,
  START_REMINDER_CATEGORIES,
  COMPLETE_REMINDER_CATEGORIES,
} from "@/lib/technician/gates"

/**
 * Teknisyen DTO'sundaki kalem. `OrderItem` ofis düzenleyicisinin sözleşmesidir
 * ve dış alım alanlarını "opsiyonel" tutar (eski çağrı yerleri hiç göndermiyordu);
 * teknisyen sayfası bunların HEPSİNİ dolduruyor, o yüzden burada zorunluya
 * daraltılır — panelin kendi bileşenleri (dış alım kartı, kalem kontrol listesi,
 * tamamlama kapısı) `undefined` kabul etmiyor.
 */
type TechnicianOrderItem = OrderItem & {
  tecdocArticleId: number | null
  purchasePriceKurus: number | null
  supplierName: string | null
  purchasedAt: string | null
  completedAt: string | null
}

/**
 * Eski parça/işçilik talebi DTO'su. Talep açma akışı söküldü (teknisyen
 * kalemleri kendisi giriyor); alan, geçmiş emirlerdeki kayıtları — ve ofis
 * tarafında henüz karara bağlanmamışları — okuyabilmek için durur.
 */
type TechnicianPartsRequest = {
  id: string
  /** "part" | "external_labor" — dış işçilik talebinde katalog alanları boştur. */
  type: string
  partName: string
  partSku: string | null
  brand: string | null
  tecdocArticleId: number | null
  quantity: number
  note: string | null
  status: string
  convertedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
}

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
  // BAK-141 — kalemler artık ofis düzenleyicisine (PartsLaborGrid) de gidiyor,
  // bu yüzden tip onun sözleşmesinden TÜRETİLİR: iki ekranın alan listesi
  // ayrışırsa typecheck söyler, kullanıcı fark etmez.
  items: TechnicianOrderItem[]
  customer: { id: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null; type: string; phone: string; email: string | null }
  // engineDisplacement/enginePower/firstRegistrationDate: parça kataloğu
  // bileşenlerinin beklediği PickerVehicle alanları (araç varyantı ipuçları).
  vehicle: { id: string; plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null; color: string | null; fuelType: string | null; transmission: string | null; catalogVehicleTypeId: number | null; engineDisplacement: string | null; enginePower: string | null; firstRegistrationDate: string | null }
  intake: { id: string; status: string; mileageAtIntake: number | null; customerComplaint: string; internalNote: string | null; createdAt: string }
  damageMarks: { id: string; zone: string; damageType: string; severity: string; note: string | null }[]
  photos: { id: string; type: string; label: string; fileUrl: string | null; phase: string; serviceOrderId: string | null; serviceOrderItemId: string | null; note: string | null; createdAt: string }[]
  checklistItems: { id: string; category: string; description: string; isCompleted: boolean; isRequired: boolean; completedAt: string | null; note: string | null; sortOrder: number; deletedAt: string | null }[]
  internalNotes: { id: string; content: string; isPinned: boolean; createdAt: string }[]
  partsRequests: TechnicianPartsRequest[]
  laborSessions: TechnicianLaborSessionRow[]
  paidAmount: number
  remainingAmount: number
  vehicleId: string
}

const TECHNICIAN_ORDER_STEPS = [
  { id: "start", label: "İşi başlat", icon: Play },
  { id: "check", label: "Araç kontrolü", icon: Car },
  { id: "items", label: "Yapılacak işler", icon: ListChecks },
  { id: "needs", label: "Parça ve dış hizmet", icon: Package },
  { id: "finish", label: "Fotoğraf ve bitir", icon: Camera },
] as const

type StepId = (typeof TECHNICIAN_ORDER_STEPS)[number]["id"]

function isStepId(value: string | null): value is StepId {
  return TECHNICIAN_ORDER_STEPS.some((step) => step.id === value)
}

export function TechnicianOrderDetail({
  order,
  technicians,
  suppliers,
  laborCatalog,
  canEditOrder,
}: {
  order: OrderData
  technicians: TechnicianInfo[]
  suppliers: SupplierInfo[]
  /** İşçilik kataloğu — paylaşılan kalem düzenleyicisinin autocomplete kaynağı. */
  laborCatalog: LaborCatalogRow[]
  /**
   * Kullanıcı `order.edit` taşıyor mu. İki yerde okunur: dış alım silme
   * kuralının rol ekseni (BAK-83) ve "Parça & İşçilik" düzenleyicisinin
   * görünürlüğü (BAK-141).
   */
  canEditOrder: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isStepPending, startStepTransition] = useTransition()
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)

  // BAK-140: ofis personeli/dış alım bu iş emrine parça eklediğinde teknisyen
  // sayfayı yenilemeden görsün — office tarafındaki aynı desen (work-order-detail.tsx).
  useOrderSync(order.id)

  const activeLabor = order.laborSessions.find((l) => !l.endTime)

  const locked = isOrderLocked(order.status as OrderStatus)

  // Kontrol listesinin iyimser durumu SAYFA seviyesinde: hem kart hem alttaki
  // hatırlatma aynı sayıyı görsün, tik atıldığı anda ikisi birden güncellensin.
  const checklist = useChecklistState(order.checklistItems, { orderId: order.id, locked })

  // Kontrol listesi kapalı geldiği için, teknisyen eksik maddeleri göremiyordu:
  // hatırlatma bölümü açıp oraya kaydırır.
  const [checklistOpen, setChecklistOpen] = useState<string[]>([])
  const checklistRef = useRef<HTMLDivElement>(null)

  // Alış fotoğrafları (serviceOrderItemId != null) dahili-yalnızdır; onarım
  // galerilerine sızmaması için hepsinden dışlanır.
  const galleryPhotos = order.photos.filter((p) => p.serviceOrderItemId == null)
  const beforePhotos = galleryPhotos.filter((p) => p.phase === "intake")
  const duringPhotos = galleryPhotos.filter((p) => p.phase === "repair_progress")
  const afterPhotos = galleryPhotos.filter((p) => p.phase === "delivery")

  const purchasedItems = order.items.filter((i) => i.source === "purchase")
  // Dış işçilik artık gerçek iş emri kalemi ve "Dış Alımlar" sekmesinde yaşar;
  // grid'e giden listeden süzülür ki aynı kalem iki yerde birikmesin.
  const externalLaborItems = order.items.filter((i) => i.type === "external_labor")
  const gridItems = order.items.filter((i) => i.type !== "external_labor")

  // Galeriden dışlanan alış kareleri kaybolmasın: ait oldukları kalemin kartında
  // gösterilir (BAK-111). Teknisyen kutunun/fişin üzerindeki yazıyı okumak için
  // fotoğrafa dokunup büyütebilsin diye kart içinde küçük şerit olarak durur.
  const purchasePhotosByItem = groupPurchasePhotos(order.photos)

  // Dış alım silme/düzenleme kuralı (BAK-83, BAK-84) sunucudaki action ile AYNI
  // fonksiyondan okunur; butonlar yalnız gerçekten izinliyken çıkar, aksi halde
  // gerekçe yazılır.
  const purchaseDelete = purchaseDeleteDecision(order.status as OrderStatus, canEditOrder)

  // Talep akışı söküldü ama eski emirlerde ofisin henüz karara bağlamadığı
  // talepler kalabilir; bunlar sunucu kapısında "Teslime Hazır"ı hâlâ bloklar.
  // Teknisyen en azından neyin beklendiğini görsün (salt-okunur bilgi).
  const undecidedRequests = findUndecidedPartsRequests(order.partsRequests)
  // İlk iki isim yazılır, kalanı sayıya çevrilir (sunucu kapısı mesajıyla aynı biçim).
  const undecidedRequestNames = (() => {
    const names = undecidedRequests.map((r) => r.partName)
    const rest = names.length - 2
    const shown = names.slice(0, 2).join(", ")
    return rest > 0 ? `${shown} (+${rest})` : shown
  })()

  // Parça arayan bileşenlerin (talep kutusu, dış alım formu) beklediği araç
  // özeti — iki bölüm de aynı katalog kapsamını görsün diye tek yerde kurulur.
  const pickerVehicle: PickerVehicle = {
    id: order.vehicle.id,
    catalogVehicleTypeId: order.vehicle.catalogVehicleTypeId,
    vin: order.vehicle.vin,
    modelYear: order.vehicle.modelYear,
    engineDisplacement: order.vehicle.engineDisplacement,
    enginePower: order.vehicle.enginePower,
    fuelType: order.vehicle.fuelType,
    firstRegistrationDate: order.vehicle.firstRegistrationDate,
  }

  // `draft` ve `waiting_parts` dahil: güncel akışta emirler draft'tan doğrudan
  // in_progress'e geçiyor (approved artık üretilmiyor, bkz. status-transitions.ts),
  // ve "Beklemeye Al" sonrası işi teknisyenin kendi ekranından sürdürebilmesi gerek.
  const canStart = ["draft", "waiting_approval", "approved", "waiting_parts"].includes(order.status)
  const canHold = order.status === "in_progress"
  const canComplete = order.status === "in_progress" || order.status === "waiting_parts"

  // Kontrol maddeleri artık kapı değil, hatırlatma (BAK-24): sayılar iyimser
  // listeden okunur ki tik atıldığı anda düşsünler. Tek gerçek kapı iş
  // kalemleri — "Tamamla" yalnız onlara takılır.
  const startChecklistLeft = countRemainingChecklist(checklist.items, START_REMINDER_CATEGORIES)
  const completeChecklistLeft = countRemainingChecklist(checklist.items, COMPLETE_REMINDER_CATEGORIES)
  const startReminder = startChecklistReminder(startChecklistLeft)
  const completeReminder = completeChecklistReminder(completeChecklistLeft)
  const completeBlockedMessage = completeWorkBlockMessage(countIncompleteItems(order.items))

  const steps = TECHNICIAN_ORDER_STEPS
  const requestedStep = searchParams.get("step")
  const validRequestedStep = isStepId(requestedStep) ? requestedStep : null
  const derivedStep: StepId = locked
    ? "finish"
    : canStart
      ? "start"
      : startChecklistLeft > 0
        ? "check"
        : countIncompleteItems(order.items) > 0
          ? "items"
          : "needs"
  const [rememberedStep, setRememberedStep] = useState<StepId | null>(null)
  // Kilit yalnız DÜZENLEMEYİ durdurur (BAK-137): kilitli iş emrinde de her
  // sekme serbestçe gezilebilsin diye currentStep artık "finish"e sabitlenmez,
  // derivedStep sadece varsayılan iniş noktasını belirler.
  const currentStep: StepId = validRequestedStep ?? rememberedStep ?? derivedStep

  useEffect(() => {
    if (validRequestedStep) return

    let savedStep: string | null = null
    try {
      savedStep = localStorage.getItem(`bakimx:technician-order:${order.id}:step`)
    } catch {
      // Depolama kapalıysa URL ve iş emri durumundan türetilen adım yeterlidir.
    }

    if (!isStepId(savedStep)) return
    const frame = requestAnimationFrame(() => setRememberedStep(savedStep))
    return () => cancelAnimationFrame(frame)
  }, [order.id, validRequestedStep])

  function goToStep(step: StepId) {
    if (step === currentStep) return

    // URL güncellenirken, özellikle yavaş bağlantıda, içerik alanı ortak sayfa
    // yükleme durumu ile geri bildirim verir. Transition, mevcut kabuğun ve
    // sekme şeridinin etkileşimli kalmasını sağlar.
    startStepTransition(() => {
      setRememberedStep(step)
      try {
        localStorage.setItem(`bakimx:technician-order:${order.id}:step`, step)
      } catch {
        // Depolama kapalıysa adım URL'de korunmaya devam eder.
      }
      const params = new URLSearchParams(searchParams.toString())
      params.set("step", step)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
      window.scrollTo({ top: 0, behavior: "smooth" })
    })
  }

  function handleStartWork() {
    startTransition(async () => {
      const res = await startWorkAction(order.id)
      if (res && "error" in res && res.error) toast.error(res.error)
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
      const res = await completeWorkAction(order.id)
      if (res && "error" in res && res.error) toast.error(res.error)
      else toast.success("İş tamamlandı.")
      setCompleteDialogOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Link href="/technician" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Teknisyen Paneli
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{order.workOrderNo}</h2>
            <StatusBadge status={order.status} />
            {order.assignedTechnicianName && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="size-3.5" />
                {order.assignedTechnicianName}
              </span>
            )}
          </div>
        </div>
        <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto sm:justify-end">
          {/* BAK-148: beklemeye alma/devam etme hızlı kararı adım/sekme
              içeriğine gömülü değil; İş Emri ile aynı aksiyon grubundadır. */}
          {(canHold || canStart) && (
            <>
              {canHold && (
                <Button variant="outline" size="sm" className="shrink-0" onClick={handleHoldWork} disabled={isPending}>
                  <Pause /> Beklemeye al
                </Button>
              )}
              {canStart && (
                <Button size="sm" className="shrink-0" onClick={handleStartWork} disabled={isPending}>
                  <Play /> {order.status === "waiting_parts" ? "Tamire devam et" : "Tamire başla"}
                </Button>
              )}
            </>
          )}
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link href={workOrderPath(order.id)}>
              <FileText />
              İş Emri
            </Link>
          </Button>
        </div>
      </div>

      {locked && (
        <Alert>
          <AlertTitle>Bu iş emri salt okunur</AlertTitle>
          <AlertDescription>
            Bu iş emri {order.status === "cancelled" ? "iptal edildi" : "teslim edildi"}. Bilgiler değiştirilemez; adımları inceleyebilirsiniz.
          </AlertDescription>
        </Alert>
      )}

      {activeLabor && (
        <Alert variant="success" className="bg-success/10 text-success-strong">
          <span className="size-2 rounded-full bg-success motion-safe:animate-pulse" />
          <AlertTitle>İşçilik sürüyor</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            <span>
              {new Date(activeLabor.startTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} başlangıç
            </span>
            {!locked && <StopLaborButton orderId={order.id} className="ml-auto" />}
          </AlertDescription>
        </Alert>
      )}

      {/* Sekmeler baştan tamamı görünür ve serbestçe gezilebilir (BAK-137):
          önceki adımın tamamlanmış olması bir sekmeye geçişi engellemez,
          kilit yalnız düzenlemeyi durdurur (yukarıdaki salt-okunur uyarısı). */}
      <Tabs value={currentStep} onValueChange={(value) => isStepId(value) && goToStep(value)}>
        <TabsList variant="line" className="flex w-full flex-nowrap gap-1 border-b border-border pb-0 -mb-px overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <TabsTrigger key={step.id} value={step.id} className="px-3 py-2.5 shrink-0 flex-none">
                <Icon className="size-4" />
                <span>{step.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <section className="min-w-0 space-y-4 mt-4 pb-24 sm:pb-20" aria-live="polite" aria-busy={isStepPending}>
          {isStepPending ? <PageLoading /> : <>
          <TabsContent value="start" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <VehicleCard vehicle={order.vehicle} />
                <CustomerCard customer={order.customer} />
              </div>
              <ComplaintCard complaint={order.intake.customerComplaint} />

              <LaborSessionCard
                orderId={order.id}
                sessions={order.laborSessions}
                locked={locked}
                canStart={canStart || canHold}
                canEdit={canEditOrder}
              />
              <WizardActions sticky>
                <Button size="sm" onClick={() => goToStep("check")}>Kontrole geç</Button>
              </WizardActions>
              {canStart && startReminder && <ChecklistReminder message={startReminder} onReveal={() => goToStep("check")} />}
          </TabsContent>

          <TabsContent value="check" className="space-y-4">
              <OrderChecklist orderId={order.id} state={checklist} locked={locked} open={checklistOpen} onOpenChange={setChecklistOpen} containerRef={checklistRef} />
              {order.damageMarks.length > 0 && <DamageMarks marks={order.damageMarks} />}
              <WizardActions sticky back={<Button variant="outline" size="sm" onClick={() => goToStep("start")}>Geri</Button>}>
                <Button size="sm" onClick={() => goToStep("items")}>Yapılacak işlere geç</Button>
              </WizardActions>
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
              <div className={cn(
                "rounded-lg border px-4 py-3 transition-colors",
                order.items.length > 0 && order.items.every((i) => i.completedAt)
                  ? "border-success/30 bg-success/5"
                  : "border-border bg-primary/[0.04]"
              )}>
                <OrderItemsChecklist orderId={order.id} items={order.items} locked={locked} />
                {order.totals.hasAnyPrice && <OrderTotals order={order} />}
              </div>
              <Card className="bg-primary/[0.04]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    <StickyNote className="size-4 text-muted-foreground" />
                    İç Notlar
                  </CardTitle>
                  <CardDescription>Müşteriye görünmez</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InternalNotesSection notes={order.internalNotes} orderId={order.id} locked={locked} />
                  {!locked && <AddInternalNoteForm orderId={order.id} />}
                </CardContent>
              </Card>
              <WizardActions sticky back={<Button variant="outline" size="sm" onClick={() => goToStep("check")}>Geri</Button>}>
                <Button size="sm" onClick={() => goToStep("needs")}>Parça ve dış hizmete geç</Button>
              </WizardActions>
          </TabsContent>

          <TabsContent value="needs" className="space-y-4">
              {undecidedRequests.length > 0 && (
                <Alert variant="warning">
                  <Package />
                  <AlertTitle>Karar bekleyen eski talep var</AlertTitle>
                  <AlertDescription>
                    {undecidedRequestNames}. Ofis karar verince kalem olarak burada görünür.
                  </AlertDescription>
                </Alert>
              )}
              <TechnicianPartsLaborSection
                orderId={order.id}
                status={order.status}
                items={gridItems}
                vehicle={pickerVehicle}
                laborCatalog={laborCatalog}
                taxRateBps={order.taxRate}
                canEditOrder={canEditOrder}
              />
              <PurchasesSection
                orderId={order.id}
                locked={locked}
                purchases={purchasedItems}
                laborItems={externalLaborItems}
                photosByItem={purchasePhotosByItem}
                vehicle={pickerVehicle}
                suppliers={suppliers}
                technicians={technicians}
                defaultTechnicianId={order.assignedTechnicianId}
                deleteDecision={purchaseDelete}
                canDeleteLabor={canEditOrder}
              />
              <WizardActions sticky back={<Button variant="outline" size="sm" onClick={() => goToStep("items")}>Geri</Button>}>
                <Button size="sm" onClick={() => goToStep("finish")}>Fotoğraf ve bitirmeye geç</Button>
              </WizardActions>
          </TabsContent>

          <TabsContent value="finish" className="space-y-4">
              <Card className="bg-primary/[0.04]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    <Camera className="size-4 text-muted-foreground" />
                    Onarım Fotoğrafları
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PhotoSection label="Onarım Öncesi" photos={beforePhotos} canDelete={!locked} onDeleted={() => router.refresh()} />
                  <PhotoSection label="Onarım Sırasında" photos={duringPhotos} canDelete={!locked} onDeleted={() => router.refresh()} />
                  <PhotoSection label="Onarım Sonrası" photos={afterPhotos} canDelete={!locked} onDeleted={() => router.refresh()} />
                  {galleryPhotos.length === 0 && <p className="text-sm text-muted-foreground">Henüz fotoğraf eklenmedi.</p>}
                  {!locked && <TechnicianPhotoUpload intakeFormId={order.intake.id} orderStatus={order.status} existingPhotoTypes={order.photos.map((p) => p.type)} />}
                </CardContent>
              </Card>

              <Card className="bg-primary/[0.04]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-muted-foreground" />
                    Son kontrol
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <ReviewRow label="Araç kontrolü" detail={`${checklist.items.filter((item) => item.isCompleted && !item.deletedAt).length}/${checklist.items.filter((item) => !item.deletedAt).length}`} complete={completeChecklistLeft === 0} />
                  <ReviewRow label="Yapılacak işler" detail={completeBlockedMessage ?? "Tümü tamamlandı"} complete={!completeBlockedMessage} />
                </CardContent>
              </Card>

              {canComplete && completeBlockedMessage && <BlockedMessage message={completeBlockedMessage} />}
              {canComplete && completeReminder && <ChecklistReminder message={completeReminder} onReveal={() => goToStep("check")} />}
              <WizardActions sticky back={<Button variant="outline" size="sm" onClick={() => goToStep("needs")}>Geri</Button>}>
                {canComplete && (
                  <Button variant="success" size="sm" onClick={() => setCompleteDialogOpen(true)} disabled={isPending || !!completeBlockedMessage}>
                    <CheckCircle2 /> İşi tamamla
                  </Button>
                )}
              </WizardActions>
          </TabsContent>
          </>}
        </section>
      </Tabs>

      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İş tamamlandı olarak işaretlensin mi?</AlertDialogTitle>
            <AlertDialogDescription>Bu işlem iş emrini kilitler. Devam etmek istediğinize emin misiniz?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteWork} disabled={isPending}>İşi tamamla</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DamageMarks({ marks }: { marks: OrderData["damageMarks"] }) {
  return (
    <Card className="bg-primary/[0.04]">
      <CardHeader>
        <CardTitle>Mevcut Hasarlar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {marks.map((mark) => (
          <Item key={mark.id} variant="muted" size="sm" className="bg-destructive/10 text-destructive-strong">
            <ItemContent>
              <ItemTitle>
                {mark.zone} · {mark.damageType}
              </ItemTitle>
              <ItemDescription>
                {mark.severity}
                {mark.note ? ` · ${mark.note}` : ""}
              </ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </CardContent>
    </Card>
  )
}

function OrderTotals({ order }: { order: OrderData }) {
  return (
    <div className="mt-3 space-y-1 border-t border-border pt-3">
      {order.totals.discountAmount > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>İndirim</span><span>-{formatTRY(order.totals.discountAmount)}</span></div>}
      {order.totals.taxAmount > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>KDV (%{bpsToPercent(order.taxRate ?? 0)})</span><span>{formatTRY(order.totals.taxAmount)}</span></div>}
      <div className="flex justify-between text-sm font-semibold text-foreground"><span>Toplam</span><span>{formatTRY(order.totals.grandTotal)}</span></div>
    </div>
  )
}

function ReviewRow({ label, detail, complete }: { label: string; detail: string; complete: boolean }) {
  return (
    <Item variant="muted" size="sm">
      <ItemContent>
        <ItemTitle>{complete ? "Tamam" : "Eksik"} · {label}</ItemTitle>
        <ItemDescription>{detail}</ItemDescription>
      </ItemContent>
    </Item>
  )
}

/** "Tamamla" engel mesajı — tek kapı kalan iş kalemleri. */
function BlockedMessage({ message }: { message: string }) {
  return <p className="text-xs text-warning-foreground text-center">{message}</p>
}

/**
 * Kontrol listesi hatırlatması: iş emrini KİLİTLEMEZ, yalnız kapalı listeyi
 * açıp oraya kaydırır. Zorunluluk kalkınca (BAK-24) tek görevi teknisyeni
 * listeye davet etmek olduğu için uyarı sarısı değil, nötr ton kullanır.
 */
function ChecklistReminder({ message, onReveal }: { message: string; onReveal: () => void }) {
  return (
    <div className="flex justify-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={onReveal}
        className="h-auto max-w-full gap-1.5 py-1 text-xs font-normal text-muted-foreground whitespace-normal"
      >
        <ListChecks className="size-3.5 shrink-0" />
        <span className="min-w-0 text-left">{message} — kontrol listesini aç</span>
      </Button>
    </div>
  )
}

function VehicleCard({ vehicle }: { vehicle: OrderData["vehicle"] }) {
  return (
    <Card className="bg-primary/[0.04]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="size-4 text-muted-foreground" />
          Araç
        </CardTitle>
        <CardDescription>{vehicle.plate}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p className="font-heading text-base font-medium text-foreground">{vehicle.brand} {vehicle.model}</p>
        {vehicle.modelYear && <p>Yıl: {vehicle.modelYear}</p>}
        {vehicle.mileage && <p>KM: {vehicle.mileage.toLocaleString("tr-TR")}</p>}
        {vehicle.fuelType && <p>Yakıt: {fuelTypeLabel(vehicle.fuelType)}</p>}
        {vehicle.transmission && <p>Vites: {transmissionLabel(vehicle.transmission)}</p>}
      </CardContent>
    </Card>
  )
}

function CustomerCard({ customer }: { customer: OrderData["customer"] }) {
  const name = customer.type === "corporate"
    ? customer.companyName || "Kurumsal"
    : customer.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Müşteri"

  return (
    <Card className="bg-primary/[0.04]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-4 text-muted-foreground" />
          Müşteri
        </CardTitle>
        <CardDescription>{name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Phone className="size-3.5" />
          <a href={`tel:${customer.phone}`} className="text-primary hover:underline">{customer.phone}</a>
        </p>
        {customer.email && <p>{customer.email}</p>}
      </CardContent>
    </Card>
  )
}

function ComplaintCard({ complaint }: { complaint: string }) {
  return (
    <Card className="bg-primary/[0.04]">
      <CardHeader>
        <CardTitle>Müşteri Şikayeti</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm text-foreground">{complaint}</p>
      </CardContent>
    </Card>
  )
}

/**
 * Faz bazlı fotoğraf ızgarası. Kaynak `fileUrl` değil `resolvePhotoSrc` ile
 * belirlenir (depo referansı doğrudan açılamaz), dokununca diğer ekranlardaki
 * gibi modal carousel (`PhotoLightbox`) açılır. `canDelete` verildiğinde her karenin
 * köşesinde sil butonu çıkar (silme sunucuda soft'tur).
 */
function PhotoSection({
  label,
  photos,
  canDelete,
  onDeleted,
}: {
  label: string
  photos: { id: string; fileUrl: string | null; label: string; note: string | null }[]
  canDelete?: boolean
  onDeleted?: () => void
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Dosyası olmayan kayıtlar açılamaz; lightbox yalnızca görüntülenebilirleri gezer.
  const viewable = photos.filter((p) => p.fileUrl)
  const lightboxPhotos: LightboxPhoto[] = viewable.map((p) => ({
    id: p.id,
    label: p.label,
    note: p.note,
    fileUrl: resolvePhotoSrc(p),
  }))

  if (photos.length === 0) return null

  return (
    <div className="mb-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label} ({photos.length})</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((p) => {
          const src = resolvePhotoSrc(p)
          return (
            <div key={p.id} className="relative">
              {canDelete && (
                <PhotoDeleteButton photoId={p.id} photoLabel={p.label} onDeleted={onDeleted} />
              )}
              {src ? (
                <PhotoThumbnail
                  src={src}
                  label={p.label}
                  onOpen={() => setLightboxIndex(viewable.findIndex((v) => v.id === p.id))}
                />
              ) : (
                <div className="w-full aspect-square rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                  <Camera className="size-5" />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <PhotoLightbox
        photos={lightboxPhotos}
        index={lightboxIndex ?? 0}
        onIndexChange={setLightboxIndex}
        open={lightboxIndex !== null}
        onOpenChange={(next) => { if (!next) setLightboxIndex(null) }}
      />
    </div>
  )
}

function PhotoThumbnail({ src, label, onOpen }: { src: string; label: string; onOpen: () => void }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")

  // Önbellekten gelen görsel, React olay dinleyicileri bağlanmadan tamamlanabilir;
  // o durumda `onLoad` HİÇ tetiklenmez. Bu yüzden (a) mount'tan sonra `complete`
  // durumunu elle ölç, (b) görseli spinner'ın ÜSTÜNE koy ve yalnız gerçek hatada
  // gizle — böylece kaçan bir olay fotoğrafı görünmez yapamaz.
  const imgRef = useRef<HTMLImageElement>(null)
  useEffect(() => {
    let frame = 0
    const settle = () => {
      const node = imgRef.current
      if (!node) return
      if (node.complete) {
        setState(node.naturalWidth > 0 ? "ready" : "failed")
        return
      }
      frame = requestAnimationFrame(settle)
    }
    settle()
    return () => cancelAnimationFrame(frame)
  }, [src])

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={state === "failed"}
      aria-label={`${label} — büyüt`}
      className="relative w-full aspect-square overflow-hidden rounded-lg border border-border bg-muted touch-manipulation"
    >
      {state !== "ready" && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground">
          {state === "loading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <ImageOff className="size-4" />
              <span className="text-[10px] leading-none">Yüklenemedi</span>
            </>
          )}
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={label}
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
        className={cn(
          "relative w-full h-full object-cover transition-transform active:scale-95",
          state === "failed" && "opacity-0"
        )}
      />
    </button>
  )
}

/**
 * "Dış Alımlar" sekmesi — dışarıdan alınan parçalar VE dış işçilik kalemleri.
 * Talep akışı söküldükten sonra teknisyenin her şeyin "dışarıda kalanını"
 * kaydettiği tek yüzey: üstte özet bandı (toplam + adetler + kayıt butonları),
 * altta bölüm bölüm zengin kartlar; hiç kayıt yoksa çizgili davet kutusu.
 */
function PurchasesSection({
  orderId,
  locked,
  purchases,
  laborItems,
  photosByItem,
  vehicle,
  suppliers,
  technicians,
  defaultTechnicianId,
  deleteDecision,
  canDeleteLabor,
}: {
  orderId: string
  locked: boolean
  purchases: OrderData["items"]
  laborItems: OrderData["items"]
  photosByItem: Map<string, PurchasePhoto[]>
  vehicle: PickerVehicle
  suppliers: SupplierInfo[]
  technicians: TechnicianInfo[]
  defaultTechnicianId: string | null
  deleteDecision: PurchaseDeleteDecision
  canDeleteLabor: boolean
}) {
  const empty = purchases.length === 0 && laborItems.length === 0

  const totalKurus =
    purchases.reduce((sum, i) => sum + (i.purchasePriceKurus ?? 0), 0) +
    laborItems.reduce((sum, i) => sum + (i.unitPrice ?? 0) * i.quantity, 0)
  const hasAnyPrice =
    purchases.some((i) => i.purchasePriceKurus != null) || laborItems.some((i) => i.unitPrice != null)

  const addActions = !locked && (
    <div className="flex shrink-0 items-center gap-2">
      <AddPurchaseCardButton
        orderId={orderId}
        vehicle={vehicle}
        suppliers={suppliers}
        technicians={technicians}
        defaultTechnicianId={defaultTechnicianId}
      />
      <AddExternalLaborButton orderId={orderId} />
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border border-border bg-primary/[0.04] bg-gradient-to-b from-primary/[0.06] to-transparent p-4 pt-5">
        <span className="absolute -top-2 left-4 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          Dış Alımlar
        </span>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Dışarıdan alınanlar</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Aldığın parçalar ve yaptırdığın işçilikler iş emri toplamına eklenir.
            </p>
          </div>
          {addActions}
        </div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="shrink-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Toplam</p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {hasAnyPrice ? formatTRY(totalKurus) : "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
            <Package className="size-3.5" />
            {purchases.length} parça
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
            <Wrench className="size-3.5" />
            {laborItems.length} dış işçilik
          </span>
          </div>
        </div>
        {locked && (
          <p className="mt-2 text-xs text-muted-foreground">
            Teslim edilmiş/iptal edilmiş iş emrinde dış alım eklenemez.
          </p>
        )}
      </div>

      {empty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-primary/[0.04] px-4 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary-strong">
            <ShoppingCart className="size-6" />
          </span>
          <p className="text-sm font-semibold text-foreground">Henüz dış alım yok</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Dışarıdan aldığın parçayı veya yaptırdığın işçiliği kaydet; tutarlar iş emri toplamına işlenir.
          </p>
        </div>
      ) : (
        <>
          {laborItems.length > 0 && (
            <section className="space-y-2">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Wrench className="size-4 text-warning-strong" />
                Dış İşçilik
                <span className="text-xs font-normal text-muted-foreground">({laborItems.length})</span>
              </h4>
              {laborItems.map((item) => (
                <ExternalLaborCard key={item.id} item={item} deletable={!locked && canDeleteLabor} orderId={orderId} />
              ))}
            </section>
          )}
          {purchases.length > 0 && (
            <section className="space-y-2">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Package className="size-4 text-primary-strong" />
                Dışarıdan Alınan Parçalar
                <span className="text-xs font-normal text-muted-foreground">({purchases.length})</span>
              </h4>
              {purchases.map((item) => (
                <PurchaseCard
                  key={item.id}
                  item={item}
                  photos={photosByItem.get(item.id) ?? []}
                  orderId={orderId}
                  vehicle={vehicle}
                  suppliers={suppliers}
                  technicians={technicians}
                  deleteDecision={deleteDecision}
                />
              ))}
              {!deleteDecision.allowed && (
                <p className="text-xs text-muted-foreground">{deleteDecision.reason}</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

/** Özet bandının CTA'sı — PurchaseFormSheet'i kendi tetikleyicisiyle açar. */
function AddPurchaseCardButton(props: {
  orderId: string
  vehicle: PickerVehicle
  suppliers: SupplierInfo[]
  technicians: TechnicianInfo[]
  defaultTechnicianId: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Dış Parça
      </Button>
      {open && <PurchaseFormSheet {...props} item={null} open onOpenChange={setOpen} />}
    </>
  )
}

/**
 * Zenginleştirilmiş dış alım kartı: solda kutu fotoğrafı (yoksa simge karesi),
 * sağda belirgin tutar, altında tedarikçi/tarih/katalog bilgisi ve aksiyonlar.
 * Fotoğrafa dokunmak galeri lightbox'ını açar; ilk kare avatar olarak büyür,
 * diğerleri küçük şeritte devam eder (BAK-111).
 */
function PurchaseCard({
  item, photos, orderId, vehicle, suppliers, technicians, deleteDecision,
}: {
  item: OrderData["items"][number]
  photos: PurchasePhoto[]
  orderId: string
  vehicle: PickerVehicle
  suppliers: SupplierInfo[]
  technicians: TechnicianInfo[]
  deleteDecision: PurchaseDeleteDecision
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const lightboxPhotos: LightboxPhoto[] = photos.map((p) => ({
    id: p.id,
    label: `${item.name} — parça fotoğrafı`,
    note: p.note,
    fileUrl: p.src,
  }))

  return (
    <div className="rounded-xl border border-border bg-primary/[0.04] p-2.5">
      <div className="flex gap-2.5">
        {photos.length > 0 ? (
          <div className="w-12 shrink-0">
            <PhotoThumbnail
              src={photos[0].src}
              label={`${item.name} — parça fotoğrafı`}
              onOpen={() => setLightboxIndex(0)}
            />
          </div>
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
            <Package className="size-4" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="break-words text-sm font-medium text-foreground">
              {item.name}
              {item.quantity !== 1 && (
                <span className="ml-1.5 whitespace-nowrap text-xs text-muted-foreground">×{item.quantity}</span>
              )}
            </p>
            {item.purchasePriceKurus != null && (
              <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                {formatTRY(item.purchasePriceKurus)}
              </p>
            )}
          </div>

          {(item.sku || item.brand) && (
            <p className="mt-0.5 break-words text-xs text-muted-foreground">
              {item.sku && <span className="font-mono">{item.sku}</span>}
              {item.brand && <>{item.sku ? " · " : ""}{item.brand}</>}
            </p>
          )}

          {photos.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {photos.slice(1).map((p, i) => (
                <div key={p.id} className="w-12">
                  <PhotoThumbnail
                    src={p.src}
                    label={`${item.name} — parça fotoğrafı`}
                    onOpen={() => setLightboxIndex(i + 1)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border pt-2">
        <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
          <Store className="size-3 shrink-0" />
          <span className="truncate">{item.supplierName || "Tedarikçi belirtilmedi"}</span>
        </span>
        {item.purchasedAt && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="size-3 shrink-0" />
            {new Date(item.purchasedAt).toLocaleDateString("tr-TR")}
          </span>
        )}
        {item.tecdocArticleId != null && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary-strong">
            Katalog parçası
          </span>
        )}

        {deleteDecision.allowed ? (
          <div className="ml-auto flex items-center gap-1">
            <EditPurchaseButton
              orderId={orderId}
              vehicle={vehicle}
              suppliers={suppliers}
              technicians={technicians}
              item={{
                id: item.id,
                name: item.name,
                sku: item.sku,
                brand: item.brand,
                quantity: item.quantity,
                purchasePriceKurus: item.purchasePriceKurus,
                supplierName: item.supplierName,
                purchasedAt: item.purchasedAt,
                tecdocArticleId: item.tecdocArticleId,
              }}
            />
            <PurchaseDeleteButton item={item} orderId={orderId} />
          </div>
        ) : null}
      </div>

      <PhotoLightbox
        photos={lightboxPhotos}
        index={lightboxIndex ?? 0}
        onIndexChange={setLightboxIndex}
        open={lightboxIndex !== null}
        onOpenChange={(next) => { if (!next) setLightboxIndex(null) }}
      />
    </div>
  )
}

/**
 * Dış işçilik kartı — type=external_labor kalemi. Amber tonu grid'in "işçilik"
 * kodunu takip eder; parça kartından ayrıştıran başlıca fark: stok/katalog
 * alanları yok, yerine "nerede yaptırıldı" bilgisi ve kalem notu durur.
 * Sil butonu yalnız `deletable` izni açıksa görünür.
 */
function ExternalLaborCard({
  item, orderId, deletable,
}: {
  item: OrderData["items"][number]
  orderId: string
  deletable: boolean
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirmDelete() {
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/items?id=${item.id}&orderId=${orderId}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || "Silinemedi")
        return
      }
      setConfirmOpen(false)
      toast.success("Dış işçilik kalemi kaldırıldı")
      router.refresh()
    } catch {
      toast.error("Bağlantı hatası, lütfen tekrar deneyin")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-primary/[0.04] p-2.5">
        <div className="flex gap-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning-strong">
            <Wrench className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="break-words text-sm font-medium text-foreground">{item.name}</p>
              {item.unitPrice != null && (
                <p className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                  {formatTRY(item.unitPrice * item.quantity)}
                </p>
              )}
            </div>
            {item.supplierName && (
              <p className="mt-0.5 break-words text-xs text-muted-foreground">{item.supplierName}</p>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
          {item.note ? (
            <p className="min-w-0 break-words text-xs text-muted-foreground">{item.note}</p>
          ) : <span />}
          {deletable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setConfirmOpen(true)}
              aria-label={`${item.name} — dış işçilik kaydını sil`}
              className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive-strong"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!busy) setConfirmOpen(o) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dış işçilik kaydı silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{item.name}&quot; dış işçilik kalemi iş emrinden kaldırılacak: tutarı toplamdan
              düşecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={confirmDelete}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Dış alım kaydını iş emrinden komple kaldırır (BAK-83). Onay metni bunun bir
 * "listeden gizleme" değil, iş emri kaleminin silinmesi olduğunu açıkça söyler:
 * tutar toplamdan düşer, parça kutusu fotoğrafı da gider.
 */
function PurchaseDeleteButton({
  item,
  orderId,
}: {
  item: OrderData["items"][number]
  orderId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirmDelete() {
    setBusy(true)
    try {
      const res = await removePurchaseItemAction(item.id, orderId)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      setOpen(false)
      toast.success("Parça iş emrinden kaldırıldı")
      router.refresh()
    } catch {
      toast.error("Bağlantı hatası, lütfen tekrar deneyin")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`${item.name} — dışarıdan alınan parçayı sil`}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive-strong"
      >
        <Trash2 className="size-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parça kaydı silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{item.name}&quot; dışarıdan alınan parça kaydı iş emrinden de kaldırılacak:
              tutarı toplamdan düşecek ve varsa parça kutusu fotoğrafı silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={confirmDelete}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          <StickyNote className="size-4 text-warning-strong shrink-0 mt-0.5" />
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
              className="opacity-0 group-hover:opacity-100 p-1 text-warning-strong hover:text-destructive-strong transition-opacity"
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
        size="default"
        disabled={isPending || !content.trim()}
        className="touch-manipulation"
      >
        <Plus className="size-4" />
        Ekle
      </Button>
    </form>
  )
}
