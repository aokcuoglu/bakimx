"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Item, ItemActions, ItemContent, ItemDescription, ItemHeader, ItemTitle } from "@/components/ui/item"
import {
  AlertTriangle,
  Camera,
  Car,
  Check,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  Phone,
  ScanLine,
  User,
  UserCog,
} from "lucide-react"
import { WizardActions, WizardHeading, WizardStepper } from "@/components/intake/wizard-ui"
import { Plate } from "@/components/shared/plate"
import { EntryVehicleFields, EMPTY_VEHICLE_FIELDS, type VehicleFields } from "@/components/intake/entry-vehicle-fields"
import { CustomerSearchOrCreate } from "@/components/customers/customer-search-or-create"
import { PlateScanner } from "@/components/intake/plate-scanner"
import { RegistrationCameraScanner } from "@/components/intake/registration-camera-scanner"
import { RuhsattanOku, type RuhsattanOkuResult } from "@/components/vehicles/ruhsattan-oku"
import { AddonGate } from "@/components/billing/addon-gate"
import { IntakeDuplicatePhoneNotice, IntakeOwnerCard } from "@/components/intake/intake-owner-card"
import { VehiclePhotoCapture, createPendingVehiclePhoto, type PendingVehiclePhoto } from "@/components/intake/vehicle-photo-capture"
import { updateCustomerContactAction } from "@/app/(app)/customers/actions"
import { ALLOW_DUPLICATE_PHONE_FIELD, type ExistingCustomer } from "@/lib/customers/duplicate-phone"
import { dataUrlToBlob } from "@/lib/image/data-url"
import { compressImageForUpload } from "@/lib/image/compress-image"
import { CrossWorkshopHistoryLoader } from "@/components/vehicles/cross-workshop-history"
import { useVinResolve } from "@/components/vehicles/vin-resolve"
import { changeVehicleOwnerAction } from "@/app/(app)/vehicles/actions"
import { displayCustomerName, type CustomerLite, type UnifiedResult } from "@/lib/search/unified-results"
import { findExactPlateMatch } from "@/lib/search/exact-plate-match"
import { isPlateOrCustomerQueryReady } from "@/lib/search/plate-search"
import { formatPhoneTR, normalizePlate, uppercaseIfPlateLike } from "@/lib/format"
import { isValidVin, normalizeVin, type VinCandidate } from "@/lib/vin/types"
import { ocrVehicleTypeToSlug, ocrFuelToSlug, tecdocFuelToFormValue } from "@/lib/constants"
import type { IntakeEntitlements } from "@/lib/intake/entitlements"
import {
  EMPTY_OWNER_FIELDS,
  confirmedVehicleParts,
  entryStepLabels,
  identityConflicts,
  ownerFieldError,
  ownerFieldsChanged,
  ownerFieldsFromCustomer,
  ownerLabel,
  entryBackTarget,
  splitPersonName,
  vehicleFieldError,
  isForeignPlate,
  photoPlateStatus,
  type EntryMethod,
  type EntryStep,
  type IdentityConflict,
  type OwnerFields,
} from "@/lib/intake/entry-wizard"

type VehicleResult = Extract<UnifiedResult, { kind: "vehicle" }>
type CustVehicle = { id: string; plate: string; brand: string; model: string }
type OwnerSeed = { isCorporate: boolean; firstName: string; lastName: string; companyName: string; label: string }
type DuplicatePhoneResponse = { error?: string; existingCustomer?: ExistingCustomer; existingCustomers?: ExistingCustomer[] }

/** Sunucunun "telefon başka müşteride kayıtlı" yanıtından eşleşme listesi. */
function duplicatesFrom(data: DuplicatePhoneResponse): ExistingCustomer[] {
  if (data.existingCustomers?.length) return data.existingCustomers
  return data.existingCustomer ? [data.existingCustomer] : []
}

/** Müşteri kartından /api/customers ya da iletişim güncellemesi için FormData. */
function ownerFormData(o: OwnerFields, allowDuplicatePhone: boolean): FormData {
  const fd = new FormData()
  fd.set("type", o.type)
  if (o.type === "corporate") {
    // Kurumsal: firma adı + yetkili ("Ad Soyad" alanı, isteğe bağlı).
    fd.set("companyName", o.companyName.trim())
    fd.set("contactName", ownerLabel({ ...o, type: "individual" }))
  } else {
    // "Ad Soyad" tek alan: son kelime soyad, öncesi ad. Tam ad da gönderilir
    // (soyadsız bireysel müşteriyi sunucunun superRefine'ı tam adla kabul eder).
    const { firstName, lastName } = splitPersonName(o.name)
    fd.set("firstName", firstName)
    fd.set("lastName", lastName)
    fd.set("fullName", ownerLabel(o))
  }
  fd.set("phone", o.phone)
  if (allowDuplicatePhone) fd.set(ALLOW_DUPLICATE_PHONE_FIELD, "on")
  return fd
}

const SEARCH_ENDPOINT = "/api/search/customer-vehicle"

/** Müşterinin kayıtlı araçları (müşteri seçilince "Aracı seçin" listesi). */
function fetchCustomerVehicles(customerId: string): Promise<CustVehicle[]> {
  return fetch(`/api/vehicles?customerId=${encodeURIComponent(customerId)}`)
    .then((r) => r.json())
    .then((d: unknown) => {
      const arr = Array.isArray(d) ? d : []
      return arr.map((v) => ({ id: String(v.id), plate: String(v.plate), brand: String(v.brand), model: String(v.model) }))
    })
}

type OwnerSeedFromCustomer = { id: string; label: string; fields: OwnerFields }

/** Müşteriden açılan odaklı kabulün sahip kartı (#832); biçim plaka sahibi önceden doldurmasıyla aynı. */
function ownerSeedFromCustomer(c: CustomerLite): OwnerSeedFromCustomer {
  const fromCustomer = ownerFieldsFromCustomer(c)
  return { id: c.id, label: displayCustomerName(c), fields: { ...fromCustomer, phone: formatPhoneTR(fromCustomer.phone) } }
}

/**
 * `createdOwner` kaydı: kart bu alanlarla onaylanırsa müşteri yeniden açılmaz.
 * Anahtar, `submitPlateFirst`in karşılaştırdığı `JSON.stringify(ownerForm)`.
 */
function ownerClaim(seed: OwnerSeedFromCustomer | null): { id: string; label: string; key: string } | null {
  return seed ? { id: seed.id, label: seed.label, key: JSON.stringify(seed.fields) } : null
}

/**
 * Kabul akışının araç girişi sihirbazı (#309).
 *
 * Her zaman plaka/müşteri aramasıyla başlar (odaklı akışta plaka kamerası
 * açılışta hazır). Aramadan müşteri seçilirse o müşterinin araçları listelenir.
 * Kabul bir müşteriden açıldıysa (`initialCustomer`) odaklı akışta yeni plakanın
 * sahip kartı o müşteriyle dolu gelir (#832); odaklı olmayan akışta müşterinin
 * araçları listelenir (#822). Kayıtlı araç
 * bulunursa doğrudan onaya, bulunmazsa "Araç bilgileri" ve "Müşteri" adımlarına
 * geçilir. Ayrı bir yöntem seçim ekranı yoktur (#822): ruhsat okuma ve şase
 * kamerası araç bilgileri ekranındadır.
 *
 * Seçim `onChange` ile dışarı verilir (kabul sihirbazı formu + URL'i besler),
 * kullanıcı onayladığında `onComplete` çağrılır.
 */
export function VehicleEntryWizard({
  value,
  onChange,
  onComplete,
  entitlements,
  initialMethod = null,
  initialCustomer = null,
  hasPrefilledVehicle = false,
  onVehiclePhotoChange,
  onConfirmOrder,
}: {
  value: { customerId: string; vehicleId: string }
  onChange: (v: { customerId: string; vehicleId: string }) => void
  onComplete: () => void
  /**
   * Sunucuda çözülen giriş yetkileri (#828). Kilitli ek özelliğin girişi
   * (ruhsat kamerası, şase kamerası, "Şaseden getir") çizilmez; yerine
   * yönetici rollerinde kompakt bir "Ek özellik" notu gelir. Elle giriş her
   * durumda açık kalır.
   */
  entitlements: IntakeEntitlements
  /**
   * Verilirse akış odaklıdır (adım rayı yok) ve bu yöntemin yakalama adımında
   * açılır; plaka akışında kamera açılışta hazır gelir. Verilmezse tam kabukta
   * plaka/müşteri aramasıyla açılır.
   */
  initialMethod?: EntryMethod | null
  /**
   * Kabul bir müşteriden açıldıysa (`?customerId=…`, araçsız). Odaklı akışta
   * (#832) kamera yine açılır; okunan plaka kayıtlı değilse sahip kartı bu
   * müşteriyle dolu gelir ve yeni müşteri açılmaz. Odaklı olmayan akışta (#822)
   * müşteri seçili başlar ve araçları listelenir. Müşteri, sunucunun atölyeye
   * göre süzdüğü listeden gelir.
   */
  initialCustomer?: CustomerLite | null
  /**
   * URL'de araç var (`?vehicleId=…`): araç ve sahibi yüklenir. Odaklı akışta
   * kamera plaka aramak için değil, ön fotoğraf için açılır (#832).
   */
  hasPrefilledVehicle?: boolean
  /**
   * Kabul fotoğrafı olarak yüklenecek araç karesi (plaka taramasında ya da araç
   * bilgileri ekranındaki kartta çekilen). Kabul kaydı oluşunca kabul sihirbazı
   * yükler; `null` bekleyen kareyi düşürür.
   */
  onVehiclePhotoChange?: (photo: PendingVehiclePhoto | null) => void
  /**
   * Verilirse odaklı plaka akışında onay ekranı ve kabul detayları atlanır:
   * "Devam" yeşil "Onayla"ya döner, "Onayla" müşteri/aracı kaydedip iş emrini
   * bu callback ile açar. Hata metni dönerse ekranda gösterilir; başarıda
   * yönlendirmeyi çağıran yapar.
   */
  onConfirmOrder?: (v: { customerId: string; vehicleId: string }) => Promise<string | null>
}) {
  // Sihirbazın başlangıç ekranı: odaklı akışta URL'deki yöntem, değilse plaka
  // araması. Geri ve "Başka araç seç" buraya döner — yöntem seçim ekranı yok.
  const startMethod: EntryMethod = initialMethod ?? "plate"
  // Müşteriden açılan kabul iki biçimde başlar: odaklı olmayan akışta o
  // müşterinin araç listesi (#822), odaklı akışta kamera + yeni plakada bu
  // müşteriyle dolu sahip kartı (#832).
  const listCustomer = initialCustomer && !initialMethod
    ? { id: initialCustomer.id, label: displayCustomerName(initialCustomer) }
    : null
  const [initialOwner] = useState(() =>
    initialCustomer && initialMethod ? ownerSeedFromCustomer(initialCustomer) : null,
  )
  const [step, setStep] = useState<EntryStep>("capture")
  const [method, setMethod] = useState<EntryMethod>(listCustomer ? "customer" : startMethod)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  // Araç
  const [fields, setFields] = useState<VehicleFields>(EMPTY_VEHICLE_FIELDS)
  const [confidence, setConfidence] = useState<Record<string, number | undefined>>({})
  const [showDetails, setShowDetails] = useState(false)
  const [catalogIds, setCatalogIds] = useState<{ brandId?: number; modelId?: number; vehicleTypeId?: number }>({})
  const [duplicate, setDuplicate] = useState<VehicleResult | null>(null)
  // Ruhsattan okunan plaka/şase, kullanıcının girdiğinden farklıysa: üzerine
  // yazılmaz, burada listelenir ve kullanıcı hangisini kullanacağını seçer.
  const [conflicts, setConflicts] = useState<IdentityConflict[]>([])

  // Sahip
  const [owner, setOwner] = useState<{ id: string; label: string } | null>(listCustomer)
  const [ownerSeed, setOwnerSeed] = useState<OwnerSeed | null>(null)
  const [ownerMode, setOwnerMode] = useState(false)

  // Arama
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UnifiedResult[]>([])
  const [searching, setSearching] = useState(false)
  const [custVehicles, setCustVehicles] = useState<CustVehicle[]>([])
  const [custVehiclesLoading, setCustVehiclesLoading] = useState(!!listCustomer)
  const [pickedCustomer, setPickedCustomer] = useState<{ id: string; label: string } | null>(listCustomer)
  // Araç listesi hangi müşteri için isteniyor: geç gelen yanıt, kullanıcı o
  // arada başka müşteriye geçtiyse yeni müşterinin altına eskinin araçlarını
  // yazmasın (yoksa seçim customerId: Y + X'in aracı olurdu).
  const custVehiclesFor = useRef<string | null>(listCustomer?.id ?? null)
  // "vehiclePhoto": araç bilgileri ekranındaki fotoğraf kartı, plaka ekranıyla
  // AYNI tarayıcıyı açar; okunan kare kabul fotoğrafı olur.
  // Odaklı plaka akışında (?entry=plate) tarayıcı açılışta hazır gelir: işin
  // ilk adımı zaten aracın önünü çekmek. Yazmayı seçen "El ile gir" ile kutuya
  // düşer. Araç URL'den geldiyse (#832) plaka zaten bilinir: kamera "vehiclePhoto"
  // kipinde açılır — kare kabul fotoğrafı olur, plaka alanı değişmez.
  // "registration": "Ruhsattan doldur" — aynı tam ekran kamera kabuğunda ruhsat.
  const [scanner, setScanner] = useState<"plate" | "vehiclePhoto" | "registration" | null>(
    initialMethod === "plate" ? (hasPrefilledVehicle ? "vehiclePhoto" : "plate") : null,
  )
  const plateQueryRef = useRef<HTMLInputElement>(null)
  // Kamera kapatılınca (X ya da "El ile gir") kullanıcı yazmaya döner: arama
  // kutusu odak alır. Kutu tarayıcının altında hep DOM'da olduğu için bir
  // sonraki karede odaklamak yeter.
  const closePlateScannerToTyping = () => {
    setScanner(null)
    requestAnimationFrame(() => plateQueryRef.current?.focus())
  }
  // Ruhsat okuma sayacı. Servisler arası geçmiş kilidi ruhsat taramasıyla açılır
  // (BAK-77); tarama sunucuda hakkı yazdığı anda paneli yeniden çektirmek için
  // bu sayaç artar.
  const [ocrUnlockKey, setOcrUnlockKey] = useState(0)

  // Odaklı plaka akışı (?entry=plate): araç bilgileri ekranı plaka → müşteri
  // kartı → (elle girişte) zorunlu araç fotoğrafı → opsiyonel ruhsat → araç
  // alanları sırasıyla tek ekrandır; ayrı "Müşteri" adımı yaşanmaz.
  const focused = initialMethod != null
  // Odaklı plaka akışında ruhsat alanları ayrı bir "Ruhsat bilgileri" ekranında
  // kontrol edilir / elle girilir; araç bilgileri ekranının yerine geçer.
  const [ruhsatView, setRuhsatView] = useState(false)
  const plateFirst = focused && method === "plate"
  const photoFeature = entitlements.photoChecklist

  // Araç fotoğrafı (kabul "Ön" fotoğrafı olacak)
  const [vehiclePhoto, setVehiclePhotoState] = useState<PendingVehiclePhoto | null>(null)
  const [photoMissing, setPhotoMissing] = useState(false)
  const [photoPreparing, setPhotoPreparing] = useState(false)
  // Fotoğraftan okunan plaka (kompakt): fotoğraf ve o sırada girilen müşteri
  // bilgileri bu araca ait. Plaka sonradan değişirse "aynı araç mı" sorulur.
  const [photoPlate, setPhotoPlate] = useState<string | null>(null)
  // Fotoğraftan doldurulan marka; "farklı araç" denirse yalnız o geri alınır.
  const photoBrand = useRef("")

  // Müşteri kartı (yalnız odaklı plaka akışı)
  const [ownerForm, setOwnerForm] = useState<OwnerFields>(initialOwner?.fields ?? EMPTY_OWNER_FIELDS)
  // Plaka kayıtlıysa kartı dolduran sahip: düzenleme bununla karşılaştırılır.
  const [ownerOriginal, setOwnerOriginal] = useState<{ vehicleId: string; customerId: string; fields: OwnerFields } | null>(null)
  const [ownerLoading, setOwnerLoading] = useState(false)
  const [ownerDupes, setOwnerDupes] = useState<ExistingCustomer[]>([])
  const ownerPrefillFor = useRef("")
  // Müşteri açıldı ama araç kaydı düştüyse tekrar denemede ikinci müşteri açılmasın.
  // Müşteriden açılan odaklı kabulde (#832) bu müşteri "zaten var" sayılır:
  // kart değişmeden onaylanırsa yeni müşteri açılmaz, onun üstüne araç açılır.
  const createdOwner = useRef<{ id: string; label: string; key: string } | null>(ownerClaim(initialOwner))

  // Onay
  const [confirmed, setConfirmed] = useState<{ vehicleId: string; customerId: string; label: string; sublabel: string } | null>(null)
  // Kayıtlı araç bulunarak mı gelindi? Öyleyse araç/sahip adımları hiç yaşanmadı;
  // ray da onları göstermez ve "Geri" doğrudan yakalama adımına döner.
  const [foundExisting, setFoundExisting] = useState(false)

  const knownVehicle = foundExisting
  const steps = entryStepLabels(method, { knownVehicle })
  const completed: string[] = []
  if (confirmed) completed.push("capture", "vehicle", "owner")

  const vinResolve = useVinResolve({
    onBrand: (b) => { setField("brand", b.name); setCatalogIds((p) => ({ ...p, brandId: b.id })) },
    onModel: (m) => { setField("model", m.name); setCatalogIds((p) => ({ ...p, modelId: m.id })) },
    onCandidate: (c: VinCandidate) => {
      setCatalogIds({ brandId: c.brandId, modelId: c.modelId, vehicleTypeId: c.vehicleTypeId })
      setFields((prev) => ({
        ...prev,
        brand: c.brandName,
        model: c.modelName,
        engineDisplacement: prev.engineDisplacement || (c.cc != null ? String(c.cc) : prev.engineDisplacement),
        enginePower: prev.enginePower || (c.kwt != null ? `${c.kwt} kW` : prev.enginePower),
        fuelType: prev.fuelType || tecdocFuelToFormValue(c.fuelType) || prev.fuelType,
        modelYear: prev.modelYear || (c.yearFrom ? String(Number(c.yearFrom.slice(0, 4))) : prev.modelYear),
      }))
    },
  })

  function setField(key: keyof VehicleFields, v: string) {
    setFields((prev) => ({ ...prev, [key]: v }))
    // Alanı elle değiştirmek çakışma sorusunu cevaplar: gösterilen uyarı düşer.
    if (key === "plate" || key === "vin") setConflicts((prev) => prev.filter((c) => c.key !== key))
  }

  /**
   * Araç fotoğrafında tanınan markayı yalnız marka alanı BOŞSA yazar: elle
   * girilen ya da ruhsattan okunan marka ezilmez. Model kullanıcıya kalır;
   * seçici markayı katalogda bulup o markanın modellerini yükler.
   */
  function applyPhotoBrand(brand: string | undefined) {
    if (!brand || fields.brand.trim()) return
    photoBrand.current = brand
    setFields((prev) => (prev.brand.trim() ? prev : { ...prev, brand }))
  }

  // Plaka fotoğraftakinden farklı mı? (yalnız odaklı plaka akışı)
  const plateStatus = plateFirst ? photoPlateStatus(vehiclePhoto ? photoPlate : null, fields.plate) : "match"

  // Odaklı plaka akışında doğrudan iş emri: "Devam" doğrulayıp düğmeyi yeşil
  // "Onayla"ya çevirir, "Onayla" kaydeder ve iş emrini açar. Onay, onaylanan
  // EKRAN DURUMUNA bağlıdır: plaka, müşteri kartı, fotoğraf ya da marka
  // değişirse anahtar tutmaz ve düğme "Devam"a geri döner — kullanıcı görmediği
  // bir değişikliği onaylamış olmaz.
  const orderDirect = plateFirst && !!onConfirmOrder
  const armKey = JSON.stringify([fields.plate, fields.brand, ownerForm, vehiclePhoto?.requestId ?? ""])
  const [armedFor, setArmedFor] = useState<string | null>(null)
  const armed = orderDirect && armedFor === armKey

  /** "Onaylıyorum": elle girilen plaka doğru; fotoğraf ve müşteri yeni plakaya bağlanır. */
  function confirmManualPlate() {
    setPhotoPlate(normalizePlate(fields.plate))
    setError("")
  }

  /** "Vazgeç": plaka alanı fotoğraftan (OCR) okunan plakaya geri döner. */
  function revertToPhotoPlate() {
    if (!photoPlate) return
    setField("plate", photoPlate)
    setError("")
  }

  /** Çakışan alanda ruhsattan okunan değeri kullan. */
  function applyScannedValue(c: IdentityConflict) {
    setField(c.key, c.scanned)
    if (c.key === "vin" && entitlements.vinLookup && isValidVin(c.scanned)) {
      void vinResolve.resolve(c.scanned, {
        engineDisplacement: fields.engineDisplacement || undefined,
        enginePower: fields.enginePower || undefined,
        fuelType: fields.fuelType || undefined,
        firstRegistrationDate: fields.firstRegistrationDate || undefined,
        modelYear: fields.modelYear ? Number(fields.modelYear) || undefined : undefined,
      })
    }
  }

  // Odaklı akışta (doğrudan iş emri açan teknisyen akışı) "Araç seçildi" onay
  // ekranı YOK: seçilen ya da yeni açılan kayıtlı araç, plaka yazınca açılan
  // araç ekranına gider — sahip kartı dolu gelir, fotoğraf + "Devam → Onayla"
  // ile iş emri açılır. Böylece her yol aynı tek ekrandan geçer.
  const confirmless = !!onConfirmOrder

  // ——— Dış prefill / geri navigasyon ———
  // URL'de araç id'si varken sihirbaz sıfırdan mount olursa (Adım 3'ten geri dönüş,
  // ruhsat okuyucudan yönlendirme) aracı çekip doğrudan onay adımını kur.
  // Odaklı akışta onay adımı olmadığı için araç ekranı kurulur.
  const hydratedFor = useRef("")
  useEffect(() => {
    const vid = value.vehicleId
    if (!vid || hydratedFor.current === vid || confirmed?.vehicleId === vid) return
    // İşaret BAŞARIDAN SONRA konur. Effect'in başında konsaydı React'in geliştirme
    // modundaki çift çağrısında ilk çalıştırma işareti koyar, cleanup isteği iptal
    // eder ve ikinci çalıştırma erken dönerdi — araç hiç hidrate olmazdı.
    let active = true
    fetch(`/api/vehicles/${vid}`)
      .then((r) => r.json())
      .then((v: unknown) => {
        if (!active || !v || typeof v !== "object" || "error" in v) return
        const veh = v as { id?: string; plate?: string; brand?: string; model?: string; customerId?: string; customer?: CustomerLite | null }
        if (!veh.id) return
        hydratedFor.current = veh.id
        if (confirmless) {
          setMethod("plate")
          setFields((prev) => ({ ...prev, plate: (veh.plate ?? "").toUpperCase() }))
          setRuhsatView(false)
          setStep("vehicle")
          return
        }
        const customerId = veh.customerId || value.customerId
        setConfirmed({
          vehicleId: veh.id,
          customerId,
          label: `${veh.plate ?? ""} — ${veh.brand ?? ""} ${veh.model ?? ""}`.trim(),
          sublabel: `Sahip: ${displayCustomerName(veh.customer ?? null)}`,
        })
        setFoundExisting(true)
        setStep("confirm")
        if (!value.customerId && customerId) onChange({ customerId, vehicleId: veh.id })
      })
      .catch(() => {})
    return () => { active = false }
  }, [value.vehicleId, value.customerId, confirmed?.vehicleId, onChange, confirmless])

  // ——— Arama (plaka/müşteri) ———
  useEffect(() => {
    if (step !== "capture" || method !== "plate") return
    const q = query.trim()
    // Boş/eksik sorguda listeyi temizle. setState doğrudan effect gövdesinde
    // çağrılmıyor (react-hooks/set-state-in-effect) — aynı desen picker'da da var.
    // Plaka modunda yalnız il kodu ("34") aranmaz; il kodundan sonra harf beklenir.
    if (!isPlateOrCustomerQueryReady(q)) {
      const clear = setTimeout(() => { setResults([]); setSearching(false) }, 0)
      return () => clearTimeout(clear)
    }
    // Sorgu değişince uçuştaki istek iptal edilir: "34 K" yanıtı, kutu "34"e
    // döndükten sonra gelip listeyi geri doldurmasın.
    const controller = new AbortController()
    const t = setTimeout(() => {
      setSearching(true)
      fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d) => setResults(Array.isArray(d?.results) ? d.results : []))
        .catch(() => { if (!controller.signal.aborted) setResults([]) })
        .finally(() => { if (!controller.signal.aborted) setSearching(false) })
    }, 250)
    return () => { clearTimeout(t); controller.abort() }
  }, [query, step, method])

  // ——— Müşteriden açılan kabul, odaklı olmayan akış (#822): araç listesi ———
  // Müşteri ilk durumda seçili; burada yalnız araçları çekilir (setState
  // yanıt geldiğinde — react-hooks/set-state-in-effect).
  const initialCustomerId = listCustomer?.id
  useEffect(() => {
    if (!initialCustomerId) return
    let active = true
    const current = () => active && custVehiclesFor.current === initialCustomerId
    fetchCustomerVehicles(initialCustomerId)
      .then((list) => { if (current()) setCustVehicles(list) })
      .catch(() => { if (current()) setCustVehicles([]) })
      .finally(() => { if (current()) setCustVehiclesLoading(false) })
    return () => { active = false }
  }, [initialCustomerId])

  // ——— Plaka çakışması: araç adımında girilen plaka zaten kayıtlıysa uyar ———
  useEffect(() => {
    if (step !== "vehicle") return
    const plate = normalizePlate(fields.plate)
    if (plate.length < 5) {
      const clear = setTimeout(() => setDuplicate(null), 0)
      return () => clearTimeout(clear)
    }
    let active = true
    const t = setTimeout(() => {
      fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(plate)}`)
        .then((r) => r.json())
        .then((d: unknown) => {
          if (!active) return
          const list = Array.isArray((d as { results?: unknown })?.results) ? (d as { results: UnifiedResult[] }).results : []
          const match = findExactPlateMatch(list, fields.plate)
          setDuplicate(match ? (list.find((r) => r.kind === "vehicle" && r.vehicleId === match.vehicleId) as VehicleResult) ?? null : null)
        })
        .catch(() => { if (active) setDuplicate(null) })
    }, 400)
    return () => { active = false; clearTimeout(t) }
  }, [step, fields.plate])

  // Hata mesajı adımın en üstünde; telefonda Devam ekranın altında kaldığı için
  // yeni bir hata görünür alana kaydırılır.
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [error])

  // Telefon çakışması da adımın en üstünde gösterilir; aynı nedenle kaydırılır.
  const ownerDupesRef = useRef<HTMLDivElement>(null)
  const hasOwnerDupes = ownerDupes.length > 0
  useEffect(() => {
    if (hasOwnerDupes) ownerDupesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [hasOwnerDupes])

  // ——— Odaklı plaka akışı: plaka kayıtlıysa müşteri kartını sahiple doldur ———
  const dupVehicleId = duplicate?.vehicleId ?? ""
  useEffect(() => {
    if (!plateFirst) return
    if (!dupVehicleId) {
      // Plaka kayıtlı bir araçtan yenisine döndü: sahibin bilgileri yeni
      // müşteriye taşınmasın, kart boşalsın — müşteriden açılan kabulde (#832)
      // o müşteriye döner.
      if (!ownerPrefillFor.current) return
      const t = setTimeout(() => {
        ownerPrefillFor.current = ""
        setOwnerOriginal(null)
        setOwnerForm(initialOwner?.fields ?? EMPTY_OWNER_FIELDS)
        setOwnerDupes([])
      }, 0)
      return () => clearTimeout(t)
    }
    if (ownerPrefillFor.current === dupVehicleId) return
    let active = true
    const t = setTimeout(() => setOwnerLoading(true), 0)
    fetch(`/api/vehicles/${dupVehicleId}`)
      .then((r) => r.json())
      .then((v: unknown) => {
        if (!active || !v || typeof v !== "object" || "error" in v) return
        const veh = v as { customerId?: string; customer?: CustomerLite | null }
        if (!veh.customerId || !veh.customer) return
        const fromCustomer = ownerFieldsFromCustomer(veh.customer)
        const prefilled = { ...fromCustomer, phone: formatPhoneTR(fromCustomer.phone) }
        ownerPrefillFor.current = dupVehicleId
        setOwnerForm(prefilled)
        setOwnerOriginal({ vehicleId: dupVehicleId, customerId: veh.customerId, fields: prefilled })
        setOwnerDupes([])
      })
      .catch(() => {})
      .finally(() => { if (active) setOwnerLoading(false) })
    return () => { active = false; clearTimeout(t) }
  }, [plateFirst, dupVehicleId, initialOwner])

  /**
   * Bekleyen araç karesini değiştirir; eski önizleme URL'i bırakılır. `plate`:
   * karede okunan plaka — kare hangi araca aitse onu bağlar.
   */
  function setVehiclePhoto(next: PendingVehiclePhoto | null, plate?: string) {
    setPhotoPlate(next && plate ? normalizePlate(plate) : null)
    setVehiclePhotoState((prev) => {
      if (prev && prev.previewUrl !== next?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return next
    })
    onVehiclePhotoChange?.(next)
  }

  /**
   * Plaka tarayıcısının karesi aracın önüdür: fotoğraf paketteyse kabul
   * fotoğrafı olarak tutulur. Kare "Dosyadan" seçilmiş ham bir dosya da
   * olabilir; yükleme sınırına takılmasın diye önce küçültülür.
   */
  async function keepScannedFrame(
    image: { dataUrl: string } | null,
    source: PendingVehiclePhoto["source"],
    plate: string,
  ) {
    if (!image || !photoFeature) return
    const blob = dataUrlToBlob(image.dataUrl)
    if (!blob) return
    setPhotoPreparing(true)
    try {
      const raw = new File([blob], "arac-on.jpg", { type: blob.type || "image/jpeg" })
      const compressed = await compressImageForUpload(raw)
      if (!compressed.ok) { setError(compressed.error); return }
      setVehiclePhoto(createPendingVehiclePhoto(compressed.file, source), plate)
      setPhotoMissing(false)
      setError("")
    } finally {
      setPhotoPreparing(false)
    }
  }

  function onQueryChange(raw: string) {
    const next = uppercaseIfPlateLike(raw)
    setQuery(next)
    // Kutu tamamen silindiyse taranan araç artık bu kabulün aracı değil.
    if (!next.trim() && vehiclePhoto?.source === "scan") setVehiclePhoto(null)
  }

  // ——— Geçişler ———
  function selectExisting(r: VehicleResult) {
    if (confirmless && !finishesOrder()) { openPlateScreen(r.plate); return }
    setFoundExisting(true)
    setConfirmed({ vehicleId: r.vehicleId, customerId: r.customerId, label: r.label, sublabel: r.sublabel })
    onChange({ customerId: r.customerId, vehicleId: r.vehicleId })
    if (finishesOrder()) { void confirmOrder({ customerId: r.customerId, vehicleId: r.vehicleId }); return }
    setStep("confirm")
  }

  /**
   * Araç çözüldüğünde onay ekranı yerine iş emri mi açılacak? Yalnız odaklı
   * plaka akışının araç bilgileri ekranından ("Onayla"). Odaklı akışın diğer
   * yolları (arama sonucu, müşterinin aracı) önce o ekrana gider.
   */
  function finishesOrder() {
    return orderDirect && step === "vehicle"
  }

  /** Odaklı akış: kayıtlı aracı plaka ekranında aç (onay ekranı yok). */
  function openPlateScreen(plate: string) {
    setMethod("plate")
    goToVehicleStep({ plate })
  }

  /** `true`: iş emri açıldı, çağıran yönlendiriyor. */
  async function confirmOrder(v: { customerId: string; vehicleId: string }): Promise<boolean> {
    if (!onConfirmOrder) return false
    setSaving(true)
    setError("")
    let err: string | null
    try {
      err = await onConfirmOrder(v)
    } catch {
      err = "İş emri oluşturulamadı. Tekrar deneyin."
    }
    // Başarıda çağıran yönlendirir: düğme sayfa değişene kadar "Oluşturuluyor…"
    // kalır, aradaki anda ikinci bir dokunuş ikinci iş emri açmasın.
    if (err) {
      setError(err)
      setSaving(false)
      return false
    }
    return true
  }

  /**
   * Ruhsat OCR sonucunu forma uygular. Ruhsat adımından da (alanlar boş), araç
   * bilgileri adımından da (kullanıcı plaka/şase girmiş olabilir) çağrılır; bu
   * yüzden kimlik çakışması burada tek yerde ele alınır.
   */
  function applyOcr({ values, confidence: conf, owner: ocrOwner }: RuhsattanOkuResult) {
    // Ruhsat okundu ⇒ sunucu servisler arası geçmiş hakkını yazdı (BAK-77).
    setOcrUnlockKey((k) => k + 1)
    const found = identityConflicts({ plate: fields.plate, vin: fields.vin }, { plate: values.plate, vin: values.vin })
    setConflicts(found)
    const keep = new Set(found.map((c) => c.key))
    setFields((prev) => ({
      ...prev,
      plate: keep.has("plate") ? prev.plate : values.plate || prev.plate,
      brand: values.brand || prev.brand,
      model: values.model || prev.model,
      vehicleType: ocrVehicleTypeToSlug(values.vehicleType) || prev.vehicleType,
      modelYear: values.modelYear || prev.modelYear,
      vin: keep.has("vin") ? prev.vin : values.vin || prev.vin,
      engineNo: values.engineNo || prev.engineNo,
      firstRegistrationDate: values.registrationDate || prev.firstRegistrationDate,
      commercialName: values.commercialName || prev.commercialName,
      fuelType: ocrFuelToSlug(values.fuelType) || prev.fuelType,
      engineDisplacement: values.engineDisplacement || prev.engineDisplacement,
      enginePower: values.enginePower || prev.enginePower,
      inspectionValidUntil: values.inspectionValidUntil || prev.inspectionValidUntil,
    }))
    // Korunan alanın değeri ruhsattan gelmedi; OCR güven skorunu ona yapıştırmak
    // kullanıcının kendi girdisini "düşük güvenli okuma" gibi sarıya boyardı.
    setConfidence({
      plate: keep.has("plate") ? undefined : conf.plate,
      brand: conf.brand, model: conf.model, vehicleType: conf.vehicleType,
      modelYear: conf.modelYear, vin: keep.has("vin") ? undefined : conf.vin, engineNo: conf.engineNo,
      firstRegistrationDate: conf.registrationDate, commercialName: conf.commercialName,
      fuelType: conf.fuelType, engineDisplacement: conf.engineDisplacement,
      enginePower: conf.enginePower, inspectionValidUntil: conf.inspectionValidUntil,
    })
    if (ocrOwner.label) {
      setOwnerSeed(ocrOwner)
      // Odaklı plaka akışında ruhsattaki sahip, boş müşteri kartını doldurur
      // (kayıtlı plakada kart sahibin kendi bilgileriyle dolu, dokunulmaz).
      if (plateFirst && !ownerOriginal) {
        setOwnerForm((prev) => {
          if (prev.name.trim() || prev.companyName.trim()) return prev
          return ocrOwner.isCorporate
            ? { ...prev, type: "corporate", companyName: ocrOwner.companyName || ocrOwner.label }
            : { ...prev, type: "individual", name: [ocrOwner.firstName, ocrOwner.lastName].filter(Boolean).join(" ") }
        })
      }
    }
    setShowDetails(true)
    // Çakışmada kullanıcının şasesi korunuyor; onu zaten girdiği adımda
    // sorguladık — ruhsattaki farklı şase için kota harcama. Şaseden tanıma
    // ayrı bir ek özellik: kapalıysa sorgu 403 olurdu, hiç gönderilmez.
    if (entitlements.vinLookup && !keep.has("vin") && isValidVin(values.vin)) {
      void vinResolve.resolve(values.vin, {
        engineDisplacement: values.engineDisplacement || undefined,
        enginePower: values.enginePower || undefined,
        fuelType: values.fuelType || undefined,
        firstRegistrationDate: values.registrationDate || undefined,
        modelYear: values.modelYear ? Number(values.modelYear) || undefined : undefined,
      })
    }
    setStep("vehicle")
  }

  function goToVehicleStep(seed: { plate?: string; vin?: string } = {}) {
    setFields((prev) => ({
      ...prev,
      plate: seed.plate ? seed.plate.toUpperCase() : prev.plate,
      vin: seed.vin ? normalizeVin(seed.vin) : prev.vin,
    }))
    if (seed.vin) {
      setShowDetails(true)
      if (entitlements.vinLookup) void vinResolve.resolve(normalizeVin(seed.vin), {})
    }
    setError("")
    setRuhsatView(false)
    setStep("vehicle")
  }

  function leaveVehicleStep() {
    const msg = vehicleFieldError(fields)
    if (msg) { setError(msg); return }
    if (duplicate) { setError("Bu plaka zaten kayıtlı — aşağıdan mevcut aracı seçin."); return }
    setError("")
    setStep("owner")
  }

  async function createVehicle(ownerArg?: { id: string; label: string }) {
    const target = ownerArg ?? owner
    if (!target) { setError("Önce müşteriyi seçin veya oluşturun."); return }
    const msg = vehicleFieldError(fields, { modelOptional: plateFirst })
    if (msg) { setError(msg); setStep("vehicle"); return }
    setSaving(true)
    setError("")
    // İş emri açıldıysa sayfa değişiyor: düğme "Oluşturuluyor…"da kalır.
    let opening = false
    try {
      const vf = new FormData()
      vf.set("customerId", target.id)
      vf.set("plate", fields.plate)
      vf.set("brand", fields.brand)
      vf.set("model", fields.model)
      if (fields.modelYear) vf.set("modelYear", fields.modelYear)
      vf.set("vehicleType", fields.vehicleType)
      vf.set("commercialName", fields.commercialName)
      vf.set("vin", fields.vin)
      vf.set("engineNo", fields.engineNo)
      vf.set("fuelType", fields.fuelType)
      vf.set("engineDisplacement", fields.engineDisplacement)
      vf.set("enginePower", fields.enginePower)
      vf.set("firstRegistrationDate", fields.firstRegistrationDate)
      vf.set("inspectionValidUntil", fields.inspectionValidUntil)
      // Şase teyidi GÖNDERİLMEZ: sunucu VIN'den türetiyor (#179, deriveVinConfirmed).
      if (catalogIds.brandId) vf.set("catalogBrandId", String(catalogIds.brandId))
      if (catalogIds.modelId) vf.set("catalogModelId", String(catalogIds.modelId))
      if (catalogIds.vehicleTypeId) vf.set("catalogVehicleTypeId", String(catalogIds.vehicleTypeId))
      const res = await fetch("/api/vehicles", { method: "POST", body: vf })
      const data = (await res.json()) as { success?: boolean; id?: string; error?: string }
      if (!data?.success || !data.id) { setError(data?.error || "Araç oluşturulamadı"); return }
      // Odaklı akışta müşteriden açılan yeni araç da onay ekranına değil, plaka
      // ekranına gider (fotoğraf + Onayla orada).
      if (confirmless && !finishesOrder()) { openPlateScreen(fields.plate); return }
      setFoundExisting(false)
      setConfirmed({
        vehicleId: data.id,
        customerId: target.id,
        label: `${fields.plate} — ${fields.brand} ${fields.model}`.trim(),
        sublabel: `Sahip: ${target.label}`,
      })
      onChange({ customerId: target.id, vehicleId: data.id })
      if (finishesOrder()) {
        opening = await confirmOrder({ customerId: target.id, vehicleId: data.id })
        return
      }
      setStep("confirm")
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyin.")
    } finally {
      if (!opening) setSaving(false)
    }
  }

  /** Odaklı plaka akışı: plaka, müşteri, fotoğraf ve (yeni araçta) araç alanları. */
  function plateFirstError(): string | null {
    if (!fields.plate.trim()) return "Plaka zorunludur."
    if (plateStatus === "typing") return "Plakayı eksiksiz girin."
    if (plateStatus === "mismatch") return "Plakayı el ile değiştirdiniz: onaylayın ya da vazgeçin."
    const ownerErr = ownerFieldError(ownerForm)
    if (ownerErr) return ownerErr
    if (photoFeature && !vehiclePhoto) {
      setPhotoMissing(true)
      return "Aracın fotoğrafını çekin."
    }
    // Araç alanları bu ekranda sorulmuyor: marka fotoğraftan (ya da ruhsattan)
    // gelir, model sonra araç kaydından tamamlanır.
    if (!duplicate && !fields.brand.trim()) {
      return entitlements.ocrIntake
        ? "Marka fotoğraftan okunamadı. Fotoğrafı tekrar çekin ya da ruhsattan doldurun."
        : "Marka fotoğraftan okunamadı. Fotoğrafı tekrar çekin ya da markayı \"Ruhsat bilgileri\"nden girin."
    }
    if (!duplicate) return vehicleFieldError(fields, { modelOptional: true })
    return null
  }

  /** "Devam" (doğrudan iş emri): yalnız doğrular, düğmeyi "Onayla"ya çevirir. */
  function armOrder() {
    if (saving || ownerLoading) return
    const msg = plateFirstError()
    if (msg) { setError(msg); return }
    setError("")
    setArmedFor(armKey)
  }

  async function submitPlateFirst(opts: { allowDuplicatePhone?: boolean } = {}) {
    if (saving || ownerLoading) return
    const msg = plateFirstError()
    if (msg) { setError(msg); return }
    setError("")

    // Kayıtlı plaka: araç ve sahibi zaten var. Kart düzenlendiyse müşteri kaydı
    // güncellenir (sahip değişmez), sonra mevcut araç seçilir.
    if (duplicate) {
      if (!ownerOriginal) return
      if (ownerFieldsChanged(ownerOriginal.fields, ownerForm)) {
        setSaving(true)
        try {
          const res = await updateCustomerContactAction(ownerOriginal.customerId, ownerFormData(ownerForm, !!opts.allowDuplicatePhone))
          if ("error" in res && res.error) {
            setOwnerDupes(duplicatesFrom(res))
            setError(res.error)
            return
          }
        } catch {
          setError("Müşteri bilgileri güncellenemedi. Tekrar deneyin.")
          return
        } finally {
          setSaving(false)
        }
      }
      setOwnerDupes([])
      selectExisting({ ...duplicate, customerId: ownerOriginal.customerId, sublabel: `Sahip: ${ownerLabel(ownerForm)}` })
      return
    }

    // Yeni plaka: önce müşteri, sonra araç.
    const key = JSON.stringify(ownerForm)
    let created = createdOwner.current?.key === key ? createdOwner.current : null
    if (!created) {
      setSaving(true)
      try {
        const res = await fetch("/api/customers", { method: "POST", body: ownerFormData(ownerForm, !!opts.allowDuplicatePhone) })
        const data = (await res.json()) as DuplicatePhoneResponse & { success?: boolean; id?: string }
        const existing = duplicatesFrom(data)
        if (existing.length) {
          // Mesaj kartın içinde gösterilir; üstte ayrı bir hata kutusu tekrar etmez.
          setOwnerDupes(existing)
          setError("")
          return
        }
        if (!data.success || !data.id) { setError(data.error || "Müşteri oluşturulamadı"); return }
        created = { id: data.id, label: ownerLabel(ownerForm), key }
        createdOwner.current = created
      } catch {
        setError("Bir hata oluştu, lütfen tekrar deneyin.")
        return
      } finally {
        setSaving(false)
      }
    }
    setOwnerDupes([])
    setOwner({ id: created.id, label: created.label })
    await createVehicle(created)
  }

  /** Telefon başka müşterideyse: yeni müşteri açmak yerine onu sahip yap. */
  async function pickExistingOwner(c: ExistingCustomer) {
    const msg = plateFirstError()
    if (msg) { setError(msg); return }
    setOwnerDupes([])
    setError("")
    createdOwner.current = { id: c.id, label: c.label, key: JSON.stringify(ownerForm) }
    setOwner({ id: c.id, label: c.label })
    await createVehicle({ id: c.id, label: c.label })
  }

  async function applyNewOwner(customerId: string, label: string) {
    if (!confirmed) return
    const res = await changeVehicleOwnerAction(confirmed.vehicleId, customerId)
    if ("error" in res) { setError(res.error || "Sahip değiştirilemedi"); return }
    setConfirmed({ ...confirmed, customerId, sublabel: `Sahip: ${label}` })
    onChange({ customerId, vehicleId: confirmed.vehicleId })
    setOwnerMode(false)
  }

  // "Başka araç seç": akışı baştan, başlangıç aramasıyla başlatır (#817, #822);
  // odaklı plaka akışında kamera açılıştaki gibi hazır gelir.
  function restart() {
    setStep("capture")
    setRuhsatView(false)
    setMethod(startMethod)
    if (initialMethod === "plate") setScanner("plate")
    setConfirmed(null)
    setFoundExisting(false)
    setOwner(null)
    setOwnerSeed(null)
    setOwnerMode(false)
    setFields(EMPTY_VEHICLE_FIELDS)
    setConfidence({})
    setCatalogIds({})
    setDuplicate(null)
    setConflicts([])
    setQuery("")
    setResults([])
    clearPickedCustomer()
    setError("")
    setVehiclePhoto(null)
    setPhotoMissing(false)
    photoBrand.current = ""
    setOwnerForm(initialOwner?.fields ?? EMPTY_OWNER_FIELDS)
    setOwnerOriginal(null)
    setOwnerDupes([])
    ownerPrefillFor.current = ""
    createdOwner.current = ownerClaim(initialOwner)
    hydratedFor.current = ""
    vinResolve.reset()
    onChange({ customerId: "", vehicleId: "" })
  }

  function goBack() {
    setError("")
    const target = entryBackTarget(step, method, { knownVehicle, startMethod })
    if (target.method !== method) {
      // Müşterinin araç listesinden plaka/müşteri aramasına dönüş (#817): seçim
      // ve önceki arama bırakılır, kutu boş açılır.
      setMethod(target.method)
      setQuery("")
      setResults([])
      clearPickedCustomer()
      // pickCustomer sahibi de yazar; plaka aramasında yeni araç bu müşteriye
      // sessizce bağlanmasın.
      setOwner(null)
    }
    setStep(target.step)
  }

  function pickCustomer(customerId: string, label: string) {
    setPickedCustomer({ id: customerId, label })
    setOwner({ id: customerId, label })
    custVehiclesFor.current = customerId
    setCustVehicles([])
    setCustVehiclesLoading(true)
    const current = () => custVehiclesFor.current === customerId
    fetchCustomerVehicles(customerId)
      .then((list) => { if (current()) setCustVehicles(list) })
      .catch(() => { if (current()) setCustVehicles([]) })
      .finally(() => { if (current()) setCustVehiclesLoading(false) })
  }

  /** Seçili müşteriyi ve (uçuştaki isteği geçersiz kılarak) araç listesini bırakır. */
  function clearPickedCustomer() {
    custVehiclesFor.current = null
    setPickedCustomer(null)
    setCustVehicles([])
    setCustVehiclesLoading(false)
  }

  const vehicleHits = results.filter((r): r is VehicleResult => r.kind === "vehicle")
  const customerHits = results.filter((r): r is Extract<UnifiedResult, { kind: "customer" }> => r.kind === "customer")
  const plateEmptyText = !query.trim()
    ? ""
    : isPlateOrCustomerQueryReady(query)
      ? `«${query.trim()}» için kayıtlı araç bulunamadı.`
      : "Aramak için il kodundan sonra en az bir harf yazın (ör. 34 A)."
  const stepIndex = steps.findIndex((s) => s.id === step)
  // Doğrudan giriş (initialMethod): adım rayı ve "Adım N" etiketi gösterilmez —
  // teknisyen tek bir işe (plakayı bulmaya) odaklanır.
  const stepEyebrow = focused ? undefined : `Adım ${stepIndex + 1}`
  const confirmedParts = confirmed ? confirmedVehicleParts(confirmed.label, confirmed.sublabel) : null

  // Hangi yoldan gelinirse gelinsin (plaka araması ya da müşteri) ruhsat araç
  // bilgileri ekranında da okutulabilir — alanları elle doldurmak zorunda kalmayın.
  // Ruhsat OCR ek özellik: kapalıysa kart yerine "Ek özellik" notu (#828).
  const ruhsatCard = (
    <AddonGate feature="ocrIntake" enabled={entitlements.ocrIntake} showUpsell={entitlements.showAddonUpsell}>
      <RuhsattanOku
        title="Ruhsattan otomatik doldur"
        description="Ruhsatı kamerayla çekin ya da dosyadan seçin; aşağıdaki alanlar dolsun."
        onResult={applyOcr}
      />
    </AddonGate>
  )

  const conflictsBox = conflicts.length > 0 ? (
    <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
      <p className="flex items-start gap-2 text-sm font-medium text-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-strong" />
        Ruhsattan okunan bilgi girdiğinizden farklı — girdiğiniz değer korundu.
      </p>
      {conflicts.map((c) => (
        <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card p-2">
          <span className="min-w-0 text-sm">
            <span className="font-medium text-foreground">{c.label}:</span>{" "}
            <span className="text-muted-foreground">girilen</span> {c.current}{" "}
            <span className="text-muted-foreground">· ruhsatta</span> {c.scanned}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => applyScannedValue(c)}>
            Ruhsattakini kullan
          </Button>
        </div>
      ))}
    </div>
  ) : null

  return (
    <div className="space-y-5">
      {!focused && <WizardStepper compact steps={steps} currentId={step} completedIds={completed} />}

      {error && (
        <Alert ref={errorRef} variant="destructive" className="scroll-mt-20">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ——— Adım: yakalama — plaka/müşteri araması ——— */}
      {step === "capture" && method === "plate" && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={stepEyebrow}
            title={focused ? "Müşteri adı veya plaka ile arayın" : "Plakayı arayın"}
            description={focused ? undefined : "Kayıtlı aracı plakasıyla bulun. Kayıt yoksa aynı plakayla yeni araç açabilirsiniz."}
            large={focused}
          />
          {focused ? (
            // Kamera düğmesi kutunun içinde: dar telefonda yazı alanı daralmasın.
            <InputGroup className="h-14">
              <InputGroupInput
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Müşteri Adı veya Plaka girin"
                aria-label="Plaka veya müşteri"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                ref={plateQueryRef}
                className="h-full px-3 text-xl font-semibold tracking-wide placeholder:text-[15px] placeholder:font-normal placeholder:tracking-normal min-[380px]:placeholder:text-base md:h-full md:text-xl"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-sm" aria-label="Plakayı kamerayla tara" onClick={() => setScanner("plate")} className="size-11">
                  <ScanLine className="size-6" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          ) : (
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Plaka veya müşteri ara…"
                aria-label="Plaka veya müşteri"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                className="flex-1 font-semibold tracking-wide"
              />
              <Button type="button" variant="outline" size="icon" aria-label="Plakayı kamerayla tara" onClick={() => setScanner("plate")}>
                <ScanLine className="size-4" />
              </Button>
            </div>
          )}
          {focused ? (
            // Tek iş: birincil eylem kutunun hemen altında, sonuçlar onun altında
            // (yöntem değiştirme bu akışta sunulmaz).
            <>
              <Button variant="foreground"
                type="button"
                className="h-14 w-full gap-2 text-lg md:h-14"
                disabled={!query.trim()}
                onClick={() => goToVehicleStep({ plate: query.trim() })}
              >
                Bu plakayla yeni araç <ChevronRight className="size-5" />
              </Button>
              <SearchHits
                large={focused}
                loading={searching}
                hits={vehicleHits}
                customers={customerHits}
                emptyText={plateEmptyText}
                onPick={selectExisting}
                onPickCustomer={(c) => { setMethod("customer"); setQuery(""); setResults([]); pickCustomer(c.customerId, c.label) }}
              />
            </>
          ) : (
            <>
              <SearchHits
                loading={searching}
                hits={vehicleHits}
                customers={customerHits}
                emptyText={plateEmptyText}
                onPick={selectExisting}
                onPickCustomer={(c) => { setMethod("customer"); setQuery(""); setResults([]); pickCustomer(c.customerId, c.label) }}
              />
              <WizardActions>
                <Button variant="foreground"
                  type="button"
                  className="gap-2"
                  disabled={!query.trim()}
                  onClick={() => goToVehicleStep({ plate: query.trim() })}
                >
                  Bu plakayla yeni araç <ChevronRight className="size-4" />
                </Button>
              </WizardActions>
            </>
          )}
        </div>
      )}

      {step === "capture" && method === "customer" && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={stepEyebrow}
            title="Müşteriyi bulun"
            description="Kayıtlı müşteriyi arayın ya da yeni müşteri oluşturun; sonra aracını seçin."
          />
          {pickedCustomer ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <User className="size-4 text-primary" /> {pickedCustomer.label}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={clearPickedCustomer}>
                  Değiştir
                </Button>
              </div>
              <p className="text-sm font-medium text-foreground">Aracı seçin</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {custVehicles.map((v) => (
                  <VehicleHitCard
                    key={v.id}
                    plate={v.plate}
                    vehicleName={`${v.brand} ${v.model}`.trim()}
                    large={focused}
                    onClick={() =>
                      selectExisting({
                        kind: "vehicle",
                        vehicleId: v.id,
                        customerId: pickedCustomer.id,
                        plate: v.plate,
                        label: `${v.plate} — ${v.brand} ${v.model}`.trim(),
                        sublabel: `Sahip: ${pickedCustomer.label}`,
                      })
                    }
                  />
                ))}
                {custVehiclesLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Araçlar yükleniyor…
                  </p>
                ) : !custVehicles.length && (
                  <p className="text-sm text-muted-foreground">Bu müşterinin kayıtlı aracı yok.</p>
                )}
              </div>
            </div>
          ) : (
            <CustomerSearchOrCreate onSelected={pickCustomer} />
          )}
          <WizardActions back={method !== startMethod && <Button type="button" variant="outline" onClick={goBack}>Geri</Button>}>
            {pickedCustomer && (
              <Button variant="foreground"
                type="button"
                className="gap-2"
                onClick={() => { setOwner(pickedCustomer); goToVehicleStep() }}
              >
                Bu müşteriye yeni araç <ChevronRight className="size-4" />
              </Button>
            )}
          </WizardActions>
        </div>
      )}

      {/* ——— Adım: araç bilgileri ——— */}
      {step === "vehicle" && !plateFirst && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={stepEyebrow}
            title="Araç bilgileri"
          />
          {ruhsatCard}
          {conflictsBox}
          <EntryVehicleFields
            fields={fields}
            onFieldChange={setField}
            confidence={confidence}
            showDetails={showDetails}
            onToggleDetails={() => setShowDetails((s) => !s)}
            vinResolve={vinResolve}
            vinLookup={entitlements.vinLookup}
            showAddonUpsell={entitlements.showAddonUpsell}
            onBrandChange={(v) => { setField("brand", v); setCatalogIds({}) }}
            onModelChange={(v) => { setField("model", v); setCatalogIds((p) => ({ brandId: p.brandId })) }}
          />
          {duplicate && (
            <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-strong" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-foreground">Bu plaka zaten kayıtlı: {duplicate.label}</p>
                  <p className="text-xs text-muted-foreground">{duplicate.sublabel}</p>
                </div>
              </div>
              <Button variant="foreground" type="button" size="sm" className="w-full" onClick={() => selectExisting(duplicate)}>
                <Car className="mr-1 size-4" /> Bu aracı seç
              </Button>
            </div>
          )}
          {/*
            Araç bu atölyede yeni ama BAŞKA servislerde kayıtlı olabilir (BAK-77).
            Ruhsat okutulmadıysa panel maskeli gelir ve kilidi nasıl açacağını
            söyler; ruhsat bu oturumda okutulduysa (ocrUnlockKey değişir) maskesiz
            tazelenir.
          */}
          <CrossWorkshopHistoryLoader plate={normalizePlate(fields.plate)} refreshKey={ocrUnlockKey} />
          <WizardActions back={<Button type="button" variant="outline" onClick={goBack}>Geri</Button>}>
            <Button variant="foreground" type="button" className="gap-2" onClick={leaveVehicleStep}>
              Devam <ChevronRight className="size-4" />
            </Button>
          </WizardActions>
        </div>
      )}

      {/* ——— Odaklı plaka akışı: ruhsat bilgileri ekranı ———
          "Ruhsattan doldur" kamerasından gelinir: okunan alanlar burada kontrol
          edilir (düşük güvenli olanlar sarı), "El ile gir" ile boş açılır.
          Ruhsat OCR kapalıysa (#828) "Ruhsat bilgileri" düğmesiyle doğrudan
          açılır: kamera yok, alanlar elle girilir. OCR için ayrı not yok —
          başlık ve düğme zaten anlatıyor; ilk alan telefonda üst yarıda kalsın. */}
      {step === "vehicle" && plateFirst && ruhsatView && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2">
            <WizardHeading
              title="Ruhsat bilgileri"
              description={entitlements.ocrIntake
                ? "Ruhsattaki bilgileri kontrol edin ya da elle girin. Sarı işaretli alanları ruhsatla karşılaştırın."
                : "Ruhsattaki bilgileri elle girin."}
            />
            {entitlements.ocrIntake && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1.5 text-primary"
                onClick={() => setScanner("registration")}
              >
                <Camera className="size-4" /> Ruhsatı çek
              </Button>
            )}
          </div>
          {conflictsBox}
          <EntryVehicleFields
            hidePlate
            fields={fields}
            onFieldChange={setField}
            confidence={confidence}
            showDetails={showDetails}
            onToggleDetails={() => setShowDetails((s) => !s)}
            vinResolve={vinResolve}
            vinLookup={entitlements.vinLookup}
            showAddonUpsell={entitlements.showAddonUpsell}
            onBrandChange={(v) => { setField("brand", v); setCatalogIds({}) }}
            onModelChange={(v) => { setField("model", v); setCatalogIds((p) => ({ brandId: p.brandId })) }}
          />
          <WizardActions back={<Button type="button" variant="outline" onClick={() => setRuhsatView(false)}>Geri</Button>}>
            <Button variant="foreground" type="button" className="gap-2" onClick={() => setRuhsatView(false)}>
              Tamam <Check className="size-4" />
            </Button>
          </WizardActions>
        </div>
      )}

      {/* ——— Adım: araç bilgileri — odaklı plaka akışı ——— */}
      {step === "vehicle" && plateFirst && !ruhsatView && (
        <div className="space-y-5">
          <IntakeDuplicatePhoneNotice
            ref={ownerDupesRef}
            duplicates={ownerDupes}
            onUseExisting={duplicate ? undefined : (c) => void pickExistingOwner(c)}
            onConfirm={() => void submitPlateFirst({ allowDuplicatePhone: true })}
          />
          {/* Ruhsat okuma bu ekranın asıl işi değil: başlığın yanında tek düğme.
              Dokununca "Aracı Çek" ile aynı tam ekran kamera açılır (ruhsatı
              çek ya da "El ile gir"), ardından "Ruhsat bilgileri" ekranı gelir.
              Ruhsat OCR kapalıysa (#828) düğme kamerasız "Ruhsat bilgileri"
              ekranını açar: şase, motor no, yakıt ve tescil tarihi elle girilir.
              Kayıtlı araçta araç alanları sorulmadığı için yok. */}
          <div className="flex items-center justify-between gap-2">
            <WizardHeading title="Araç bilgileri" />
            {!duplicate && (entitlements.ocrIntake ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-primary"
                onClick={() => setScanner("registration")}
              >
                <ScanLine className="size-4" /> Ruhsattan doldur
              </Button>
            ) : (
              // Ruhsat verisine tek giriş yolu: keşfedilsin diye çerçeveli.
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => { setShowDetails(true); setRuhsatView(true) }}
              >
                <FileText className="size-4" /> Ruhsat bilgileri
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-plate">Plaka *</Label>
            <Input
              id="entry-plate"
              value={fields.plate}
              onChange={(e) => setField("plate", e.target.value.toUpperCase())}
              placeholder="34 ABC 123"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="h-12 text-lg font-semibold tracking-wide md:h-12 md:text-lg"
            />
          </div>
          {/* Kabul için aracın fotoğrafı zorunlu. Plaka ekranında çekilen kare
              burada küçük resim olarak görünür (büyütülür / yeniden yüklenir);
              plaka elle yazıldıysa kart boş başlar. */}
          {photoFeature && (
            <VehiclePhotoCapture
              photo={vehiclePhoto}
              brand={fields.brand}
              busy={photoPreparing}
              invalid={photoMissing}
              onCapture={() => setScanner("vehiclePhoto")}
            />
          )}
          {plateStatus === "mismatch" && photoPlate && (
            <div role="alert" className="space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-strong" />
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="font-semibold text-foreground">Plakayı el ile değiştirdiniz</p>
                  <p className="text-muted-foreground-strong">
                    Fotoğrafta <span className="font-medium text-foreground">{photoPlate}</span> okundu, plaka
                    alanında <span className="font-medium text-foreground">{normalizePlate(fields.plate)}</span> yazıyor.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="foreground" className="sm:flex-1" onClick={confirmManualPlate}>
                  Onaylıyorum
                </Button>
                <Button type="button" variant="outline" className="sm:flex-1" onClick={revertToPhotoPlate}>
                  Vazgeç
                </Button>
              </div>
            </div>
          )}
          <IntakeOwnerCard
            value={ownerForm}
            onChange={(next) => { setOwnerForm(next); setOwnerDupes([]) }}
            registeredVehicleLabel={duplicate?.label}
            loading={ownerLoading || (!!duplicate && !ownerOriginal)}
          />
          {/* Araç alanları bu ekranda sorulmaz: marka fotoğrafta rozet olarak
              görünür, ruhsattan okunanlar arka planda kayda gider. Ruhsat
              okumasının çakışma uyarısı (plaka/şase) yine burada çıkar. */}
          {!duplicate && conflictsBox}
          <WizardActions back={<Button type="button" variant="outline" onClick={goBack} disabled={saving}>Geri</Button>}>
            {armed ? (
              <Button
                variant="success"
                type="button"
                className="gap-2"
                disabled={saving || ownerLoading || photoPreparing}
                onClick={() => void submitPlateFirst()}
              >
                {saving
                  ? <><Loader2 className="size-4 animate-spin" /> Oluşturuluyor…</>
                  : <><Check className="size-4" /> Onayla</>}
              </Button>
            ) : orderDirect ? (
              <Button
                variant="foreground"
                type="button"
                className="gap-2"
                disabled={saving || ownerLoading || photoPreparing}
                onClick={armOrder}
              >
                Devam <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                variant="foreground"
                type="button"
                className="gap-2"
                disabled={saving || ownerLoading || photoPreparing}
                onClick={() => void submitPlateFirst()}
              >
                {saving
                  ? <><Loader2 className="size-4 animate-spin" /> Kaydediliyor…</>
                  : <>{duplicate ? "Devam" : "Aracı kaydet"} <ChevronRight className="size-4" /></>}
              </Button>
            )}
          </WizardActions>
        </div>
      )}

      {/* ——— Adım: müşteri (sahip) ——— */}
      {step === "owner" && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={stepEyebrow}
            title="Aracın sahibi kim?"
            description="Kayıtlı müşteriyi arayın ya da yeni müşteri oluşturun."
          />
          {owner ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <User className="size-4 text-primary" /> {owner.label}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOwner(null)}>Değiştir</Button>
            </div>
          ) : (
            <CustomerSearchOrCreate
              onSelected={(id, label) => { setOwner({ id, label }); setError("") }}
              initialName={ownerSeed?.label}
              initialType={ownerSeed?.isCorporate ? "corporate" : "individual"}
              initialCompanyName={ownerSeed?.companyName}
              initialFirstName={ownerSeed?.firstName}
              initialLastName={ownerSeed?.lastName}
              autoCreate={!!ownerSeed}
            />
          )}
          <WizardActions back={<Button type="button" variant="outline" onClick={goBack}>Geri</Button>}>
            <Button variant="foreground" type="button" className="gap-2" disabled={!owner || saving} onClick={() => void createVehicle()}>
              {saving ? <><Loader2 className="size-4 animate-spin" /> Kaydediliyor…</> : <>Aracı kaydet <ChevronRight className="size-4" /></>}
            </Button>
          </WizardActions>
        </div>
      )}

      {/* ——— Adım: onay ——— */}
      {step === "confirm" && confirmed && confirmedParts && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={stepEyebrow}
            title="Araç seçildi"
            description="Bilgiler doğruysa kabul detaylarına geçebilirsiniz."
          />
          {/* Teknisyen panelindeki iş emri kartıyla aynı yapı (technician-dashboard
              OrderCard): büyük plaka, araç ve sahip satırları. */}
          <Item variant="outline" className="bg-card/80 shadow-xs">
            <ItemContent>
              <ItemHeader>
                <Plate plate={confirmedParts.plate} size="lg" />
              </ItemHeader>
              {confirmedParts.vehicleName && (
                <ItemTitle className="flex items-center gap-2 text-base font-semibold">
                  <Car className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="line-clamp-1">{confirmedParts.vehicleName}</span>
                </ItemTitle>
              )}
              <ItemDescription className="flex items-center gap-2">
                <User className="size-4 shrink-0" aria-hidden="true" />
                <span className="line-clamp-1">{confirmedParts.ownerName}</span>
              </ItemDescription>
            </ItemContent>
          </Item>
          {/* Bu ekran yalnız ofis akışında yaşar (odaklı akışta yok, bkz.
              `confirmless`). Randevu/teklif linkleri aracı önceden seçtiği için
              oradan çıkmanın tek yolu bu düğmeler. */}
          {ownerMode ? (
            <div className="space-y-2">
              <CustomerSearchOrCreate autoFocus onSelected={applyNewOwner} />
              <Button type="button" variant="ghost" size="sm" onClick={() => setOwnerMode(false)}>Vazgeç</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOwnerMode(true)}>
                <UserCog className="mr-1 size-4" /> Sahip değiştir
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                <Link href={`/vehicles/${confirmed.vehicleId}`}>
                  <Info className="mr-1 size-4" /> Araç detayı
                </Link>
              </Button>
            </div>
          )}
          {/* Seçilen aracın diğer servislerdeki geçmişi (BAK-77). */}
          <CrossWorkshopHistoryLoader vehicleId={confirmed.vehicleId} refreshKey={ocrUnlockKey} />
          <WizardActions back={<Button type="button" variant="outline" onClick={restart}>Başka araç seç</Button>}>
            <Button variant="foreground" type="button" className="gap-2" onClick={onComplete}>
              Devam <ChevronRight className="size-4" />
            </Button>
          </WizardActions>
        </div>
      )}

      {scanner === "plate" && (
        <PlateScanner
          onDetected={(plate, image, brand) => {
            setScanner(null)
            const normalized = normalizePlate(plate)
            setQuery(normalized)
            void keepScannedFrame(image, "scan", plate)
            applyPhotoBrand(brand)
            // Odaklı plaka akışında okunan plaka onay beklemeden araç bilgileri
            // ekranına taşınır: o ekran plaka kayıtlıysa aracı ve sahibini zaten
            // buluyor (duplicate → sahip kartı dolu, "Devam"), değilse yeni araç
            // açar. Arama ekranında durup "Bu plakayla yeni araç"a basmak ek bir
            // dokunuştan ibaretti. Plaka yanlış okunduysa araç ekranında düzeltilir.
            if (plateFirst && normalized) goToVehicleStep({ plate: normalized })
          }}
          onClose={closePlateScannerToTyping}
          onManualEntry={focused ? closePlateScannerToTyping : undefined}
        />
      )}
      {scanner === "vehiclePhoto" && (
        <PlateScanner
          onDetected={(plate, image, brand) => {
            setScanner(null)
            // Plaka elle yazılmamışsa okunanı kullan; yazılmışsa kullanıcınınki korunur.
            if (!fields.plate.trim()) setField("plate", normalizePlate(plate))
            void keepScannedFrame(image, "manual", plate)
            applyPhotoBrand(brand)
          }}
          onClose={() => setScanner(null)}
          // Yabancı plaka okunamaz (okuma yalnız TR tanır): kare plakasız kabul edilir (#840).
          allowNoPlate={isForeignPlate(fields.plate)}
        />
      )}
      {scanner === "registration" && entitlements.ocrIntake && (
        <RegistrationCameraScanner
          onResult={(r) => {
            setScanner(null)
            applyOcr(r)
            setRuhsatView(true)
          }}
          onClose={() => setScanner(null)}
          onManualEntry={() => {
            setScanner(null)
            setShowDetails(true)
            setRuhsatView(true)
          }}
        />
      )}
    </div>
  )

}

/** Arama sonuç listesi — araçlar önce, altında (varsa) müşteri eşleşmeleri. */
function SearchHits({
  loading,
  hits,
  customers = [],
  emptyText,
  onPick,
  onPickCustomer,
  large = false,
}: {
  loading: boolean
  hits: Extract<UnifiedResult, { kind: "vehicle" }>[]
  customers?: Extract<UnifiedResult, { kind: "customer" }>[]
  emptyText: string
  onPick: (r: Extract<UnifiedResult, { kind: "vehicle" }>) => void
  onPickCustomer?: (c: Extract<UnifiedResult, { kind: "customer" }>) => void
  /** Odaklı ekranda büyük yazı ve dokunma alanı. */
  large?: boolean
}) {
  const noteClass = large ? "text-base text-muted-foreground" : "text-sm text-muted-foreground"
  if (loading) {
    return (
      <p className={cn("flex items-center gap-2", noteClass)}>
        <Loader2 className="size-4 animate-spin" /> Aranıyor…
      </p>
    )
  }
  if (!hits.length && !customers.length) {
    return emptyText ? <p className={noteClass}>{emptyText}</p> : null
  }
  return (
    <div className="space-y-2">
      {hits.map((r) => (
        <VehicleHitCard
          key={r.vehicleId}
          plate={r.plate}
          vehicleName={r.vehicleName || r.label}
          ownerName={r.ownerName ?? r.sublabel.replace(/^Sahip:\s*/, "")}
          large={large}
          onClick={() => onPick(r)}
        />
      ))}
      {onPickCustomer && customers.map((c) => (
        <Button key={c.customerId} type="button" variant="outline" className={HIT_CARD_CLASS} onClick={() => onPickCustomer(c)}>
          <Item className="w-full p-0">
            <ItemContent>
              <ItemTitle className="flex items-center gap-2 text-base font-semibold">
                <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="line-clamp-1">{c.label}</span>
              </ItemTitle>
              {c.sublabel && (
                <ItemDescription className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0" aria-hidden="true" />
                  <span className="line-clamp-1">{formatPhoneTR(c.sublabel)}</span>
                </ItemDescription>
              )}
            </ItemContent>
            <ItemActions>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </ItemActions>
          </Item>
        </Button>
      ))}
    </div>
  )
}

/**
 * Arama sonucu kartı. Teknisyen panosundaki iş emri kartıyla (`OrderCard`,
 * technician-dashboard.tsx) aynı kalıp: Item outline yüzeyi, hover'da mavi ton.
 * Kart bir eylem (seçim) olduğu için kabuk `Link` değil `Button`.
 */
const HIT_CARD_CLASS =
  "h-auto w-full justify-start whitespace-normal rounded-lg bg-card/80 px-3 py-2.5 text-left font-normal tracking-normal shadow-xs hover:bg-primary/10 hover:ring-2 hover:ring-primary/20"

/** Araç kartı: üstte mavi bantlı plaka, altında araç ve (varsa) sahip satırı. */
function VehicleHitCard({
  plate,
  vehicleName,
  ownerName,
  large = false,
  onClick,
}: {
  plate: string
  vehicleName: string
  ownerName?: string
  /** Odaklı ekranda büyük plaka. */
  large?: boolean
  onClick: () => void
}) {
  return (
    <Button type="button" variant="outline" className={HIT_CARD_CLASS} onClick={onClick}>
      <Item className="w-full p-0">
        <ItemContent>
          <ItemHeader>
            <Plate plate={plate} size={large ? "lg" : "md"} />
          </ItemHeader>
          <ItemTitle className="flex items-center gap-2 text-base font-semibold">
            <Car className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="line-clamp-1">{vehicleName || "—"}</span>
          </ItemTitle>
          {ownerName && (
            <ItemDescription className="flex items-center gap-2">
              <User className="size-4 shrink-0" aria-hidden="true" />
              <span className="line-clamp-1">{ownerName}</span>
            </ItemDescription>
          )}
        </ItemContent>
        <ItemActions>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </ItemActions>
      </Item>
    </Button>
  )
}
