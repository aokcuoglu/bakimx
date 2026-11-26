"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DashOrderStatus, surface } from "@/components/dashboard/surface"
import { DetailPanel, DetailPill, OrderPaymentPill, detail } from "@/components/orders/order-detail-surface"
import { orderListReturnHref } from "@/lib/orders/list-state"
import { isUnassignedListHref } from "@/lib/orders/unassigned-in-service"
import { DetailHeader, type DetailHeaderAction } from "@/components/orders/detail-header"
import { OrderRecordRail } from "@/components/orders/order-record-rail"
import {
  Camera,
  Share2,
  CheckCircle2,
  Pencil,
  Info,
  Upload,
  Loader2,
  Link as LinkIcon,
  Eye,
  EyeOff,
  KeyRound,
  Printer,
  FileText,
  Send,
  Play,
  Package,
  PackageCheck,
  XCircle,
  RotateCcw,
  Undo2,
  Plus,
  X,
  HardHat,
  ChevronRight,
  UserPlus,
  ArrowLeft,
} from "lucide-react"
import {
  PHOTO_TYPES,
  PHOTO_PHASES,
  VEHICLE_PHOTO_TYPES,
  PAYMENT_STATUS,
  type PaymentStatusKey,
  type PhotoPhaseKey,
} from "@/lib/constants"
import { formatTRY } from "@/lib/format"
import { kurusToLira, bpsToPercent, liraToKurus, percentToBps } from "@/lib/money"
import { STANDARD_TAX_BPS } from "@/lib/orders/line-vat"
import { isOrderLocked } from "@/lib/status-transitions"
import { findUnpricedItems } from "@/lib/orders/pricing-guard"
import { findUndecidedPartsRequests } from "@/lib/orders/parts-request-guard"
import { canOpenTechnicianView, technicianOrderPath } from "@/lib/technician/cross-links"
import type { OrderStatus } from "@prisma/client"
import { DamageCapture } from "@/components/intake/damage-capture"
import { PhotoGalleryGrid } from "@/components/intake/photo-gallery-grid"
import { PhotoPhaseMatrix } from "@/components/intake/photo-phase-matrix"
import { partitionIntakePhotos, photoPhaseForStatus } from "@/lib/photos/phase-matrix"
import { generateWhatsAppShareText, getWhatsAppSendUrl } from "@/lib/share/whatsapp"
import { calculatePhotoCompletion } from "@/lib/intake/completeness"
import { IntakeEvidenceSummary } from "@/components/intake/intake-evidence-summary"
import { FuelLevelPicker } from "@/components/intake/fuel-gauge"
import { OrderActivityLog } from "@/components/orders/order-activity-log"
import { useOrderSync } from "@/hooks/use-order-sync"
import type { OrderActivityEntry } from "@/lib/orders/activity"
import {
  NEXT_STATUSES,
  PartsLaborCard,
  OrderPaymentCard,
  PaymentHistoryCard,
  type OrderDetailData,
  type PricingMetaDraft,
} from "@/components/orders/order-management-panel"
import { OrderInfoCard } from "@/components/orders/order-info-card"
import { reopenDeliveredOrderAction } from "@/app/(app)/orders/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { TechnicianProgressPanel } from "@/components/orders/technician-progress-panel"
import { TechnicianAssign, type AssignableTechnician } from "@/components/orders/technician-assign"
import { PartsRequestPanel } from "@/components/orders/parts-request-panel"
import type { LaborCatalogRow } from "@/lib/labor/types"
import { MAX_BATCH_PHOTOS, describeUploadFailure, selectPhotoFiles } from "@/lib/photos/select-photo-files"
import { InlineFeatureUpsell } from "@/components/billing/inline-feature-upsell"
import type { GatedFeature, PlanTier } from "@/lib/plan"
import { compressImagesForUpload } from "@/lib/image/compress-image"
import { cn } from "@/lib/utils"
import { istanbulDateTimeInputValue } from "@/lib/istanbul-time"
import { DeferUntilVisible } from "@/components/shared/defer-until-visible"
import { OrderSectionNav } from "@/components/orders/order-section-nav"
import { OrderMobileSummary, OrderStatusCard } from "@/components/orders/order-status-summary"
import { useOrderSectionScroll } from "@/components/orders/use-order-section-scroll"
import { useReturnFocus } from "@/hooks/use-return-focus"
import { orderNextStep } from "@/lib/orders/next-step"
import { orderTotalsChain, totalsChainText } from "@/lib/orders/totals-chain"
import { urlWithout } from "@/lib/orders/detail-sections"
import { OrderQuickActions } from "@/components/orders/order-quick-actions"
import { PhotoSourceButtons } from "@/components/intake/photo-source-buttons"
import { orderQuickActions, type OrderQuickAction } from "@/lib/orders/quick-actions"
import type { PartsAddType } from "@/components/orders/parts-labor-grid"

// Header aksiyon ikonları (eski orders ekranıyla aynı görünüm). Hedef duruma göre;
// geri dönüş geçişi ileri geçişin ikonunu almasın diye `ORDER_BACK_ACTION_ICONS`
// (kaynak durum → hedef) önce bakılır: Teslime Hazır → İşlemde "Başla"nın ▶'i değil.
const ORDER_BACK_ACTION_ICONS: Record<string, Record<string, DetailHeaderAction["icon"]>> = {
  ready_for_delivery: { in_progress: Undo2 },
}
const ORDER_ACTION_ICONS: Record<string, DetailHeaderAction["icon"]> = {
  waiting_approval: Send,
  approved: CheckCircle2,
  in_progress: Play,
  waiting_parts: Package,
  ready_for_delivery: PackageCheck,
  delivered: KeyRound,
  cancelled: XCircle,
  draft: RotateCcw,
}

// Yüklenmeyi bekleyen seçim. `previewUrl` bir blob URL'idir; kare listeden
// çıktığında (kaldırıldı / yüklendi / dialog kapandı) revoke edilir.
type PendingPhoto = { key: string; file: File; previewUrl: string }

type VehiclePhoto = {
  id: string
  type: string
  phase: string
  label: string
  required: boolean
  fileUrl: string | null
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
  storageProvider: string | null
  note: string | null
}

type IntakeDetailProps = {
  id: string
  status: string
  mileageAtIntake: number | null
  fuelLevelAtIntake: number | null
  customerComplaint: string
  internalNote: string | null
  approvedAt: Date | null
  createdAt: Date
  customer: {
    id: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    contactName: string | null
    type: string
    phone: string
    email: string | null
  }
  vehicle: { id: string; plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null }
  photos: VehiclePhoto[]
  damageMarks: { id: string; zone: string; damageType: string; severity: string; note: string | null }[]
  approvals: { id: string; status: string; createdAt: Date }[]
  shareLinks: { id: string; token: string; isActive: boolean }[]
  order: { id: string; status: string; paymentStatus: string; items: { id: string; type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null; note: string | null }[] } | null
}

/**
 * BAK-102 — "Aracı Getiren" / "Aracı Teslim Alacak" okuma bloğu. Değer boş olsa
 * da render edilir: alan opsiyonel olduğu için gizlenirse servis kullanıcısı
 * böyle bir alanın var olduğunu hiç görmüyor. Boşken ne anlama geldiğini yazar
 * ve yetkisi varsa mevcut düzenleme editörünü açan tek bir aksiyon sunar.
 */
function HandoverPerson({
  label,
  name,
  phone,
  emptyText,
  closedText,
  onAdd,
}: {
  label: string
  name: string | null
  phone: string | null
  emptyText: string
  /** Teslimden sonra boş alanın anlamı geçmiş zamanla yazılır (#913); verilmezse `emptyText`. */
  closedText?: string
  /**
   * Verilmezse (yetki yok / emir kilitli) yalnız bilgi görünür. Düğmeyi alır:
   * düzenleme penceresi kapanınca odak oraya döner (#913).
   */
  onAdd?: (opener: HTMLElement) => void
}) {
  return (
    <div className="min-w-0">
      <p className={detail.fieldLabel}>{label}</p>
      {name ? (
        <>
          <p className="text-sm text-foreground break-words">{name}</p>
          {phone && (
            <a href={`tel:${phone}`} className="text-xs text-primary hover:underline break-all">
              {phone}
            </a>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{closedText ?? emptyText}</p>
          {onAdd && (
            <Button variant="link" size="sm" onClick={(event) => onAdd(event.currentTarget)} className="px-0">
              <Plus className="size-3.5" /> Bilgi ekle
            </Button>
          )}
        </>
      )}
    </div>
  )
}

export function WorkOrderDetail({
  intake,
  order,
  technicians,
  activity = [],
  editInitially = false,
  returnTo,
  laborCatalog,
  canReopen = false,
  canEditInfo = false,
  enabledFeatures,
  currentTier,
}: {
  intake: IntakeDetailProps
  order: OrderDetailData
  technicians?: AssignableTechnician[]
  activity?: OrderActivityEntry[]
  // Listeden "Düzenle" ile gelindiğinde (?edit=1) Şikayet & Notlar kartı
  // doğrudan düzenleme modunda açılır. Kilitli emirde yok sayılır.
  editInitially?: boolean
  returnTo?: string
  // Atölyenin işçilik kataloğu — İşçilik composer'ının öneri kaynağı.
  laborCatalog: LaborCatalogRow[]
  // #183 — teslim edilmiş iş emrini yeniden açma yetkisi (yalnız Yönetici).
  // Karar SUNUCUDA verilir; burada yalnız görünürlük. Asıl kapı action'da.
  canReopen?: boolean
  // BAK-102 — "Şikayet & Notlar" kartındaki düzenleme aksiyonu yetkisi
  // (`order.edit`). Karar SUNUCUDA verilir (`updateIntakeDetailsAction` →
  // `requireWritableWorkshop("order.edit")`); burada yalnız görünürlük.
  canEditInfo?: boolean
  enabledFeatures: readonly GatedFeature[]
  currentTier: PlanTier
}) {
  const router = useRouter()

  useOrderSync(order.id)

  // #911 — tek sayfa: bölümler hep DOM'da, atlamalar doğrudan bölüme kaydırır
  // (#838'in bekleyen kaydırması sekme paneli içindi). Eski `?tab=` bağlantısı
  // açılışta ilgili bölüme kaydırır. Adres `#bölüm` olur ve `?edit=1` düşer;
  // `router.replace` değil `history.replaceState`, sunucuya gidilmez.
  const pageRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const scrollToOrderSection = useOrderSectionScroll(pageRef, railRef)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const orderLocked = isOrderLocked(order.status as OrderStatus)
  // Kabulün açıldığı liste (filtreleri korunur) ve o liste "usta bekliyor"
  // listesi mi (#866): öyleyse üstte usta atama notu gösterilir.
  const listHref = orderListReturnHref(returnTo)
  const fromUnassignedList = isUnassignedListHref(listHref)
  const canCashbox = enabledFeatures.includes("cashbox")
  const canTeam = enabledFeatures.includes("team")
  const canUseInventory = enabledFeatures.includes("partsInventory")
  const canUsePhotoChecklist = enabledFeatures.includes("photoChecklist")
  const canUseDamageMap = enabledFeatures.includes("damageMap")

  // Order-side pricing/meta edit
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaDraft, setMetaDraft] = useState<PricingMetaDraft>({
    technicianName: order.technicianName || "",
    estimatedDeliveryAt: order.estimatedDeliveryAt
      ? istanbulDateTimeInputValue(new Date(order.estimatedDeliveryAt))
      : "",
    discountAmount: order.discountAmount != null ? String(kurusToLira(order.discountAmount)) : "",
    taxRate: order.taxRate != null ? String(bpsToPercent(order.taxRate)) : "",
    notes: order.notes || "",
  })

  function setMetaEditorOpen(open: boolean) {
    if (open) {
      setError("")
      setMetaDraft({
        technicianName: order.technicianName || "",
        estimatedDeliveryAt: order.estimatedDeliveryAt
          ? istanbulDateTimeInputValue(new Date(order.estimatedDeliveryAt))
          : "",
        discountAmount: order.discountAmount != null ? String(kurusToLira(order.discountAmount)) : "",
        taxRate: order.taxRate != null ? String(bpsToPercent(order.taxRate)) : "",
        notes: order.notes || "",
      })
    }
    setEditingMeta(open)
  }

  // Intake info edit (complaint/note/mileage)
  // ?edit=1 ile gelindiğinde kart daha ilk render'da açık olsun (önce okuma
  // görünümü çizip sonra düzenlemeye atlama titremesi olmasın).
  const openInfoEditor = editInitially && !orderLocked && canEditInfo

  // #913 — tetikleyicisiz pencereler (hızlı işlemler, Şikayet düzenleme, başlığın
  // ⋯ menüsünden açılan İptal onayı ve Yeniden Aç) kapanınca odak açan düğmeye
  // döner; Radix yalnız kendi Dialog.Trigger'ına döndürüyor, odak BODY'ye düşüyordu. Kalem düğmesi pencere açıkken çizilmez (kapanınca yeniden
  // bağlanır), bu yüzden ref olarak hatırlanır; `?edit=1` ile açık gelen pencere de
  // oraya döner. Hızlı işlem sayfayı bölüme kaydırdığı için odak dönerken sayfa
  // geri kaymaz (`preventScroll`): sonuç kaydırılan bölümde görünür kalır.
  const editInfoButtonRef = useRef<HTMLButtonElement>(null)
  const { remember: rememberFocus, onCloseAutoFocus: returnFocusOnClose } = useReturnFocus({
    preventScroll: true,
    initial: openInfoEditor ? editInfoButtonRef : null,
  })

  // BAK-102 — düzenleme aksiyonları (başlıktaki "Düzenle" ve boş getiren/teslim
  // alacak bloğundaki "Bilgi ekle") yalnız yetkili ve kilitli olmayan emirde.
  const canOpenInfoEditor = canEditInfo && !orderLocked

  // #183 — teslim edilmiş iş emrini yeniden açma. Gerekçe zorunlu: denetim
  // kaydında "neden geri alındı" sorusunun cevabı dursun.
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reopenReason, setReopenReason] = useState("")
  const [reopening, setReopening] = useState(false)

  async function handleReopen() {
    setReopening(true)
    try {
      const res = await reopenDeliveredOrderAction(order.id, reopenReason)
      if (res && "error" in res) {
        toast.error(res.error)
        return
      }
      toast.success("Araç kabulü yeniden açıldı")
      setReopenOpen(false)
      setReopenReason("")
      router.refresh()
    } finally {
      setReopening(false)
    }
  }
  const [editingInfo, setEditingInfo] = useState(openInfoEditor)
  // Liste "Düzenle"nin ?edit=1'i yalnız ilk açılış içindir: pencere kapanınca
  // (Kaydet, İptal, Esc) adresten düşer, yeniden yükleme tekrar açmaz. Sorgu
  // değiştiği için `router.replace` (scroll: false): replaceState yalnız tarayıcı
  // adresini değiştirir, sonraki `router.refresh()` sayfayı en üste atıyordu.
  // `?tab=` varken açılışta bölüm kancası adresi zaten değiştiriyor; iki
  // `router.replace` yarışmasın (sonuncusu kazanır), bu tur atlanır.
  useEffect(() => {
    if (editingInfo) return
    if (new URLSearchParams(window.location.search).has("tab")) return
    const next = urlWithout(window.location.href, ["edit"])
    if (next) router.replace(next, { scroll: false })
  }, [editingInfo, router])
  const [savingInfo, setSavingInfo] = useState(false)
  const [editComplaint, setEditComplaint] = useState(openInfoEditor ? order.intake.customerComplaint : "")
  const [editNote, setEditNote] = useState(openInfoEditor ? order.intake.internalNote ?? "" : "")
  const [editMileage, setEditMileage] = useState(
    openInfoEditor && order.intake.mileageAtIntake != null ? String(order.intake.mileageAtIntake) : ""
  )
  const [editFuelLevel, setEditFuelLevel] = useState<number | null>(
    openInfoEditor ? order.intake.fuelLevelAtIntake ?? null : null
  )
  // #196 / #149 — aracı getiren ve teslim alacak kişi (müşteri değilse).
  const [editDropName, setEditDropName] = useState(openInfoEditor ? order.intake.droppedOffByName ?? "" : "")
  const [editDropPhone, setEditDropPhone] = useState(openInfoEditor ? order.intake.droppedOffByPhone ?? "" : "")
  const [editPickName, setEditPickName] = useState(openInfoEditor ? order.intake.pickedUpByName ?? "" : "")
  const [editPickPhone, setEditPickPhone] = useState(openInfoEditor ? order.intake.pickedUpByPhone ?? "" : "")

  // Photos
  const [addingPhoto, setAddingPhoto] = useState(false)
  const [photoType, setPhotoType] = useState("")
  const [photoPhase, setPhotoPhase] = useState("intake")
  // Matris hücresinden açıldığında tip ve aşama hücrenin kendisinden gelir;
  // seçimler kilitlenir. Serbest "Fotoğraf Ekle" butonunda editable kalır.
  const [photoContextLocked, setPhotoContextLocked] = useState(false)
  const [photoNote, setPhotoNote] = useState("")
  // Çoklu yükleme: seçilen kareler yüklenene kadar burada birikir. Önizleme
  // blob URL'i her kare için tutulur ve listeden çıkınca serbest bırakılır.
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([])
  const [uploadedCount, setUploadedCount] = useState(0)
  // Mobilde `capture` girdisi galeri seçicisini baypas edip doğrudan kamerayı
  // açtığı için çoklu seçim ayrı bir girdide (capture'sız, `multiple`) duruyor.
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  // Üretilen tüm blob URL'leri; unmount'ta topluca serbest bırakılır (tekrar
  // revoke etmek zararsız, tek tek kaldırmada zaten serbest bırakılıyorlar).
  const photoUrlsRef = useRef<string[]>([])
  useEffect(() => () => { photoUrlsRef.current.forEach(URL.revokeObjectURL) }, [])

  // Share
  const [shareToken, setShareToken] = useState(intake.shareLinks[0]?.token || "")

  // Delivery OTP
  const [deliveryOtpMode, setDeliveryOtpMode] = useState(false)
  const [deliveryOtpCode, setDeliveryOtpCode] = useState("")
  const [deliverySentCode, setDeliverySentCode] = useState<string | null>(null)

  async function changeStatus(newStatus: string): Promise<boolean> {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        router.refresh()
        return true
      }
      setError(data.error || "Durum güncellenemedi")
      return false
    } catch {
      setError("Bir hata oluştu")
      return false
    } finally {
      setLoading(false)
    }
  }

  // İptal terminal ve kilitleyici: kalemler, fiyat, fotoğraf ve usta ataması
  // kapanır. Başlıktaki İptal her durumda önce onay ister (#912 — eskiden yalnız
  // bilgi kartındaki Durum Select'i soruyordu, başlık iki durumda tek dokunuşla
  // yazıyordu). POST yalnız onaylanınca gider; hata pencerenin içinde görünür.
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)

  function requestCancel() {
    setError("")
    setConfirmCancelOpen(true)
  }

  async function handleConfirmCancel() {
    if (await changeStatus("cancelled")) setConfirmCancelOpen(false)
  }

  // İstek sürerken kapanmaz. Vazgeç / Esc ile kapanınca pencerede gösterilen
  // iptal hatası sayfanın üstünde asılı kalmasın.
  function handleCancelDialogOpenChange(open: boolean) {
    if (loading) return
    setConfirmCancelOpen(open)
    if (!open) setError("")
  }

  async function saveMeta() {
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("technicianName", metaDraft.technicianName)
      formData.set("estimatedDeliveryAt", metaDraft.estimatedDeliveryAt)
      formData.set("discountAmount", String(liraToKurus(Math.max(0, Number(metaDraft.discountAmount) || 0))))
      formData.set("taxRate", String(percentToBps(Number(metaDraft.taxRate) || 0)))
      formData.set("notes", metaDraft.notes)
      const res = await fetch(`/api/orders/${order.id}/meta`, { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setEditingMeta(false)
        router.refresh()
      } else setError(data.error || "Bilgiler güncellenemedi")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  /**
   * BAK-75 — bir kalemin KDV tick'i açıldığında iş emrinde KDV oranı tanımlı
   * değilse standart %20 buradan yazılır. Oran olmadan tick tek başına işe
   * yaramaz: satırda "+₺20,00 KDV" yazarken Genel Toplam'a hiç KDV girmez.
   *
   * Diğer meta alanları KAYITLI değerlerinden gönderilir (metaDraft'tan değil):
   * açık ama kaydedilmemiş bir fiyatlandırma düzenlemesi bu tıkla sessizce
   * kalıcılaşmasın.
   */
  async function applyStandardTaxRate() {
    setLoading(true)
    setError("")
    try {
      const formData = new FormData()
      formData.set("technicianName", order.technicianName ?? "")
      formData.set(
        "estimatedDeliveryAt",
        order.estimatedDeliveryAt ? istanbulDateTimeInputValue(new Date(order.estimatedDeliveryAt)) : ""
      )
      formData.set("discountAmount", String(order.discountAmount ?? 0))
      formData.set("taxRate", String(STANDARD_TAX_BPS))
      formData.set("notes", order.notes ?? "")
      const res = await fetch(`/api/orders/${order.id}/meta`, { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setMetaDraft((draft) => ({ ...draft, taxRate: String(bpsToPercent(STANDARD_TAX_BPS)) }))
        toast.success(`Araç kabulüne %${bpsToPercent(STANDARD_TAX_BPS)} KDV uygulandı`)
        router.refresh()
      } else setError(data.error || "KDV oranı uygulanamadı")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  function startEditInfo(opener?: HTMLElement) {
    // "Bilgi ekle" kaydedilince (ad girildi) DOM'dan kalkar: yedek kalem düğmesi.
    rememberFocus(opener ?? editInfoButtonRef, editInfoButtonRef)
    setEditComplaint(order.intake.customerComplaint)
    setEditNote(order.intake.internalNote ?? "")
    setEditMileage(order.intake.mileageAtIntake != null ? String(order.intake.mileageAtIntake) : "")
    setEditFuelLevel(order.intake.fuelLevelAtIntake ?? null)
    // Bu dördü de seed edilmek ZORUNDA: boş string "temizle" anlamına geliyor,
    // seed edilmezse yalnızca şikayeti düzenleyen biri kayıtlı getiren/teslim
    // alan kişiyi farkında olmadan siler.
    setEditDropName(order.intake.droppedOffByName ?? "")
    setEditDropPhone(order.intake.droppedOffByPhone ?? "")
    setEditPickName(order.intake.pickedUpByName ?? "")
    setEditPickPhone(order.intake.pickedUpByPhone ?? "")
    setError("")
    setEditingInfo(true)
  }

  async function handleSaveInfo() {
    setSavingInfo(true)
    setError("")
    try {
      const res = await fetch(`/api/intakes/${intake.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerComplaint: editComplaint,
          internalNote: editNote,
          mileageAtIntake: editMileage,
          fuelLevelAtIntake: editFuelLevel,
          droppedOffByName: editDropName,
          droppedOffByPhone: editDropPhone,
          pickedUpByName: editPickName,
          pickedUpByPhone: editPickPhone,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEditingInfo(false)
        router.refresh()
      } else setError(data.error || "Bilgiler güncellenemedi")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setSavingInfo(false)
    }
  }

  // Seçilen kareleri listeye ekler (değiştirmez): kamera ve galeri girdileri
  // arka arkaya kullanılabilsin diye seçim biriktirilir. Yüklemeden önce
  // istemci sıkıştırması depolama ve mobil bant genişliğini düşürür.
  async function addPickedPhotos(list: FileList | null) {
    if (!list || list.length === 0) return
    const { accepted, duplicates, overflow } = selectPhotoFiles(
      pendingPhotos.map((p) => p.file),
      Array.from(list),
    )
    if (duplicates > 0) toast.info(`${duplicates} fotoğraf zaten seçiliydi`)
    if (overflow > 0) toast.warning(`Tek seferde en fazla ${MAX_BATCH_PHOTOS} fotoğraf; ${overflow} tanesi eklenmedi`)
    if (accepted.length === 0) return

    const { accepted: compressed, failures } = await compressImagesForUpload(accepted)
    for (const failure of failures) {
      toast.error(`${failure.name}: ${failure.error}`)
    }
    if (compressed.length === 0) return

    const added = compressed.map((file, i) => {
      const previewUrl = URL.createObjectURL(file)
      photoUrlsRef.current.push(previewUrl)
      return { key: `${file.name}-${file.size}-${file.lastModified}-${pendingPhotos.length + i}`, file, previewUrl }
    })
    setPendingPhotos((prev) => [...prev, ...added])
  }

  function removePendingPhoto(key: string) {
    const target = pendingPhotos.find((p) => p.key === key)
    if (target) URL.revokeObjectURL(target.previewUrl)
    setPendingPhotos(pendingPhotos.filter((p) => p.key !== key))
  }

  function resetPhotoDraft(items: PendingPhoto[] = pendingPhotos) {
    items.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setPendingPhotos([])
    setUploadedCount(0)
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    if (galleryInputRef.current) galleryInputRef.current.value = ""
  }

  // Tek kare gönderir. Sunucu sözleşmesi değişmedi (istek başına bir dosya);
  // toplu yükleme istemcide sıralı tekrar ile yapılır.
  async function uploadPhoto(file: File | null): Promise<{ ok: boolean; error?: string }> {
    const formData = new FormData()
    formData.set("intakeFormId", intake.id)
    formData.set("type", photoType)
    formData.set("label", PHOTO_TYPES[photoType as keyof typeof PHOTO_TYPES]?.label || photoType)
    if (photoNote) formData.set("note", photoNote)
    if (photoPhase) formData.set("phase", photoPhase)
    if (file) formData.set("file", file)
    try {
      const res = await fetch("/api/intakes/photos", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) return { ok: true }
      return { ok: false, error: data.error || "Fotoğraf eklenemedi" }
    } catch {
      return { ok: false, error: "Bir hata oluştu" }
    }
  }

  async function handleAddPhoto() {
    if (!photoType || loading) return
    setLoading(true)
    setError("")
    setUploadedCount(0)

    // Dosyasız "kayıt ekle" yolu korunuyor (eksik kanıtı yer tutucuyla işaretleme).
    if (pendingPhotos.length === 0) {
      const result = await uploadPhoto(null)
      if (result.ok) {
        setAddingPhoto(false)
        setPhotoType("")
        setPhotoPhase("intake")
        setPhotoNote("")
        resetPhotoDraft()
        router.refresh()
      } else setError(result.error ?? "Fotoğraf eklenemedi")
      setLoading(false)
      return
    }

    // Sıralı yükleme: mobil bağlantıda paralel istekler birbirini aç bırakıyor
    // ve kısmi hatayı hangi karenin ürettiğini izlemek zorlaşıyor.
    const failed: PendingPhoto[] = []
    let firstError = ""
    let done = 0
    for (const pending of pendingPhotos) {
      const result = await uploadPhoto(pending.file)
      if (result.ok) {
        done++
        setUploadedCount(done)
      } else {
        failed.push(pending)
        if (!firstError) firstError = result.error ?? ""
      }
    }

    if (failed.length === 0) {
      toast.success(done === 1 ? "Fotoğraf eklendi" : `${done} fotoğraf eklendi`)
      setAddingPhoto(false)
      setPhotoType("")
      setPhotoPhase("intake")
      setPhotoNote("")
      resetPhotoDraft()
    } else {
      // Yüklenenlerin önizlemesini bırak, başarısızları tekrar denenebilsin diye tut.
      const failedKeys = new Set(failed.map((p) => p.key))
      pendingPhotos.filter((p) => !failedKeys.has(p.key)).forEach((p) => URL.revokeObjectURL(p.previewUrl))
      setPendingPhotos(failed)
      setUploadedCount(0)
      const summary = describeUploadFailure(failed.map((p) => p.file.name), pendingPhotos.length)
      setError(firstError ? `${summary} (${firstError})` : summary)
    }
    router.refresh()
    setLoading(false)
  }

  async function handleGenerateShareLink() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/intakes/${intake.id}/share`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setShareToken(data.token)
        router.refresh()
      } else setError(data.error || "Link oluşturulamadı")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestDeliveryOtp() {
    setLoading(true); setError(""); setDeliverySentCode(null); setDeliveryOtpCode("")
    try {
      const res = await fetch(`/api/intakes/${intake.id}/delivery-otp`, { method: "POST" })
      const data = await res.json() as { success?: boolean; otpCode?: string; error?: string }
      if (data.success) {
        setDeliveryOtpMode(true)
        setDeliverySentCode(data.otpCode ?? null)
      } else setError(data.error || "Kod gönderilemedi")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyDeliveryOtp() {
    setLoading(true); setError("")
    try {
      const res = await fetch(`/api/intakes/${intake.id}/delivery-otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: deliveryOtpCode }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) {
        setDeliveryOtpMode(false)
        setDeliveryOtpCode("")
        setDeliverySentCode(null)
        router.refresh()
      }
      else setError(data.error || "Doğrulama başarısız")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const customerName =
    order.customer.type === "corporate"
      ? order.customer.companyName || "Kurumsal Müşteri"
      : order.customer.fullName ||
        `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() ||
        "Müşteri"

  // Teslimden sonra kalemler kilitlenir, fiyat bir daha girilemez; bu yüzden
  // fiyatsız kalem varken teslim aksiyonu kapalı (asıl engel sunucuda).
  const unpricedItems = findUnpricedItems(order.items)
  // Karar bekleyen parça talebi hem "Teslime Hazır"ı hem teslimi kapatır: müşteriye
  // "hazır" denirken ya da araç çıkarken açık parça sorusu kalmasın (BAK-85).
  const undecidedRequests = findUndecidedPartsRequests(order.partsRequests)
  const partsDecisionBlocked = undecidedRequests.length > 0
  const deliveryBlocked = unpricedItems.length > 0 || partsDecisionBlocked

  // Header aksiyonları eski orders akışı (order durum makinesi). Teslim adımı
  // OTP akışını tetikler (müşteri onaylı teslim); verify hem intake hem order'ı
  // delivered yapar.
  const nextActions = NEXT_STATUSES[order.status] || []
  // Telefon özet kartı ve raydaki Durum kartı: başlıktaki birincil aksiyon + engelleri.
  const nextStep = orderNextStep({
    status: order.status,
    actions: nextActions,
    unpricedNames: unpricedItems.map((item) => item.name),
    undecidedNames: undecidedRequests.map((request) => request.partName),
  })
  // Pasif birincil düğmenin nedeni ekran okuyucuya (#913); görünür ayrıntı Durum kartında.
  const blockedReason = nextStep?.blockers.map((issue) => `${issue.text}. ${issue.hint}`).join(" ")
  const headerActions: DetailHeaderAction[] = nextActions.map((a) => {
    const disabled =
      (a.key === "delivered" && deliveryBlocked) ||
      (a.key === "ready_for_delivery" && partsDecisionBlocked)
    return {
      key: a.key,
      label: a.key === "delivered" ? "Teslim Et (OTP)" : a.label,
      onClick:
        a.key === "delivered"
          ? handleRequestDeliveryOtp
          : a.key === "cancelled"
            ? requestCancel
            : () => void changeStatus(a.key),
      tone: a.key === "cancelled" ? "danger" : a.primary ? "primary" : "secondary",
      icon: ORDER_BACK_ACTION_ICONS[order.status]?.[a.key] ?? ORDER_ACTION_ICONS[a.key],
      disabled,
      disabledReason: disabled && a.primary ? blockedReason : undefined,
    }
  })
  // #183 → #913 — teslim edilmiş kabulü yeniden açma başlığın ⋯ menüsünde (durum
  // makinesinin geçişi değil, gerekçeli ayrı action; `NEXT_STATUSES`e girmez).
  // Teslim edilmiş kabulde birincil aksiyon yok, ikincil ton menüye iner.
  if (canReopen && order.status === "delivered") {
    headerActions.push({
      key: "reopen",
      label: "Yeniden Aç",
      onClick: () => setReopenOpen(true),
      tone: "secondary",
      icon: RotateCcw,
    })
  }
  // Kapanış anı: son "durum → teslim edildi / iptal" kaydı (geçmiş yeniden eskiye sıralı).
  const closedAt = orderLocked
    ? activity.find((entry) => entry.action === `order_status_changed_to_${order.status}`)?.at
    : undefined

  const { vehicle: vehiclePhotos, damage: damagePhotos } = partitionIntakePhotos(intake.photos)
  const takenPhotoTypes = new Set(vehiclePhotos.map((p) => p.type))
  const missingRequired = Object.entries(VEHICLE_PHOTO_TYPES).filter(
    ([key, v]) => v.required && !takenPhotoTypes.has(key)
  )
  const photoCompletion = calculatePhotoCompletion(vehiclePhotos.map((p) => p.type))
  const approvalStatus = intake.approvals.length > 0
    ? intake.approvals[0].status === "verified" ? "verified" as const : "pending" as const
    : "none" as const
  const publicLinkStatus = intake.shareLinks.length > 0
    ? intake.shareLinks[0].isActive ? "active" as const : "expired" as const
    : "none" as const

  const shareLinkFull = shareToken
    ? (typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : `/s/${shareToken}`)
    : null

  // Eksik/istenen foto akışı: tipini seç, diyaloğu aç ve Kanıt bölümüne kaydır
  // (diyalog kapanınca kullanıcı fotoğrafları orada görür).
  function focusPhoto(typeKey?: string, phase?: PhotoPhaseKey, opener?: HTMLElement | null) {
    // Lite'ta eksik-fotoğraf kısayolları diyaloğu açamaz; kullanıcıyı ortak
    // yükseltme kartının bulunduğu Kanıt bölümüne taşır.
    if (!canUsePhotoChecklist) {
      scrollToOrderSection("kanit")
      return
    }

    if (typeKey) setPhotoType(typeKey)
    if (phase) setPhotoPhase(phase)
    // İkisi de biliniyorsa hücre bağlamıdır (matris karesi / karşılaştır "+")
    // → tür ve aşama diyaloğda kilitli gelir.
    setPhotoContextLocked(Boolean(typeKey && phase))
    // Odak açan kutucukta kalır (bölüme taşınmaz), pencere kapanınca oraya döner (#913).
    // Kutucuk açıkça verilir: Safari fare tıklamasında düğmeye odak vermez.
    rememberFocus(opener ?? undefined)
    setAddingPhoto(true)
    scrollToOrderSection("kanit", { focus: false })
  }

  // Hızlı butonlar (#881): pencere hemen açılır, sayfa arkada ilgili bölüme
  // kayar; pencere kapanınca kullanıcı sonucu o bölümde görür.
  // Kilit sunucuda, tahsilat action'ının kapısıyla aynı girdiden hesaplanır (page.tsx).
  const collectionsLocked = order.collectionsLocked
  const quickActions = orderQuickActions({ orderLocked, canCashbox, collectionsLocked })
  // Telefon özet kartının para satırı (#912): Ödeme kartının kısa hâli, ona bağlanır.
  const mobileMoney = order.totals.hasAnyPrice
    ? {
        grandTotal: order.totals.grandTotal,
        remaining: canCashbox ? order.remainingAmount : null,
        chainText: totalsChainText(orderTotalsChain(order.totals, order.taxRate)),
      }
    : null
  const [partsAddType, setPartsAddType] = useState<PartsAddType | null>(null)
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)

  // Ödeme kartındaki "Tahsilat al" ve hızlı işlem aynı pencereyi açar; kart
  // zaten ekranda olduğu için buradan kaydırılmaz, adrese dokunulmaz.
  function openCollection(opener: HTMLElement) {
    rememberFocus(opener)
    setCollectionModalOpen(true)
  }

  function handleQuickAction(action: OrderQuickAction, opener: HTMLElement) {
    if (action === "foto") {
      // Lite: focusPhoto yükseltme alanına götürür. Diğerlerinde "Fotoğraf
      // ekle" kutusuyla aynı serbest akış: tür seçilebilir, aşama duruma göre.
      if (!canUsePhotoChecklist) {
        focusPhoto()
        return
      }
      rememberFocus(opener)
      setPhotoType("")
      setPhotoPhase(photoPhaseForStatus(order.status))
      setPhotoContextLocked(false)
      setAddingPhoto(true)
      scrollToOrderSection("kanit", { focus: false })
      return
    }
    if (action === "tahsilat") {
      scrollToOrderSection("odeme", { focus: false })
      openCollection(opener)
      return
    }
    rememberFocus(opener)
    scrollToOrderSection("kalemler", { focus: false })
    setPartsAddType(action)
  }

  return (
    <div ref={pageRef} className={cn(surface.root, detail.page, "pb-24 lg:pb-6")}>
      {/* #913 — başlık → hızlı işlemler → (uyarı / teslim kodu) → özet + çipler →
          yerleşim arası tek 24px adım. `surface.root`un kendi aralığı (36/44px)
          yalnız bu tek çocuğa düşer; başka modülden ezilmez (eşit özgüllük). */}
      <div className={detail.flow}>
      <DetailHeader
        plate={order.vehicle.plate}
        title={`${order.vehicle.brand} ${order.vehicle.model}`}
        subline={`${customerName}${order.vehicle.modelYear ? ` · ${order.vehicle.modelYear}` : ""}`}
        backHref={orderListReturnHref(returnTo)}
        pills={
          <>
            <DashOrderStatus status={order.status} />
            {canCashbox && <OrderPaymentPill status={order.paymentStatus} />}
          </>
        }
        meta={
          /* Atanan usta bir *durum* değil, işin kime ait olduğu bilgisi —
             bu yüzden müşteri satırının yanında, hapla yarışmadan durur.
             Usta henüz yoksa atamak beklenen adımdır: belirgin düğme (#866). */
          canTeam ? (
            <TechnicianAssign
              orderId={order.id}
              assignedTechnicianId={order.assignedTechnicianId}
              assignedTechnicianName={order.assignedTechnicianName}
              technicians={technicians ?? []}
              locked={orderLocked}
              variant={!orderLocked && !order.assignedTechnicianId ? "cta" : "meta"}
            />
          ) : undefined
        }
        actions={headerActions}
        loading={loading}
        rememberOpener={rememberFocus}
      />

      <OrderQuickActions actions={quickActions} onAction={handleQuickAction} />

      {error && (
        <Alert variant="destructive">
          <Info />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* "Usta bekliyor" listesinden gelindi (#866): beklenen adım usta atamak.
          Atanınca not yeşile döner ve sıradaki kabul için listeye tek tık
          (atanan kabul o listeden çıktığı için sıradaki en üsttedir). */}
      {fromUnassignedList && canTeam && !orderLocked && (
        order.assignedTechnicianId ? (
          <Alert variant="success">
            <CheckCircle2 />
            <AlertTitle>Usta atandı: {order.assignedTechnicianName}</AlertTitle>
            <AlertDescription>
              <p>Sıradaki ustasız kabul için listeye dönün.</p>
              <Button variant="outline" asChild className="mt-1">
                <Link href={listHref}>
                  <ArrowLeft />
                  Listeye dön
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="info">
            <UserPlus />
            <AlertTitle>Bu kabule henüz usta atanmadı.</AlertTitle>
            <AlertDescription>
              <p>Ustayı seçince kabul &quot;usta bekliyor&quot; listesinden çıkar.</p>
              <TechnicianAssign
                orderId={order.id}
                assignedTechnicianId={order.assignedTechnicianId}
                assignedTechnicianName={order.assignedTechnicianName}
                technicians={technicians ?? []}
                variant="cta"
                className="mt-1"
              />
            </AlertDescription>
          </Alert>
        )
      )}

      {deliveryOtpMode && order.status === "ready_for_delivery" && (
        <div className={cn(detail.shell, "space-y-3 p-4")}>
          <p className="text-sm font-medium flex items-center gap-2"><KeyRound className="size-4" /> SMS Teslim Onayı</p>
          {order.paymentStatus !== "paid" && (
            <p className="text-xs text-warning-strong">Uyarı: Bu araç kabulünde ödeme tamamlanmadı ({PAYMENT_STATUS[order.paymentStatus as PaymentStatusKey]?.label ?? order.paymentStatus}).</p>
          )}
          <p className="text-xs text-muted-foreground">Müşterinin telefonuna SMS ile gönderilen kodu girin. Kod 10 dakika geçerlidir.</p>
          {deliverySentCode && (
            <p className="text-xs text-muted-foreground">Test modu — gerçek SMS gönderilmedi. Demo kodu: <span className="font-mono font-bold">{deliverySentCode}</span></p>
          )}
          <Input
            value={deliveryOtpCode}
            onChange={(e) => setDeliveryOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 haneli teslim kodu"
            inputMode="numeric"
            size="lg"
            className="text-center tracking-widest"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="foreground" onClick={handleVerifyDeliveryOtp} disabled={loading || deliveryOtpCode.length < 6} size="lg" className="sm:flex-1">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Doğrula ve Teslim Et"}
            </Button>
            <Button variant="outline" onClick={handleRequestDeliveryOtp} disabled={loading} size="lg">Kodu Tekrar Gönder</Button>
            <Button variant="ghost" onClick={() => { setDeliveryOtpMode(false); setDeliveryOtpCode(""); setDeliverySentCode(null) }} disabled={loading} size="lg">Vazgeç</Button>
          </div>
        </div>
      )}

      {/* #911 — tek sayfa + yan ray. Telefon özet kartı başlığın altında (para
          raydaki Ödeme Özeti kartında, #912); bölüm çipleri üst barın altında
          yapışkan (iki kolonda gizli).
          Bloklar `data-section` taşır; tek kolonda ray kartları `order` ile
          ilgili bölümün içine girer (order-detail.module.css). */}
      <OrderMobileSummary
        complaint={order.intake.customerComplaint}
        money={mobileMoney}
        nextStep={nextStep}
        status={order.status}
        closedAt={closedAt}
        canReopen={canReopen}
        onNavigate={scrollToOrderSection}
      />

      <OrderSectionNav rootRef={pageRef} onNavigate={scrollToOrderSection} />

      <div className={detail.layout}>
        <div className={detail.main}>
          {/* ÖZET — Şikayet & Notlar (düzenlenebilir) */}
          <div id="ozet" data-section="ozet" role="region" aria-label="Özet" tabIndex={-1} className={cn(detail.section, detail.oComplaint)}>
            <DetailPanel
              title="Şikayet & Notlar"
              aside={
                <>
                {!editingInfo && canOpenInfoEditor && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Şikayet ve notları düzenle"
                        ref={editInfoButtonRef}
                        onClick={() => startEditInfo()}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Şikayet ve notları düzenle</TooltipContent>
                  </Tooltip>
                )}
                </>
              }
            >
              <div className={detail.block}>
                <p className={detail.fieldLabel}>Müşteri şikayeti</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{order.intake.customerComplaint}</p>
              </div>
              {order.intake.internalNote && (
                <div className={detail.block}>
                  <p className={detail.fieldLabel}>Teknisyen iç notu</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{order.intake.internalNote}</p>
                  <p className="mt-1 text-xs text-muted-foreground italic">Bu not müşteri çıktısında gösterilmez</p>
                </div>
              )}
              {/* BAK-102 — blok BOŞKEN DE görünür. Alan opsiyonel ama gizli
                  olduğu sürece servis kullanıcısı var olduğunu fark etmiyor;
                  teslim anında tek dokunuşla doldurulabilsin diye boş durum
                  da yazılıyor. */}
              <div className={cn(detail.block, "grid gap-4 sm:grid-cols-2")}>
                <HandoverPerson
                  label="Aracı Getiren"
                  name={order.intake.droppedOffByName}
                  phone={order.intake.droppedOffByPhone}
                  emptyText="Belirtilmedi — aracı müşterinin kendisi getirdi"
                  onAdd={canOpenInfoEditor ? startEditInfo : undefined}
                />
                <HandoverPerson
                  label="Aracı Teslim Alacak"
                  name={order.intake.pickedUpByName}
                  phone={order.intake.pickedUpByPhone}
                  emptyText="Belirtilmedi — aracı müşterinin kendisi teslim alacak"
                  closedText={order.status === "delivered" ? "Belirtilmedi — aracı müşterinin kendisi teslim aldı" : undefined}
                  onAdd={canOpenInfoEditor ? startEditInfo : undefined}
                />
              </div>
            </DetailPanel>

            <Dialog open={editingInfo} onOpenChange={(open) => { if (!savingInfo) setEditingInfo(open) }}>
              <DialogContent
                className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden sm:max-w-2xl"
                onCloseAutoFocus={returnFocusOnClose}
              >
                <DialogHeader>
                  <DialogTitle>Şikayet ve notları düzenle</DialogTitle>
                  <DialogDescription>Araç kabulü kabul bilgilerini güncelleyin.</DialogDescription>
                </DialogHeader>
                <div className="min-h-0 space-y-4 overflow-y-auto py-4 text-sm">
                  {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-complaint">Müşteri Şikayeti</Label>
                      <Textarea id="edit-complaint" value={editComplaint} onChange={(e) => setEditComplaint(e.target.value)} placeholder="Müşterinin bildirdiği arıza/şikayet..." className="min-h-20" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-note">Teknisyen İç Notu</Label>
                      <Textarea id="edit-note" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Servis içi notlar (opsiyonel)..." className="min-h-15" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-mileage">Kilometre (kabul anı)</Label>
                      <Input id="edit-mileage" type="number" inputMode="numeric" min="0" value={editMileage} onChange={(e) => setEditMileage(e.target.value)} placeholder="Örn. 125000" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Yakıt seviyesi (kabul anı)</Label>
                      <FuelLevelPicker value={editFuelLevel} onChange={setEditFuelLevel} />
                    </div>
                    <div className="space-y-3 rounded-md border border-border p-3">
                      <p className="text-sm font-medium text-foreground">Aracı getiren kişi</p>
                      <p className="text-xs text-muted-foreground">Aracı müşterinin kendisi getirdiyse boş bırakın.</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-drop-name">Ad Soyad</Label>
                          <Input id="edit-drop-name" value={editDropName} onChange={(e) => setEditDropName(e.target.value)} placeholder="Örn. Ahmet Yılmaz" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-drop-phone">Telefon</Label>
                          <Input id="edit-drop-phone" type="tel" inputMode="tel" value={editDropPhone} onChange={(e) => setEditDropPhone(e.target.value)} placeholder="Örn. 0532 000 0000" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 rounded-md border border-border p-3">
                      <p className="text-sm font-medium text-foreground">Aracı teslim alacak kişi</p>
                      <p className="text-xs text-muted-foreground">Aracı müşterinin kendisi teslim alacaksa boş bırakın.</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-pick-name">Ad Soyad</Label>
                          <Input id="edit-pick-name" value={editPickName} onChange={(e) => setEditPickName(e.target.value)} placeholder="Örn. Ayşe Demir" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-pick-phone">Telefon</Label>
                          <Input id="edit-pick-phone" type="tel" inputMode="tel" value={editPickPhone} onChange={(e) => setEditPickPhone(e.target.value)} placeholder="Örn. 0532 000 0000" />
                        </div>
                      </div>
                    </div>
                  </div>
                <DialogFooter className="shrink-0">
                  <Button variant="outline" onClick={() => setEditingInfo(false)} disabled={savingInfo}>İptal</Button>
                  <Button variant="foreground" onClick={handleSaveInfo} disabled={savingInfo || !editComplaint.trim()}>
                    {savingInfo ? <Loader2 className="size-4 animate-spin" /> : "Kaydet"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* KALEMLER — parça talepleri + parça & işçilik */}
          <div id="kalemler" data-section="kalemler" role="region" aria-label="Kalemler" tabIndex={-1} className={cn(detail.section, detail.oItems, "space-y-5")}>
            {!canUseInventory && (
              <InlineFeatureUpsell feature="partsInventory" currentTier={currentTier} />
            )}
            <PartsRequestPanel
              requests={order.partsRequests}
              locked={isOrderLocked(order.status as OrderStatus)}
              onError={(msg) => toast.error(msg)}
            />

            {/* Kalem hataları sayfa-üstü banner yerine TOAST: grid satırları uzun
                listede ekranın çok altında kalıyor, banner viewport dışında kalıp
                görülmüyordu — kullanıcı yalnız değerin geri sarıldığını görüyordu.
                Başarıda satırdaki "✓ Kaydedildi" işaretiyle simetrik. */}
            <PartsLaborCard orderId={order.id} status={order.status} items={order.items} vehicle={order.vehicle} onError={(msg) => toast.error(msg)} onLoading={setLoading} loading={loading} laborCatalog={laborCatalog} taxRateBps={order.taxRate} onApplyStandardTax={orderLocked ? undefined : applyStandardTaxRate} addingType={partsAddType} onAddingTypeChange={setPartsAddType} rememberAddOpener={rememberFocus} onAddDialogCloseAutoFocus={returnFocusOnClose} />
          </div>

          {/* KANIT — kabul kanıtları, fotoğraflar, hasar */}
          <div id="kanit" data-section="kanit" role="region" aria-label="Kanıt" tabIndex={-1} className={cn(detail.section, detail.oEvidence, detail.stack)}>
            {/* Kabul kanıtları */}
            <DetailPanel title="Kabul kanıtları">
              <div className={surface.cardBody}>
                <IntakeEvidenceSummary
                  photoCompletion={photoCompletion}
                  damageCount={damagePhotos.length}
                  approvalStatus={approvalStatus}
                  publicLinkStatus={publicLinkStatus}
                  onMissingPhotoClick={(key, opener) => focusPhoto(key, undefined, opener)}
                  readOnly={orderLocked}
                  photoCount={vehiclePhotos.length}
                />
              </div>
            </DetailPanel>

            {/* Fotoğraflar */}
            <DetailPanel
              title="Fotoğraflar"
              aside={
                canUsePhotoChecklist &&
                (orderLocked ? (
                  // Kapanmış kabulde eksik açı yarım iş değil, kayıttır: nötr sayı (#913).
                  <DetailPill tone="neutral">{vehiclePhotos.length} fotoğraf</DetailPill>
                ) : (
                  <DetailPill tone={missingRequired.length ? "warning" : "success"}>
                    {missingRequired.length === 0 && <CheckCircle2 className="size-3.5" />}
                    {photoCompletion.requiredCompleted}/{photoCompletion.required} zorunlu
                  </DetailPill>
                ))
              }
            >
              <div className={cn(detail.block, "space-y-3")}>
                {/* Aşama seçici + açı kutucukları — hasar detayı alt kartta, burada yok */}
                {canUsePhotoChecklist ? (
                  <PhotoPhaseMatrix
                    photos={vehiclePhotos}
                    defaultPhase={photoPhaseForStatus(order.status)}
                    canDelete={!orderLocked}
                    onDeleted={() => router.refresh()}
                    onAdd={orderLocked ? undefined : (type, phase, opener) => focusPhoto(type, phase, opener)}
                    onAddOther={orderLocked ? undefined : (phase, opener) => {
                      rememberFocus(opener ?? undefined)
                      setPhotoType("")
                      setPhotoPhase(phase)
                      setPhotoContextLocked(false)
                      setAddingPhoto(true)
                    }}
                  />
                ) : vehiclePhotos.length > 0 ? (
                  <PhotoGalleryGrid photos={vehiclePhotos} canDelete={!orderLocked} onDeleted={() => router.refresh()} />
                ) : (
                  <p className="text-[15px] leading-5 text-muted-foreground">Henüz araç fotoğrafı eklenmedi</p>
                )}

                {/* Ekleme diyaloğu: boş kutucuk (tür + aşama kilitli) ya da "Fotoğraf ekle" kutusu açar */}
                {!orderLocked && canUsePhotoChecklist && (<>
                <Dialog
                  open={addingPhoto}
                  onOpenChange={(o) => {
                    if (!o && loading) return // yükleme sürerken kapanmasın
                    setAddingPhoto(o)
                    if (!o) {
                      setPhotoType("")
                      setPhotoPhase("intake")
                      setPhotoContextLocked(false)
                      setPhotoNote("")
                      resetPhotoDraft()
                    }
                  }}
                >
                  <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto" onCloseAutoFocus={returnFocusOnClose}>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2"><Camera className="size-4 text-primary" /> Fotoğraf Ekle</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                  {canUsePhotoChecklist && <div className="space-y-1.5">
                    <Label>Fotoğraf Türü</Label>
                    <Select value={photoType} onValueChange={(v) => setPhotoType(v)} disabled={photoContextLocked}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seçiniz..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Seçiniz...</SelectItem>
                        {Object.entries(VEHICLE_PHOTO_TYPES).map(([key, val]) => (
                          <SelectItem key={key} value={key}>{val.label} {val.required ? "(Zorunlu)" : "(Opsiyonel)"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Hasar detayı görselleri alttaki Hasar bölümünden eklenir.
                    </p>
                  </div>}
                  {canUsePhotoChecklist && <div className="space-y-1.5">
                    <Label>Aşama</Label>
                    <Select value={photoPhase} onValueChange={(v) => setPhotoPhase(v)} disabled={photoContextLocked}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Aşama seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PHOTO_PHASES) as PhotoPhaseKey[]).map((key) => (
                          <SelectItem key={key} value={key}>{PHOTO_PHASES[key].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>}
                  <div className="space-y-1.5">
                    <Label>Fotoğraf Çek / Yükle</Label>
                    {/* İki ayrı girdi: `capture` bulunan girdi mobilde galeri
                        seçicisini baypas edip kamerayı açtığı için çoklu seçim
                        ayrı, capture'sız girdide duruyor. İkisi de aynı listeye ekler. */}
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => { addPickedPhotos(e.target.files); e.target.value = "" }}
                    />
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => { addPickedPhotos(e.target.files); e.target.value = "" }}
                    />
                    <PhotoSourceButtons
                      disabled={loading}
                      onCamera={() => cameraInputRef.current?.click()}
                      onFiles={() => galleryInputRef.current?.click()}
                    />
                    <p className="text-xs text-muted-foreground">
                      Galeriden ya da dosyadan tek seferde birden fazla fotoğraf seçebilirsiniz (en fazla {MAX_BATCH_PHOTOS}).
                    </p>
                    {pendingPhotos.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {pendingPhotos.length} fotoğraf seçildi
                          {loading && uploadedCount > 0 ? ` — ${uploadedCount}/${pendingPhotos.length} yüklendi` : ""}
                        </p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {pendingPhotos.map((p, i) => (
                            <div key={p.key} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.previewUrl} alt={`Seçilen fotoğraf ${i + 1}`} className="size-full object-cover" />
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="secondary"
                                aria-label={`Fotoğraf ${i + 1} — seçimden çıkar`}
                                disabled={loading}
                                onClick={() => removePendingPhoto(p.key)}
                                className={cn("absolute top-1 right-1", detail.tap)}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Not</Label>
                    <Input value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="Fotoğraf açıklaması..." />
                    {pendingPhotos.length > 1 && (
                      <p className="text-xs text-muted-foreground">Tür, aşama ve not seçilen tüm fotoğraflara uygulanır.</p>
                    )}
                  </div>
                  <Button variant="foreground" onClick={handleAddPhoto} disabled={loading || !photoType} size="lg" className="w-full">
                    {loading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
                    {loading && pendingPhotos.length > 0
                      ? `Yükleniyor ${Math.min(uploadedCount + 1, pendingPhotos.length)}/${pendingPhotos.length}`
                      : pendingPhotos.length > 1
                        ? `${pendingPhotos.length} Fotoğrafı Yükle ve Kaydet`
                        : pendingPhotos.length === 1
                          ? "Fotoğraf Yükle ve Kaydet"
                          : "Fotoğraf Kaydı Ekle"}
                  </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                </>)}
              </div>
              {!canUsePhotoChecklist && (
                <div className={detail.block}>
                  <InlineFeatureUpsell feature="photoChecklist" currentTier={currentTier} />
                </div>
              )}
            </DetailPanel>

            {/* Hasar */}
            {canUseDamageMap ? (
              <DetailPanel title="Hasar">
                <div className={detail.block}>
                  {/* 3B görüntüleyici ve hasar kayıtları ağır: görünür alana yaklaşınca bağlanır (#911). */}
                  {/* Yer tutucu yüklenmiş blok boyunda (ölçüm #911: 390px'te ~755-770px,
                      640px+ 580-680px): değişim anında üstteki derin bağlantı hedefi kaymaz. */}
                  <DeferUntilVisible label="Hasar kaydı yükleniyor" placeholderClassName="min-h-[760px] sm:min-h-[640px]">
                    <DamageCapture reloadKey={JSON.stringify([intake.damageMarks,intake.photos])} intakeFormId={intake.id} vehicle={intake.vehicle} readOnly={orderLocked} modalMetadata />
                  </DeferUntilVisible>
                </div>

                {damagePhotos.length > 0 && (
                  <div className={detail.block}>
                    <p className={detail.fieldLabel}>Hasar fotoğrafları · {damagePhotos.length}</p>
                    <PhotoGalleryGrid photos={damagePhotos} canDelete={!orderLocked} onDeleted={() => router.refresh()} />
                  </div>
                )}
              </DetailPanel>
            ) : (
              <InlineFeatureUpsell feature="damageMap" currentTier={currentTier} />
            )}
          </div>

          {/* Kabul bilgileri (telefonda Özet bölümünde) */}
          <div data-section="ozet" tabIndex={-1} className={cn(detail.section, detail.oInfo)}>
            <OrderInfoCard order={order} />
          </div>

          {/* ÖDEMELER — tahsilat geçmişi (toplamlar raydaki Ödeme kartında, #912) */}
          <div id="odeme" data-section="odeme" role="region" aria-label="Ödeme" tabIndex={-1} className={cn(detail.section, detail.oPayments, detail.stack)}>
            {!canCashbox ? (
              <DetailPanel title="Ödemeler" bare>
                <InlineFeatureUpsell feature="cashbox" currentTier={currentTier} />
              </DetailPanel>
            ) : (
              <>
              <PaymentHistoryCard
                orderId={order.id}
                collectionsLocked={collectionsLocked}
                grandTotal={order.totals.grandTotal}
                hasAnyPrice={order.totals.hasAnyPrice}
                paidAmount={order.paidAmount}
                remainingAmount={order.remainingAmount}
                collections={order.collectionHistory}
                customerId={order.customer.id}
                customerName={customerName}
                collectionModalOpen={collectionModalOpen}
                onCollectionModalOpenChange={setCollectionModalOpen}
                onCollectionModalCloseAutoFocus={returnFocusOnClose}
              />
              </>
            )}
          </div>

          {/* TEKNİSYEN — teknisyen panelindeki ilerleme, salt okunur */}
          <div id="teknisyen" data-section="teknisyen" role="region" aria-label="Teknisyen" tabIndex={-1} className={cn(detail.section, detail.oTechPanel)}>
            {!canTeam ? (
              <DetailPanel title="Teknisyen" bare>
                <InlineFeatureUpsell feature="team" currentTier={currentTier} />
              </DetailPanel>
            ) : (
              <TechnicianProgressPanel
                checklistItems={order.checklistItems}
                laborSessions={order.laborSessions}
                internalNotes={order.internalNotes}
                closed={orderLocked}
              />
            )}
          </div>

          {/* GEÇMİŞ */}
          <div id="gecmis" data-section="gecmis" role="region" aria-label="Geçmiş" tabIndex={-1} className={cn(detail.section, detail.oHistory)}>
            {/* İşlem Geçmişi (personel-içi; public paylaşıma dahil değildir) */}
            <OrderActivityLog entries={activity} />
          </div>
        </div>

        {/* RAY — iki kolonda yapışkan; tek kolonda kartlar bölümlerin içine girer. */}
        <div ref={railRef} className={detail.rail}>
          <OrderStatusCard
            status={order.status}
            nextStep={nextStep}
            closedAt={closedAt}
            canReopen={canReopen}
            onNavigate={scrollToOrderSection}
          />

          <div data-section="odeme" tabIndex={-1} className={cn(detail.section, detail.oPricing)}>
            {/* Ödeme kartı (#912): sayfada paranın tek yeri. */}
            <OrderPaymentCard
              totals={order.totals}
              taxRateBps={order.taxRate}
              paymentStatus={order.paymentStatus}
              paidAmount={order.paidAmount}
              remainingAmount={order.remainingAmount}
              locked={isOrderLocked(order.status as OrderStatus)}
              editingMeta={editingMeta}
              setEditingMeta={setMetaEditorOpen}
              metaDraft={metaDraft}
              setMetaDraft={setMetaDraft}
              saveMeta={saveMeta}
              loading={loading}
              error={error}
              showCashbox={canCashbox}
              onCollect={canCashbox && !collectionsLocked ? openCollection : undefined}
            />
          </div>

          {/* Müşteri & Araç */}
          <div data-section="ozet" tabIndex={-1} className={cn(detail.section, detail.oRecord)}>
            <OrderRecordRail order={order} customerName={customerName} />
          </div>

          {canTeam && (
            <div data-section="teknisyen" tabIndex={-1} className={cn(detail.section, detail.oTechCard)}>
              {/* Panelin kendisi bilinçli olarak aksiyonsuz (bkz. technician-progress-panel).
                  İşaretleme teknisyen panelinde yapıldığı için geçiş linki panelin
                  dışında, raydaki bağlam kartında durur (BAK-23, #897; #911). */}
              <section aria-label="Teknisyen" className={cn(surface.card, detail.context)}>
                <span aria-hidden className={cn(surface.tile, surface["tone-info"])}>
                  <HardHat />
                </span>
                <div className={detail.contextMain}>
                  <p className={detail.itemTitle}>{order.assignedTechnicianName || "Henüz usta atanmadı"}</p>
                  <p className={detail.itemSub}>
                    {order.assignedTechnicianName || orderLocked ? "" : "Atama yapıldığında kontrol listesi otomatik oluşur. "}
                    Kontrol listesi ve işçilik teknisyen panelinde işaretlenir; burada salt okunur görünür.
                  </p>
                </div>
                {canOpenTechnicianView(order.assignedTechnicianId) && (
                  <Button variant="outline" asChild className={detail.contextAction}>
                    <Link href={technicianOrderPath(order.id)}>
                      Teknisyen Panelinde Aç
                      <ChevronRight />
                    </Link>
                  </Button>
                )}
              </section>
            </div>
          )}

          <div data-section="odeme" tabIndex={-1} className={cn(detail.section, detail.oShare)}>
            {/* Müşteri Çıktısı & Paylaşım */}
            <DetailPanel title="Müşteri Çıktısı">
              <div className={cn(surface.cardBody, "space-y-3")}>
                {!shareToken ? (
                  <>
                    <p className="text-xs text-muted-foreground">Müşteriyle paylaşabileceğiniz salt-görüntü bir özet linki oluşturun.</p>
                    <Button variant="foreground" onClick={handleGenerateShareLink} disabled={loading} className="w-full">
                      <Share2 className="size-4 mr-2" /> Müşteri Çıktı Linki Oluştur
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-xs">
                      {intake.shareLinks[0]?.isActive ? <Eye className="size-3.5 text-success-strong" /> : <EyeOff className="size-3.5 text-destructive-strong" />}
                      <span className={intake.shareLinks[0]?.isActive ? "text-success-strong font-medium" : "text-destructive-strong font-medium"}>
                        {intake.shareLinks[0]?.isActive ? "Link aktif" : "Link devre dışı"}
                      </span>
                    </div>
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <Link href={`/s/${shareToken}`} target="_blank" rel="noopener noreferrer">
                        <FileText className="size-4 text-muted-foreground" /> Müşteri Çıktısını Aç
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <Link href={`/s/${shareToken}/pdf`} target="_blank" rel="noopener noreferrer">
                        <Printer className="size-4 text-muted-foreground" /> Yazdır / PDF
                      </Link>
                    </Button>
                    <Button
                      variant="whatsapp"
                      type="button"
                      size="lg"
                      className="w-full justify-start"
                      onClick={() => {
                        if (!shareLinkFull) return
                        const text = generateWhatsAppShareText({ publicLink: shareLinkFull, totalAmount: order.totals.hasAnyPrice ? order.totals.grandTotal : null })
                        window.open(getWhatsAppSendUrl(order.customer.phone, text), "_blank")
                      }}
                    >
                      <Share2 className="size-4" /> WhatsApp ile Paylaş
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="compact"
                        onClick={async () => {
                          const linkId = intake.shareLinks[0]?.id
                          if (!linkId) return
                          try {
                            await fetch(`/api/intakes/${intake.id}/share-visibility`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ linkId, isActive: !intake.shareLinks[0].isActive }),
                            })
                            router.refresh()
                          } catch {}
                        }}
                        className="flex-1"
                      >
                        {intake.shareLinks[0]?.isActive ? <><EyeOff className="size-3.5" /> Devre Dışı</> : <><Eye className="size-3.5" /> Etkinleştir</>}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="compact"
                        onClick={async () => { if (shareLinkFull) { try { await navigator.clipboard.writeText(shareLinkFull) } catch {} } }}
                        className="flex-1"
                      >
                        <LinkIcon className="size-3.5" /> Kopyala
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </DetailPanel>
          </div>
        </div>
      </div>
      </div>

      <AlertDialog open={confirmCancelOpen} onOpenChange={handleCancelDialogOpenChange}>
        <AlertDialogContent onCloseAutoFocus={returnFocusOnClose}>
          <AlertDialogHeader>
            <AlertDialogTitle>Araç kabulü iptal edilsin mi?</AlertDialogTitle>
            {/* Tek açıklama (aria-describedby tek kimliğe bağlanır), iki paragraf. */}
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Kalemler, fiyatlar, fotoğraflar ve usta ataması kilitlenir; araç kabulü
                  daha sonra başlıktaki &quot;Yeniden Aktif Et&quot; ile yeniden açılabilir.
                </p>
                {/* İptal tahsilata dokunmaz (updateOrderStatusAction); iade akışı yok,
                    Kasa'da yalnız tahsilat kaydı gerekçeyle iptal edilebilir. */}
                {canCashbox && order.paidAmount > 0 && (
                  <p>
                    {`Tahsil edilen ${formatTRY(order.paidAmount)} kayıtlı kalır; tahsilat kayıtları`}{" "}
                    silinmez. Para geri verilecekse ilgili tahsilatı Kasa&apos;dan ayrıca iptal edin.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Vazgeç</AlertDialogCancel>
            {/* Pencere istek sürerken açık kalır; yalnız başarıda kapanır. */}
            <AlertDialogAction
              variant="destructive"
              disabled={loading}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmCancel()
              }}
            >
              {loading ? "İptal ediliyor…" : "İptal Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reopenOpen} onOpenChange={(o) => { if (!reopening) setReopenOpen(o) }}>
        <AlertDialogContent onCloseAutoFocus={returnFocusOnClose}>
          <AlertDialogHeader>
            <AlertDialogTitle>Araç kabulü yeniden açılsın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              Durum &quot;Teslime Hazır&quot;a döner. Tahsilat, paylaşım linki ve müşteri onayı
              kayıtlarına dokunulmaz. Gerekçe denetim kaydına yazılır.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reopen-reason">Gerekçe</Label>
            <Textarea
              id="reopen-reason"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Örn. Müşteri aynı arızayla geri geldi"
              className="min-h-18"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopening}>Vazgeç</AlertDialogCancel>
            <Button variant="foreground" onClick={handleReopen} disabled={reopening || reopenReason.trim().length < 5}>
              {reopening ? <Loader2 className="size-4 animate-spin" /> : "Yeniden Aç"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
