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
} from "lucide-react"
import { toast } from "sonner"
import { PhotoLightbox, type LightboxPhoto } from "@/components/shared/photo-lightbox"
import { resolvePhotoSrc } from "@/lib/photos/photo-src"
import { groupPurchasePhotos, type PurchasePhoto } from "@/lib/photos/purchase-photos"
import { OrderItemsChecklist } from "@/components/technician/order-items-checklist"
import { OrderChecklist, useChecklistState } from "@/components/technician/order-checklist"
import { TechnicianPhotoUpload } from "@/components/technician/technician-photo-upload"
import { PartCard } from "@/components/parts/part-card"
import type { PickerVehicle } from "@/components/parts/tecdoc-part-picker"
import {
  AddPurchaseButton,
  EditPurchaseButton,
  type SupplierInfo,
  type TechnicianInfo,
} from "@/components/technician/purchase-form-sheet"
import {
  ORDER_STATUS,
  fuelTypeLabel, transmissionLabel,
} from "@/lib/constants"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WizardActions, WizardHeading } from "@/components/intake/wizard-ui"
import {
  PartsRequestSection,
  type TechnicianPartsRequest,
} from "@/components/technician/parts-request-section"
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
  { id: "start", label: "İşi başlat" },
  { id: "check", label: "Araç kontrolü" },
  { id: "items", label: "Yapılacak işler" },
  { id: "needs", label: "Parça ve dış hizmet" },
  { id: "finish", label: "Fotoğraf ve bitir" },
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
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)

  // BAK-140: ofis personeli/dış alım bu iş emrine parça eklediğinde teknisyen
  // sayfayı yenilemeden görsün — office tarafındaki aynı desen (work-order-detail.tsx).
  useOrderSync(order.id)

  const statusInfo = (ORDER_STATUS as Record<string, { label: string; color: string }>)[order.status]
  const statusLabel = statusInfo?.label || order.status
  const statusColor = statusInfo?.color || "bg-muted text-foreground"

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

  // Galeriden dışlanan alış kareleri kaybolmasın: ait oldukları kalemin kartında
  // gösterilir (BAK-111). Teknisyen kutunun/fişin üzerindeki yazıyı okumak için
  // fotoğrafa dokunup büyütebilsin diye kart içinde küçük şerit olarak durur.
  const purchasePhotosByItem = groupPurchasePhotos(order.photos)

  // Dış alım silme/düzenleme kuralı (BAK-83, BAK-84) sunucudaki action ile AYNI
  // fonksiyondan okunur; butonlar yalnız gerçekten izinliyken çıkar, aksi halde
  // gerekçe yazılır.
  const purchaseDelete = purchaseDeleteDecision(order.status as OrderStatus, canEditOrder)

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
  const currentIndex = steps.findIndex((step) => step.id === currentStep)

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
      <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/technician" className="hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          Teknisyen Paneli
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{order.workOrderNo}</span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
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
        {/* Aynı işin iş emri görünümüne kısayol (BAK-23): fiyat, tahsilat ve
            kanıt burada yok. Link olmadığı için kenar çubuğundan /orders'a
            gidip aynı işi listede yeniden aramak gerekiyordu. */}
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          className="shrink-0"
          render={<Link href={workOrderPath(order.id)} />}
        >
          <FileText />
          İş Emri
        </Button>
      </div>

      {/* BAK-148: beklemeye alma/devam etme hızlı kararı adım/sekme içeriğine
          gömülü değil, teknisyen hangi adımda olursa olsun burada durur. */}
      {(canHold || canStart) && (
        <div className="flex flex-wrap items-center gap-2">
          {canHold && (
            <Button variant="warning" size="lg" onClick={handleHoldWork} disabled={isPending}>
              <Pause /> Beklemeye al
            </Button>
          )}
          {canStart && (
            <Button size="lg" onClick={handleStartWork} disabled={isPending}>
              <Play /> {order.status === "waiting_parts" ? "Tamire devam et" : "Tamire başla"}
            </Button>
          )}
        </div>
      )}

      {locked && (
        <Alert>
          <AlertTitle>Bu iş emri salt okunur</AlertTitle>
          <AlertDescription>
            Bu iş emri {order.status === "cancelled" ? "iptal edildi" : "teslim edildi"}. Bilgiler değiştirilemez; adımları inceleyebilirsiniz.
          </AlertDescription>
        </Alert>
      )}

      {activeLabor && (
        <div className="flex min-h-8 flex-wrap items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-3 py-2">
          <span className="size-2 rounded-full bg-success motion-safe:animate-pulse" />
          <span className="text-sm font-medium text-foreground">İşçilik sürüyor</span>
          <span className="text-xs text-muted-foreground">
            {new Date(activeLabor.startTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} başlangıç
          </span>
          {!locked && <StopLaborButton orderId={order.id} className="ml-auto" />}
        </div>
      )}

      {/* Sekmeler baştan tamamı görünür ve serbestçe gezilebilir (BAK-137):
          önceki adımın tamamlanmış olması bir sekmeye geçişi engellemez,
          kilit yalnız düzenlemeyi durdurur (yukarıdaki salt-okunur uyarısı). */}
      <Tabs value={currentStep} onValueChange={(value) => isStepId(String(value)) && goToStep(value as StepId)}>
        <div className="max-w-full overflow-x-auto pb-1">
          <TabsList className="w-max">
            {steps.map((step, i) => (
              <TabsTrigger key={step.id} value={step.id}>
                {i + 1}. {step.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <section className="min-w-0 space-y-4 mt-4" aria-live="polite">
          <WizardHeading
            eyebrow={`Adım ${currentIndex + 1} / ${steps.length}`}
            title={steps[currentIndex].label}
            description={
              currentStep === "start" ? "Araç ve şikâyeti kontrol edip tamire başlayın." :
              currentStep === "check" ? "Araç kontrollerini ve mevcut hasarları gözden geçirin." :
              currentStep === "items" ? "Yapılan işleri işaretleyin ve gerekli notları ekleyin." :
              currentStep === "needs" ? "Kullanılan parça ve işçilikleri girin; gerekirse talep açın veya dış alım kaydedin." :
              "Fotoğrafları ekleyip son kontrollerden sonra işi tamamlayın."
            }
          />

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
              <WizardActions>
                <Button size="lg" onClick={() => goToStep("check")}>Kontrole geç</Button>
              </WizardActions>
              {canStart && startReminder && <ChecklistReminder message={startReminder} onReveal={() => goToStep("check")} />}
          </TabsContent>

          <TabsContent value="check" className="space-y-4">
              <OrderChecklist orderId={order.id} state={checklist} locked={locked} open={checklistOpen} onOpenChange={setChecklistOpen} containerRef={checklistRef} />
              {order.damageMarks.length > 0 && <DamageMarks marks={order.damageMarks} />}
              <WizardActions back={<Button variant="outline" size="lg" onClick={() => goToStep("start")}>Geri</Button>}>
                <Button size="lg" onClick={() => goToStep("items")}>Yapılacak işlere geç</Button>
              </WizardActions>
          </TabsContent>

          <TabsContent value="items" className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <OrderItemsChecklist orderId={order.id} items={order.items} locked={locked} />
                {order.totals.hasAnyPrice && <OrderTotals order={order} />}
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <StickyNote /> İç Notlar <span className="text-xs font-normal text-muted-foreground">(Müşteriye görünmez)</span>
                </h3>
                <InternalNotesSection notes={order.internalNotes} orderId={order.id} locked={locked} />
                {!locked && <AddInternalNoteForm orderId={order.id} />}
              </div>
              <WizardActions back={<Button variant="outline" size="lg" onClick={() => goToStep("check")}>Geri</Button>}>
                <Button size="lg" onClick={() => goToStep("needs")}>Parça ve dış hizmete geç</Button>
              </WizardActions>
          </TabsContent>

          <TabsContent value="needs" className="space-y-4">
              {/* BAK-141 — "Parça & İşçilik" ilk sekme ve `order.edit` taşıyan
                  kullanıcıda VARSAYILAN: müşterinin isteği teknisyenin kalemi
                  doğrudan girebilmesi, talep açması değil. İzni olmayan (çırak)
                  eski varsayılanda kalır — ona düzenleyici zaten açılmıyor. */}
              <Tabs defaultValue={canEditOrder ? "kalemler" : "requests"}>
                <div className="max-w-full overflow-x-auto pb-1">
                  <TabsList>
                    <TabsTrigger value="kalemler">Parça &amp; İşçilik ({order.items.length})</TabsTrigger>
                    <TabsTrigger value="requests">Talepler ({order.partsRequests.length})</TabsTrigger>
                    <TabsTrigger value="purchases">Dış alımlar ({purchasedItems.length})</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="kalemler">
                  <TechnicianPartsLaborSection
                    orderId={order.id}
                    status={order.status}
                    items={order.items}
                    vehicle={pickerVehicle}
                    laborCatalog={laborCatalog}
                    taxRateBps={order.taxRate}
                    canEditOrder={canEditOrder}
                  />
                </TabsContent>
                <TabsContent value="requests">
                  <PartsRequestSection orderId={order.id} vehicle={pickerVehicle} requests={order.partsRequests} locked={locked} />
                </TabsContent>
                <TabsContent value="purchases">
                  <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ShoppingCart className="size-4 text-muted-foreground" />
            Dışarıdan Alınan Parçalar
          </h3>
        </div>
        <PurchasedItemsSection
          items={purchasedItems}
          photosByItem={purchasePhotosByItem}
          orderId={order.id}
          vehicle={pickerVehicle}
          suppliers={suppliers}
          technicians={technicians}
          deleteDecision={purchaseDelete}
        />
        {!locked && (
          <AddPurchaseButton
            orderId={order.id}
            vehicle={pickerVehicle}
            suppliers={suppliers}
            technicians={technicians}
            defaultTechnicianId={order.assignedTechnicianId}
          />
        )}
                  </div>
                </TabsContent>
              </Tabs>
              <WizardActions back={<Button variant="outline" size="lg" onClick={() => goToStep("items")}>Geri</Button>}>
                <Button size="lg" onClick={() => goToStep("finish")}>Fotoğraf ve bitirmeye geç</Button>
              </WizardActions>
          </TabsContent>

          <TabsContent value="finish" className="space-y-4">
              <Tabs defaultValue="photos">
                <div className="max-w-full overflow-x-auto pb-1">
                  <TabsList>
                    <TabsTrigger value="photos">Fotoğraflar</TabsTrigger>
                    <TabsTrigger value="review">Son kontrol</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="photos">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground"><Camera /> Onarım Fotoğrafları</h3>
                    <PhotoSection label="Onarım Öncesi" photos={beforePhotos} canDelete={!locked} onDeleted={() => router.refresh()} />
                    <PhotoSection label="Onarım Sırasında" photos={duringPhotos} canDelete={!locked} onDeleted={() => router.refresh()} />
                    <PhotoSection label="Onarım Sonrası" photos={afterPhotos} canDelete={!locked} onDeleted={() => router.refresh()} />
                    {galleryPhotos.length === 0 && <p className="text-sm text-muted-foreground">Henüz fotoğraf eklenmedi.</p>}
                    {!locked && <TechnicianPhotoUpload intakeFormId={order.intake.id} orderStatus={order.status} existingPhotoTypes={order.photos.map((p) => p.type)} />}
                  </div>
                </TabsContent>
                <TabsContent value="review">
                  <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                    <ReviewRow label="Araç kontrolü" detail={`${checklist.items.filter((item) => item.isCompleted && !item.deletedAt).length}/${checklist.items.filter((item) => !item.deletedAt).length}`} complete={completeChecklistLeft === 0} />
                    <ReviewRow label="Yapılacak işler" detail={completeBlockedMessage ?? "Tümü tamamlandı"} complete={!completeBlockedMessage} />
                    <ReviewRow label="Bekleyen talepler" detail={`${order.partsRequests.filter((request) => request.status === "requested").length}`} complete={!order.partsRequests.some((request) => request.status === "requested")} />
                  </div>
                </TabsContent>
              </Tabs>

              {canComplete && completeBlockedMessage && <BlockedMessage message={completeBlockedMessage} />}
              {canComplete && completeReminder && <ChecklistReminder message={completeReminder} onReveal={() => goToStep("check")} />}
              <WizardActions back={<Button variant="outline" size="lg" onClick={() => goToStep("needs")}>Geri</Button>}>
                {canComplete && (
                  <Button variant="success" size="lg" onClick={() => setCompleteDialogOpen(true)} disabled={isPending || !!completeBlockedMessage}>
                    <CheckCircle2 /> İşi tamamla
                  </Button>
                )}
              </WizardActions>
          </TabsContent>
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
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Mevcut Hasarlar</h3>
      <div className="space-y-1.5">
        {marks.map((mark) => (
          <div key={mark.id} className="flex min-h-8 flex-wrap items-center gap-2 rounded bg-destructive/10 px-3 py-2 text-sm">
            <span className="font-medium text-foreground">{mark.zone}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-foreground">{mark.damageType}</span>
            <span className="text-xs text-muted-foreground">({mark.severity})</span>
            {mark.note && <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">{mark.note}</span>}
          </div>
        ))}
      </div>
    </div>
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
    <div className="flex min-h-8 items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
      <span className="font-medium text-foreground">{complete ? "✓" : "!"} {label}</span>
      <span className="text-right text-xs text-muted-foreground">{detail}</span>
    </div>
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
    <div className="rounded-lg border border-border bg-card p-4">
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
    <div className="rounded-lg border border-border bg-card p-4">
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
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-2">Müşteri Şikayeti</h3>
      <p className="text-sm text-foreground whitespace-pre-wrap">{complaint}</p>
    </div>
  )
}

/**
 * Faz bazlı fotoğraf ızgarası. Kaynak `fileUrl` değil `resolvePhotoSrc` ile
 * belirlenir (depo referansı doğrudan açılamaz), dokununca diğer ekranlardaki
 * gibi tam ekran `PhotoLightbox` açılır. `canDelete` verildiğinde her karenin
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
                <div className="w-full aspect-square rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground/70">
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
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1 text-muted-foreground/70">
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
 * Dış alım kaleminin kartı içindeki fotoğraf şeridi (BAK-111).
 *
 * Teknisyen parça kutusunun/fişin üzerindeki yazıyı küçük karede okuyamıyordu;
 * dokununca galeriyle AYNI tam ekran `PhotoLightbox` açılır (X, Escape, kaydırma
 * ve çift dokunuşla yakınlaştırma oradan gelir). Kalemde birden çok kare varsa
 * hepsi aynı lightbox içinde gezilir.
 *
 * Karenin genişliği 64px: mobil dokunma hedefi eşiğinin (44px) üstünde.
 */
function PurchasePhotoStrip({ photos, itemName }: { photos: PurchasePhoto[]; itemName: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const lightboxPhotos: LightboxPhoto[] = photos.map((p) => ({
    id: p.id,
    label: itemName,
    note: p.note,
    fileUrl: p.src,
  }))

  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((p, i) => (
        <div key={p.id} className="w-16">
          <PhotoThumbnail
            src={p.src}
            label={`${itemName} — parça fotoğrafı`}
            onOpen={() => setLightboxIndex(i)}
          />
        </div>
      ))}
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
 * Dış alım listesi — projenin ortak PARÇA KARTINI kullanır (BAK-84), yani
 * "Parça Talepleri" bölümüyle aynı yerleşim: ad + miktar, altında mono parça
 * numarası ve marka, sağda tutar, altta tarih/kaynak ve aksiyonlar.
 *
 * Düzenleme ve silme AYNI kapıdan geçer (`purchaseDeleteDecision`): kalemi
 * silemeyen roller onu değiştiremez de — ikisi de kalemin kimliğini bozar.
 */
function PurchasedItemsSection({
  items,
  photosByItem,
  orderId,
  vehicle,
  suppliers,
  technicians,
  deleteDecision,
}: {
  items: OrderData["items"]
  /** Kalem kimliği → o kaleme ait gösterilebilir kareler (`groupPurchasePhotos`). */
  photosByItem: Map<string, PurchasePhoto[]>
  orderId: string
  vehicle: PickerVehicle
  suppliers: SupplierInfo[]
  technicians: TechnicianInfo[]
  deleteDecision: PurchaseDeleteDecision
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground/70">Henüz dışarıdan alınan parça yok.</p>
  }
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const photos = photosByItem.get(item.id) ?? []
        return (
        <PartCard
          key={item.id}
          name={item.name}
          quantity={item.quantity}
          partNo={item.sku}
          brand={item.brand}
          // Fotoğrafı olmayan kalemde slot HİÇ verilmez: aksi halde boş bir
          // kutu ve üst boşluğu kalırdı.
          media={photos.length > 0 ? <PurchasePhotoStrip photos={photos} itemName={item.name} /> : null}
          badge={
            item.purchasePriceKurus != null ? (
              <span className="text-sm font-semibold text-foreground">
                {formatTRY(item.purchasePriceKurus)}
              </span>
            ) : null
          }
          meta={
            <>
              {item.supplierName || "Tedarikçi belirtilmedi"}
              {item.purchasedAt && ` · ${new Date(item.purchasedAt).toLocaleDateString("tr-TR")}`}
              {item.tecdocArticleId != null && " · Katalog parçası"}
            </>
          }
          actions={
            deleteDecision.allowed ? (
              <>
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
              </>
            ) : null
          }
        />
        )
      })}
      {!deleteDecision.allowed && (
        <p className="text-xs text-muted-foreground/70">{deleteDecision.reason}</p>
      )}
    </div>
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
              className="opacity-0 group-hover:opacity-100 p-1 text-warning-strong/60 hover:text-destructive-strong transition-opacity"
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
