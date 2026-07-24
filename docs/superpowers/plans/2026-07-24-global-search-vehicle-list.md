# Global Başlık Araması → Araç/Müşteri Canlı Liste — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uygulama kabuğundaki üst arama kutusunu, mevcut `/api/search/customer-vehicle` backend'ine bağlı canlı araç/müşteri sonuç dropdown'una dönüştürmek.

**Architecture:** Test edilebilir saf mantık (`global-search.ts`: sonuç→URL eşlemesi ve fetch) `bun test` ile test edilir; UI (`global-search.tsx`) mevcut `part-search-input.tsx` desenini birebir izleyen Base UI `Autocomplete` bileşeniyle kurulur ve `app-shell.tsx`'teki inert `<form>` bununla değiştirilir. Yeni API/şema yok.

**Tech Stack:** Next.js (App Router, client component), TypeScript strict, Base UI Autocomplete (`@/components/ui/autocomplete`), `bun test`, Tailwind.

## Global Constraints

- Bileşen mimarisi: **sadece ShadcnUI/Base UI**, el yapımı UI yok. Mevcut `src/components/ui/autocomplete.tsx` yapı taşları kullanılır.
- Yükleme durumu: **BrandSpinner** (`@/components/shared/brand-spinner`), skeleton değil.
- Tenant izolasyonu backend tarafında (`requireAuth()` → `workshopId`); istemci yalnız `q` gönderir, sorgu değişmez.
- TypeScript strict; `any` yok.
- Yeni API rotası / Prisma şema değişikliği / migration **yok**.
- Chat yanıtları Türkçe.
- Detay rotaları: araç `/vehicles/{id}`, müşteri `/customers/{id}` (mevcut).
- Debounce **250ms** (mevcut `customer-vehicle-picker.tsx` ile aynı).

---

## File Structure

- **Create:** `src/components/app/global-search.ts` — saf mantık: `resultHref()` (UnifiedResult → detay URL'i) + `fetchGlobalSearchResults()` (query → sonuç dizisi, boş/hatada `[]`).
- **Create:** `src/components/app/global-search.test.ts` — `bun test` birim testleri (global.fetch stub'lı).
- **Create:** `src/components/app/global-search.tsx` — Base UI Autocomplete tabanlı `GlobalSearch` istemci bileşeni (debounce + dropdown + navigasyon).
- **Modify:** `src/components/app/app-shell.tsx` — inert `<form>` (satır 270-283) → `<GlobalSearch>`; kullanılmayan `searchValue` state, `handleSearch`, `router`/`Input`/`Search` importları temizlenir.

---

### Task 1: Saf mantık modülü + testleri (`global-search.ts`)

**Files:**
- Create: `src/components/app/global-search.ts`
- Test: `src/components/app/global-search.test.ts`

**Interfaces:**
- Consumes: `UnifiedResult` from `@/lib/search/unified-results` (mevcut ayrımlı birleşim: `{ kind: "vehicle"; vehicleId; customerId; plate; label; sublabel }` | `{ kind: "customer"; customerId; label; sublabel }`).
- Produces:
  - `resultHref(result: UnifiedResult): string` — araç için `` `/vehicles/${result.vehicleId}` ``, müşteri için `` `/customers/${result.customerId}` ``.
  - `fetchGlobalSearchResults(query: string): Promise<UnifiedResult[]>` — trim'lenmiş boş sorguda ağa çıkmadan `[]`; aksi halde `GET /api/search/customer-vehicle?q=<enc>`; `res.ok` değilse veya hata/parse hatasında `[]`; başarılıysa `data.results` dizi ise onu, değilse `[]`.

- [ ] **Step 1: Testi yaz (fail etmeli)**

Create `src/components/app/global-search.test.ts`:

```ts
import { test, expect, afterEach } from "bun:test"
import { resultHref, fetchGlobalSearchResults } from "./global-search"
import type { UnifiedResult } from "@/lib/search/unified-results"

const VEHICLE: UnifiedResult = {
  kind: "vehicle",
  vehicleId: "veh-1",
  customerId: "cus-9",
  plate: "34MYL739",
  label: "34 MYL 739 — Renault Megane",
  sublabel: "Sahip: Ahmet Yılmaz",
}
const CUSTOMER: UnifiedResult = {
  kind: "customer",
  customerId: "cus-2",
  label: "Fatma Kaya",
  sublabel: "0532 000 00 00",
}

function stubFetch(status: number, body: unknown) {
  let captured = ""
  global.fetch = (async (url: string) => {
    captured = url
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return () => captured
}

afterEach(() => {
  // @ts-expect-error test-only cleanup
  delete global.fetch
})

test("resultHref: araç → /vehicles/{vehicleId}", () => {
  expect(resultHref(VEHICLE)).toBe("/vehicles/veh-1")
})

test("resultHref: müşteri → /customers/{customerId}", () => {
  expect(resultHref(CUSTOMER)).toBe("/customers/cus-2")
})

test("fetchGlobalSearchResults: boş sorgu ağa çıkmadan [] döner", async () => {
  let called = false
  global.fetch = (async () => {
    called = true
    return new Response("{}", { status: 200 })
  }) as unknown as typeof fetch
  expect(await fetchGlobalSearchResults("   ")).toEqual([])
  expect(called).toBe(false)
})

test("fetchGlobalSearchResults: q'yu encode edip results dizisini döner", async () => {
  const getUrl = stubFetch(200, { results: [VEHICLE, CUSTOMER] })
  const out = await fetchGlobalSearchResults("34 myl")
  expect(out).toEqual([VEHICLE, CUSTOMER])
  expect(getUrl()).toBe("/api/search/customer-vehicle?q=34%20myl")
})

test("fetchGlobalSearchResults: res.ok değilse [] döner", async () => {
  stubFetch(500, { results: [VEHICLE] })
  expect(await fetchGlobalSearchResults("x")).toEqual([])
})

test("fetchGlobalSearchResults: results dizi değilse [] döner", async () => {
  stubFetch(200, { results: null })
  expect(await fetchGlobalSearchResults("x")).toEqual([])
})

test("fetchGlobalSearchResults: fetch fırlatırsa [] döner", async () => {
  global.fetch = (async () => {
    throw new Error("network")
  }) as unknown as typeof fetch
  expect(await fetchGlobalSearchResults("x")).toEqual([])
})
```

- [ ] **Step 2: Testi çalıştır, fail ettiğini gör**

Run: `cd /Users/void/www/bakimx-global-search && bun test src/components/app/global-search.test.ts`
Expected: FAIL — `Cannot find module "./global-search"` (modül henüz yok).

- [ ] **Step 3: Modülü yaz (minimal)**

Create `src/components/app/global-search.ts`:

```ts
import type { UnifiedResult } from "@/lib/search/unified-results"

const SEARCH_ENDPOINT = "/api/search/customer-vehicle"

/** Bir arama sonucunun gideceği detay sayfası URL'i. */
export function resultHref(result: UnifiedResult): string {
  return result.kind === "vehicle"
    ? `/vehicles/${result.vehicleId}`
    : `/customers/${result.customerId}`
}

/**
 * Birleşik araç/müşteri aramasını çağırır. Boş sorguda ağa çıkmaz; hata,
 * non-ok yanıt veya beklenmeyen gövdede sessizce `[]` döner (arama kutusu
 * çalışmaya devam etsin).
 */
export async function fetchGlobalSearchResults(query: string): Promise<UnifiedResult[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.results) ? (data.results as UnifiedResult[]) : []
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `cd /Users/void/www/bakimx-global-search && bun test src/components/app/global-search.test.ts`
Expected: PASS (7 test).

- [ ] **Step 5: Commit**

```bash
cd /Users/void/www/bakimx-global-search
git add src/components/app/global-search.ts src/components/app/global-search.test.ts
git commit -m "feat(search): global arama saf mantığı (resultHref + fetch) + testleri

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `GlobalSearch` bileşeni + app-shell'e bağlama

**Files:**
- Create: `src/components/app/global-search.tsx`
- Modify: `src/components/app/app-shell.tsx` (satır 4, 16, 38, 198, 203, 211-216, 270-283)

**Interfaces:**
- Consumes: `resultHref`, `fetchGlobalSearchResults` from `./global-search`; `UnifiedResult` from `@/lib/search/unified-results`; `Autocomplete*` from `@/components/ui/autocomplete`; `BrandSpinner` from `@/components/shared/brand-spinner`.
- Produces: `GlobalSearch(props: { className?: string }): JSX.Element` — dışa aktarılan istemci bileşeni; `app-shell.tsx` tarafından tüketilir.

Not: Bu görevin UI'ı, projedeki test kuralına uygun olarak **birim testi yazılmaz** (repoda testing-library yok; `components/`'teki testler yalnız çıkarılmış saf mantığı test eder — o kısım Task 1'de test edildi). Doğrulama: `typecheck` + `lint` + `build` + manuel QA.

- [ ] **Step 1: Bileşeni yaz**

Create `src/components/app/global-search.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Car, User, Search } from "lucide-react"
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "@/components/ui/autocomplete"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import type { UnifiedResult } from "@/lib/search/unified-results"
import { resultHref, fetchGlobalSearchResults } from "./global-search"

const MIN_QUERY = 2

/**
 * Üst başlık araması: plaka/müşteri yazınca birleşik arama backend'inden canlı
 * araç/müşteri sonuçları listeler; bir sonuç seçilince ilgili detay sayfasına
 * gider ve kutuyu temizler. part-search-input.tsx ile aynı Base UI Autocomplete
 * desenini izler (serbest metin + async `items`, `filter={null}`).
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UnifiedResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_QUERY) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    const t = setTimeout(async () => {
      const found = await fetchGlobalSearchResults(q)
      if (!active) return
      setResults(found)
      setLoading(false)
    }, 250)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [query])

  function select(r: UnifiedResult) {
    setQuery("")
    setResults([])
    router.push(resultHref(r))
  }

  const q = query.trim()
  const showContent = q.length >= MIN_QUERY

  return (
    <Autocomplete
      items={results}
      value={query}
      filter={null}
      autoHighlight
      itemToStringValue={(r: UnifiedResult) => r.label}
      onValueChange={(v: string) => setQuery(v)}
    >
      <div className={className}>
        <InputGroup>
          <AutocompleteInput
            render={
              <InputGroupInput
                type="search"
                placeholder="Plaka veya müşteri ara"
                className="text-sm"
              />
            }
          />
          <InputGroupAddon align="inline-start">
            <Search className="size-4 text-muted-foreground/70" />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {showContent && (
        <AutocompleteContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <BrandSpinner className="size-4" />
              <span>Aranıyor…</span>
            </div>
          ) : (
            <>
              <AutocompleteEmpty>Sonuç bulunamadı</AutocompleteEmpty>
              <AutocompleteList>
                {(r: UnifiedResult) => (
                  <AutocompleteItem
                    key={r.kind === "vehicle" ? `v-${r.vehicleId}` : `c-${r.customerId}`}
                    value={r}
                    onClick={() => select(r)}
                  >
                    {r.kind === "vehicle" ? (
                      <Car className="size-4 text-primary" />
                    ) : (
                      <User className="size-4 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{r.label}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {r.sublabel}
                      </span>
                    </span>
                  </AutocompleteItem>
                )}
              </AutocompleteList>
            </>
          )}
        </AutocompleteContent>
      )}
    </Autocomplete>
  )
}
```

Not: `BrandSpinner`'ın `className` prop'unu kabul edip etmediğini uygularken doğrula (`src/components/shared/brand-spinner.tsx`). Kabul etmiyorsa `<BrandSpinner />`'ı sarmalayıcı olmadan kullan ve boyutu bırak.

- [ ] **Step 2: `app-shell.tsx` — GlobalSearch import et ve inert form'u değiştir**

`src/components/app/app-shell.tsx` satır 270-283'teki `{showGlobalSearch && ( <form ...>...</form> )}` bloğunu tümüyle şununla değiştir:

```tsx
              {showGlobalSearch && (
                <GlobalSearch className="flex-1 sm:max-w-md sm:mx-4" />
              )}
```

Dosyanın üstündeki importlara ekle (mevcut app import bloğunun yanına, örn. `BrandLogo` importundan sonra):

```tsx
import { GlobalSearch } from "@/components/app/global-search"
```

- [ ] **Step 3: `app-shell.tsx` — kullanılmayan kod ve importları temizle**

Aşağıdakiler artık kullanılmıyor; kaldır:

1. `searchValue` state — satır 203'teki şu satırı sil:
   ```tsx
   const [searchValue, setSearchValue] = useState("")
   ```
2. `handleSearch` fonksiyonu — satır 211-216'daki tüm bloğu sil:
   ```tsx
   function handleSearch(e: React.FormEvent<HTMLFormElement>) {
     e.preventDefault()
     const value = searchValue.trim()
     if (!value) return
     router.push(`/parts?q=${encodeURIComponent(value)}`)
   }
   ```
3. `router` — satır 198'deki `const router = useRouter()` sil (başka kullanımı yok — doğrulamak için `grep -n "router\." src/components/app/app-shell.tsx` boş dönmeli). Satır 4 importunu `import { usePathname, useRouter } from "next/navigation"` → `import { usePathname } from "next/navigation"` yap.
4. `Input` importu (satır 38) `import { Input } from "@/components/ui/input"` — sil (başka kullanımı yok).
5. Lucide `Search` importu (satır 16, import bloğu içinde `Search,`) — sil (form içindeki tek kullanımı gitti).

- [ ] **Step 4: Typecheck çalıştır**

Run: `cd /Users/void/www/bakimx-global-search && bun run typecheck`
Expected: PASS (hata yok). Beklenmedik "unused"/tip hatası çıkarsa Step 3'teki temizlik eksik demektir — düzelt.

- [ ] **Step 5: Lint çalıştır**

Run: `cd /Users/void/www/bakimx-global-search && bun run lint`
Expected: PASS — `global-search.tsx`, `global-search.ts`, `app-shell.tsx` için hata/uyarı yok (kullanılmayan import kalırsa burada yakalanır).

- [ ] **Step 6: Testleri tekrar çalıştır (regresyon)**

Run: `cd /Users/void/www/bakimx-global-search && bun test src/components/app/global-search.test.ts`
Expected: PASS (7 test).

- [ ] **Step 7: Commit**

```bash
cd /Users/void/www/bakimx-global-search
git add src/components/app/global-search.tsx src/components/app/app-shell.tsx
git commit -m "feat(search): üst başlık aramasını canlı araç/müşteri sonuçlarına bağla

Boş dropdown'lı /parts yönlendirmesi yerine /api/search/customer-vehicle'a
bağlı Base UI Autocomplete; sonuç seçince /vehicles veya /customers detayına gider.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Doğrulama — build + manuel QA

**Files:** (yok — yalnız doğrulama)

- [ ] **Step 1: Production build**

Run: `cd /Users/void/www/bakimx-global-search && bun run build`
Expected: Başarılı derleme (bileşen kabuğa girdiği için önemli).

- [ ] **Step 2: Dev sunucusunu başlat ve manuel QA yap**

Not: Yerel dev AWS dev DB'ye bağlanır ve `bun run db:tunnel` gerektirir (memory: local-dev-env-and-db). Kullanıcı sunucuyu kendisi çalıştırmak isterse `! bun run dev` önerilebilir. QA adımları (spec §Manuel QA):

1. Bir uygulama sayfasında üst kutuya kayıtlı bir plakanın parçasını yaz (örn. `34myl`) → ~250ms sonra araç sonuçları listelenir.
2. Bir araç sonucuna dokun → `/vehicles/{id}` açılır, kutu temizlenir.
3. Müşteri adı/telefon yaz → müşteri sonuçları; seçince `/customers/{id}`.
4. Eşleşmeyen sorgu → "Sonuç bulunamadı".
5. Kutuyu temizle (< 2 karakter) → dropdown kapanır, istek atılmaz.
6. Farklı atölye hesabı → sadece kendi tenant sonuçları (tenant izolasyonu).
7. Mobil genişlik → dropdown tam genişlik, dokunmayla seçilebilir.

- [ ] **Step 3: (Opsiyonel) bakimx-release-check / bakimx-ui-qa skill'lerini çalıştır**

Değişiklik kabuğu etkilediği için commit/PR öncesi `bakimx-ui-qa` ve `bakimx-release-check` skill'leri önerilir.

---

## Self-Review

**Spec coverage:**
- Canlı dropdown → Task 2 (Autocomplete + AutocompleteContent). ✓
- 250ms debounce → Task 2 Step 1 (`setTimeout(..., 250)`). ✓
- Boş sorguda istek yok → Task 1 `fetchGlobalSearchResults` + Task 2 `MIN_QUERY` guard. ✓
- Araçlar önce, sonra müşteri → backend sırası korunur (`items={results}` olduğu gibi). ✓
- Satır ikon/label/sublabel → Task 2 AutocompleteItem. ✓
- BrandSpinner yükleme → Task 2 loading dalı. ✓
- "Sonuç bulunamadı" → Task 2 AutocompleteEmpty. ✓
- Seçince /vehicles veya /customers + temizle → Task 1 `resultHref` + Task 2 `select`. ✓
- `showGlobalSearch` korunur → Task 2 Step 2 bloğu koşulu değişmeden. ✓
- Eski /parts yönlendirmesi + inert state kaldırılır → Task 2 Step 3. ✓
- Tenant izolasyonu backend'de, dokunulmaz → API değişmiyor. ✓

**Placeholder scan:** Placeholder/TODO yok; tüm adımlar tam kod içeriyor. ✓

**Type consistency:** `resultHref`/`fetchGlobalSearchResults` imzaları Task 1 ile Task 2 tüketimi arasında tutarlı; `UnifiedResult` ayrımı `kind` üzerinden; `vehicleId`/`customerId` alan adları backend tipiyle eşleşiyor. ✓
