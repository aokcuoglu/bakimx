"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Loader2, Car, User, Plus, X, UserCog } from "lucide-react"
import { InlineCreateModal, type InlineCreateResult } from "./inline-create-modal"
import { CustomerSearchOrCreate } from "./customer-search-or-create"
import { displayCustomerName, type UnifiedResult, type CustomerLite } from "@/lib/search/unified-results"
import { changeVehicleOwnerAction } from "@/app/(app)/vehicles/actions"

type CustVehicle = { id: string; plate: string; brand: string; model: string }
type Mode = "plate" | "customer"
type Selected =
  | { kind: "vehicle"; customerId: string; vehicleId: string; label: string; sublabel: string }
  | { kind: "customer"; customerId: string; label: string }
  | null

const SEARCH_ENDPOINT = "/api/search/customer-vehicle"

/**
 * Birleşik müşteri+araç seçici (mod-geçişli). Plaka modu (varsayılan) / müşteri modu
 * (kişi ikonu toggle). Seçimi `onChange` ile dışarı iter; `value` yalnızca dış reset'i
 * yansıtır (id'lerden etiketli seçim kurmaz — Faz 3'e ertelendi).
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

  const fixedCustomer = useMemo(
    () => (selected?.kind === "customer" ? { id: selected.customerId, label: selected.label } : undefined),
    [selected]
  )

  useEffect(() => {
    if (selected || query.trim().length < 1) {
      const t = setTimeout(() => setResults([]), 0)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      setLoading(true)
      fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((d) => setResults(Array.isArray(d?.results) ? d.results : []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [query, selected])

  useEffect(() => {
    if (!value.customerId && !value.vehicleId) {
      setTimeout(() => { setSelected(null); setCustVehicles([]); setOwnerMode(false) }, 0)
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
        setSelected({
          kind: "vehicle",
          customerId: veh.customerId || value.customerId,
          vehicleId: veh.id,
          label: `${veh.plate ?? ""} — ${veh.brand ?? ""} ${veh.model ?? ""}`.trim(),
          sublabel: `Sahip: ${displayCustomerName(veh.customer ?? null)}`,
        })
      })
      .catch(() => {})
    return () => { active = false }
  }, [value.vehicleId, value.customerId, selected])

  const modeResults = results.filter((r) => (mode === "plate" ? r.kind === "vehicle" : r.kind === "customer"))

  function switchMode(m: Mode) { setMode(m); setQuery(""); setResults([]) }

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

  function reset() { setSelected(null); setCustVehicles([]); setOwnerMode(false); onChange({ customerId: "", vehicleId: "" }) }

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
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOwnerMode(true)}>
            <UserCog className="size-4 mr-1" /> Sahip Değiştir
          </Button>
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
      <div className="flex items-start gap-2">
        <div className="flex-1">
          {mode === "plate" ? (
            <Combobox
              items={modeResults}
              filter={() => true}
              itemToStringValue={(r: UnifiedResult) => r.label}
              onInputValueChange={(v: string) => setQuery(v)}
              onValueChange={(r: UnifiedResult | null) => { if (r && r.kind === "vehicle") pickVehicle(r) }}
            >
              <ComboboxInput showTrigger={false} placeholder="Plaka ile ara…" />
              <ComboboxContent>
                <ComboboxEmpty className="p-0">
                  {loading ? (
                    <span className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Aranıyor…</span>
                  ) : query.trim().length >= 1 ? (
                    <div className="flex w-full flex-wrap items-center gap-2 p-2">
                      <span className="text-xs text-muted-foreground">«{query.trim()}» yok —</span>
                      <Button type="button" size="sm" onClick={() => setModalOpen(true)}><Plus className="size-4 mr-1" /> Oluştur</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setModalOpen(true)}>Oluştur ve Düzenle</Button>
                    </div>
                  ) : (
                    <span className="py-2 text-sm text-muted-foreground">Plaka yazın</span>
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
        {/* Mod toggle: kişi ikonu — aktifse müşteri modu */}
        <Button
          type="button"
          variant={mode === "customer" ? "default" : "outline"}
          size="icon"
          aria-label={mode === "customer" ? "Plaka aramaya dön" : "Müşteri ara"}
          aria-pressed={mode === "customer"}
          onClick={() => switchMode(mode === "customer" ? "plate" : "customer")}
        >
          <User className="size-4" />
        </Button>
      </div>

      <InlineCreateModal open={modalOpen} onOpenChange={setModalOpen} initialPlate={query.trim()} onCreated={onModalCreated} />
    </div>
  )
}
