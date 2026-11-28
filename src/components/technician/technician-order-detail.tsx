"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { CheckCircle2, ChevronDown, ChevronRight, ListChecks, Package, Pause, Play } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { toast } from "sonner"
import { useOrderSync } from "@/hooks/use-order-sync"
import { BottomSheet } from "@/components/shared/bottom-sheet"
import { groupPurchasePhotos } from "@/lib/photos/purchase-photos"
import { OrderItemsChecklist } from "@/components/technician/order-items-checklist"
import { OrderChecklist, useChecklistState } from "@/components/technician/order-checklist"
import type { PickerVehicle } from "@/components/parts/tecdoc-part-picker"
import type { SupplierInfo, TechnicianInfo } from "@/components/technician/purchase-form-sheet"
import { fuelTypeLabel } from "@/lib/constants"
import { holdWorkAction, completeWorkAction, startWorkWithTimerAction } from "@/app/(app)/technician/actions"
import { LaborSessionCard, StopLaborButton } from "@/components/technician/labor-session-card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { findUndecidedPartsRequests } from "@/lib/orders/parts-request-guard"
import { isOrderLocked } from "@/lib/status-transitions"
import { purchaseDeleteDecision } from "@/lib/orders/purchase-delete"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { OrderStatus } from "@prisma/client"
import type { LaborCatalogRow } from "@/lib/labor/types"
import { TechnicianPartsLaborSection } from "@/components/technician/technician-parts-labor-section"
import type { PartsAddType } from "@/components/orders/parts-labor-grid"
import { workOrderPath } from "@/lib/technician/cross-links"
import { StatusBadge } from "@/components/shared/status-badge"
import { countIncompleteItems, completeWorkBlockMessage } from "@/lib/technician/gates"
import {
  canCompleteWork,
  canHoldWork,
  workPrimaryAction,
  workScreenTiles,
  type WorkScreenPermissions,
  type WorkTileKey,
} from "@/lib/technician/work-screen"
import { missingRequiredPhotoTypes } from "@/lib/technician/photo-upload"
import { ElapsedTimer } from "@/components/technician/work-screen/elapsed-timer"
import { PurchaseCards } from "@/components/technician/work-screen/purchase-cards"
import { WorkTileGrid } from "@/components/technician/work-screen/work-tile-grid"
import { WorkSheets, type WorkSheetState } from "@/components/technician/work-screen/work-sheets"
import {
  CustomerBlock,
  DamageMarks,
  InternalNotesSection,
  LatestInternalNote,
  OrderTotals,
  PhotoSection,
} from "@/components/technician/work-screen/work-details"
import type { OrderData, TechnicianOrderItem } from "@/components/technician/work-screen/types"

/**
 * Teknisyen iş ekranı (kiosk, #1036): üstte plaka + durum, hemen altında tek
 * birincil eylem, ardından büyük kutucuklar ve "Yapılacaklar". Sihirbaz adımları,
 * sekmeler ve sabit alt çubuk yok — usta eldiveniyle tek dokunuşla ilerler.
 * Parça/işçilik ekleme ofis düzenleyicisini (PartsLaborGrid) olduğu gibi kullanır.
 */
export function TechnicianOrderDetail({
  order,
  technicians,
  suppliers,
  laborCatalog,
  permissions,
}: {
  order: OrderData
  technicians: TechnicianInfo[]
  suppliers: SupplierInfo[]
  /** İşçilik kataloğu — paylaşılan kalem düzenleyicisinin autocomplete kaynağı. */
  laborCatalog: LaborCatalogRow[]
  /** Rol → ekran yetenekleri (`workScreenPermissions`); kapılar sunucuda ayrıca var. */
  permissions: WorkScreenPermissions
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [holdDialogOpen, setHoldDialogOpen] = useState(false)
  const [sheet, setSheet] = useState<WorkSheetState>(null)
  const [addingType, setAddingType] = useState<PartsAddType | null>(null)
  const [editRequest, setEditRequest] = useState<{ rowId: string } | null>(null)
  const [checklistSheetOpen, setChecklistSheetOpen] = useState(false)
  const [checklistOpen, setChecklistOpen] = useState<string[]>(["checklist"])
  const checklistRef = useRef<HTMLDivElement>(null)

  const { canEditOrder, canChangeStatus } = permissions
  // Telefonda alttan sayfa, lg+ masaüstünde pencere (parça/işçilik ekleme yüzeyiyle aynı ayrım).
  const isMobile = useIsMobile()

  // BAK-140: ofis personeli/dış alım bu iş emrine parça eklediğinde teknisyen
  // sayfayı yenilemeden görsün.
  useOrderSync(order.id)

  const activeLabor = order.laborSessions.find((l) => !l.endTime)
  const locked = isOrderLocked(order.status as OrderStatus)

  // Kontrol listesinin iyimser durumu SAYFA seviyesinde: satır özeti ve sayfa
  // içindeki liste aynı sayıyı görsün.
  const checklist = useChecklistState(order.checklistItems, { orderId: order.id, locked })
  const liveChecklist = checklist.items.filter((item) => !item.deletedAt)
  const checklistDone = liveChecklist.filter((item) => item.isCompleted).length

  // Alış fotoğrafları (serviceOrderItemId != null) dahili-yalnızdır; onarım
  // galerilerine sızmaması için hepsinden dışlanır.
  const galleryPhotos = order.photos.filter((p) => p.serviceOrderItemId == null)
  const beforePhotos = galleryPhotos.filter((p) => p.phase === "intake")
  const duringPhotos = galleryPhotos.filter((p) => p.phase === "repair_progress")
  const afterPhotos = galleryPhotos.filter((p) => p.phase === "delivery")

  const purchasedItems = order.items.filter((i) => i.source === "purchase")
  // Dış işçilik gerçek iş emri kalemi ve "Dış Alımlar" kartında yaşar;
  // grid'e giden listeden süzülür ki aynı kalem iki yerde birikmesin.
  const externalLaborItems = order.items.filter((i) => i.type === "external_labor")
  const gridItems = order.items.filter((i) => i.type !== "external_labor")

  // Galeriden dışlanan alış kareleri kaybolmasın: ait oldukları kalemin kartında
  // gösterilir (BAK-111).
  const purchasePhotosByItem = groupPurchasePhotos(order.photos)

  // Dış alım silme/düzenleme kuralı (BAK-83, BAK-84) sunucudaki action ile AYNI
  // fonksiyondan okunur.
  const purchaseDelete = purchaseDeleteDecision(order.status as OrderStatus, canEditOrder)

  // Eski emirlerde ofisin henüz karara bağlamadığı talepler kalabilir; sunucu
  // kapısında "Teslime Hazır"ı hâlâ bloklar. Teknisyen neyin beklendiğini görsün.
  const undecidedRequests = findUndecidedPartsRequests(order.partsRequests)
  const undecidedRequestNames = (() => {
    const names = undecidedRequests.map((r) => r.partName)
    const rest = names.length - 2
    const shown = names.slice(0, 2).join(", ")
    return rest > 0 ? `${shown} (+${rest})` : shown
  })()

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

  const tiles = workScreenTiles(permissions, locked)
  const primaryAction = workPrimaryAction(order.status, !!activeLabor, canChangeStatus)
  const canHold = canHoldWork(order.status, canChangeStatus) && !locked
  const canComplete = canCompleteWork(order.status, canChangeStatus) && !locked
  const completeBlockedMessage = completeWorkBlockMessage(countIncompleteItems(order.items))

  const itemsDone = order.items.filter((i) => i.completedAt).length

  // Zorunlu fotoğraf ipucu: eksik tür sayısı Fotoğraf kutucuğunda rozet olur.
  const missingPhotoCount = missingRequiredPhotoTypes(order.photos.map((p) => p.type)).length
  const tileBadges = missingPhotoCount > 0 ? { photo: `${missingPhotoCount} eksik` } : undefined

  // Sayı, bölümlerde gerçekten listelenen karelerden gelir (VISIBLE_PHOTO sunucuda
  // süzer, alış kareleri galeri dışı); silme `router.refresh()` ile yeniden hesaplanır.
  const listedPhotoCount = beforePhotos.length + duringPhotos.length + afterPhotos.length
  const detailsSummary = [
    "Detaylar",
    listedPhotoCount > 0 ? `${listedPhotoCount} fotoğraf` : null,
    order.internalNotes.length > 0 ? `${order.internalNotes.length} not` : null,
  ].filter(Boolean).join(" · ")

  function handleTile(tile: WorkTileKey) {
    if (tile === "part") setAddingType("parca")
    else if (tile === "labor") setAddingType("iscilik")
    else if (tile === "purchase") setSheet({ kind: "purchase", item: null })
    else if (tile === "externalLabor") setSheet({ kind: "externalLabor", item: null })
    else if (tile === "photo") setSheet({ kind: "photo" })
    else setSheet({ kind: "note" })
  }

  function openPurchaseEdit(item: TechnicianOrderItem) {
    setSheet({
      kind: "purchase",
      item: {
        id: item.id,
        name: item.name,
        sku: item.sku,
        brand: item.brand,
        quantity: item.quantity,
        purchasePriceKurus: item.purchasePriceKurus,
        supplierName: item.supplierName,
        purchasedAt: item.purchasedAt,
        tecdocArticleId: item.tecdocArticleId,
      },
    })
  }

  function openLaborEdit(item: TechnicianOrderItem) {
    setSheet({
      kind: "externalLabor",
      item: {
        id: item.id,
        name: item.name,
        supplierName: item.supplierName,
        purchasePriceKurus: item.purchasePriceKurus,
        note: item.note,
        purchasedAt: item.purchasedAt,
        createdAt: item.createdAt,
      },
    })
  }

  // "Yapılacaklar" satırına dokunma: kalemin türüne göre doğru düzenleme yüzeyi.
  function handleEditItem(itemId: string) {
    const item = order.items.find((i) => i.id === itemId)
    if (!item) return
    if (item.type === "external_labor") openLaborEdit(item)
    else if (item.source === "purchase") {
      if (purchaseDelete.allowed) openPurchaseEdit(item)
      else toast.error(purchaseDelete.reason)
    } else setEditRequest({ rowId: itemId })
  }

  function handlePrimary() {
    startTransition(async () => {
      const res = await startWorkWithTimerAction(order.id)
      if (res && "error" in res && res.error) toast.error(res.error)
      router.refresh()
    })
  }

  function handleHoldWork() {
    startTransition(async () => {
      const res = await holdWorkAction(order.id)
      if (res && "error" in res && res.error) toast.error(res.error)
      else toast.success("Parça bekliyor olarak işaretlendi.")
      setHoldDialogOpen(false)
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

  const checklistRow = (
    <Button
      variant="outline"
      size="row"
      className="w-full justify-between"
      onClick={() => setChecklistSheetOpen(true)}
    >
      <span className="flex items-center gap-2">
        <ListChecks />
        Araç Kontrolü
      </span>
      <span className="tabular-nums text-muted-foreground">{checklistDone}/{liveChecklist.length}</span>
    </Button>
  )

  const checklistList = (
    <OrderChecklist
      orderId={order.id}
      state={checklist}
      locked={locked || !canEditOrder}
      open={checklistOpen}
      onOpenChange={setChecklistOpen}
      containerRef={checklistRef}
    />
  )

  const vehicleLine = [
    `${order.vehicle.brand} ${order.vehicle.model}`,
    order.vehicle.modelYear,
    order.vehicle.fuelType ? fuelTypeLabel(order.vehicle.fuelType) : null,
  ].filter(Boolean).join(" · ")

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <section className="space-y-2 rounded-xl bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={order.status} />
          {canEditOrder && (
            <Button variant="ghost" size="inline" asChild>
              <Link href={workOrderPath(order.id)}>
                İş emri
                <ChevronRight />
              </Link>
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{vehicleLine}</p>
        {order.intake.customerComplaint && (
          <p className="line-clamp-2 whitespace-pre-wrap text-sm text-foreground">{order.intake.customerComplaint}</p>
        )}
      </section>

      {locked && (
        <Alert>
          <AlertTitle>Bu araç kabulü salt okunur</AlertTitle>
          <AlertDescription>
            Bu araç kabulü {order.status === "cancelled" ? "iptal edildi" : "teslim edildi"}. Bilgiler değiştirilemez; inceleyebilirsin.
          </AlertDescription>
        </Alert>
      )}

      {undecidedRequests.length > 0 && (
        <Alert variant="warning">
          <Package />
          <AlertTitle>Karar bekleyen eski talep var</AlertTitle>
          <AlertDescription>
            {undecidedRequestNames}. Ofis karar verince kalem olarak burada görünür.
          </AlertDescription>
        </Alert>
      )}

      <LatestInternalNote note={order.internalNotes[0]} />

      <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="min-w-0 space-y-4">
          {activeLabor && !locked && canChangeStatus && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4">
              <ElapsedTimer startTime={activeLabor.startTime} />
              {primaryAction === "pause" ? (
                <StopLaborButton
                  orderId={order.id}
                  label="Ara Ver"
                  mode="pause"
                  size="xl"
                  variant="foreground"
                  className="w-full sm:w-auto"
                />
              ) : (
                // Teslime hazır gibi birincil eylemin olmadığı durumlarda da açık sayaç durdurulabilir.
                <StopLaborButton orderId={order.id} label="Sayacı Durdur" size="xl" className="w-full sm:w-auto" />
              )}
            </section>
          )}

          {(primaryAction === "start" || primaryAction === "resume") && (
            <Button variant="foreground" size="xl" className="w-full" onClick={handlePrimary} disabled={isPending}>
              <Play />
              {primaryAction === "resume" ? "Devam Et" : "İşi Başlat"}
            </Button>
          )}

          {canHold && (
            <div className="pt-2">
              <Button variant="ghost" size="row" className="w-full justify-center" onClick={() => setHoldDialogOpen(true)} disabled={isPending}>
                <Pause />
                Parça bekliyor
              </Button>
            </div>
          )}

          <WorkTileGrid tiles={tiles} onSelect={handleTile} badges={tileBadges} />

          <section className="space-y-3 rounded-xl bg-card p-4">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Yapılacaklar <span className="tabular-nums">{itemsDone}/{order.items.length}</span>
            </h2>
            <OrderItemsChecklist
              orderId={order.id}
              items={order.items}
              locked={locked}
              canToggle={canEditOrder}
              hideHeading
              emptyMessage={tiles.length > 0 ? "Yukarıdaki kutucuklardan ekle." : "Henüz kalem yok."}
              onEditItem={canEditOrder && !locked ? handleEditItem : undefined}
            />
            {order.totals.hasAnyPrice && <OrderTotals totals={order.totals} taxRate={order.taxRate} />}
          </section>

          <TechnicianPartsLaborSection
            orderId={order.id}
            status={order.status}
            items={gridItems}
            vehicle={pickerVehicle}
            laborCatalog={laborCatalog}
            taxRateBps={order.taxRate}
            canEditOrder={canEditOrder}
            addingType={addingType}
            onAddingTypeChange={setAddingType}
            editRequest={editRequest}
          />

          <PurchaseCards
            orderId={order.id}
            locked={locked}
            purchases={purchasedItems}
            laborItems={externalLaborItems}
            photosByItem={purchasePhotosByItem}
            deleteDecision={purchaseDelete}
            canDeleteLabor={canEditOrder}
            onEditPurchase={openPurchaseEdit}
            onEditLabor={openLaborEdit}
          />

          {/* Telefonda okuma sırası: Yapılacaklar → Araç Kontrolü → İşi Bitir → Detaylar. */}
          <div className="lg:hidden">{checklistRow}</div>

          {canComplete && (
            <div className="space-y-2">
              {completeBlockedMessage && (
                <p className="text-center text-xs text-warning-strong">{completeBlockedMessage}</p>
              )}
              <Button
                variant="success"
                size="xl"
                className="w-full"
                onClick={() => setCompleteDialogOpen(true)}
                disabled={isPending || !!completeBlockedMessage}
              >
                <CheckCircle2 />
                İşi Bitir
              </Button>
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="max-lg:hidden">{checklistRow}</div>

          <Collapsible className="rounded-xl bg-card">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="row" className="group w-full justify-between">
                {detailsSummary}
                <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 p-4 pt-0">
              <CustomerBlock customer={order.customer} />
              <DamageMarks marks={order.damageMarks} />
              <div>
                <PhotoSection label="Onarım Öncesi" photos={beforePhotos} canDelete={!locked && canEditOrder} onDeleted={() => router.refresh()} />
                <PhotoSection label="Onarım Sırasında" photos={duringPhotos} canDelete={!locked && canEditOrder} onDeleted={() => router.refresh()} />
                <PhotoSection label="Onarım Sonrası" photos={afterPhotos} canDelete={!locked && canEditOrder} onDeleted={() => router.refresh()} />
                {galleryPhotos.length === 0 && <p className="text-sm text-muted-foreground">Henüz fotoğraf eklenmedi.</p>}
              </div>
              <InternalNotesSection notes={order.internalNotes} locked={locked} canDelete={canEditOrder} />
              <LaborSessionCard
                sessions={order.laborSessions}
                locked={locked}
                canEdit={canEditOrder}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <WorkSheets
        sheet={sheet}
        onClose={() => setSheet(null)}
        orderId={order.id}
        intakeFormId={order.intake.id}
        orderStatus={order.status}
        existingPhotoTypes={order.photos.map((p) => p.type)}
        vehicle={pickerVehicle}
        suppliers={suppliers}
        technicians={technicians}
        defaultTechnicianId={order.assignedTechnicianId}
      />

      {isMobile ? (
        <BottomSheet open={checklistSheetOpen} onOpenChange={setChecklistSheetOpen} title="Araç Kontrolü">
          <div className="pb-4">{checklistList}</div>
        </BottomSheet>
      ) : (
        <Dialog open={checklistSheetOpen} onOpenChange={setChecklistSheetOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Araç Kontrolü</DialogTitle>
              <DialogDescription>Kontrol maddelerini işaretle.</DialogDescription>
            </DialogHeader>
            {checklistList}
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={holdDialogOpen} onOpenChange={setHoldDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parça bekleniyor olarak işaretlensin mi?</AlertDialogTitle>
            <AlertDialogDescription>Sayaç durur. Parça gelince “Devam Et” ile sürdürebilirsin.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleHoldWork} disabled={isPending}>Parça bekliyor</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İş tamamlandı olarak işaretlensin mi?</AlertDialogTitle>
            <AlertDialogDescription>Bu işlem araç kabulünü kilitler. Devam etmek istediğine emin misin?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteWork} disabled={isPending}>İşi bitir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
