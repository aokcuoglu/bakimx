"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Loader2, Car, User, Plus, X, UserCog, ScanLine, Info, Barcode } from "lucide-react"
import { InlineCreateModal, type InlineCreateResult } from "@/components/intake/inline-create-modal"
import { CustomerSearchOrCreate } from "@/components/customers/customer-search-or-create"
import { PlateScanner } from "@/components/intake/plate-scanner"
import { displayCustomerName, type UnifiedResult, type CustomerLite } from "@/lib/search/unified-results"
import { changeVehicleOwnerAction } from "@/app/(app)/vehicles/actions"
import { normalizePlate } from "@/lib/format"
import { isValidVin, normalizeVin } from "@/lib/vin/types"
import { searchQueryFor, visibleResultsFor, type PickerSearchMode } from "@/lib/vin/search"

type CustVehicle = { id: string; plate: string; brand: string; model: string }
type Mode = PickerSearchMode // "plate" | "customer" | "vin"
type Selected =
  | { kind: "vehicle"; customerId: string; vehicleId: string; label: string; sublabel: string }
  | { kind: "customer"; customerId: string; label: string }
  | null

const SEARCH_ENDPOINT = "/api/search/customer-vehicle"

/**
 * Birleşik müşteri+araç seçici. Varsayılan modda tek kutu hem plakayı hem
 * müşteriyi arar ve ikisini tek listede gösterir (#152); araç seçilirse doğrudan,
 * müşteri seçilirse o müşterinin araç listesi üzerinden devam edilir. VIN modu
 * (barkod ikonu) ve müşteri modu (kişi ikonu — yeni müşteri oluşturma yolu)
 * ayrı toggle olarak kalır. Seçimi `onChange` ile dışarı iter; `value` yalnızca
 * dış reset'i yansıtır (id'lerden etiketli seçim kurmaz — Faz 3'e ertelendi).
 */
export function CustomerVehiclePicker({
  value,
  onChange,
}: {
  value: { customerId: string; vehicleId: string }
  onChange: (v: { customerId: string; vehicleId: string }) => void
}) {
  const [mode, setMode] = useState<Mode>("plate")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UnifiedResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Selected>(null)
  const [custVehicles, setCustVehicles] = useState<CustVehicle[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [ownerMode, setOwnerMode] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [comboOpen, setComboOpen] = useState(false)
  const [modalSeed, setModalSeed] = useState<{ plate?: string; vin?: string }>({})

  const fixedCustomer = useMemo(
    () => (selected?.kind === "customer" ? { id: selected.customerId, label: selected.label } : undefined),
    [selected]
  )

  useEffect(() => {
    const q = searchQueryFor(mode, query)
    if (selected || !q) {
      const t = setTimeout(() => setResults([]), 0)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setLoading(true)
      fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setResults(Array.isArray(d?.results) ? d.results : []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [query, selected, mode])

  useEffect(() => {
    if (!value.customerId && !value.vehicleId) {
      setTimeout(() => { setSelected(null); setCustVehicles([]); setOwnerMode(false); setQuery(""); setResults([]) }, 0)
    }
  }, [value.customerId, value.vehicleId])

  // Geri navigasyonu / dış prefill: value'da araç id'si varken etiketli seçim
  // yoksa aracı çekip özet kartını id'lerden yeniden kur (picker step değişiminde
  // unmount olduğu için step 1'e dönünce selected sıfırlanır; buradan hydrate edilir).
  useEffect(() => {
    const vid = value.vehicleId
    if (!vid || (selected?.kind === "vehicle" && selected.vehicleId === vid)) return
    let active = true
    fetch(`/api/vehicles/${vid}`)
      .then((r) => r.json())
      .then((v: unknown) => {
        if (!active || !v || typeof v !== "object") return
        const veh = v as { id?: string; plate?: string; brand?: string; model?: string; customerId?: string; customer?: CustomerLite | null }
        if (!veh.id) return
        const customerId = veh.customerId || value.customerId
        setSelected({
          kind: "vehicle",
          customerId,
          vehicleId: veh.id,
          label: `${veh.plate ?? ""} — ${veh.brand ?? ""} ${veh.model ?? ""}`.trim(),
          sublabel: `Sahip: ${displayCustomerName(veh.customer ?? null)}`,
        })
        // Sadece vehicleId ile gelen prefill'de (örn. araç detayından "Yeni İş Emri")
        // customerId dışarıda hâlâ boş kalır — sahibi burada öğrenince forma yansıt.
        if (!value.customerId && customerId) onChange({ customerId, vehicleId: veh.id })
      })
      .catch(() => {})
    return () => { active = false }
  }, [value.vehicleId, value.customerId, selected, onChange])

  const modeResults = visibleResultsFor(mode, results)

  function switchMode(m: Mode) { setMode(m); setQuery(""); setResults([]) }

  function openCreate(seed: { plate?: string; vin?: string }) { setModalSeed(seed); setModalOpen(true) }

  // Kameradan okunan plaka: arama kutusuna yaz (mevcut debounce'lu arama tetiklenir)
  // ve açılır listeyi aç — eşleşen araç seçilebilir, yoksa "Oluştur" yolu görünür.
  function onPlateScanned(plate: string) {
    setScannerOpen(false)
    setMode("plate")
    setSelected(null)
    setQuery(normalizePlate(plate))
    setComboOpen(true)
  }

  function pickVehicle(r: Extract<UnifiedResult, { kind: "vehicle" }>) {
    setSelected({ kind: "vehicle", customerId: r.customerId, vehicleId: r.vehicleId, label: r.label, sublabel: r.sublabel })
    onChange({ customerId: r.customerId, vehicleId: r.vehicleId })
    setQuery(""); setResults([])
  }

  function enterCustomer(customerId: string, label: string) {
    setSelected({ kind: "customer", customerId, label })
    onChange({ customerId, vehicleId: "" })
    setQuery(""); setResults([])
    fetch(`/api/vehicles?customerId=${customerId}`)
      .then((res) => res.json())
      .then((d: unknown) => {
        const arr = Array.isArray(d) ? d : []
        setCustVehicles(arr.map((v) => ({ id: String(v.id), plate: String(v.plate), brand: String(v.brand), model: String(v.model) })))
      })
      .catch(() => setCustVehicles([]))
  }

  function pickCustomerVehicle(v: CustVehicle) {
    if (!selected || selected.kind !== "customer") return
    setSelected({ kind: "vehicle", customerId: selected.customerId, vehicleId: v.id, label: `${v.plate} — ${v.brand} ${v.model}`, sublabel: `Sahip: ${selected.label}` })
    onChange({ customerId: selected.customerId, vehicleId: v.id })
  }

  function reset() { setSelected(null); setCustVehicles([]); setOwnerMode(false); setQuery(""); setResults([]); onChange({ customerId: "", vehicleId: "" }) }

  function onModalCreated(r: InlineCreateResult) {
    setSelected({
      kind: "vehicle",
      customerId: r.customerId,
      vehicleId: r.vehicleId,
      label: r.plate ? `${r.plate}${r.brand ? ` — ${r.brand} ${r.model ?? ""}`.trimEnd() : ""}` : "Yeni araç",
      sublabel: r.customerName ? `Sahip: ${r.customerName}` : "Yeni müşteri",
    })
    onChange({ customerId: r.customerId, vehicleId: r.vehicleId })
    setQuery(""); setResults([])
  }

  async function applyOwner(customerId: string, label: string) {
    if (!selected || selected.kind !== "vehicle") return
    const res = await changeVehicleOwnerAction(selected.vehicleId, customerId)
    if ("error" in res) return
    setSelected({ ...selected, customerId, sublabel: `Sahip: ${label}` })
    onChange({ customerId, vehicleId: selected.vehicleId })
    setOwnerMode(false)
  }

  // ——— Seçili: araç ———
  if (selected?.kind === "vehicle") {
    return (
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Car className="size-4 mt-0.5 text-primary" />
            <div>
              <p className="font-semibold text-foreground">{selected.label}</p>
              <p className="text-xs text-muted-foreground">{selected.sublabel}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={reset} aria-label="Seçimi temizle"><X className="size-4" /></Button>
        </div>
        {ownerMode ? (
          <div className="space-y-2">
            <CustomerSearchOrCreate autoFocus onSelected={applyOwner} />
            <Button type="button" variant="ghost" size="sm" onClick={() => setOwnerMode(false)}>Vazgeç</Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOwnerMode(true)}>
              <UserCog className="size-4 mr-1" /> Sahip Değiştir
            </Button>
            <Button
              nativeButton={false}
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              render={<Link href={`/vehicles/${selected.vehicleId}`} />}
            >
              <Info className="size-4 mr-1" /> Detay
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ——— Seçili: müşteri (aracını seç/oluştur) ———
  if (selected?.kind === "customer") {
    return (
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2"><User className="size-4 text-primary" /><p className="font-semibold text-foreground">{selected.label}</p></div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={reset} aria-label="Seçimi temizle"><X className="size-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground">Araç seçin:</p>
        <div className="space-y-1">
          {custVehicles.map((v) => (
            <Button key={v.id} type="button" variant="outline" className="w-full justify-start" onClick={() => pickCustomerVehicle(v)}>
              <Car className="size-4 mr-2" /> {v.plate} — {v.brand} {v.model}
            </Button>
          ))}
          <Button type="button" variant="ghost" className="w-full justify-start text-primary" onClick={() => setModalOpen(true)}>
            <Plus className="size-4 mr-2" /> Bu müşteriye yeni araç ekle
          </Button>
        </div>
        <InlineCreateModal open={modalOpen} onOpenChange={setModalOpen} fixedCustomer={fixedCustomer} onCreated={onModalCreated} />
      </div>
    )
  }

  // ——— Arama (mod-geçişli) ———
  // Plaka modu → araç Combobox'ı (yalnızca vehicle sonuçları). Müşteri modu → CustomerSearchOrCreate.
  // Sağdaki kişi ikonu modu değiştirir. Mevcut effect/`results`/`loading` yalnızca plaka modunda kullanılır.
  return (
    <div className="space-y-2">
      {/* Belirgin başlangıç: ruhsattan yeni müşteri & araç oluştur (OCR ile ön-doldur). */}
      <Button
        type="button"
        variant="outline"
        onClick={() => openCreate({})}
        className="h-auto w-full justify-start gap-3 whitespace-normal border-2 border-dashed border-primary/30 bg-primary/5 p-3 text-left hover:border-primary hover:bg-primary/10"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ScanLine className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">Ruhsat tara — yeni müşteri & araç</span>
          <span className="block text-xs text-muted-foreground">Ruhsatı okutun, alanlar otomatik dolsun.</span>
        </span>
      </Button>

      <div className="relative flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> veya plaka/müşteri ile ara <span className="h-px flex-1 bg-border" />
      </div>

      <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          {mode === "plate" || mode === "vin" ? (
            <Combobox
              items={modeResults}
              filter={() => true}
              itemToStringValue={(r: UnifiedResult) => r.label}
              inputValue={query}
              onInputValueChange={(v: string) => setQuery(mode === "vin" ? v.toUpperCase() : v)}
              open={comboOpen}
              onOpenChange={setComboOpen}
              onValueChange={(r: UnifiedResult | null) => {
                if (!r) return
                if (r.kind === "vehicle") pickVehicle(r)
                else enterCustomer(r.customerId, r.label)
              }}
            >
              <ComboboxInput
                className="w-full"
                showTrigger={false}
                placeholder={mode === "vin" ? "VIN ile ara…" : "Plaka veya müşteri ara…"}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return
                  // Ok tuşuyla bir seçenek vurgulanmışsa (aria-activedescendant),
                  // Base UI onu normal şekilde seçsin.
                  if (e.currentTarget.getAttribute("aria-activedescendant")) return
                  // Doğrudan input'ta Enter: Base UI'nın Enter'da popup'ı kapatıp
                  // input'u (boş) seçili değere geri döndürme davranışını durdur ve
                  // kararı biz verelim — eşleşen araç varsa onu seç, yoksa "Oluştur"
                  // yeni araç modalını (yazılan plakayla) aç.
                  e.preventBaseUIHandler()
                  e.preventDefault()
                  if (loading) return
                  const first = modeResults[0]
                  if (first?.kind === "vehicle") { pickVehicle(first); return }
                  if (first?.kind === "customer") { enterCustomer(first.customerId, first.label); return }
                  // Eşleşme yok: plaka modu her metinde modalı açar; VIN modu yalnız
                  // geçerli 17-hane VIN'de (kısmi girişte Enter no-op).
                  if (mode === "vin") { if (isValidVin(query)) openCreate({ vin: normalizeVin(query) }) }
                  else if (query.trim()) openCreate({ plate: query.trim() })
                }}
              />
              <ComboboxContent>
                <ComboboxEmpty className="p-0">
                  {loading ? (
                    <span className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Aranıyor…</span>
                  ) : mode === "vin" ? (
                    isValidVin(query) ? (
                      <div className="flex w-full flex-wrap items-center gap-2 p-2">
                        <span className="text-xs text-muted-foreground">«{normalizeVin(query)}» yok —</span>
                        <Button type="button" size="sm" onClick={() => openCreate({ vin: normalizeVin(query) })}><Plus className="size-4 mr-1" /> VIN&apos;den araç oluştur</Button>
                      </div>
                    ) : (
                      <span className="py-2 text-sm text-muted-foreground">17 haneli VIN yazın</span>
                    )
                  ) : query.trim().length >= 1 ? (
                    <div className="flex w-full flex-wrap items-center gap-2 p-2">
                      <span className="text-xs text-muted-foreground">«{query.trim()}» yok —</span>
                      <Button type="button" size="sm" onClick={() => openCreate({ plate: query.trim() })}><Plus className="size-4 mr-1" /> Oluştur</Button>
                    </div>
                  ) : (
                    <span className="py-2 text-sm text-muted-foreground">Plaka veya müşteri adı yazın</span>
                  )}
                </ComboboxEmpty>
                <ComboboxList>
                  {(r: UnifiedResult) => (
                    <ComboboxItem key={r.kind === "vehicle" ? `v-${r.vehicleId}` : `c-${r.customerId}`} value={r}>
                      <Item size="sm" className="w-full p-0">
                        <ItemMedia>{r.kind === "vehicle" ? <Car className="size-4 text-primary" /> : <User className="size-4 text-muted-foreground" />}</ItemMedia>
                        <ItemContent className="gap-0.5"><ItemTitle>{r.label}</ItemTitle><ItemDescription>{r.sublabel}</ItemDescription></ItemContent>
                      </Item>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          ) : (
            <CustomerSearchOrCreate onSelected={enterCustomer} />
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:contents">
          {/* Plakayı kamerayla tara — yalnızca plaka modunda */}
          {mode === "plate" && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 md:size-9"
            aria-label="Plakayı kamerayla tara"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="size-4" />
          </Button>
          )}
          {/* Mod toggle: VIN ikonu — aktifse VIN modu (plaka toggle) */}
          <Button
          type="button"
          variant={mode === "vin" ? "default" : "outline"}
          size="icon"
          className="size-11 md:size-9"
          aria-label={mode === "vin" ? "Plaka aramaya dön" : "VIN ile ara"}
          aria-pressed={mode === "vin"}
          onClick={() => switchMode(mode === "vin" ? "plate" : "vin")}
        >
          <Barcode className="size-4" />
          </Button>
          {/* Mod toggle: kişi ikonu — aktifse müşteri modu */}
          <Button
          type="button"
          variant={mode === "customer" ? "default" : "outline"}
          size="icon"
          className="size-11 md:size-9"
          aria-label={mode === "customer" ? "Plaka aramaya dön" : "Müşteri ara"}
          aria-pressed={mode === "customer"}
          onClick={() => switchMode(mode === "customer" ? "plate" : "customer")}
        >
          <User className="size-4" />
          </Button>
        </div>
      </div>

      <InlineCreateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialPlate={modalSeed.plate}
        initialVin={modalSeed.vin}
        onCreated={onModalCreated}
      />
      {scannerOpen && <PlateScanner onDetected={onPlateScanned} onClose={() => setScannerOpen(false)} />}
    </div>
  )
}
