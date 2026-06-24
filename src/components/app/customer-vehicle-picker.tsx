"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Car, User, Plus, X, UserCog } from "lucide-react"
import { InlineCreateModal, type InlineCreateResult } from "./inline-create-modal"
import type { UnifiedResult } from "@/lib/search/unified-results"
import { changeVehicleOwnerAction } from "@/app/(app)/vehicles/actions"

type CustVehicle = { id: string; plate: string; brand: string; model: string }

type Selected =
  | { kind: "vehicle"; customerId: string; vehicleId: string; label: string; sublabel: string }
  | { kind: "customer"; customerId: string; label: string }
  | null

const SEARCH_ENDPOINT = "/api/search/customer-vehicle"

export function CustomerVehiclePicker({
  value: _value,
  onChange,
}: {
  value: { customerId: string; vehicleId: string }
  onChange: (v: { customerId: string; vehicleId: string }) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UnifiedResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Selected>(null)
  const [custVehicles, setCustVehicles] = useState<CustVehicle[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [ownerMode, setOwnerMode] = useState(false)
  const [ownerQuery, setOwnerQuery] = useState("")
  const [ownerResults, setOwnerResults] = useState<Extract<UnifiedResult, { kind: "customer" }>[]>([])
  const [ownerBusy, setOwnerBusy] = useState(false)

  // Birincil arama (debounce 250ms)
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

  // Sahip-değiştir araması (yalnızca müşteri sonuçları)
  useEffect(() => {
    if (!ownerMode || ownerQuery.trim().length < 1) {
      const t = setTimeout(() => setOwnerResults([]), 0)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(ownerQuery.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          const list: UnifiedResult[] = Array.isArray(d?.results) ? d.results : []
          setOwnerResults(list.filter((x): x is Extract<UnifiedResult, { kind: "customer" }> => x.kind === "customer"))
        })
        .catch(() => setOwnerResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [ownerQuery, ownerMode])

  function pickVehicle(r: Extract<UnifiedResult, { kind: "vehicle" }>) {
    setSelected({ kind: "vehicle", customerId: r.customerId, vehicleId: r.vehicleId, label: r.label, sublabel: r.sublabel })
    onChange({ customerId: r.customerId, vehicleId: r.vehicleId })
    setQuery(""); setResults([])
  }

  function pickCustomer(r: Extract<UnifiedResult, { kind: "customer" }>) {
    setSelected({ kind: "customer", customerId: r.customerId, label: r.label })
    onChange({ customerId: r.customerId, vehicleId: "" })
    setQuery(""); setResults([])
    fetch(`/api/vehicles?customerId=${r.customerId}`)
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

  function reset() {
    setSelected(null); setCustVehicles([]); setOwnerMode(false); onChange({ customerId: "", vehicleId: "" })
  }

  function onModalCreated(r: InlineCreateResult) {
    setSelected({ kind: "vehicle", customerId: r.customerId, vehicleId: r.vehicleId, label: "Yeni araç", sublabel: "Yeni müşteri" })
    onChange({ customerId: r.customerId, vehicleId: r.vehicleId })
    setQuery(""); setResults([])
  }

  async function applyOwner(r: Extract<UnifiedResult, { kind: "customer" }>) {
    if (!selected || selected.kind !== "vehicle") return
    setOwnerBusy(true)
    const res = await changeVehicleOwnerAction(selected.vehicleId, r.customerId)
    setOwnerBusy(false)
    if ("error" in res) return
    setSelected({ ...selected, customerId: r.customerId, sublabel: `Sahip: ${r.label}` })
    onChange({ customerId: r.customerId, vehicleId: selected.vehicleId })
    setOwnerMode(false); setOwnerQuery(""); setOwnerResults([])
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
          <Button type="button" variant="ghost" size="sm" onClick={reset}><X className="size-4" /></Button>
        </div>
        {ownerMode ? (
          <div className="space-y-2">
            <Input autoFocus value={ownerQuery} onChange={(e) => setOwnerQuery(e.target.value)} placeholder="Yeni sahip: müşteri adı veya telefon..." />
            <div className="max-h-40 overflow-y-auto rounded-md border border-border">
              {ownerBusy ? (
                <div className="flex justify-center py-3"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
              ) : ownerResults.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Müşteri aramak için yazın</p>
              ) : ownerResults.map((r) => (
                <Button key={r.customerId} type="button" variant="ghost" className="w-full justify-start rounded-none" onClick={() => applyOwner(r)}>
                  <User className="size-4 mr-2" /> {r.label} <span className="text-muted-foreground ml-2">{r.sublabel}</span>
                </Button>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOwnerMode(false)}>Vazgeç</Button>
          </div>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOwnerMode(true)}>
            <UserCog className="size-4 mr-1" /> Sahip değiştir
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
          <Button type="button" variant="ghost" size="sm" onClick={reset}><X className="size-4" /></Button>
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
        <InlineCreateModal open={modalOpen} onOpenChange={setModalOpen} onCreated={onModalCreated} />
      </div>
    )
  }

  // ——— Arama ———
  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Plaka veya müşteri adı/telefon ile ara..."
        autoComplete="off"
      />
      {open && query.trim().length >= 1 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-64 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
          {loading ? (
            <div className="flex justify-center py-3"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
          ) : results.length === 0 ? (
            <div className="p-3 space-y-2">
              <p className="text-xs text-muted-foreground">«{query.trim()}» için kayıt bulunamadı.</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => setModalOpen(true)}><Plus className="size-4 mr-1" /> Oluştur</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setModalOpen(true)}>Oluştur ve Düzenle</Button>
              </div>
            </div>
          ) : (
            results.map((r) => (
              r.kind === "vehicle" ? (
                <Button key={`v-${r.vehicleId}`} type="button" variant="ghost" className="w-full justify-start rounded-none h-auto py-2" onClick={() => pickVehicle(r)}>
                  <Car className="size-4 mr-2 shrink-0 text-primary" />
                  <span className="text-left"><span className="font-medium text-foreground">{r.label}</span><br /><span className="text-xs text-muted-foreground">{r.sublabel}</span></span>
                </Button>
              ) : (
                <Button key={`c-${r.customerId}`} type="button" variant="ghost" className="w-full justify-start rounded-none h-auto py-2" onClick={() => pickCustomer(r)}>
                  <User className="size-4 mr-2 shrink-0 text-muted-foreground" />
                  <span className="text-left"><span className="font-medium text-foreground">{r.label}</span><br /><span className="text-xs text-muted-foreground">{r.sublabel}</span></span>
                </Button>
              )
            ))
          )}
        </div>
      )}
      <InlineCreateModal open={modalOpen} onOpenChange={setModalOpen} initialPlate={query.trim()} onCreated={onModalCreated} />
    </div>
  )
}
