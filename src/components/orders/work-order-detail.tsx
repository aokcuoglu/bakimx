"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DashOrderStatus, surface } from "@/components/dashboard/surface"
import { DetailPanel, DetailRow, DetailPill, DetailEmpty, OrderPaymentPill, detail } from "@/components/orders/order-detail-surface"
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
  Plus,
  Wallet,
  History,
  Calculator,
  TriangleAlert,
  Images,
  X,
  Wrench,
  HardHat,
  UserPlus,
  ArrowLeft,
  LockKeyhole,
} from "lucide-react"
import {
  PHOTO_TYPES,
  PHOTO_PHASES,
  VEHICLE_PHOTO_TYPES,
  type PhotoPhaseKey,
} from "@/lib/constants"
import { formatTRY } from "@/lib/format"
import { kurusToLira, bpsToPercent, liraToKurus, percentToBps } from "@/lib/money"
import { STANDARD_TAX_BPS } from "@/lib/orders/line-vat"
import { isOrderLocked, isCollectionLockedForOrder } from "@/lib/status-transitions"
import { findUnpricedItems } from "@/lib/orders/pricing-guard"
import { findUndecidedPartsRequests } from "@/lib/orders/parts-request-guard"
import { canOpenTechnicianView, technicianOrderPath } from "@/lib/technician/cross-links"
import type { OrderStatus, PaymentStatus } from "@prisma/client"
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
  PricingSummaryCard,
  PaymentHistoryCard,
  type OrderDetailData,
  type PricingMetaDraft,
  type Totals,
} from "@/components/orders/order-management-panel"
import { OrderInfoCard } from "@/components/orders/order-info-card"
import { reopenDeliveredOrderAction } from "@/app/(app)/orders/actions"
import {
  AlertDialog,
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
import { lockedFeatureLabels } from "@/lib/feature-catalog"
import { compressImagesForUpload } from "@/lib/image/compress-image"
import { cn } from "@/lib/utils"
import { usePendingScroll } from "@/hooks/use-pending-scroll"
import { OrderQuickActions } from "@/components/orders/order-quick-actions"
import { orderQuickActions, type OrderQuickAction } from "@/lib/orders/quick-actions"
import type { PartsAddType } from "@/components/orders/parts-labor-grid"

// Header aksiyon ikonları (eski orders ekranıyla aynı görünüm).
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

// Detay içeriği sekmelere bölünür (uzun tek-scroll yerine). Aktif sekme
// istemcide durur. Adres `?tab=` ile güncellenir ama `router.replace` ile
// değil: o çağrı sayfayı (Prisma + aktivite) her sekmede yeniden üretiyordu.
type TabKey = "ozet" | "parca" | "tahsilat" | "kanit" | "teknisyen" | "gecmis"

function parseOrderTab(value: string | null): TabKey {
  if (
    value === "ozet" ||
    value === "parca" ||
    value === "tahsilat" ||
    value === "kanit" ||
    value === "teknisyen" ||
    value === "gecmis"
  ) {
    return value
  }
  return "ozet"
}

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; feature?: GatedFeature }[] = [
  { key: "ozet", label: "Özet", icon: Info },
  { key: "parca", label: "Parça & İşçilik", icon: Package },
  { key: "tahsilat", label: "Tahsilat", icon: Wallet, feature: "cashbox" },
  { key: "kanit", label: "Kanıt", icon: Camera },
  { key: "teknisyen", label: "Teknisyen", icon: Wrench, feature: "team" },
  { key: "gecmis", label: "Geçmiş", icon: History },
]

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
  onAdd,
}: {
  label: string
  name: string | null
  phone: string | null
  emptyText: string
  /** Verilmezse (yetki yok / emir kilitli) yalnız bilgi görünür. */
  onAdd?: () => void
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
          <p className="text-sm text-muted-foreground">{emptyText}</p>
          {onAdd && (
            <Button variant="link" size="sm" onClick={onAdd} className="px-0">
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
  const searchParams = useSearchParams()
  // İlk değer sunucu ve istemci hidrasyonunda aynı olsun diye URL'den okunur
  // (derin bağlantı `?tab=kanit`). Sonraki geçişler state'tedir; Next
  // `useSearchParams` güncellenmez, sayfa da yeniden istenmez.
  const [activeTab, setActiveTab] = useState<TabKey>(() => parseOrderTab(searchParams.get("tab")))

  useOrderSync(order.id)

  function handleTabChange(key: string) {
    const next = parseOrderTab(key)
    setActiveTab(next)
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    url.searchParams.set("tab", next)
    // Liste "Düzenle" ile gelen ?edit=1 sekme değişince düşer; sunucuya gidilmez.
    url.searchParams.delete("edit")
    const nextUrl = `${url.pathname}${url.search}`
    window.history.replaceState(window.history.state, "", nextUrl)
  }

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
      ? new Date(order.estimatedDeliveryAt).toISOString().slice(0, 16)
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
          ? new Date(order.estimatedDeliveryAt).toISOString().slice(0, 16)
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
  // Fotoğraflar bölümüne kaydırma: Kanıt paneli başka sekmedeyken DOM'da
  // yoktur, kaydırma panel bağlandığında yapılır (#838, lib/pending-scroll).
  const [attachPhotos, scrollToPhotos] = usePendingScroll()
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
  // Fiyatlandırma kartı Özet sekmesinde; Parça sekmesindeki mobil toplam
  // çubuğu Özet'i açar, kart bağlanınca kaydırılır (#838).
  const [attachPricing, scrollToPricing] = usePendingScroll()
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

  // Etkin sekme taşan şeridin dışında kalmasın: yalnız şeridi yatay kaydır
  // (scrollIntoView sayfayı dikey de kaydırır ve foto/fiyat kaydırmasıyla çakışır).
  const tabListRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const list = tabListRef.current
    const trigger = list?.querySelector<HTMLElement>('[data-state="active"]')
    if (!list || !trigger) return
    const l = list.getBoundingClientRect()
    const t = trigger.getBoundingClientRect()
    const pad = 16
    if (t.left < l.left + pad) {
      list.scrollTo({ left: list.scrollLeft + (t.left - l.left) - pad, behavior: "smooth" })
    } else if (t.right > l.right - pad) {
      list.scrollTo({ left: list.scrollLeft + (t.right - l.right) + pad, behavior: "smooth" })
    }
  }, [activeTab])

  function focusPricingSummary() {
    if (activeTab !== "ozet") handleTabChange("ozet")
    scrollToPricing()
  }

  async function changeStatus(newStatus: string) {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.success) router.refresh()
      else setError(data.error || "Durum güncellenemedi")
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
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
        order.estimatedDeliveryAt ? new Date(order.estimatedDeliveryAt).toISOString().slice(0, 16) : ""
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

  function startEditInfo() {
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
  const headerActions: DetailHeaderAction[] = nextActions.map((a) => ({
    key: a.key,
    label: a.key === "delivered" ? "Teslim Et (OTP)" : a.label,
    onClick: a.key === "delivered" ? handleRequestDeliveryOtp : () => changeStatus(a.key),
    tone: a.key === "cancelled" ? "danger" : a.primary ? "primary" : "secondary",
    icon: ORDER_ACTION_ICONS[a.key],
    disabled:
      (a.key === "delivered" && deliveryBlocked) ||
      (a.key === "ready_for_delivery" && partsDecisionBlocked),
  }))

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

  // Eksik/istenen foto akışı: Kanıt sekmesine geç (paneli mount et), tipini
  // seç ve dialog'u aç; scroll useEffect ile panel render olunca yapılır.
  function focusPhoto(typeKey?: string, phase?: PhotoPhaseKey) {
    // Lite'ta eksik-fotoğraf kısayolları diyaloğu açamaz; kullanıcıyı ortak
    // yükseltme kartının bulunduğu Fotoğraflar bölümüne taşır.
    if (!canUsePhotoChecklist) {
      if (activeTab !== "kanit") handleTabChange("kanit")
      scrollToPhotos()
      return
    }

    if (typeKey) setPhotoType(typeKey)
    if (phase) setPhotoPhase(phase)
    // İkisi de biliniyorsa hücre bağlamıdır (matris karesi / karşılaştır "+")
    // → tür ve aşama diyaloğda kilitli gelir.
    setPhotoContextLocked(Boolean(typeKey && phase))
    setAddingPhoto(true)
    // Kanıt paneli zaten açıksa hemen, değilse panel bağlanınca kaydırılır.
    if (activeTab !== "kanit") handleTabChange("kanit")
    scrollToPhotos()
  }

  // Hızlı butonlar (#881): pencereler ilgili sekmenin içinde yaşar, bu yüzden
  // önce o sekmeye geçilir; pencere sekme bağlanınca açık gelir.
  const collectionsLocked =
    order.status === "cancelled" ||
    isCollectionLockedForOrder(order.status as OrderStatus, order.paymentStatus as PaymentStatus)
  const quickActions = orderQuickActions({ orderLocked, canCashbox, collectionsLocked })
  const [partsAddType, setPartsAddType] = useState<PartsAddType | null>(null)
  const [collectionModalOpen, setCollectionModalOpen] = useState(false)

  function handleQuickAction(action: OrderQuickAction) {
    if (action === "foto") {
      // Lite: focusPhoto yükseltme alanına götürür. Diğerlerinde "Fotoğraf
      // ekle" kutusuyla aynı serbest akış: tür seçilebilir, aşama duruma göre.
      if (!canUsePhotoChecklist) {
        focusPhoto()
        return
      }
      setPhotoType("")
      setPhotoPhase(photoPhaseForStatus(order.status))
      setPhotoContextLocked(false)
      setAddingPhoto(true)
      if (activeTab !== "kanit") handleTabChange("kanit")
      return
    }
    if (action === "tahsilat") {
      if (activeTab !== "tahsilat") handleTabChange("tahsilat")
      setCollectionModalOpen(true)
      return
    }
    if (activeTab !== "parca") handleTabChange("parca")
    setPartsAddType(action)
  }

  return (
    <div className={cn(surface.root, detail.page, "pb-24 lg:pb-6")}>
      <div className={detail.top}>
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

      {/* Teslim adımında fiyatsız kalem varsa: başlıktaki teslim butonu pasif,
          gerekçe ve çıkış yolu burada. Yalnız teslim adımında gösterilir —
          önceki adımlarda fiyat henüz beklenen bir eksik değil. */}
      {unpricedItems.length > 0 && order.status === "ready_for_delivery" && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>{unpricedItems.length} kalemin fiyatı girilmemiş.</AlertTitle>
          <AlertDescription>
            <p className="truncate">
              {unpricedItems.slice(0, 2).map((i) => i.name).join(", ")}
              {unpricedItems.length > 2 && `, +${unpricedItems.length - 2}`}
            </p>
            <p className="text-xs">Teslim için tüm kalemlere fiyat girin (0 TL girilebilir).</p>
            <Button variant="outline" onClick={() => handleTabChange("parca")} className="mt-1">
              Parça sekmesinde tamamla
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Karar bekleyen parça talebi: fiyat uyarısından farklı olarak teslim
          adımından ÖNCE de gösterilir — "Teslime Hazır"ı da kapatan engel budur,
          kullanıcı o düğmeyi pasif bulmadan önce nedenini görsün. */}
      {partsDecisionBlocked && !orderLocked && (
        <Alert variant="warning">
          <TriangleAlert />
          <AlertTitle>{undecidedRequests.length} parça talebi karar bekliyor.</AlertTitle>
          <AlertDescription>
            <p className="truncate">
              {undecidedRequests.slice(0, 2).map((r) => r.partName).join(", ")}
              {undecidedRequests.length > 2 && `, +${undecidedRequests.length - 2}`}
            </p>
            <p className="text-xs">
              Her talebi ya kaleme ekleyin ya da iptal edin; karar verilmeden araç kabulü teslime
              hazırlanamaz ve teslim edilemez.
            </p>
            <Button variant="outline" onClick={() => handleTabChange("parca")} className="mt-1">
              Parça sekmesinde karar ver
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {deliveryOtpMode && order.status === "ready_for_delivery" && (
        <div className={cn(detail.shell, "space-y-3 p-4")}>
          <p className="text-sm font-medium flex items-center gap-2"><KeyRound className="size-4" /> SMS Teslim Onayı</p>
          {order.paymentStatus !== "paid" && (
            <p className="text-xs text-warning-strong">Uyarı: Bu araç kabulünde ödeme tamamlanmadı ({order.paymentStatus}).</p>
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
            className="text-center text-xl tracking-widest"
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
      </div>

      {/* Tek sütun (#860): sol kayıt sütunu yok, sekmeler başlığın hemen altında
          tam genişlikte. Tutar şeridi her genişlikte sekmelerin üstünde kalır. */}
      <div className="min-w-0 space-y-5">
      {order.totals.hasAnyPrice && (
        <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-sm", detail.shell)}>
          {/* İndirim/KDV varken Genel Toplam kalem tutarlarına EŞİT DEĞİLDİR:
              yalnız sonuç gösterilince (ör. ₺400'lük tek kalem → ₺240) rakam
              hatalı sanılıyordu (BAK-55). Zincir hep görünür: ara toplam →
              indirim → KDV → genel toplam. Fark yoksa şerit eskisi gibi sade. */}
          {order.totals.discountAmount > 0 || order.totals.taxAmount > 0 ? (
            <>
              <span className="text-muted-foreground">Ara Toplam: <span className="font-semibold text-foreground">{formatTRY(order.totals.subtotal)}</span></span>
              {order.totals.discountAmount > 0 && (
                <span className="text-muted-foreground">İndirim: <span className="font-semibold text-foreground">−{formatTRY(order.totals.discountAmount)}</span></span>
              )}
              {order.totals.taxAmount > 0 && (
                <span className="text-muted-foreground">KDV{order.taxRate ? ` (%${bpsToPercent(order.taxRate)})` : ""}: <span className="font-semibold text-foreground">{formatTRY(order.totals.taxAmount)}</span></span>
              )}
            </>
          ) : null}
          <span className="text-muted-foreground">Genel Toplam: <span className="font-semibold text-foreground">{formatTRY(order.totals.grandTotal)}</span></span>
          {canCashbox && (
            <>
              <span className="text-muted-foreground">Ödenen: <span className="font-semibold text-success-strong">{formatTRY(order.paidAmount)}</span></span>
              <span className="text-muted-foreground">Kalan: <span className={`font-semibold ${order.remainingAmount > 0 ? "text-destructive-strong" : "text-success-strong"}`}>{formatTRY(order.remainingAmount)}</span></span>
            </>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList ref={tabListRef} variant="line" className={cn(detail.tabList, "flex w-full flex-nowrap overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden")}>
          {TABS.map((t) => {
            const Icon = t.icon
            const locked = Boolean(t.feature && !enabledFeatures.includes(t.feature))
            return (
              <TabsTrigger key={t.key} value={t.key} className={cn("shrink-0", detail.tab)}>
                <Icon className="size-3.5" />
                <span>{t.label}</span>
                {locked && t.feature && <LockKeyhole className="size-3" aria-label={lockedFeatureLabels(t.feature).description} />}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* ÖZET */}
        <TabsContent value="ozet" className={detail.stack}>
          {canReopen && order.status === "delivered" && (
            <div className={cn(detail.shell, "flex flex-wrap items-center justify-between gap-3 p-4")}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Araç kabulü teslim edildi</p>
                  <p className="text-xs text-muted-foreground">
                    Araç geri geldiyse araç kabulünü yeniden açabilirsiniz. Tahsilat ve müşteri
                    onayı kayıtları korunur.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setReopenOpen(true)}>
                  Yeniden Aç
                </Button>
            </div>
          )}
          {/* Müşteri & Araç: Özet'in ilk paneli, her genişlikte */}
          <OrderRecordRail order={order} customerName={customerName} />

          {/* İş Emri Bilgileri */}
          <OrderInfoCard
            order={order}
            technicians={technicians}
            onRequestDelivery={handleRequestDeliveryOtp}
            deliveryBlocked={deliveryBlocked}
            partsDecisionBlocked={partsDecisionBlocked}
          />

          {/* Şikayet & Notlar (düzenlenebilir) */}
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
                      onClick={startEditInfo}
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
                onAdd={canOpenInfoEditor ? startEditInfo : undefined}
              />
            </div>
          </DetailPanel>

          <Dialog open={editingInfo} onOpenChange={(open) => { if (!savingInfo) setEditingInfo(open) }}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Şikayet ve notları düzenle</DialogTitle>
                <DialogDescription>Araç kabulü kabul bilgilerini güncelleyin.</DialogDescription>
              </DialogHeader>
              <div className="min-h-0 space-y-4 overflow-y-auto py-4 text-sm">
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-complaint">Müşteri Şikayeti</Label>
                    <Textarea id="edit-complaint" value={editComplaint} onChange={(e) => setEditComplaint(e.target.value)} placeholder="Müşterinin bildirdiği arıza/şikayet..." className="min-h-[80px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-note">Teknisyen İç Notu</Label>
                    <Textarea id="edit-note" value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Servis içi notlar (opsiyonel)..." className="min-h-[60px]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-mileage">Kilometre (kabul anı)</Label>
                    <Input id="edit-mileage" type="number" inputMode="numeric" min="0" value={editMileage} onChange={(e) => setEditMileage(e.target.value)} placeholder="Örn. 125000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Yakıt seviyesi (kabul anı)</Label>
                    <FuelLevelPicker value={editFuelLevel} onChange={setEditFuelLevel} />
                  </div>
                  <div className="space-y-3 rounded-lg border border-border p-3">
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
                  <div className="space-y-3 rounded-lg border border-border p-3">
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

          {/* Kabul kanıtları */}
          <DetailPanel title="Kabul kanıtları">
            <div className={surface.cardBody}>
              <IntakeEvidenceSummary
                photoCompletion={photoCompletion}
                damageCount={damagePhotos.length}
                approvalStatus={approvalStatus}
                publicLinkStatus={publicLinkStatus}
                onMissingPhotoClick={(key) => focusPhoto(key)}
              />
            </div>
          </DetailPanel>

          <div ref={attachPricing} className="scroll-mt-20">
            <PricingSummaryCard
              totals={order.totals}
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
            />
          </div>

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

              {order.status === "ready_for_delivery" && !deliveryOtpMode && (
                <div className="pt-3 border-t">
                  <Button onClick={handleRequestDeliveryOtp} disabled={loading} variant="outline" className="w-full">
                    <KeyRound className="size-4 mr-2" /> SMS Teslim Kodu Gönder
                  </Button>
                </div>
              )}
            </div>
          </DetailPanel>
        </TabsContent>

        {/* PARÇA & İŞÇİLİK */}
        <TabsContent value="parca" className="space-y-5">
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
          <PartsLaborCard orderId={order.id} status={order.status} items={order.items} vehicle={order.vehicle} onError={(msg) => toast.error(msg)} onLoading={setLoading} loading={loading} laborCatalog={laborCatalog} taxRateBps={order.taxRate} onApplyStandardTax={orderLocked ? undefined : applyStandardTaxRate} addingType={partsAddType} onAddingTypeChange={setPartsAddType} />

          {/* Mobil yapışkan toplam: kalem eklerken genel toplam hep görünür;
              dokununca Fiyatlandırma kartına kaydırır. Alt navigasyonun (fixed,
              <lg) üzerine oturur. */}
          <MobileTotalsBar
            totals={order.totals}
            itemCount={order.items.length}
            onJump={focusPricingSummary}
          />
        </TabsContent>

        {/* TAHSİLAT */}
        <TabsContent value="tahsilat" className={detail.stack}>
          {!canCashbox ? (
            <InlineFeatureUpsell feature="cashbox" currentTier={currentTier} />
          ) : (
          <>
          {/* Kompakt ödeme özeti */}
          <DetailPanel title="Ödeme Özeti" aside={<OrderPaymentPill status={order.paymentStatus} />}>
            {order.totals.hasAnyPrice ? (
              <>
                <DetailRow label="Genel Toplam">
                  <span className="font-semibold tabular-nums">{formatTRY(order.totals.grandTotal)}</span>
                </DetailRow>
                <DetailRow label="Ödenen">
                  <span className="font-semibold tabular-nums text-success-strong">{formatTRY(order.paidAmount)}</span>
                </DetailRow>
                <DetailRow label="Kalan">
                  <span className={`font-semibold tabular-nums ${order.remainingAmount > 0 ? "text-destructive-strong" : "text-success-strong"}`}>{formatTRY(order.remainingAmount)}</span>
                </DetailRow>
              </>
            ) : (
              <DetailEmpty>Henüz tutar girilmedi</DetailEmpty>
            )}
          </DetailPanel>

          <PaymentHistoryCard
            orderId={order.id}
            collectionsLocked={collectionsLocked}
            totals={order.totals}
            paidAmount={order.paidAmount}
            remainingAmount={order.remainingAmount}
            collections={order.collectionHistory}
            customerId={order.customer.id}
            customerName={customerName}
            collectionModalOpen={collectionModalOpen}
            onCollectionModalOpenChange={setCollectionModalOpen}
          />
          </>
          )}
        </TabsContent>

        {/* KANIT (Foto & Hasar) */}
        <TabsContent value="kanit" className={detail.stack}>
          {/* Fotoğraflar */}
          <div ref={attachPhotos} className="scroll-mt-4">
          <DetailPanel
            title="Fotoğraflar"
            aside={
              canUsePhotoChecklist && (
                <DetailPill tone={missingRequired.length ? "warning" : "success"}>
                  {missingRequired.length === 0 && <CheckCircle2 className="size-3.5" />}
                  {photoCompletion.requiredCompleted}/{photoCompletion.required} zorunlu
                </DetailPill>
              )
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
                  onAdd={orderLocked ? undefined : (type, phase) => focusPhoto(type, phase)}
                  onAddOther={orderLocked ? undefined : (phase) => {
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
                <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" disabled={loading} onClick={() => cameraInputRef.current?.click()}>
                      <Camera className="size-4 mr-1.5" /> Kamera
                    </Button>
                    <Button type="button" variant="outline" disabled={loading} onClick={() => galleryInputRef.current?.click()}>
                      <Images className="size-4 mr-1.5" /> Galeriden seç
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Galeriden tek seferde birden fazla fotoğraf seçebilirsiniz (en fazla {MAX_BATCH_PHOTOS}).
                  </p>
                  {pendingPhotos.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {pendingPhotos.length} fotoğraf seçildi
                        {loading && uploadedCount > 0 ? ` — ${uploadedCount}/${pendingPhotos.length} yüklendi` : ""}
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {pendingPhotos.map((p, i) => (
                          <div key={p.key} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.previewUrl} alt={`Seçilen fotoğraf ${i + 1}`} className="size-full object-cover" />
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="secondary"
                              aria-label={`Fotoğraf ${i + 1} — seçimden çıkar`}
                              disabled={loading}
                              onClick={() => removePendingPhoto(p.key)}
                              className={cn("absolute top-1 right-1 rounded-full", detail.tap)}
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
          </div>

          {/* Hasar */}
          {canUseDamageMap ? (
            <DetailPanel title="Hasar">
              <div className={detail.block}>
                <DamageCapture reloadKey={JSON.stringify([intake.damageMarks,intake.photos])} intakeFormId={intake.id} vehicle={intake.vehicle} readOnly={orderLocked} modalMetadata />
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
        </TabsContent>

        {/* TEKNİSYEN — teknisyen panelindeki ilerleme, salt okunur */}
        <TabsContent value="teknisyen" className={detail.stack}>
          {!canTeam ? (
            <InlineFeatureUpsell feature="team" currentTier={currentTier} />
          ) : (
          <>
          {/* Panelin kendisi bilinçli olarak aksiyonsuz (bkz. technician-progress-panel).
              İşaretleme teknisyen panelinde yapıldığı için geçiş linki panelin
              dışında, sekmenin başında durur (BAK-23). */}
          {canOpenTechnicianView(order.assignedTechnicianId) && (
            <div className="flex justify-end">
              <Button variant="outline" asChild>
                <Link href={technicianOrderPath(order.id)}>
                  <HardHat />
                  Teknisyen Panelinde Aç
                </Link>
              </Button>
            </div>
          )}
          <TechnicianProgressPanel
            checklistItems={order.checklistItems}
            laborSessions={order.laborSessions}
            internalNotes={order.internalNotes}
            technicianName={order.assignedTechnicianName}
          />
          </>
          )}
        </TabsContent>

        {/* GEÇMİŞ */}
        <TabsContent value="gecmis">
          {/* İşlem Geçmişi (personel-içi; public paylaşıma dahil değildir) */}
          <OrderActivityLog entries={activity} />
        </TabsContent>
      </Tabs>
      </div>

      <AlertDialog open={reopenOpen} onOpenChange={(o) => { if (!reopening) setReopenOpen(o) }}>
        <AlertDialogContent>
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
              className="min-h-[70px]"
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

// Mobil (<md) yapışkan Genel Toplam barı. Parça sekmesi içeriğinin SON çocuğu
// olarak sticky durur: içerik uzunken alt navigasyonun üstünde yüzer, sekme
// sonuna gelince doğal akış yerine oturur — içeriği hiçbir zaman örtmez.
function MobileTotalsBar({
  totals,
  itemCount,
  onJump,
}: {
  totals: Totals
  itemCount: number
  onJump: () => void
}) {
  if (!totals.hasAnyPrice) return null
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onJump}
      aria-label="Fiyatlandırma özetine git"
      className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 h-auto w-full justify-between rounded-xl bg-background/95 px-4 py-3 text-left whitespace-normal shadow-lg backdrop-blur md:hidden"
    >
      <span className="flex min-w-0 flex-col items-start gap-0.5">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calculator className="size-4" />
          Genel Toplam
          <span className="text-xs text-muted-foreground">· {itemCount} kalem</span>
        </span>
        {/* Kalem toplamı ile genel toplam farklıysa farkın nedeni burada yazar
            (BAK-55) — mobilde fiyatlandırma kartı ekranın çok altında kalıyor. */}
        {(totals.discountAmount > 0 || totals.taxAmount > 0) && (
          <span className="truncate text-[11px] text-muted-foreground">
            {[
              `Ara toplam ${formatTRY(totals.subtotal)}`,
              totals.discountAmount > 0 ? `indirim −${formatTRY(totals.discountAmount)}` : null,
              totals.taxAmount > 0 ? `KDV ${formatTRY(totals.taxAmount)}` : null,
            ].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      <span className="text-base font-bold tabular-nums text-foreground">{formatTRY(totals.grandTotal)}</span>
    </Button>
  )
}
