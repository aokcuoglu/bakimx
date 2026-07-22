# VIN ile arama (İş Emri Adım 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yeni İş Emri sihirbazının 1. adımına, geçerli VIN girildiğinde kayıtlı aracı bulan; kayıt yoksa yeni-araç modalını VIN dolu açıp otomatik decode eden bir "VIN modu" ekle.

**Architecture:** İki bileşen değişir (`customer-vehicle-picker.tsx`, `inline-create-modal.tsx`) + bir saf yardımcı modül (`src/lib/vin/search.ts`). Mevcut arama API'si (`/api/search/customer-vehicle`) VIN'i zaten `contains`/insensitive arıyor ve `/api/vin/resolve` decode'u zaten var — bu yüzden API/şema/migration **değişmez**. Yeni pure `searchQueryFor` mod-duyarlı sorgu çözümünü DRY + test edilebilir kılar.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Base UI (ui/*), lucide-react, bun test.

## Global Constraints

- Şema / migration / API route değişikliği **yasak** — yalnız UI + saf yardımcı.
- TypeScript strict; `any` yok.
- ShadcnUI/Base UI bileşenleri kullan; native/custom kontrol ekleme.
- Tenant izolasyonu mevcut API'de korunur; yeni sorgu noktası eklenmez.
- Web'de bileşen yüksekliği `md+` → `size-9`; mevcut mod butonları `size-11 md:size-9` (dokunma) — aynen kopyala.
- Türkçe UI metni.
- VIN doğrulama tek kaynak: `@/lib/vin/types` `isValidVin` / `normalizeVin` (17 hane, I/O/Q yok). Yeniden yazma.
- Chat yanıtları Türkçe.

---

### Task 1: `searchQueryFor` saf yardımcısı + test

Mod-duyarlı arama-sorgusu çözümünü saf, test edilebilir bir fonksiyona çıkar. `null` = arama atla.

**Files:**
- Create: `src/lib/vin/search.ts`
- Test: `src/lib/vin/search.test.ts`

**Interfaces:**
- Consumes: `isValidVin`, `normalizeVin` from `@/lib/vin/types`.
- Produces:
  - `export type PickerSearchMode = "plate" | "customer" | "vin"`
  - `export function searchQueryFor(mode: PickerSearchMode, query: string): string | null`
    - `"plate"` → `query.trim()` (boşsa `null`)
    - `"customer"` → her zaman `null` (picker-seviyesi arama kapalı; müşteri modu ayrı bileşen kullanır)
    - `"vin"` → geçerli 17-hane VIN ise `normalizeVin(query)`, değilse `null`

- [ ] **Step 1: Failing test yaz**

`src/lib/vin/search.test.ts`:

```ts
import { describe, expect, it } from "bun:test"
import { searchQueryFor } from "./search"

describe("searchQueryFor", () => {
  it("plate mode: trims and returns the raw query", () => {
    expect(searchQueryFor("plate", "  34abc123 ")).toBe("34abc123")
  })
  it("plate mode: blank → null", () => {
    expect(searchQueryFor("plate", "   ")).toBeNull()
  })
  it("customer mode: always null (picker-level search off)", () => {
    expect(searchQueryFor("customer", "ahmet")).toBeNull()
  })
  it("vin mode: valid 17-char VIN → normalized (upper, no spaces)", () => {
    expect(searchQueryFor("vin", " wvwzzz1kz aw000001 ")).toBe("WVWZZZ1KZAW000001")
  })
  it("vin mode: partial VIN → null (no DB call)", () => {
    expect(searchQueryFor("vin", "WVWZZZ1KZ")).toBeNull()
  })
  it("vin mode: 17 chars with illegal O → null", () => {
    expect(searchQueryFor("vin", "WVWZZZ1KZAW0O0001")).toBeNull()
  })
})
```

- [ ] **Step 2: Testi çalıştır, FAIL doğrula**

Run: `cd /Users/void/www/bakimx-vin-arama && bun test src/lib/vin/search.test.ts`
Expected: FAIL — `Cannot find module './search'` (henüz yok).

- [ ] **Step 3: Yardımcıyı yaz**

`src/lib/vin/search.ts`:

```ts
import { isValidVin, normalizeVin } from "./types"

export type PickerSearchMode = "plate" | "customer" | "vin"

/**
 * Picker arama kutusu için mod-duyarlı sorgu çözümü. `null` → arama atlanır.
 * VIN modu yalnız geçerli 17-hane VIN'de (normalize edilerek) arar; kısmi/geçersiz
 * girişte ve müşteri modunda picker-seviyesi arama yapılmaz (gereksiz DB çağrısı yok).
 */
export function searchQueryFor(mode: PickerSearchMode, query: string): string | null {
  const q = query.trim()
  if (!q) return null
  if (mode === "customer") return null
  if (mode === "vin") return isValidVin(q) ? normalizeVin(q) : null
  return q
}
```

- [ ] **Step 4: Testi çalıştır, PASS doğrula**

Run: `cd /Users/void/www/bakimx-vin-arama && bun test src/lib/vin/search.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/void/www/bakimx-vin-arama
git add src/lib/vin/search.ts src/lib/vin/search.test.ts
git commit -m "feat(vin): mod-duyarlı searchQueryFor saf yardımcısı + test

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `InlineCreateModal` — `initialVin` seed + oto-decode

Modalı VIN ile açılabilir yap: açılışta VIN alanını doldur, geçerliyse teknik alanları aç ve ipuçsuz decode'u tetikle.

**Files:**
- Modify: `src/components/app/inline-create-modal.tsx`

**Interfaces:**
- Consumes: mevcut `useVinResolve` hook'u (`vinResolve.resolve(vin, hints)`, `vinResolve.reset()`), `isValidVin` + yeni `normalizeVin` from `@/lib/vin/types`.
- Produces: `initialVin?: string` prop'u (Task 3 bunu kullanır).

- [ ] **Step 1: `normalizeVin` importunu ekle**

`inline-create-modal.tsx:24` — mevcut satır:

```ts
import { isValidVin, type VinCandidate } from "@/lib/vin/types"
```

şununla değiştir:

```ts
import { isValidVin, normalizeVin, type VinCandidate } from "@/lib/vin/types"
```

- [ ] **Step 2: `initialVin` prop'unu imzaya ekle**

`inline-create-modal.tsx:73-85` — bileşen imzasında `initialPlate`'ten hemen sonra prop ekle. Mevcut:

```tsx
export function InlineCreateModal({
  open,
  onOpenChange,
  initialPlate,
  fixedCustomer,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPlate?: string
  fixedCustomer?: { id: string; label: string }
  onCreated: (result: InlineCreateResult) => void
}) {
```

şununla değiştir:

```tsx
export function InlineCreateModal({
  open,
  onOpenChange,
  initialPlate,
  initialVin,
  fixedCustomer,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPlate?: string
  initialVin?: string
  fixedCustomer?: { id: string; label: string }
  onCreated: (result: InlineCreateResult) => void
}) {
```

- [ ] **Step 3: Açılış reset effect'inde VIN seed + oto-decode**

`inline-create-modal.tsx:132-148` — mevcut reset effect'i:

```tsx
  const wasOpen = useRef(false)
  useEffect(() => {
    const justOpened = open && !wasOpen.current
    wasOpen.current = open
    if (!justOpened) return
    setTimeout(() => {
      setOwner(fixedCustomer ?? null)
      setFields({ ...EMPTY_FIELDS, plate: (initialPlate || "").toUpperCase() })
      setError("")
      setLoading(false)
      setOwnerSeed(null)
      setConfidence({})
      setShowDetails(false)
      setExistingMatch(null)
      setCatalogIds({})
      vinResolve.reset()
    }, 0)
  }, [open, initialPlate, fixedCustomer]) // eslint-disable-line react-hooks/exhaustive-deps -- vinResolve is stable-shaped, re-running on its identity would loop
```

şununla değiştir:

```tsx
  const wasOpen = useRef(false)
  useEffect(() => {
    const justOpened = open && !wasOpen.current
    wasOpen.current = open
    if (!justOpened) return
    const seedVin = normalizeVin(initialVin || "")
    const hasVin = isValidVin(seedVin)
    setTimeout(() => {
      setOwner(fixedCustomer ?? null)
      setFields({ ...EMPTY_FIELDS, plate: (initialPlate || "").toUpperCase(), vin: seedVin })
      setError("")
      setLoading(false)
      setOwnerSeed(null)
      setConfidence({})
      // VIN ile açıldıysa teknik alanlar (VIN + sonuç) görünür başlasın.
      setShowDetails(hasVin)
      setExistingMatch(null)
      setCatalogIds({})
      vinResolve.reset()
      // Kullanıcının niyeti "VIN'den bul" → ipuçsuz oto-decode; marka/model/motor
      // beklemeden dolar, belirsizse VinCandidateList görünür.
      if (hasVin) void vinResolve.resolve(seedVin, {})
    }, 0)
  }, [open, initialPlate, initialVin, fixedCustomer]) // eslint-disable-line react-hooks/exhaustive-deps -- vinResolve is stable-shaped, re-running on its identity would loop
```

- [ ] **Step 4: Typecheck + lint**

Run: `cd /Users/void/www/bakimx-vin-arama && bun run typecheck && bun run lint`
Expected: hata yok (0 error). (VIN alanı satır 419-421'de `fields.vin`'e zaten bağlı; seed otomatik görünür.)

- [ ] **Step 5: Commit**

```bash
cd /Users/void/www/bakimx-vin-arama
git add src/components/app/inline-create-modal.tsx
git commit -m "feat(vehicle): InlineCreateModal initialVin seed + oto-decode

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `CustomerVehiclePicker` — VIN modu

Üçüncü mod (VIN) ekle: toggle butonu, mod-duyarlı placeholder/arama/boş-durum/Enter, ve modalın VIN ile açılması.

**Files:**
- Modify: `src/components/app/customer-vehicle-picker.tsx`

**Interfaces:**
- Consumes: `searchQueryFor` + `PickerSearchMode` (Task 1), `isValidVin` + `normalizeVin` (`@/lib/vin/types`), `initialVin` prop (Task 2), lucide `Barcode`.
- Produces: (dışa API yok — bileşen içi).

- [ ] **Step 1: Import'ları güncelle**

`customer-vehicle-picker.tsx:15` lucide importuna `Barcode` ekle. Mevcut:

```ts
import { Loader2, Car, User, Plus, X, UserCog, ScanLine, Info } from "lucide-react"
```

→

```ts
import { Loader2, Car, User, Plus, X, UserCog, ScanLine, Info, Barcode } from "lucide-react"
```

`customer-vehicle-picker.tsx:21` `normalizePlate` importundan sonra iki yeni import satırı ekle:

```ts
import { normalizePlate } from "@/lib/format"
```

→

```ts
import { normalizePlate } from "@/lib/format"
import { isValidVin, normalizeVin } from "@/lib/vin/types"
import { searchQueryFor, type PickerSearchMode } from "@/lib/vin/search"
```

- [ ] **Step 2: `Mode` tipini VIN ile genişlet**

`customer-vehicle-picker.tsx:24` mevcut:

```ts
type Mode = "plate" | "customer"
```

→

```ts
type Mode = PickerSearchMode // "plate" | "customer" | "vin"
```

- [ ] **Step 3: Arama effect'ini mod-duyarlı yap**

`customer-vehicle-picker.tsx:60-74` mevcut effect:

```tsx
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
```

şununla değiştir:

```tsx
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
```

- [ ] **Step 4: `modeResults` filtresini güncelle**

`customer-vehicle-picker.tsx:111` mevcut:

```ts
  const modeResults = results.filter((r) => (mode === "plate" ? r.kind === "vehicle" : r.kind === "customer"))
```

→ (plaka **ve** VIN modları araç sonucu gösterir)

```ts
  const modeResults = results.filter((r) => (mode === "customer" ? r.kind === "customer" : r.kind === "vehicle"))
```

- [ ] **Step 5: Combobox render koşulu + placeholder + input büyük-harf (VIN)**

`customer-vehicle-picker.tsx:262` render koşulu. Mevcut:

```tsx
          {mode === "plate" ? (
```

→

```tsx
          {mode === "plate" || mode === "vin" ? (
```

Aynı Combobox içinde `onInputValueChange` (satır 268) — VIN modunda girişi büyük harfe çevir. Mevcut:

```tsx
              onInputValueChange={(v: string) => setQuery(v)}
```

→

```tsx
              onInputValueChange={(v: string) => setQuery(mode === "vin" ? v.toUpperCase() : v)}
```

`ComboboxInput` placeholder (satır 275). Mevcut:

```tsx
                placeholder="Plaka ile ara…"
```

→

```tsx
                placeholder={mode === "vin" ? "VIN ile ara…" : "Plaka ile ara…"}
```

- [ ] **Step 6: Enter davranışını mod-duyarlı yap**

`customer-vehicle-picker.tsx:287-290` — `onKeyDown` içindeki karar bloğu. Mevcut:

```tsx
                  if (loading) return
                  const first = modeResults[0]
                  if (first && first.kind === "vehicle") pickVehicle(first)
                  else if (query.trim()) setModalOpen(true)
```

şununla değiştir:

```tsx
                  if (loading) return
                  const first = modeResults[0]
                  if (first && first.kind === "vehicle") { pickVehicle(first); return }
                  // Eşleşme yok: plaka modu her metinde modalı açar; VIN modu yalnız
                  // geçerli 17-hane VIN'de (kısmi girişte Enter no-op).
                  if (mode === "vin") { if (isValidVin(query)) setModalOpen(true) }
                  else if (query.trim()) setModalOpen(true)
```

- [ ] **Step 7: Boş-durumu mod-duyarlı yap**

`customer-vehicle-picker.tsx:294-305` — `ComboboxEmpty` içeriği. Mevcut:

```tsx
                <ComboboxEmpty className="p-0">
                  {loading ? (
                    <span className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Aranıyor…</span>
                  ) : query.trim().length >= 1 ? (
                    <div className="flex w-full flex-wrap items-center gap-2 p-2">
                      <span className="text-xs text-muted-foreground">«{query.trim()}» yok —</span>
                      <Button type="button" size="sm" onClick={() => setModalOpen(true)}><Plus className="size-4 mr-1" /> Oluştur</Button>
                    </div>
                  ) : (
                    <span className="py-2 text-sm text-muted-foreground">Plaka yazın</span>
                  )}
                </ComboboxEmpty>
```

şununla değiştir:

```tsx
                <ComboboxEmpty className="p-0">
                  {loading ? (
                    <span className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Aranıyor…</span>
                  ) : mode === "vin" ? (
                    isValidVin(query) ? (
                      <div className="flex w-full flex-wrap items-center gap-2 p-2">
                        <span className="text-xs text-muted-foreground">«{normalizeVin(query)}» yok —</span>
                        <Button type="button" size="sm" onClick={() => setModalOpen(true)}><Plus className="size-4 mr-1" /> VIN'den araç oluştur</Button>
                      </div>
                    ) : (
                      <span className="py-2 text-sm text-muted-foreground">17 haneli VIN yazın</span>
                    )
                  ) : query.trim().length >= 1 ? (
                    <div className="flex w-full flex-wrap items-center gap-2 p-2">
                      <span className="text-xs text-muted-foreground">«{query.trim()}» yok —</span>
                      <Button type="button" size="sm" onClick={() => setModalOpen(true)}><Plus className="size-4 mr-1" /> Oluştur</Button>
                    </div>
                  ) : (
                    <span className="py-2 text-sm text-muted-foreground">Plaka yazın</span>
                  )}
                </ComboboxEmpty>
```

- [ ] **Step 8: VIN mod-toggle butonunu ekle**

`customer-vehicle-picker.tsx:335-346` — kişi (müşteri) toggle butonundan **hemen önce** VIN butonunu ekle. Mevcut blok başı:

```tsx
        {/* Mod toggle: kişi ikonu — aktifse müşteri modu */}
        <Button
          type="button"
          variant={mode === "customer" ? "default" : "outline"}
```

şununla değiştir (VIN butonu + yorum, kişi butonu aynen korunur):

```tsx
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
```

- [ ] **Step 9: Modal çağrısını mod-duyarlı yap (`initialVin`)**

`customer-vehicle-picker.tsx:349` mevcut:

```tsx
      <InlineCreateModal open={modalOpen} onOpenChange={setModalOpen} initialPlate={query.trim()} onCreated={onModalCreated} />
```

şununla değiştir:

```tsx
      <InlineCreateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialPlate={mode === "vin" ? undefined : query.trim()}
        initialVin={mode === "vin" ? normalizeVin(query) : undefined}
        onCreated={onModalCreated}
      />
```

- [ ] **Step 10: Typecheck + lint + tüm testler**

Run:
```bash
cd /Users/void/www/bakimx-vin-arama && bun run typecheck && bun run lint && bun test
```
Expected: typecheck 0 error, lint 0 error, `bun test` → önceki 301 + 6 yeni = 307 pass, 0 fail.

- [ ] **Step 11: Commit**

```bash
cd /Users/void/www/bakimx-vin-arama
git add src/components/app/customer-vehicle-picker.tsx
git commit -m "feat(orders): iş emri Adım 1'e VIN ile arama modu

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Bütünsel doğrulama (build + manuel QA notu)

**Files:** (yok — doğrulama)

- [ ] **Step 1: Prod build**

Run: `cd /Users/void/www/bakimx-vin-arama && bun run build`
Expected: build başarılı (Adım 1'i içeren `/orders/new` route'u derlenir, hata yok).

- [ ] **Step 2: Manuel QA (dev server, mobil viewport)**

`bun run dev` (gerekirse `bun run db:tunnel` açık). `/orders/new`:
1. VIN butonuna bas → placeholder "VIN ile ara…", kamera-tara butonu gizli, buton `default` (dolu) görünür.
2. Kayıtlı aracın VIN'ini yaz → araç sonucu listelenir; seçilince özet kartı doğru (plaka — marka model, sahip).
3. Kayıtsız geçerli VIN → "VIN'den araç oluştur" / Enter → modal VIN dolu + teknik alanlar açık + decode otomatik (marka/model/motor dolar veya aday listesi). Plakayı elle gir → Oluştur → picker aracı seçili gösterir.
4. Kısmi/geçersiz VIN → arama atılmaz, boş-durum "17 haneli VIN yazın", Enter no-op.
5. Regresyon: plaka modu (kamera dahil) ve müşteri modu eskisi gibi.

- [ ] **Step 3: (doğrulama-only, commit yok)**

Build/QA sonuçlarını raporla. Kod commit'leri Task 1-3'te tamamlandı.

---

## Self-Review

**Spec coverage:**
- VIN modu UI (toggle/placeholder/gizli kamera) → Task 3 (Step 1,5,8). ✓
- Geçerli-VIN-de arama + kayıtlı seç → Task 1 (`searchQueryFor`) + Task 3 (Step 3,4,6). ✓
- Kayıt yoksa VIN dolu modal + oto-decode → Task 2 + Task 3 (Step 7,9). ✓
- Plaka gelmez / kullanıcı elle girer → Task 2 (VIN seed yalnız `vin`, `plate` boş) + QA Step 2.3. ✓
- RapidAPI kotası (yalnız geçerli VIN'de çağrı) → Task 1 gating + Task 2 `hasVin` guard. ✓
- Feature gate davranış değişmez → değişiklik yok (mevcut `vinResolve.error` yolu). ✓
- API/şema değişmez → Global Constraints + hiçbir task route/schema'ya dokunmaz. ✓
- Test → Task 1 (6 unit) + Task 4 (build + manuel QA). ✓

**Placeholder scan:** Tüm kod-adımları tam kod içeriyor; TBD/TODO yok. ✓

**Type consistency:** `searchQueryFor(mode, query)` — `mode: PickerSearchMode`; picker `type Mode = PickerSearchMode` (Task 3 Step 2) → uyumlu. `initialVin?: string` Task 2'de tanımlı, Task 3 Step 9'da tüketilir. `vinResolve.resolve(seedVin, {})` — imza `resolve(vin: string, hints: RuhsatHints)`, `{}` boş ipucu geçerli (tüm alanlar opsiyonel). ✓
