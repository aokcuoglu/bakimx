"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import {
  AlertTriangle,
  Barcode,
  Car,
  Check,
  ChevronRight,
  Info,
  Loader2,
  ScanLine,
  Search,
  User,
  UserCog,
} from "lucide-react"
import { WizardActions, WizardChoiceCard, WizardHeading, WizardStepper } from "@/components/intake/wizard-ui"
import { EntryVehicleFields, EMPTY_VEHICLE_FIELDS, type VehicleFields } from "@/components/intake/entry-vehicle-fields"
import { CustomerSearchOrCreate } from "@/components/customers/customer-search-or-create"
import { PlateScanner } from "@/components/intake/plate-scanner"
import { VinScanner } from "@/components/intake/vin-scanner"
import { RuhsattanOku, type RuhsattanOkuResult } from "@/components/vehicles/ruhsattan-oku"
import { CrossWorkshopHistoryLoader } from "@/components/vehicles/cross-workshop-history"
import { useVinResolve } from "@/components/vehicles/vin-resolve"
import { changeVehicleOwnerAction } from "@/app/(app)/vehicles/actions"
import { displayCustomerName, type CustomerLite, type UnifiedResult } from "@/lib/search/unified-results"
import { findExactPlateMatch } from "@/lib/search/exact-plate-match"
import { normalizePlate } from "@/lib/format"
import { isValidVin, normalizeVin, type VinCandidate } from "@/lib/vin/types"
import { ocrVehicleTypeToSlug, ocrFuelToSlug, tecdocFuelToFormValue } from "@/lib/constants"
import {
  ENTRY_METHODS,
  entryStepLabels,
  identityConflicts,
  previousEntryStep,
  vehicleFieldError,
  type EntryMethod,
  type EntryStep,
  type IdentityConflict,
} from "@/lib/intake/entry-wizard"

type VehicleResult = Extract<UnifiedResult, { kind: "vehicle" }>
type CustVehicle = { id: string; plate: string; brand: string; model: string }
type OwnerSeed = { isCorporate: boolean; firstName: string; lastName: string; companyName: string; label: string }

const SEARCH_ENDPOINT = "/api/search/customer-vehicle"
const RECENT_ENDPOINT = "/api/vehicles/recent"

const METHOD_ICONS: Record<EntryMethod, ReactNode> = {
  registration: <ScanLine className="size-5" />,
  vin: <Barcode className="size-5" />,
  plate: <Search className="size-5" />,
  customer: <User className="size-5" />,
}

/**
 * Kabul akışının araç girişi sihirbazı (#309).
 *
 * Kullanıcı önce **nasıl başlayacağını** seçer — ruhsat görseli, camdan şase,
 * plaka araması ya da müşteri araması — sonra o yolun kendi tam-genişlikte adımı
 * gelir. Kayıtlı araç bulunursa doğrudan onaya, bulunmazsa "Araç bilgileri" ve
 * "Müşteri" adımlarına geçilir. Eskiden bunların hepsi tek bir dar diyalogun
 * içinde üst üste duruyordu; ruhsat yükleme alanı da bir şeride sıkışmıştı.
 *
 * Seçim `onChange` ile dışarı verilir (kabul sihirbazı formu + URL'i besler),
 * kullanıcı onayladığında `onComplete` çağrılır.
 */
export function VehicleEntryWizard({
  value,
  onChange,
  onComplete,
}: {
  value: { customerId: string; vehicleId: string }
  onChange: (v: { customerId: string; vehicleId: string }) => void
  onComplete: () => void
}) {
  const [step, setStep] = useState<EntryStep>("method")
  const [method, setMethod] = useState<EntryMethod | null>(null)
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
  const [owner, setOwner] = useState<{ id: string; label: string } | null>(null)
  const [ownerSeed, setOwnerSeed] = useState<OwnerSeed | null>(null)
  const [ownerMode, setOwnerMode] = useState(false)

  // Arama
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UnifiedResult[]>([])
  const [searching, setSearching] = useState(false)
  const [recent, setRecent] = useState<VehicleResult[]>([])
  const [custVehicles, setCustVehicles] = useState<CustVehicle[]>([])
  const [pickedCustomer, setPickedCustomer] = useState<{ id: string; label: string } | null>(null)
  const [scanner, setScanner] = useState<"plate" | "vin" | null>(null)
  // Ruhsat okuma sayacı. Servisler arası geçmiş kilidi ruhsat taramasıyla açılır
  // (BAK-77); tarama sunucuda hakkı yazdığı anda paneli yeniden çektirmek için
  // bu sayaç artar.
  const [ocrUnlockKey, setOcrUnlockKey] = useState(0)

  // Onay
  const [confirmed, setConfirmed] = useState<{ vehicleId: string; customerId: string; label: string; sublabel: string } | null>(null)
  // Kayıtlı araç bulunarak mı gelindi? Öyleyse araç/sahip adımları hiç yaşanmadı;
  // ray da onları göstermez ve "Geri" doğrudan yakalama adımına döner.
  const [foundExisting, setFoundExisting] = useState(false)

  const knownVehicle = foundExisting
  const steps = entryStepLabels(method, { knownVehicle })
  const completed: string[] = []
  if (method) completed.push("method")
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

  /** Çakışan alanda ruhsattan okunan değeri kullan. */
  function applyScannedValue(c: IdentityConflict) {
    setField(c.key, c.scanned)
    if (c.key === "vin" && isValidVin(c.scanned)) {
      void vinResolve.resolve(c.scanned, {
        engineDisplacement: fields.engineDisplacement || undefined,
        enginePower: fields.enginePower || undefined,
        fuelType: fields.fuelType || undefined,
        firstRegistrationDate: fields.firstRegistrationDate || undefined,
        modelYear: fields.modelYear ? Number(fields.modelYear) || undefined : undefined,
      })
    }
  }

  // ——— Dış prefill / geri navigasyon ———
  // URL'de araç id'si varken sihirbaz sıfırdan mount olursa (Adım 3'ten geri dönüş,
  // ruhsat okuyucudan yönlendirme) aracı çekip doğrudan onay adımını kur.
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
  }, [value.vehicleId, value.customerId, confirmed?.vehicleId, onChange])

  // ——— Arama (plaka / şase modları) ———
  useEffect(() => {
    if (step !== "capture" || (method !== "plate" && method !== "vin")) return
    const q = query.trim()
    // Boş/eksik sorguda listeyi temizle. setState doğrudan effect gövdesinde
    // çağrılmıyor (react-hooks/set-state-in-effect) — aynı desen picker'da da var.
    if (!q || (method === "vin" && !isValidVin(q))) {
      const clear = setTimeout(() => setResults([]), 0)
      return () => clearTimeout(clear)
    }
    const t = setTimeout(() => {
      setSearching(true)
      fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(method === "vin" ? normalizeVin(q) : q)}`)
        .then((r) => r.json())
        .then((d) => setResults(Array.isArray(d?.results) ? d.results : []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(t)
  }, [query, step, method])

  // ——— Son araçlar (yöntem adımında yazmadan seçim) ———
  const recentRequested = useRef(false)
  useEffect(() => {
    if (step !== "method" || recentRequested.current) return
    recentRequested.current = true
    let active = true
    fetch(RECENT_ENDPOINT)
      .then((r) => r.json())
      .then((d: unknown) => {
        if (!active) return
        const list = Array.isArray((d as { results?: unknown })?.results) ? (d as { results: UnifiedResult[] }).results : []
        setRecent(list.filter((r): r is VehicleResult => r.kind === "vehicle"))
      })
      .catch(() => {})
    return () => { active = false }
  }, [step])

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

  // ——— Geçişler ———
  function chooseMethod(m: EntryMethod) {
    setMethod(m)
    setError("")
    setQuery("")
    setResults([])
    setPickedCustomer(null)
    setCustVehicles([])
    setStep("capture")
  }

  function selectExisting(r: VehicleResult) {
    setFoundExisting(true)
    setConfirmed({ vehicleId: r.vehicleId, customerId: r.customerId, label: r.label, sublabel: r.sublabel })
    onChange({ customerId: r.customerId, vehicleId: r.vehicleId })
    setStep("confirm")
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
    if (ocrOwner.label) setOwnerSeed(ocrOwner)
    setShowDetails(true)
    // Çakışmada kullanıcının şasesi korunuyor; onu zaten girdiği adımda
    // sorguladık — ruhsattaki farklı şase için kota harcama.
    if (!keep.has("vin") && isValidVin(values.vin)) {
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
      void vinResolve.resolve(normalizeVin(seed.vin), {})
    }
    setError("")
    setStep("vehicle")
  }

  function leaveVehicleStep() {
    const msg = vehicleFieldError(fields)
    if (msg) { setError(msg); return }
    if (duplicate) { setError("Bu plaka zaten kayıtlı — aşağıdan mevcut aracı seçin."); return }
    setError("")
    setStep("owner")
  }

  async function createVehicle() {
    if (!owner) { setError("Önce müşteriyi seçin veya oluşturun."); return }
    const msg = vehicleFieldError(fields)
    if (msg) { setError(msg); setStep("vehicle"); return }
    setSaving(true)
    setError("")
    try {
      const vf = new FormData()
      vf.set("customerId", owner.id)
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
      setFoundExisting(false)
      setConfirmed({
        vehicleId: data.id,
        customerId: owner.id,
        label: `${fields.plate} — ${fields.brand} ${fields.model}`.trim(),
        sublabel: `Sahip: ${owner.label}`,
      })
      onChange({ customerId: owner.id, vehicleId: data.id })
      setStep("confirm")
    } catch {
      setError("Bir hata oluştu, lütfen tekrar deneyin.")
    } finally {
      setSaving(false)
    }
  }

  async function applyNewOwner(customerId: string, label: string) {
    if (!confirmed) return
    const res = await changeVehicleOwnerAction(confirmed.vehicleId, customerId)
    if ("error" in res) { setError(res.error || "Sahip değiştirilemedi"); return }
    setConfirmed({ ...confirmed, customerId, sublabel: `Sahip: ${label}` })
    onChange({ customerId, vehicleId: confirmed.vehicleId })
    setOwnerMode(false)
  }

  function restart() {
    setStep("method")
    setMethod(null)
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
    setPickedCustomer(null)
    setCustVehicles([])
    setError("")
    hydratedFor.current = ""
    vinResolve.reset()
    onChange({ customerId: "", vehicleId: "" })
  }

  function goBack() {
    setError("")
    setStep(previousEntryStep(step, method, { knownVehicle }))
  }

  function pickCustomer(customerId: string, label: string) {
    setPickedCustomer({ id: customerId, label })
    setOwner({ id: customerId, label })
    fetch(`/api/vehicles?customerId=${customerId}`)
      .then((r) => r.json())
      .then((d: unknown) => {
        const arr = Array.isArray(d) ? d : []
        setCustVehicles(arr.map((v) => ({ id: String(v.id), plate: String(v.plate), brand: String(v.brand), model: String(v.model) })))
      })
      .catch(() => setCustVehicles([]))
  }

  const vehicleHits = results.filter((r): r is VehicleResult => r.kind === "vehicle")
  const customerHits = results.filter((r): r is Extract<UnifiedResult, { kind: "customer" }> => r.kind === "customer")
  const stepIndex = steps.findIndex((s) => s.id === step)

  return (
    <div className="space-y-5">
      <WizardStepper compact steps={steps} currentId={step} completedIds={completed} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ——— Adım: yöntem seçimi ——— */}
      {step === "method" && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={`Adım ${stepIndex + 1}`}
            title="Aracı nasıl kaydedelim?"
            description="Ruhsatı okutabilir, camdaki şaseyi taratabilir ya da sistemde kayıtlı aracı arayabilirsiniz."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {ENTRY_METHODS.map((m) => (
              <WizardChoiceCard
                key={m.value}
                icon={METHOD_ICONS[m.value]}
                title={m.title}
                description={m.description}
                selected={method === m.value}
                onClick={() => chooseMethod(m.value)}
              />
            ))}
          </div>

          {recent.length > 0 && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">Son araçlar</p>
              <p className="text-xs text-muted-foreground">Yakın zamanda işlem gören araçlar — tek dokunuşla seçin.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {recent.map((r) => (
                  <Button
                    key={r.vehicleId}
                    type="button"
                    variant="outline"
                    className="h-auto md:h-auto w-full justify-start gap-2 whitespace-normal py-2 text-left"
                    onClick={() => selectExisting(r)}
                  >
                    <Car className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{r.label}</span>
                      <span className="block text-xs text-muted-foreground">{r.sublabel}</span>
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ——— Adım: yönteme özel yakalama ——— */}
      {step === "capture" && method === "registration" && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={`Adım ${stepIndex + 1}`}
            title="Ruhsatı yükleyin"
            description="Fotoğrafı çekin ya da dosyadan seçin; plaka, marka, model ve teknik alanlar otomatik dolar."
          />
          <RuhsattanOku
            variant="hero"
            title="Ruhsat fotoğrafını yükleyin"
            description="Kamerayla çekin, dosyadan seçin veya bu alana sürükleyin."
            onResult={applyOcr}
          />
          <WizardActions back={<Button type="button" variant="outline" onClick={goBack}>Geri</Button>}>
            <Button type="button" variant="ghost" onClick={() => goToVehicleStep()}>
              Ruhsatsız devam et — bilgileri elle gir
            </Button>
          </WizardActions>
        </div>
      )}

      {step === "capture" && method === "vin" && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={`Adım ${stepIndex + 1}`}
            title="Şase (VIN) numarasını okutun"
            description="Ön camın altındaki 17 haneli şase numarasını kamerayla okutun veya elle yazın."
          />
          <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center sm:p-10">
            <div className="flex flex-col items-center gap-4">
              <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Barcode className="size-8" />
              </span>
              <Button type="button" className="gap-2" onClick={() => setScanner("vin")}>
                <ScanLine className="size-4" /> Kamerayla şase oku
              </Button>
              <div className="w-full max-w-sm space-y-1.5 text-left">
                <Label htmlFor="entry-vin">veya elle yazın</Label>
                <Input
                  id="entry-vin"
                  value={query}
                  onChange={(e) => setQuery(e.target.value.toUpperCase())}
                  placeholder="17 haneli şase numarası"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
          <SearchHits
            loading={searching}
            hits={vehicleHits}
            emptyText={
              isValidVin(query)
                ? `«${normalizeVin(query)}» sistemde kayıtlı değil.`
                : query.trim()
                  ? "17 haneli geçerli bir şase numarası girin."
                  : ""
            }
            onPick={selectExisting}
          />
          <WizardActions back={<Button type="button" variant="outline" onClick={goBack}>Geri</Button>}>
            <Button
              type="button"
              className="gap-2"
              disabled={!isValidVin(query)}
              onClick={() => goToVehicleStep({ vin: query })}
            >
              Bu şaseyle yeni araç <ChevronRight className="size-4" />
            </Button>
          </WizardActions>
        </div>
      )}

      {step === "capture" && method === "plate" && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={`Adım ${stepIndex + 1}`}
            title="Plakayı arayın"
            description="Kayıtlı aracı plakasıyla bulun. Kayıt yoksa aynı plakayla yeni araç açabilirsiniz."
          />
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Plaka veya müşteri ara…"
              autoComplete="off"
              className="flex-1"
            />
            <Button type="button" variant="outline" size="icon" aria-label="Plakayı kamerayla tara" onClick={() => setScanner("plate")}>
              <ScanLine className="size-4" />
            </Button>
          </div>
          <SearchHits
            loading={searching}
            hits={vehicleHits}
            customers={customerHits}
            emptyText={query.trim() ? `«${query.trim()}» için kayıtlı araç bulunamadı.` : ""}
            onPick={selectExisting}
            onPickCustomer={(c) => { setMethod("customer"); setQuery(""); setResults([]); pickCustomer(c.customerId, c.label) }}
          />
          <WizardActions back={<Button type="button" variant="outline" onClick={goBack}>Geri</Button>}>
            <Button
              type="button"
              className="gap-2"
              disabled={!query.trim()}
              onClick={() => goToVehicleStep({ plate: query.trim() })}
            >
              Bu plakayla yeni araç <ChevronRight className="size-4" />
            </Button>
          </WizardActions>
        </div>
      )}

      {step === "capture" && method === "customer" && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={`Adım ${stepIndex + 1}`}
            title="Müşteriyi bulun"
            description="Kayıtlı müşteriyi arayın ya da yeni müşteri oluşturun; sonra aracını seçin."
          />
          {pickedCustomer ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <User className="size-4 text-primary" /> {pickedCustomer.label}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setPickedCustomer(null); setCustVehicles([]) }}>
                  Değiştir
                </Button>
              </div>
              <p className="text-sm font-medium text-foreground">Aracı seçin</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {custVehicles.map((v) => (
                  <Button
                    key={v.id}
                    type="button"
                    variant="outline"
                    className="h-auto md:h-auto w-full justify-start gap-2 whitespace-normal py-2 text-left"
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
                  >
                    <Car className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 text-sm font-medium text-foreground">{v.plate} — {v.brand} {v.model}</span>
                  </Button>
                ))}
                {!custVehicles.length && (
                  <p className="text-sm text-muted-foreground">Bu müşterinin kayıtlı aracı yok.</p>
                )}
              </div>
            </div>
          ) : (
            <CustomerSearchOrCreate onSelected={pickCustomer} />
          )}
          <WizardActions back={<Button type="button" variant="outline" onClick={goBack}>Geri</Button>}>
            {pickedCustomer && (
              <Button
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
      {step === "vehicle" && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={`Adım ${stepIndex + 1}`}
            title="Araç bilgileri"
            description="Zorunlu alanlar plaka, marka ve model. Ruhsattan okunan alanlar sarı işaretliyse kontrol edin."
          />
          {/* Hangi yoldan gelinirse gelinsin (plaka araması, şase, müşteri) ruhsat
              burada da okutulabilir — alanları elle doldurmak zorunda kalmayın. */}
          <RuhsattanOku
            title="Ruhsattan otomatik doldur"
            description="Ruhsatı kamerayla çekin ya da dosyadan seçin; aşağıdaki alanlar dolsun."
            onResult={applyOcr}
          />
          {conflicts.length > 0 && (
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
          )}
          <EntryVehicleFields
            fields={fields}
            onFieldChange={setField}
            confidence={confidence}
            showDetails={showDetails}
            onToggleDetails={() => setShowDetails((s) => !s)}
            vinResolve={vinResolve}
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
              <Button type="button" size="sm" className="w-full" onClick={() => selectExisting(duplicate)}>
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
            <Button type="button" className="gap-2" onClick={leaveVehicleStep}>
              Devam <ChevronRight className="size-4" />
            </Button>
          </WizardActions>
        </div>
      )}

      {/* ——— Adım: müşteri (sahip) ——— */}
      {step === "owner" && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={`Adım ${stepIndex + 1}`}
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
            <Button type="button" className="gap-2" disabled={!owner || saving} onClick={createVehicle}>
              {saving ? <><Loader2 className="size-4 animate-spin" /> Kaydediliyor…</> : <>Aracı kaydet <ChevronRight className="size-4" /></>}
            </Button>
          </WizardActions>
        </div>
      )}

      {/* ——— Adım: onay ——— */}
      {step === "confirm" && confirmed && (
        <div className="space-y-5">
          <WizardHeading
            eyebrow={`Adım ${stepIndex + 1}`}
            title="Araç seçildi"
            description="Bilgiler doğruysa kabul detaylarına geçebilirsiniz."
          />
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Check className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{confirmed.label}</p>
                <p className="text-sm text-muted-foreground">{confirmed.sublabel}</p>
              </div>
            </div>
            {ownerMode ? (
              <div className="mt-3 space-y-2">
                <CustomerSearchOrCreate autoFocus onSelected={applyNewOwner} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setOwnerMode(false)}>Vazgeç</Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-1">
                <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOwnerMode(true)}>
                  <UserCog className="mr-1 size-4" /> Sahip değiştir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  asChild
                >
                  <Link href={`/vehicles/${confirmed.vehicleId}`}>
                    <Info className="mr-1 size-4" /> Araç detayı
                  </Link>
                </Button>
              </div>
            )}
          </div>
          {/* Seçilen aracın diğer servislerdeki geçmişi (BAK-77). */}
          <CrossWorkshopHistoryLoader vehicleId={confirmed.vehicleId} refreshKey={ocrUnlockKey} />
          <WizardActions back={<Button type="button" variant="outline" onClick={restart}>Başka araç seç</Button>}>
            <Button type="button" className="gap-2" onClick={onComplete}>
              Kabul detaylarına geç <ChevronRight className="size-4" />
            </Button>
          </WizardActions>
        </div>
      )}

      {scanner === "plate" && (
        <PlateScanner
          onDetected={(plate) => { setScanner(null); setQuery(normalizePlate(plate)) }}
          onClose={() => setScanner(null)}
        />
      )}
      {scanner === "vin" && (
        <VinScanner
          onDetected={(vin) => { setScanner(null); setQuery(normalizeVin(vin)) }}
          onClose={() => setScanner(null)}
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
}: {
  loading: boolean
  hits: Extract<UnifiedResult, { kind: "vehicle" }>[]
  customers?: Extract<UnifiedResult, { kind: "customer" }>[]
  emptyText: string
  onPick: (r: Extract<UnifiedResult, { kind: "vehicle" }>) => void
  onPickCustomer?: (c: Extract<UnifiedResult, { kind: "customer" }>) => void
}) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Aranıyor…
      </p>
    )
  }
  if (!hits.length && !customers.length) {
    return emptyText ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null
  }
  return (
    <div className="space-y-2">
      {hits.map((r) => (
        <Button
          key={r.vehicleId}
          type="button"
          variant="outline"
          className="h-auto md:h-auto w-full justify-start gap-2 whitespace-normal py-2 text-left"
          onClick={() => onPick(r)}
        >
          <Item size="sm" className="w-full p-0">
            <ItemMedia><Car className="size-4 text-primary" /></ItemMedia>
            <ItemContent className="gap-0.5">
              <ItemTitle>{r.label}</ItemTitle>
              <ItemDescription>{r.sublabel}</ItemDescription>
            </ItemContent>
          </Item>
        </Button>
      ))}
      {onPickCustomer && customers.map((c) => (
        <Button
          key={c.customerId}
          type="button"
          variant="outline"
          className="h-auto md:h-auto w-full justify-start gap-2 whitespace-normal py-2 text-left"
          onClick={() => onPickCustomer(c)}
        >
          <Item size="sm" className="w-full p-0">
            <ItemMedia><User className="size-4 text-muted-foreground" /></ItemMedia>
            <ItemContent className="gap-0.5">
              <ItemTitle>{c.label}</ItemTitle>
              <ItemDescription>{c.sublabel}</ItemDescription>
            </ItemContent>
          </Item>
        </Button>
      ))}
    </div>
  )
}
