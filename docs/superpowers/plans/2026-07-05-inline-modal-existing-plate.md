# InlineCreateModal — Mevcut Plaka Çakışmasını Seçime Dönüştür — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İş emri/teklif akışındaki `InlineCreateModal`'da, girilen plaka DB'de zaten kayıtlıysa çıkmaz-sokak hatası yerine mevcut aracı bulup tek tıkla seçime dönüştürmek.

**Architecture:** Risk taşıyan saf mantık (contains araması sonuçlarından birebir plaka eşiti seçmek) `src/lib/search/exact-plate-match.ts`'e çıkarılıp `bun test` ile TDD edilir. React kablolaması (`inline-create-modal.tsx`) bu helper'ı debounce'lu bir effect'te ve submit güvenlik ağında kullanır; eşleşme bulununca mevcut `onCreated` callback'i ile aracı seçtirir. Yeni backend, yeni endpoint, yeni prop yok.

**Tech Stack:** Next.js 16 (App Router), React client component, TypeScript strict, `bun test`, mevcut `/api/search/customer-vehicle` endpoint'i, `normalizePlate` (`@/lib/format`).

## Global Constraints

- TypeScript strict; `any` kullanma.
- ShadcnUI/Base UI bileşenleri; native/custom UI ekleme. Modal zaten mevcut bileşenleri kullanıyor.
- Component yüksekliği web'de `h-9` (yeni buton eklenirse mevcut modal butonlarıyla aynı boyut).
- Tenant izolasyonu: yeni sorgu yok — mevcut `/api/search/customer-vehicle` zaten `requireAuth()` + `workshopId` filtreliyor.
- Mobile-first; kart mevcut modal genişliğine (`sm:max-w-lg`) sığmalı.
- Sadece iki dosya değişir/eklenir: `src/lib/search/exact-plate-match.ts` (+ testi) ve `src/components/app/inline-create-modal.tsx`. `createVehicleAction`, `/api/vehicles`, arama endpoint'i, `CustomerVehiclePicker` **değişmez**.
- Türkçe kullanıcı-yüzü metinler.

---

### Task 1: Birebir plaka eşleştirme helper'ı (saf mantık, TDD)

**Files:**
- Create: `src/lib/search/exact-plate-match.ts`
- Test: `src/lib/search/exact-plate-match.test.ts`

**Interfaces:**
- Consumes: `UnifiedResult` (`@/lib/search/unified-results`), `normalizePlate` (`@/lib/format`).
- Produces:
  - `type ExistingVehicleMatch = { vehicleId: string; customerId: string; label: string; sublabel: string }`
  - `function findExactPlateMatch(results: UnifiedResult[], plate: string): ExistingVehicleMatch | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/search/exact-plate-match.test.ts`:

```ts
import { test, expect } from "bun:test"
import { findExactPlateMatch } from "./exact-plate-match"
import type { UnifiedResult } from "./unified-results"

const vehicle = (plate: string, id = "v1"): UnifiedResult => ({
  kind: "vehicle",
  vehicleId: id,
  customerId: `c-${id}`,
  plate,
  label: `${plate} — Peugeot Boxer`,
  sublabel: "Sahip: Ahmet Kaya",
})

const customer: UnifiedResult = { kind: "customer", customerId: "cX", label: "Ahmet Kaya", sublabel: "0555" }

test("returns the vehicle whose plate matches exactly (ignoring spacing/case)", () => {
  const results = [customer, vehicle("34 MYL 739")]
  expect(findExactPlateMatch(results, "34myl739")).toEqual({
    vehicleId: "v1",
    customerId: "c-v1",
    label: "34 MYL 739 — Peugeot Boxer",
    sublabel: "Sahip: Ahmet Kaya",
  })
})

test("does not match a plate that only contains the query", () => {
  const results = [vehicle("34 MYL 7391")]
  expect(findExactPlateMatch(results, "34 MYL 739")).toBeNull()
})

test("returns null for blank plate", () => {
  expect(findExactPlateMatch([vehicle("34 MYL 739")], "   ")).toBeNull()
})

test("ignores customer results", () => {
  expect(findExactPlateMatch([customer], "34 MYL 739")).toBeNull()
})

test("returns the first exact match when duplicates exist", () => {
  const results = [vehicle("34 MYL 739", "a"), vehicle("34 MYL 739", "b")]
  expect(findExactPlateMatch(results, "34 MYL 739")?.vehicleId).toBe("a")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/search/exact-plate-match.test.ts`
Expected: FAIL — `Cannot find module './exact-plate-match'` (veya `findExactPlateMatch is not a function`).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/search/exact-plate-match.ts`:

```ts
import { normalizePlate } from "@/lib/format"
import type { UnifiedResult } from "./unified-results"

export type ExistingVehicleMatch = {
  vehicleId: string
  customerId: string
  label: string
  sublabel: string
}

/**
 * Arama sonuçları (contains araması geniş döner) içinden birebir plaka eşiti
 * aracı seçer. Plaka boşluk/noktalama farkları normalize edilerek karşılaştırılır.
 * Eşleşme yoksa null.
 */
export function findExactPlateMatch(
  results: UnifiedResult[],
  plate: string,
): ExistingVehicleMatch | null {
  const target = normalizePlate(plate)
  if (!target) return null
  for (const r of results) {
    if (r.kind !== "vehicle") continue
    if (normalizePlate(r.plate) === target) {
      return { vehicleId: r.vehicleId, customerId: r.customerId, label: r.label, sublabel: r.sublabel }
    }
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/search/exact-plate-match.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: hata yok.

- [ ] **Step 6: Commit**

```bash
git add src/lib/search/exact-plate-match.ts src/lib/search/exact-plate-match.test.ts
git commit -m "feat(search): exact-plate match helper for existing-vehicle detection"
```

---

### Task 2: Modalda erken tespit + eşleşme kartı + submit güvenlik ağı

**Files:**
- Modify: `src/components/app/inline-create-modal.tsx`

**Interfaces:**
- Consumes: `findExactPlateMatch`, `ExistingVehicleMatch` (Task 1); mevcut `normalizePlate` (`@/lib/format`); mevcut `onCreated` prop'u (`InlineCreateResult`).
- Produces: (dış arayüz değişmez — sadece iç davranış.)

Bu görev tek bir React client component'inin davranış değişikliği. Bu repoda component test harness'ı (jsdom/testing-library) yok — tüm mevcut testler saf `src/lib` mantığı. Bu yüzden Task 2 typecheck + lint + build + manuel QA ile doğrulanır (yeni test altyapısı eklemek proje kuralına aykırı).

- [ ] **Step 1: Import helper ve normalizePlate**

`inline-create-modal.tsx` üstündeki import bloğuna ekle (mevcut importların yanına):

```ts
import { normalizePlate } from "@/lib/format"
import { findExactPlateMatch, type ExistingVehicleMatch } from "@/lib/search/exact-plate-match"
```

- [ ] **Step 2: State ekle**

`const [showDetails, setShowDetails] = useState(false)` satırının hemen altına:

```ts
  // Girilen plaka DB'de zaten kayıtlıysa: mevcut aracı seçime dönüştürmek için tutulur.
  const [existingMatch, setExistingMatch] = useState<ExistingVehicleMatch | null>(null)
```

- [ ] **Step 3: Açılış reset'ine ekle**

Mevcut `justOpened` effect'inin `setTimeout` gövdesindeki `setShowDetails(false)` satırının altına ekle:

```ts
      setExistingMatch(null)
```

- [ ] **Step 4: Debounce'lu tespit effect'i ekle**

`justOpened` effect'inin hemen altına yeni bir effect ekle:

```ts
  // Plaka değişince mevcut aracı ara (debounce). contains araması → client'ta
  // birebir plaka filtresi. Modal kapalıyken çalışmaz.
  useEffect(() => {
    if (!open) return
    const plate = normalizePlate(fields.plate)
    if (plate.length < 5) { setExistingMatch(null); return }
    let active = true
    const t = setTimeout(() => {
      fetch(`/api/search/customer-vehicle?q=${encodeURIComponent(fields.plate.trim())}`)
        .then((r) => r.json())
        .then((d: unknown) => {
          if (!active) return
          const results = Array.isArray((d as { results?: unknown })?.results)
            ? (d as { results: import("@/lib/search/unified-results").UnifiedResult[] }).results
            : []
          setExistingMatch(findExactPlateMatch(results, fields.plate))
        })
        .catch(() => { if (active) setExistingMatch(null) })
    }, 400)
    return () => { active = false; clearTimeout(t) }
  }, [open, fields.plate])
```

- [ ] **Step 5: "Bu aracı seç" handler'ı ekle**

`handleCreate` fonksiyonunun hemen üstüne ekle:

```ts
  // Kart: mevcut aracı, DB'deki gerçek sahibiyle seç. onCreated picker'a araç
  // seçimi olarak yansır. brand/model ayrı alan yok → label'ın " — " kuyruğu
  // brand olarak geçer, model boş (picker etiketi "PLAKA — Marka Model" kalır).
  function selectExisting() {
    if (!existingMatch) return
    const brandTail = existingMatch.label.split(" — ")[1] ?? ""
    const ownerName = existingMatch.sublabel.replace(/^Sahip:\s*/, "")
    onCreated({
      customerId: existingMatch.customerId,
      vehicleId: existingMatch.vehicleId,
      plate: fields.plate,
      brand: brandTail,
      model: "",
      customerName: ownerName,
    })
    onOpenChange(false)
  }
```

- [ ] **Step 6: Submit güvenlik ağı**

`handleCreate` içinde, `setLoading(true)` satırının HEMEN ÜSTÜNE ekle (plaka/marka/model zorunlu kontrolünden sonra):

```ts
    if (existingMatch) { setError("Bu plaka zaten kayıtlı — aşağıdan mevcut aracı seçin."); return }
```

- [ ] **Step 7: Eşleşme kartını render et**

Primary vehicle fields bloğunda, Plaka input'unu saran `<div className="space-y-1">…</div>` (Plaka `Label` + `Input`) ile Yıl alanı arasındaki gride dokunmadan; gridi saran `<div className="grid grid-cols-2 gap-2 border-t border-border pt-3">` bloğunun HEMEN ALTINA ekle:

```tsx
          {existingMatch && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-foreground">Bu plaka zaten kayıtlı: {existingMatch.label}</p>
                  <p className="text-xs text-muted-foreground">{existingMatch.sublabel}</p>
                </div>
              </div>
              <Button type="button" size="sm" className="w-full" onClick={selectExisting}>
                <Car className="size-4 mr-1" /> Bu aracı seç
              </Button>
            </div>
          )}
```

Not: `AlertTriangle` zaten import edilmiş. `Car` import edilmemişse `lucide-react` import satırına ekle:

```ts
import { AlertTriangle, Car, ChevronDown, Loader2, User, X } from "lucide-react"
```

- [ ] **Step 8: Typecheck**

Run: `bun run typecheck`
Expected: hata yok.

- [ ] **Step 9: Lint**

Run: `bun run lint`
Expected: yeni hata yok (`import("@/lib/…")` inline type import'u lint'i geçmezse Step 4'teki tipi dosya başındaki `import type { UnifiedResult } from "@/lib/search/unified-results"` ile değiştirip inline kullanımı sadeleştir).

- [ ] **Step 10: Manuel QA (dev server)**

`bun run dev` çalışırken iş emri/teklif oluşturma → araç seçici → "Ruhsat tara — yeni müşteri & araç":

1. DB'de **kayıtlı** plakalı ruhsat okut (veya plakayı elle yaz) → sarı kart çıkmalı, "Bu aracı seç" aracı seçip modalı kapatmalı, akış devam etmeli.
2. DB'de **olmayan** plaka → kart çıkmamalı, normal "Oluştur" çalışmalı.
3. Kart görünürken "Oluştur"a bas → ham "zaten var" hatası değil, "Bu plaka zaten kayıtlı — aşağıdan mevcut aracı seçin." uyarısı.
4. Kartlı plakayı silip farklı (kayıtsız) plaka yaz → kart kaybolmalı.
5. Bulunan aracın sahibi ekrandaki seed müşteriden farklıyken "seç" → gerçek sahiple seçilmeli (picker kartında doğru sahip görünmeli).

- [ ] **Step 11: Commit**

```bash
git add src/components/app/inline-create-modal.tsx
git commit -m "feat(intake): detect existing plate in inline vehicle modal, offer select instead of dead-end error"
```

---

## Self-Review

**Spec coverage:**
- Erken tespit (debounce'lu, plaka değişince) → Task 2 Step 4. ✔
- Submit güvenlik ağı → Task 2 Step 6. ✔
- Eşleşme kartı (label + sublabel, gerçek sahiple seç) → Task 2 Step 5 & 7. ✔
- `onCreated` yeniden kullanımı, gerçek sahiple seç → Task 2 Step 5. ✔
- Birebir plaka filtresi (yanlış eşleşme riski) → Task 1 (TDD). ✔
- Modal açılışta reset → Task 2 Step 3. ✔
- Dokunulmayan bileşenler → Global Constraints. ✔
- Manuel QA 6 senaryo → spec'teki 6 madde Task 2 Step 10'da (madde 2 "elle yaz" senaryosu 1'e katlandı). ✔
- Kapsam dışı `/vehicles/new` → plana dahil değil (spec ile tutarlı). ✔

**Placeholder scan:** Tüm kod adımları tam kod içeriyor; TBD/TODO yok.

**Type consistency:** `findExactPlateMatch` / `ExistingVehicleMatch` Task 1'de tanımlı, Task 2'de aynı adlarla tüketiliyor. `InlineCreateResult` alanları (`customerId, vehicleId, plate, brand, model, customerName`) mevcut tiple birebir. `existingMatch` state tipi `ExistingVehicleMatch | null`.
