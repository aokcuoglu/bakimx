# Faz 2b: Birleşik Picker UI (inline modal + picker + wizard entegrasyonu) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Müşteri ve aracı tek searchable input'tan seçtiren bir picker + DB'de yoksa aynı ekranda inline oluşturan bir modal kurmak ve bunları intake (kabul) sihirbazının 1-2. adımlarının yerine koymak.

**Architecture:** `CustomerVehiclePicker` istemci bileşeni Faz 2a'nın `GET /api/search/customer-vehicle?q=` endpoint'ini debounce'lu sorgular; araç seçilince hem aracı hem güncel sahibini, müşteri seçilince müşteriyi (+ araçlarını) set eder; sonuç yoksa `InlineCreateModal`'ı açar (müşteri → POST /api/customers, sonra araç → POST /api/vehicles). Seçili araçta "Sahip değiştir" Faz 2a'nın `changeVehicleOwnerAction`'ını çağırır. Picker, intake-wizard'ın react-hook-form alanlarına (`selectedCustomerId`, `selectedVehicleId`) `value`/`onChange` ile bağlanır. Sıfır şema değişikliği; tüm alanlar mevcut.

**Tech Stack:** Next.js 16 (client components + server actions), React 19, @base-ui/react Dialog, react-hook-form, TypeScript strict, Bun.

## Global Constraints

- **Tenant izolasyonu:** UI yalnızca server-tarafı (workshop-kapsamlı) endpoint/action çağırır; client hiçbir workshopId üretmez/iletmez.
- **Şema değişikliği YOK.** Mevcut `POST /api/customers`, `POST /api/vehicles`, `GET /api/vehicles?customerId=`, Faz 2a `GET /api/search/customer-vehicle`, `changeVehicleOwnerAction` kullanılır.
- **UI desenleri:** combobox için `quote-create-form.tsx:285-328` deseni (Input + mutlak konumlu dropdown + ghost Button satırları); modal için `src/components/ui/dialog.tsx` (`open`/`onOpenChange`); inline yükleme için `Loader2 className="size-4 animate-spin"` (skeleton KULLANMA; tam-sayfa yüklemeler BrandSpinner ama burada inline). Form alanları için `customer-create-form.tsx` / `vehicle-create-form.tsx` alan desenleri.
- **TypeScript strict; `any` kullanma** (zorunlu durumda `// eslint-disable-line` ile gerekçele — fetch JSON narrowing dışında kaçın).
- **UI metinleri Türkçe.** Plaka büyük harfe çevrilir.
- **Dokunma:** `.env`, prod config, `patches/`, schema.
- **Paket yöneticisi bun.** `bun run typecheck/lint/build`, `bun test`. **`bun install`/`add`/`update` YOK.**
- **Commit'ler küçük; branch `feat/unified-work-order-flow` (izole worktree);** her mesaj şu satırla biter:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Çalışma dizini:** worktree `/Users/void/www/bakimx/.claude/worktrees/unified-work-order`.

> **Test stratejisi:** Bu görevler UI/istemci bileşenleridir; proje UI test harness'i yok. Doğrulama: `bun run typecheck` + `bun run lint` + `bun run build` + ertelenen manuel QA (yerel DB yok). `bun test` mevcut 23 testin yeşil kaldığını teyit eder.

---

### Task 1: Inline "müşteri + araç oluştur" modalı

`InlineCreateModal` — Dialog içinde müşteri (bireysel/kurumsal, telefon, e-posta, VIP, TC/VKN) + araç (plaka, marka, model, yıl) alanları; "Oluştur" iki adımda kaydeder (önce müşteri, dönen id ile araç) ve seçer; "Oluştur ve Düzenle" kaydedip araç düzenleme sayfasına gider.

**Files:**
- Create: `src/components/app/inline-create-modal.tsx`

**Interfaces:**
- Consumes: `POST /api/customers` (FormData → `{success,id}|{error}`), `POST /api/vehicles` (FormData, gerekli `customerId,plate,brand,model` → `{success,id}|{error}`); `Dialog*` from `@/components/ui/dialog`; `Input`, `Label`, `Button`, `Select*`, `Checkbox`.
- Produces: `type InlineCreateResult = { customerId: string; vehicleId: string }`; `<InlineCreateModal open onOpenChange initialPlate? onCreated />` where `onCreated(result: InlineCreateResult): void`. Task 2 tüketir.

- [ ] **Step 1: Bileşeni oluştur**

`src/components/app/inline-create-modal.tsx`:

```tsx
"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"

export type InlineCreateResult = { customerId: string; vehicleId: string }

export function InlineCreateModal({
  open,
  onOpenChange,
  initialPlate,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPlate?: string
  onCreated: (result: InlineCreateResult) => void
}) {
  const [type, setType] = useState<"individual" | "corporate">("individual")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [isVip, setIsVip] = useState(false)
  const [identityNumber, setIdentityNumber] = useState("")
  const [taxNumber, setTaxNumber] = useState("")
  const [plate, setPlate] = useState((initialPlate || "").toUpperCase())
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [modelYear, setModelYear] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleCreate(edit: boolean) {
    setError("")
    if (!phone.trim()) { setError("Telefon zorunludur"); return }
    if (type === "individual" && !firstName.trim()) { setError("Ad zorunludur"); return }
    if (type === "corporate" && !companyName.trim()) { setError("Şirket adı zorunludur"); return }
    if (!plate.trim() || !brand.trim() || !model.trim()) { setError("Plaka, marka ve model zorunludur"); return }

    setLoading(true)
    try {
      const cf = new FormData()
      cf.set("type", type)
      if (type === "individual") { cf.set("firstName", firstName); cf.set("lastName", lastName) }
      else { cf.set("companyName", companyName) }
      cf.set("phone", phone)
      if (email) cf.set("email", email)
      if (isVip) cf.set("tag", "vip")
      if (identityNumber) cf.set("identityNumber", identityNumber)
      if (taxNumber) cf.set("taxNumber", taxNumber)
      const cRes = await fetch("/api/customers", { method: "POST", body: cf })
      const cData = await cRes.json()
      if (!cData?.success) { setError(cData?.error || "Müşteri oluşturulamadı"); setLoading(false); return }
      const customerId: string = cData.id

      const vf = new FormData()
      vf.set("customerId", customerId)
      vf.set("plate", plate)
      vf.set("brand", brand)
      vf.set("model", model)
      if (modelYear) vf.set("modelYear", modelYear)
      const vRes = await fetch("/api/vehicles", { method: "POST", body: vf })
      const vData = await vRes.json()
      if (!vData?.success) { setError(vData?.error || "Araç oluşturulamadı (müşteri oluşturuldu)"); setLoading(false); return }
      const vehicleId: string = vData.id

      setLoading(false)
      if (edit) { window.location.href = `/vehicles/${vehicleId}`; return }
      onCreated({ customerId, vehicleId })
      onOpenChange(false)
    } catch {
      setError("Bir hata oluştu")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni müşteri & araç</DialogTitle>
          <DialogDescription>Kaydı oluşturup seçili hale getirin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" variant={type === "individual" ? "default" : "outline"} className="flex-1" onClick={() => setType("individual")}>Bireysel</Button>
            <Button type="button" variant={type === "corporate" ? "default" : "outline"} className="flex-1" onClick={() => setType("corporate")}>Kurumsal</Button>
          </div>

          {type === "individual" ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Ad *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div className="space-y-1"><Label>Soyad</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
          ) : (
            <div className="space-y-1"><Label>Şirket adı *</Label><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Telefon *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></div>
            <div className="space-y-1"><Label>E-posta</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>{type === "individual" ? "TC Kimlik No" : "Vergi No (VKN)"}</Label>
              <Input value={type === "individual" ? identityNumber : taxNumber} onChange={(e) => (type === "individual" ? setIdentityNumber : setTaxNumber)(e.target.value)} inputMode="numeric" /></div>
            <label className="flex items-center gap-2 pt-6 text-sm"><Checkbox checked={isVip} onCheckedChange={(v) => setIsVip(v === true)} /> VIP müşteri</label>
          </div>

          <div className="border-t border-border pt-3 grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Plaka *</Label><Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} /></div>
            <div className="space-y-1"><Label>Yıl</Label><Input value={modelYear} onChange={(e) => setModelYear(e.target.value)} inputMode="numeric" /></div>
            <div className="space-y-1"><Label>Marka *</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></div>
            <div className="space-y-1"><Label>Model *</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleCreate(true)} disabled={loading}>Oluştur ve Düzenle</Button>
            <Button type="button" onClick={() => handleCreate(false)} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Oluştur"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

> Not: `Checkbox` API'sini doğrula — `src/components/ui/checkbox.tsx`'i aç; `onCheckedChange` imzası farklıysa (ör. `(checked: boolean)`) ona uyarla (`v === true` yerine `v`). Diğer importların yolları için mevcut `customer-create-form.tsx`'e bak.

- [ ] **Step 2: typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: typecheck 0; lint yeni sorun yok; build exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/inline-create-modal.tsx
git commit -m "feat: add inline create customer+vehicle modal" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Manuel QA (ertelendi):** Modal açılır; bireysel/kurumsal geçişi; eksik zorunlu alan → hata; "Oluştur" → müşteri+araç oluşur, `onCreated` çağrılır; "Oluştur ve Düzenle" → `/vehicles/{id}`'e gider; var olan plaka → araç hatası (müşteri oluştu uyarısı).

---

### Task 2: `CustomerVehiclePicker` birleşik picker bileşeni

Tek input → debounce'lu birleşik arama → araç/müşteri seç; müşteri seçilince araçlarını listele; sonuç yoksa modal; seçili araçta "Sahip değiştir".

**Files:**
- Create: `src/components/app/customer-vehicle-picker.tsx`

**Interfaces:**
- Consumes: `GET /api/search/customer-vehicle?q=` → `{ results: UnifiedResult[] }`; `GET /api/vehicles?customerId=` → tam araç dizisi; `changeVehicleOwnerAction(vehicleId, newCustomerId)` from `@/app/(app)/vehicles/actions`; `InlineCreateModal` (Task 1); `type UnifiedResult` from `@/lib/search/unified-results`.
- Produces: `<CustomerVehiclePicker value={{customerId, vehicleId}} onChange={(v)=>...} />`. Task 3 tüketir.

- [ ] **Step 1: Bileşeni oluştur**

`src/components/app/customer-vehicle-picker.tsx`:

```tsx
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
  value,
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
    if (selected || query.trim().length < 1) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(() => {
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
    if (!ownerMode || ownerQuery.trim().length < 1) { setOwnerResults([]); return }
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
```

> Not: `changeVehicleOwnerAction` bir server action; istemci bileşeninden doğrudan import edilip çağrılması Next.js'te desteklenir. Dönüş `{success,id}|{error}` olduğundan `"error" in res` ile daraltılır. `r.kind === "customer"` filtresinin tip-koruması (`x is Extract<...>`) ownerResults'u daraltır. Açık-dropdown dışına tıklayınca kapatma (blur/outside-click) bu MVP'de zorunlu değil; istenirse `onBlur` ile eklenebilir (focus kaybında 150ms gecikmeli kapat).

- [ ] **Step 2: typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: typecheck 0; lint yeni sorun yok; build exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/customer-vehicle-picker.tsx
git commit -m "feat: add unified customer+vehicle searchable picker" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Manuel QA (ertelendi):** Plaka yaz → eşleşen araç (sahip alt-etiketiyle) → seç → özet + "Sahip değiştir"; müşteri adı yaz → müşteri seç → araçları listelenir → araç seç; sonuç yok → "Oluştur" → modal → oluşturunca seçili; "Sahip değiştir" → yeni müşteri ara/seç → sahip güncellenir.

---

### Task 3: Picker'ı intake-wizard adım 1-2'ye bağla

Sihirbazın ayrı Müşteri (adım 1) ve Araç (adım 2) `Select`'lerini tek `CustomerVehiclePicker` ile değiştir. İki adım tek "Müşteri & Araç" adımına iner.

**Files:**
- Modify: `src/components/app/intake-wizard.tsx`

**Interfaces:**
- Consumes: `CustomerVehiclePicker` (Task 2). Wizard form alanları `selectedCustomerId`, `selectedVehicleId` (mevcut).
- Produces: yok (entegrasyon).

- [ ] **Step 1: Picker'ı import et ve adım 1'i değiştir**

`src/components/app/intake-wizard.tsx` üstüne import ekle:

```tsx
import { CustomerVehiclePicker } from "./customer-vehicle-picker"
```

Adım 1 kartının (şu an müşteri `Select` + inline yeni-müşteri modu, ~satır 354-469) GÖVDESİNİ, picker'ı render eden tek bir blokla değiştir. Picker `selectedCustomerId`/`selectedVehicleId`'yi birlikte yönettiği için ayrı araç adımına gerek kalmaz:

```tsx
{step === 1 && (
  <Card>
    <CardHeader><CardTitle className="text-base">Müşteri & Araç</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <CustomerVehiclePicker
        value={{ customerId: selectedCustomerId, vehicleId: selectedVehicleId }}
        onChange={(v) => {
          form.setValue("selectedCustomerId", v.customerId, { shouldValidate: true })
          form.setValue("selectedVehicleId", v.vehicleId, { shouldValidate: true })
        }}
      />
      <div className="flex justify-end">
        <Button type="button" className="h-12" disabled={!selectedCustomerId || !selectedVehicleId}
          onClick={() => setStep(3)}>
          Devam <ArrowRight className="size-4 ml-1" />
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

> Not: `selectedCustomerId`/`selectedVehicleId` zaten `form.watch(...)` ile yukarıda tanımlı (satır 96-97). "Devam" araç da seçilince aktif olur ve adım 3'e (Kabul detayı) geçer; ESKİ adım 2 (araç `Select`) tamamen kaldırılır.

- [ ] **Step 2: Eski adım 2 kartını ve artık kullanılmayan kodu kaldır**

- ESKİ adım 2 bloğunu (vehicle `Select` kartı, `{step === 2 && (...)}`, ~satır 471-609) SİL.
- Artık kullanılmayanları kaldır: `vehicles`, `vehicleLoading`, `newCustomerMode`, `newVehicleMode` state'leri; `useEffect` ile `selectedCustomerId` değişince `/api/vehicles` çeken blok (satır 109-120); `handleCreateCustomer` (136-171) ve `handleCreateVehicle` (174-207) (artık picker/modal hallediyor); bunlara bağlı `new*` form alanları kullanılmıyorsa default'larda bırakılabilir ama JSX referansları kaldırılmalı.
- Adım göstergesi/STEPS dizisini, Müşteri ve Araç'ı tek "Müşteri & Araç" adımına indiritecek şekilde güncelle (STEPS'ten araç adımını çıkar veya birleştir). Adım numaralandırmasını koru: bu MVP'de en güvenlisi adım 1 = Müşteri & Araç, adım 3 = Kabul detayı kalsın; adım 2'yi atla VEYA STEPS etiketlerini sadeleştir. Mevcut `nextStep`/ilerleme mantığını bozma — yalnızca araç adımını devre dışı bırak.

> Bu adım dosyaya özgüdür; uygulayıcı `intake-wizard.tsx`'i okuyup yukarıdaki kaldırmaları yapar. Hedef: derleme yeşil, picker adım 1'de çalışır, eski ayrı araç adımı yok, kullanılmayan import/state/handler kalmaz (lint temiz).

- [ ] **Step 3: typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: typecheck 0; lint YENİ uyarı yok (kullanılmayan değişken/import bırakma); build exit 0. (Mevcut ~9 önceden-var-olan uyarı kalabilir; intake-wizard'ın `form.watch` uyarısı zaten o listede.)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/intakes/components 2>/dev/null; git add src/components/app/intake-wizard.tsx
git commit -m "feat: use unified customer+vehicle picker in intake wizard" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Manuel QA (ertelendi):** `/intakes/new` → adım 1'de tek arama kutusu; plaka/ad ile seç veya oluştur; "Devam" → Kabul detayı; eski ayrı araç adımı yok; kabul oluşturma uçtan uca çalışır (Faz 1 auto-order ile).

---

## Faz 2b kapsam dışı / sonraki

- Dropdown dışına tıklayınca kapatma (outside-click) — istenirse küçük ekleme.
- Faz 3 (dikey kaydırmalı akış) bu picker'ı yeni kabuk içinde yeniden kullanır.
- Faz 2 (2a+2b) tamamlanınca: ONE final whole-branch review (opus) → PR #5 push/güncelle.
