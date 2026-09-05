"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DetailHeader, type DetailHeaderAction } from "@/components/orders/detail-header"
import { StatusBadge, PaymentBadge } from "@/components/shared/status-badge"
import {
  Car,
  User,
  Phone,
  Mail,
  ClipboardList,
  Camera,
  AlertTriangle,
  Share2,
  CheckCircle2,
  Pencil,
  Info,
  Upload,
  Loader2,
  BarChart3,
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
  ArrowRight,
  Calculator,
  TriangleAlert,
  Images,
  X,
  Wrench,
  HardHat,
  LockKeyhole,
} from "lucide-react"
import {
  PHOTO_TYPES,
  PHOTO_PHASES,
  VEHICLE_PHOTO_TYPES,
  type PhotoPhaseKey,
} from "@/lib/constants"
import { formatDate } from "@/lib/utils-client"
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
import { partitionIntakePhotos } from "@/lib/photos/phase-matrix"
import { generateWhatsAppShareText, getWhatsAppSendUrl } from "@/lib/share/whatsapp"
import { calculatePhotoCompletion } from "@/lib/intake/completeness"
import { IntakeEvidenceSummary } from "@/components/intake/intake-evidence-summary"
import { FuelGauge, FuelLevelPicker } from "@/components/intake/fuel-gauge"
import { formatFuelLevel } from "@/lib/fuel-level"
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
import { compressImagesForUpload } from "@/lib/image/compress-image"

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

// Detay içeriği sekmelere bölünür (uzun tek-scroll yerine). Aktif sekme URL'de
// `?tab=` ile tutulur; settings-tabs deseniyle aynı.
type TabKey = "ozet" | "parca" | "tahsilat" | "kanit" | "teknisyen" | "gecmis"

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
  approvals: { id: string; status: string; otpCode: string; createdAt: Date }[]
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
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
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
  const activeTab = (searchParams.get("tab") as TabKey) || "ozet"

  useOrderSync(order.id)

  function handleTabChange(key: string) {
    router.replace(`/orders/${order.id}?tab=${key}`, { scroll: false })
  }

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const orderLocked = isOrderLocked(order.status as OrderStatus)
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
      toast.success("İş emri yeniden açıldı")
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
  const infoCardRef = useRef<HTMLDivElement>(null)

  // Photos
  const photosRef = useRef<HTMLDivElement>(null)
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
  const pendingPhotoScrollRef = useRef(false)
  const pendingPricingScrollRef = useRef(false)
  const pricingRef = useRef<HTMLDivElement>(null)
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

  // Kanıt sekmesi aktif olunca (panel mount olduktan sonra) foto bölümüne kaydır.
  // Base UI Tabs pasif paneli unmount ettiği için scroll senkron yapılamaz; ref
  // ile bekleyen istek işaretlenir (state değil → cascading render/lint yok).
  useEffect(() => {
    if (activeTab === "kanit" && pendingPhotoScrollRef.current) {
      pendingPhotoScrollRef.current = false
      photosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [activeTab])

  // Fiyatlandırma artık Özet sekmesinde. Parça sekmesindeki mobil toplam çubuğu
  // önce sekmeyi açar; panel mount edildikten sonra karta kaydırma tamamlanır.
  useEffect(() => {
    if (activeTab === "ozet" && pendingPricingScrollRef.current) {
      pendingPricingScrollRef.current = false
      pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [activeTab])

  function focusPricingSummary() {
    if (activeTab === "ozet") {
      pricingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }

    pendingPricingScrollRef.current = true
    handleTabChange("ozet")
  }

  // Listeden "Düzenle" ile gelindiğinde kart sayfanın alt kısmında kalıyor;
  // özellikle mobilde kullanıcı düzenleme alanını göremiyor.
  useEffect(() => {
    if (!openInfoEditor) return
    infoCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [openInfoEditor])

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
        toast.success(`İş emrine %${bpsToPercent(STANDARD_TAX_BPS)} KDV uygulandı`)
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
    setLoading(true); setError(""); setDeliverySentCode(null)
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
      if (data.success) router.refresh()
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
    if (typeKey) setPhotoType(typeKey)
    if (phase) setPhotoPhase(phase)
    // İkisi de biliniyorsa hücre bağlamıdır (matris karesi / karşılaştır "+")
    // → tür ve aşama diyaloğda kilitli gelir.
    setPhotoContextLocked(Boolean(typeKey && phase))
    setAddingPhoto(true)
    if (activeTab === "kanit") {
      // Panel zaten mount; doğrudan kaydır.
      photosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    } else {
      // Sekmeye geç; scroll panel mount olunca useEffect'te yapılır.
      pendingPhotoScrollRef.current = true
      handleTabChange("kanit")
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <DetailHeader
        plate={order.vehicle.plate}
        vehicleLabel={`${order.vehicle.brand} ${order.vehicle.model}${order.vehicle.modelYear ? ` (${order.vehicle.modelYear})` : ""}`}
        customerLabel={customerName}
        meta={
          /* Atanan usta bir *durum* değil, işin kime ait olduğu bilgisi —
             bu yüzden müşteri satırının yanında, rozetlerle yarışmadan durur. */
          canTeam ? (
            <TechnicianAssign
              orderId={order.id}
              assignedTechnicianId={order.assignedTechnicianId}
              assignedTechnicianName={order.assignedTechnicianName}
              technicians={technicians ?? []}
              locked={orderLocked}
              variant="meta"
            />
          ) : undefined
        }
        badges={
          <>
            <StatusBadge status={order.status} size="lg" />
            {canCashbox && <PaymentBadge status={order.paymentStatus} size="lg" />}
          </>
        }
        actions={headerActions}
        loading={loading}
        onBack={() => router.push("/orders")}
      />

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-foreground text-sm flex items-start gap-2">
          <Info className="size-4 text-destructive-strong shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Teslim adımında fiyatsız kalem varsa: başlıktaki teslim butonu pasif,
          gerekçe ve çıkış yolu burada. Yalnız teslim adımında gösterilir —
          önceki adımlarda fiyat henüz beklenen bir eksik değil. */}
      {unpricedItems.length > 0 && order.status === "ready_for_delivery" && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm flex items-start gap-2">
          <TriangleAlert className="size-4 text-warning-strong shrink-0 mt-0.5" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{unpricedItems.length} kalemin fiyatı girilmemiş.</p>
            <p className="text-muted-foreground truncate">
              {unpricedItems.slice(0, 2).map((i) => i.name).join(", ")}
              {unpricedItems.length > 2 && `, +${unpricedItems.length - 2}`}
            </p>
            <p className="text-muted-foreground text-xs">Teslim için tüm kalemlere fiyat girin (0 TL girilebilir).</p>
            <Button variant="outline" onClick={() => handleTabChange("parca")} className="mt-1">
              Parça sekmesinde tamamla
            </Button>
          </div>
        </div>
      )}

      {/* Karar bekleyen parça talebi: fiyat uyarısından farklı olarak teslim
          adımından ÖNCE de gösterilir — "Teslime Hazır"ı da kapatan engel budur,
          kullanıcı o düğmeyi pasif bulmadan önce nedenini görsün. */}
      {partsDecisionBlocked && !orderLocked && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm flex items-start gap-2">
          <TriangleAlert className="size-4 text-warning-strong shrink-0 mt-0.5" />
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{undecidedRequests.length} parça talebi karar bekliyor.</p>
            <p className="text-muted-foreground truncate">
              {undecidedRequests.slice(0, 2).map((r) => r.partName).join(", ")}
              {undecidedRequests.length > 2 && `, +${undecidedRequests.length - 2}`}
            </p>
            <p className="text-muted-foreground text-xs">
              Her talebi ya kaleme ekleyin ya da iptal edin; karar verilmeden iş emri teslime
              hazırlanamaz ve teslim edilemez.
            </p>
            <Button variant="outline" onClick={() => handleTabChange("parca")} className="mt-1">
              Parça sekmesinde karar ver
            </Button>
          </div>
        </div>
      )}

      {deliveryOtpMode && order.status === "ready_for_delivery" && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><KeyRound className="size-4" /> Teslim Onayı (OTP)</p>
          {order.paymentStatus !== "paid" && (
            <p className="text-xs text-warning-strong">Uyarı: Bu iş emrinde ödeme tamamlanmadı ({order.paymentStatus}).</p>
          )}
          {deliverySentCode && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Demo kodu (SMS kapalı): <span className="font-mono font-bold">{deliverySentCode}</span></p>
              <Button
                type="button"
                size="lg"
                className="w-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90"
                onClick={() => {
                  const text = `BakimX teslim onay kodunuz: ${deliverySentCode}. Aracınızın teslimini onaylamak için bu kodu servise iletin.`
                  window.open(getWhatsAppSendUrl(order.customer.phone, text), "_blank")
                }}
              >
                WhatsApp ile Gönder
              </Button>
            </div>
          )}
          <Input
            value={deliveryOtpCode}
            onChange={(e) => setDeliveryOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 haneli teslim kodu"
            inputMode="numeric"
            className="text-center text-xl tracking-widest"
          />
          <div className="flex gap-2">
            <Button onClick={handleVerifyDeliveryOtp} disabled={loading || deliveryOtpCode.length < 6} size="lg" className="flex-1">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Doğrula ve Teslim Et"}
            </Button>
            <Button variant="outline" onClick={handleRequestDeliveryOtp} disabled={loading} size="lg">Kodu Tekrar Gönder</Button>
            <Button variant="ghost" onClick={() => { setDeliveryOtpMode(false); setDeliveryOtpCode(""); setDeliverySentCode(null) }} disabled={loading} size="lg">Vazgeç</Button>
          </div>
        </div>
      )}

      {/* Finansal özet şerit — sekmeden bağımsız hep görünür (durum/ödeme rozetleri
          zaten header'da; burada yalnız header'da olmayan tutarlar). */}
      {order.totals.hasAnyPrice && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
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
        <TabsList variant="line" className="flex w-full flex-nowrap gap-1 sm:gap-2 border-b border-border pb-0 -mb-px overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const Icon = t.icon
            const locked = Boolean(t.feature && !enabledFeatures.includes(t.feature))
            return (
              <TabsTrigger key={t.key} value={t.key} className="px-3 py-2.5 shrink-0 flex-none">
                <Icon className="size-4" />
                <span>{t.label}</span>
                {locked && <LockKeyhole className="size-3" aria-label="Profesyonel paket özelliği" />}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* ÖZET */}
        <TabsContent value="ozet" className="space-y-5">
          {canReopen && order.status === "delivered" && (
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">İş emri teslim edildi</p>
                  <p className="text-xs text-muted-foreground">
                    Araç geri geldiyse iş emrini yeniden açabilirsiniz. Tahsilat ve müşteri
                    onayı kayıtları korunur.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setReopenOpen(true)}>
                  Yeniden Aç
                </Button>
              </CardContent>
            </Card>
          )}
          {/* Müşteri & Araç */}
          {(canUsePhotoChecklist || canUseDamageMap) && <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Müşteri & Araç</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <User className="size-3" /> Müşteri
                  </div>
                  <p className="text-sm font-semibold text-foreground">{customerName}</p>
                  {order.customer.type === "corporate" && order.customer.contactName ? (
                    <p className="text-xs text-muted-foreground">Yetkili: {order.customer.contactName}</p>
                  ) : null}
                  <a href={`tel:${order.customer.phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
                    <Phone className="size-3.5" />
                    {order.customer.phone}
                  </a>
                  {order.customer.email && (
                    <a href={`mailto:${order.customer.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary">
                      <Mail className="size-3.5" />
                      {order.customer.email}
                    </a>
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <Car className="size-3" /> Araç
                    </div>
                    <Link
                      href={`/vehicles/${order.vehicle.id}`}
                      className="text-xs text-primary hover:text-primary font-medium inline-flex items-center gap-1 shrink-0 touch-manipulation"
                    >
                      Araç Detayı
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {order.vehicle.plate} · {order.vehicle.brand} {order.vehicle.model}
                    {order.vehicle.modelYear ? ` (${order.vehicle.modelYear})` : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {order.intake.mileageAtIntake != null && <span>Giriş KM: {order.intake.mileageAtIntake.toLocaleString("tr-TR")}</span>}
                    {order.intake.fuelLevelAtIntake != null && (
                      <span className="inline-flex items-center gap-1.5">
                        <FuelGauge value={order.intake.fuelLevelAtIntake} size="sm" showLabel={false} />
                        Yakıt: {formatFuelLevel(order.intake.fuelLevelAtIntake)}
                      </span>
                    )}
                    {order.vehicle.mileage != null && <span>Kayıtlı: {order.vehicle.mileage.toLocaleString("tr-TR")} km</span>}
                    {order.vehicle.vin && <span className="font-mono">Şase: {order.vehicle.vin}</span>}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Kabul: {formatDate(order.intake.createdAt)}</span>
                {order.intake.approvedAt && <span>Onay: {formatDate(order.intake.approvedAt)}</span>}
              </div>
            </CardContent>
          </Card>}

          {/* İş Emri Bilgileri */}
          <OrderInfoCard
            order={order}
            technicians={technicians}
            onRequestDelivery={handleRequestDeliveryOtp}
            deliveryBlocked={deliveryBlocked}
            partsDecisionBlocked={partsDecisionBlocked}
          />

          {/* Şikayet & Notlar (düzenlenebilir) */}
          <Card ref={infoCardRef}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><ClipboardList className="size-4" /> Şikayet & Notlar</span>
                {!editingInfo && canOpenInfoEditor && (
                  <button
                    onClick={startEditInfo}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/5 px-2 py-1 rounded-lg touch-manipulation"
                  >
                    <Pencil className="size-3.5" /> Düzenle
                  </button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingInfo ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <Label>Müşteri Şikayeti</Label>
                    <Textarea value={editComplaint} onChange={(e) => setEditComplaint(e.target.value)} placeholder="Müşterinin bildirdiği arıza/şikayet..." className="min-h-[80px]" />
                  </div>
                  <div>
                    <Label>Teknisyen İç Notu</Label>
                    <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Servis içi notlar (opsiyonel)..." className="min-h-[60px]" />
                  </div>
                  <div>
                    <Label>Kilometre (kabul anı)</Label>
                    <Input type="number" inputMode="numeric" min="0" value={editMileage} onChange={(e) => setEditMileage(e.target.value)} placeholder="Örn. 125000" />
                  </div>
                  <div>
                    <Label>Yakıt seviyesi (kabul anı)</Label>
                    <div className="pt-1">
                      <FuelLevelPicker value={editFuelLevel} onChange={setEditFuelLevel} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-3">
                    <p className="text-sm font-medium text-foreground">Aracı getiren kişi</p>
                    <p className="text-xs text-muted-foreground">Aracı müşterinin kendisi getirdiyse boş bırakın.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Ad Soyad</Label>
                        <Input value={editDropName} onChange={(e) => setEditDropName(e.target.value)} placeholder="Örn. Ahmet Yılmaz" />
                      </div>
                      <div>
                        <Label>Telefon</Label>
                        <Input type="tel" inputMode="tel" value={editDropPhone} onChange={(e) => setEditDropPhone(e.target.value)} placeholder="Örn. 0532 000 0000" />
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-3 space-y-3">
                    <p className="text-sm font-medium text-foreground">Aracı teslim alacak kişi</p>
                    <p className="text-xs text-muted-foreground">Aracı müşterinin kendisi teslim alacaksa boş bırakın.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Ad Soyad</Label>
                        <Input value={editPickName} onChange={(e) => setEditPickName(e.target.value)} placeholder="Örn. Ayşe Demir" />
                      </div>
                      <div>
                        <Label>Telefon</Label>
                        <Input type="tel" inputMode="tel" value={editPickPhone} onChange={(e) => setEditPickPhone(e.target.value)} placeholder="Örn. 0532 000 0000" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Yapılan değişiklik zaman çizelgesine ve denetim kaydına işlenir.</p>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleSaveInfo} disabled={savingInfo || !editComplaint.trim()} size="sm" className="flex-1">
                      {savingInfo ? <Loader2 className="size-4 animate-spin" /> : "Kaydet"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditingInfo(false)} disabled={savingInfo} size="sm">İptal</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Müşteri Şikayeti</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{order.intake.customerComplaint}</p>
                  </div>
                  {order.intake.internalNote && (
                    <div className="pt-3 border-t">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Teknisyen İç Notu</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{order.intake.internalNote}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground italic">Bu not müşteri çıktısında gösterilmez</p>
                    </div>
                  )}
                  {/* BAK-102 — blok BOŞKEN DE görünür. Alan opsiyonel ama gizli
                      olduğu sürece servis kullanıcısı var olduğunu fark etmiyor;
                      teslim anında tek dokunuşla doldurulabilsin diye boş durum
                      da yazılıyor. */}
                  <div className="pt-3 border-t grid gap-3 sm:grid-cols-2">
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Özet & Kanıt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="size-4" /> Özet & Kanıt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <IntakeEvidenceSummary
                photoCompletion={photoCompletion}
                damageCount={damagePhotos.length}
                approvalStatus={approvalStatus}
                publicLinkStatus={publicLinkStatus}
                onMissingPhotoClick={(key) => focusPhoto(key)}
              />
            </CardContent>
          </Card>

          <div ref={pricingRef} className="scroll-mt-20">
            <PricingSummaryCard
              totals={order.totals}
              paymentStatus={order.paymentStatus}
              paidAmount={order.paidAmount}
              remainingAmount={order.remainingAmount}
              locked={isOrderLocked(order.status as OrderStatus)}
              editingMeta={editingMeta}
              setEditingMeta={setEditingMeta}
              metaDraft={metaDraft}
              setMetaDraft={setMetaDraft}
              saveMeta={saveMeta}
              loading={loading}
              showCashbox={canCashbox}
            />
          </div>

          {/* Müşteri Çıktısı & Paylaşım */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Share2 className="size-4 text-muted-foreground" /> Müşteri Çıktısı</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!shareToken ? (
                <>
                  <p className="text-xs text-muted-foreground">Müşteriyle paylaşabileceğiniz salt-görüntü bir özet linki oluşturun.</p>
                  <Button onClick={handleGenerateShareLink} disabled={loading} className="w-full">
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
                  <Link href={`/s/${shareToken}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full p-2.5 rounded-lg border border-border hover:bg-muted text-sm text-foreground touch-manipulation">
                    <FileText className="size-4 text-muted-foreground" /> Müşteri Çıktısını Aç
                  </Link>
                  <Link href={`/s/${shareToken}/pdf`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full p-2.5 rounded-lg border border-border hover:bg-muted text-sm text-foreground touch-manipulation">
                    <Printer className="size-4 text-muted-foreground" /> Yazdır / PDF
                  </Link>
                  <Button
                    type="button"
                    size="lg"
                    className="w-full justify-start bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90 touch-manipulation"
                    onClick={() => {
                      if (!shareLinkFull) return
                      const text = generateWhatsAppShareText({ publicLink: shareLinkFull, totalAmount: order.totals.hasAnyPrice ? order.totals.grandTotal : null })
                      window.open(getWhatsAppSendUrl(order.customer.phone, text), "_blank")
                    }}
                  >
                    <Share2 className="size-4" /> WhatsApp ile Paylaş
                  </Button>
                  <div className="flex gap-2">
                    <button
                      type="button"
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
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border bg-background text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                    >
                      {intake.shareLinks[0]?.isActive ? <><EyeOff className="size-3.5" /> Devre Dışı</> : <><Eye className="size-3.5" /> Etkinleştir</>}
                    </button>
                    <button
                      type="button"
                      onClick={async () => { if (shareLinkFull) { try { await navigator.clipboard.writeText(shareLinkFull) } catch {} } }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border bg-background text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                    >
                      <LinkIcon className="size-3.5" /> Kopyala
                    </button>
                  </div>
                </>
              )}

              {order.status === "ready_for_delivery" && !deliveryOtpMode && (
                <div className="pt-3 border-t">
                  <Button onClick={handleRequestDeliveryOtp} disabled={loading} variant="outline" className="w-full">
                    <KeyRound className="size-4 mr-2" /> Teslim Onayı (OTP) Gönder
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
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
          <PartsLaborCard orderId={order.id} status={order.status} items={order.items} vehicle={order.vehicle} onError={(msg) => toast.error(msg)} onLoading={setLoading} loading={loading} laborCatalog={laborCatalog} taxRateBps={order.taxRate} onApplyStandardTax={orderLocked ? undefined : applyStandardTaxRate} />

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
        <TabsContent value="tahsilat" className="space-y-5">
          {!canCashbox ? (
            <InlineFeatureUpsell feature="cashbox" currentTier={currentTier} />
          ) : (
          <>
          {/* Kompakt ödeme özeti */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Wallet className="size-4" /> Ödeme Özeti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.totals.hasAnyPrice ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Genel Toplam</span>
                    <span className="font-semibold">{formatTRY(order.totals.grandTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ödenen</span>
                    <span className="font-semibold text-success-strong">{formatTRY(order.paidAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-muted-foreground">Kalan</span>
                    <span className={`font-semibold ${order.remainingAmount > 0 ? "text-destructive-strong" : "text-success-strong"}`}>{formatTRY(order.remainingAmount)}</span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-center py-2">Henüz tutar girilmedi</p>
              )}
            </CardContent>
          </Card>

          <PaymentHistoryCard
            orderId={order.id}
            collectionsLocked={order.status === "cancelled" || isCollectionLockedForOrder(order.status as OrderStatus, order.paymentStatus as PaymentStatus)}
            totals={order.totals}
            paidAmount={order.paidAmount}
            remainingAmount={order.remainingAmount}
            collections={order.collectionHistory}
            customerId={order.customer.id}
            customerName={customerName}
          />
          </>
          )}
        </TabsContent>

        {/* KANIT (Foto & Hasar) */}
        <TabsContent value="kanit" className="space-y-5">
          {/* Fotoğraflar */}
          <div ref={photosRef} className="scroll-mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Camera className="size-4" /> Fotoğraflar</span>
                {canUsePhotoChecklist && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {photoCompletion.requiredCompleted} / {photoCompletion.required} zorunlu açı
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Tip × aşama matrisi — hasar detayı alt kartta, burada yok */}
              {canUsePhotoChecklist && (vehiclePhotos.length > 0 || missingRequired.length > 0) ? (
                <PhotoPhaseMatrix
                  photos={vehiclePhotos}
                  canDelete={!orderLocked}
                  onDeleted={() => router.refresh()}
                  onAdd={
                    orderLocked
                      ? undefined
                      : (type, phase) => focusPhoto(type, phase)
                  }
                />
              ) : vehiclePhotos.length > 0 ? (
                <PhotoGalleryGrid photos={vehiclePhotos} canDelete={!orderLocked} onDeleted={() => router.refresh()} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-3">Henüz araç fotoğrafı eklenmedi</p>
              )}

              {/* Missing required chips */}
              {canUsePhotoChecklist && (missingRequired.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Eksik:</span>
                  {missingRequired.map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => focusPhoto(key)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-destructive/10 text-destructive-strong border border-destructive/20 hover:bg-destructive/15 transition-colors touch-manipulation"
                    >
                      <Camera className="size-3" /> {val.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-success-strong flex items-center gap-1.5"><CheckCircle2 className="size-3.5" /> Tüm zorunlu fotoğraflar tamam</p>
              ))}

              {!canUsePhotoChecklist && (
                <InlineFeatureUpsell feature="photoChecklist" currentTier={currentTier} />
              )}

              {/* Add photo trigger + dialog */}
              {!orderLocked && (<>
              <Button variant="outline" onClick={() => {
                setPhotoContextLocked(false)
                if (!canUsePhotoChecklist) {
                  setPhotoType("other")
                  setPhotoPhase("intake")
                }
                setAddingPhoto(true)
              }} className="w-full">
                <Plus className="size-3.5 mr-1" /> Fotoğraf Ekle
              </Button>

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
                          <div key={p.key} className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.previewUrl} alt={`Seçilen fotoğraf ${i + 1}`} className="size-full object-cover" />
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="secondary"
                              aria-label={`Fotoğraf ${i + 1} — seçimden çıkar`}
                              disabled={loading}
                              onClick={() => removePendingPhoto(p.key)}
                              className="absolute top-1 right-1 rounded-full"
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
                <Button onClick={handleAddPhoto} disabled={loading || !photoType} size="lg" className="w-full">
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
            </CardContent>
          </Card>
          </div>

          {/* Hasar */}
          {canUseDamageMap ? <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="size-4 text-warning-strong" /> Hasar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DamageCapture reloadKey={JSON.stringify([intake.damageMarks,intake.photos])} intakeFormId={intake.id} vehicle={intake.vehicle} readOnly={orderLocked} />

              {damagePhotos.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Hasar Fotoğrafları ({damagePhotos.length})</p>
                  <PhotoGalleryGrid photos={damagePhotos} canDelete={!orderLocked} onDeleted={() => router.refresh()} />
                </div>
              )}
            </CardContent>
          </Card> : <InlineFeatureUpsell feature="damageMap" currentTier={currentTier} />}
        </TabsContent>

        {/* TEKNİSYEN — teknisyen panelindeki ilerleme, salt okunur */}
        <TabsContent value="teknisyen" className="space-y-4">
          {!canTeam ? (
            <InlineFeatureUpsell feature="team" currentTier={currentTier} />
          ) : (
          <>
          {/* Panelin kendisi bilinçli olarak aksiyonsuz (bkz. technician-progress-panel).
              İşaretleme teknisyen panelinde yapıldığı için geçiş linki panelin
              dışında, sekmenin başında durur (BAK-23). */}
          {canOpenTechnicianView(order.assignedTechnicianId) && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
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

      <AlertDialog open={reopenOpen} onOpenChange={(o) => { if (!reopening) setReopenOpen(o) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İş emri yeniden açılsın mı?</AlertDialogTitle>
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
            <Button onClick={handleReopen} disabled={reopening || reopenReason.trim().length < 5}>
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
    <button
      type="button"
      onClick={onJump}
      aria-label="Fiyatlandırma özetine git"
      className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex w-full items-center justify-between rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur touch-manipulation md:hidden"
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
    </button>
  )
}
