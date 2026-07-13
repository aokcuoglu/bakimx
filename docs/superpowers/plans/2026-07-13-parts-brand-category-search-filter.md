# Marka & Kategori ile arama/filtre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parça satırının **Marka** ve **Kategori** kolonlarını, cache'li TecDoc verisinde arama/filtre yapan combobox'lara çevirmek; seçim "Parça/İşçilik" aramasını daraltır (böngöz), yanında canlı picker'ı ön-odaklı açan "Katalogda ara →" kısayolu.

**Architecture:** Mevcut altyapı üzerine, şema değişmeden. Veri katmanında `searchVehicleArticles` opsiyonel `supplierId`/`categoryId` filtresi + böngöz kuralı alır; arama API route'u bu paramları geçer. UI'da yeni `PartFilterCombobox` (Base UI ui/combobox) kolonlara oturur, filtre state'i satır-yerel tutulur ve `PartSearchInput`'a beslenir.

**Tech Stack:** Next.js (App Router, server route handlers), React client components, Prisma (Postgres), Base UI (`@/components/ui/combobox`), Playwright (runtime QA), `bun test` (saf lib testleri).

## Global Constraints

- Şema değişikliği YOK. `ServiceOrderItem(brand, category, categoryId)` persist modeli değişmez; filtre satıra persist EDİLMEZ.
- Tenant izolasyonu: yeni sorgu yok; mevcut route guard (`tecdocRouteGuard`) korunur.
- ShadcnUI/Base UI (`@/components/ui/*`) kullan; native/custom UI yok. `ui/combobox` free-form değildir → katı liste-seçim.
- Bileşen yükseklikleri: form kontrolleri web'de `h-9`; grid içi kompakt kontroller mevcut `h-8` desenini izler.
- Mobil-first: Marka/Kategori kolonları `hidden md:block` kalır; combobox yalnız md+ ve katalog-bağlı araçta.
- TypeScript strict; `any` yok. Mock TecDoc verisi asla cache'lenmez (mevcut davranış).
- Dil: TR arama `contains ... mode:insensitive` (mevcut); TR-locale davranışı bozulmaz.

**Doğrulama ortamı:** Yerel dev DB açık (OrbStack). Katalog-bağlı test aracı: `Vehicle` plate=`34MHP923`, `catalogVehicleTypeId=117598`; cache'te 5 kategori var (ör. `categoryId=100260` → 63 parça, "Hava filtresi"...). Draft emir: `cmri8ldca002v9yxloej5ia6n`. Demo giriş: `admin@bakimx.com` / `admin123456` (owner, aynı workshop).

---

### Task 1: Veri katmanı — arama filtresi + böngöz

Combobox seçimini aramaya bağlayan çekirdek. `searchVehicleArticles`'a opsiyonel marka/kategori filtresi ve "filtre varsa boş query'de de grubu döndür" (böngöz) kuralı; arama API route'u paramları geçirir.

**Files:**
- Modify: `src/lib/tecdoc/catalog.ts:186-207` (`searchVehicleArticles`)
- Modify: `src/app/api/tecdoc/articles/search/route.ts`
- Verify (geçici): `/private/tmp/claude-501/-Users-void-www-bakimx/b65c798d-864f-4594-81f9-a3f5d30f8494/scratchpad/verify-search.ts`

**Interfaces:**
- Produces: `searchVehicleArticles(vehicleId: number, query: string, opts?: { supplierId?: number | null; categoryId?: number | null; limit?: number }): Promise<ArticleSearchResult[]>`
- Produces: `GET /api/tecdoc/articles/search?vehicleId=&q=&supplierId=&categoryId=` → `{ articles: ArticleSearchResult[] }`

- [ ] **Step 1: `searchVehicleArticles` imza + filtre + böngöz**

`src/lib/tecdoc/catalog.ts` — mevcut fonksiyonun başını (186-207) şununla değiştir:

```ts
export async function searchVehicleArticles(
  vehicleId: number,
  query: string,
  opts: { supplierId?: number | null; categoryId?: number | null; limit?: number } = {}
): Promise<ArticleSearchResult[]> {
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    throw new TecdocError("invalid_params", "Geçersiz araç katalog kimliği.")
  }
  const { supplierId = null, categoryId = null, limit = 20 } = opts
  const hasFilter = supplierId != null || categoryId != null
  const q = query.trim()
  // Böngöz: filtre yoksa kısa query hiçbir şey döndürmez; filtre varsa boş
  // query'de bile o grubun parçaları listelenir (kullanıcı yazınca daralır).
  if (q.length < 2 && !hasFilter) return []
  const rows = await prisma.tecdocArticle.findMany({
    where: {
      vehicleTypeId: vehicleId,
      ...(supplierId != null ? { supplierId } : {}),
      ...(categoryId != null ? { categoryId } : {}),
      ...(q.length >= 2
        ? {
            OR: [
              { articleNo: { contains: q, mode: "insensitive" as const } },
              { productName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    take: limit,
    orderBy: { articleNo: "asc" },
  })
  if (rows.length === 0) return []
```

(Fonksiyonun geri kalanı — kategori-adı çözümleme ve `rows.map(...)` — aynen kalır.)

- [ ] **Step 2: Arama route'una param ekle**

`src/app/api/tecdoc/articles/search/route.ts` — `q` okumasından sonra ekle ve çağrıyı güncelle:

```ts
  const q = params.get("q") || ""
  const supplierId = parsePositiveInt(params.get("supplierId"))
  const categoryId = parsePositiveInt(params.get("categoryId"))

  try {
    const articles = await searchVehicleArticles(vehicleId, q, { supplierId, categoryId })
    return NextResponse.json({ articles })
```

(`parsePositiveInt` zaten import edili; `null` döndürür, `searchVehicleArticles` null'ı atlar.)

- [ ] **Step 3: Geçici doğrulama script'i yaz**

`scratchpad/verify-search.ts`:

```ts
import { searchVehicleArticles } from "@/lib/tecdoc/catalog"

async function main() {
  const V = 117598
  const noFilter = await searchVehicleArticles(V, "x") // filtre yok, kısa q → []
  const byCat = await searchVehicleArticles(V, "", { categoryId: 100260 }) // böngöz
  const byCatQ = await searchVehicleArticles(V, "hava", { categoryId: 100260 })
  console.log(JSON.stringify({
    noFilter_len: noFilter.length,
    byCat_len: byCat.length,
    byCat_sample: byCat[0]?.productName,
    byCatQ_len: byCatQ.length,
    byCatQ_allMatch: byCatQ.every((a) => /hava/i.test(a.productName + a.articleNo)),
  }, null, 2))
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 4: Doğrulama script'ini çalıştır**

Run: `bunx tsx scratchpad/verify-search.ts` (repo kökünden; tsconfig path alias `@/` çözülür).
Expected: `noFilter_len: 0`, `byCat_len: > 0` (böngöz çalışıyor, ~63'e kadar `limit=20` ile 20), `byCat_sample` bir "filtresi" adı, `byCatQ_allMatch: true`.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/tecdoc/catalog.ts src/app/api/tecdoc/articles/search/route.ts`
Expected: hata yok.

- [ ] **Step 6: Geçici script'i sil + commit**

```bash
rm -f scratchpad/verify-search.ts
git add src/lib/tecdoc/catalog.ts src/app/api/tecdoc/articles/search/route.ts
git commit -m "feat(tecdoc): parça aramasına marka/kategori filtresi + böngöz"
```

---

### Task 2: `PartFilterCombobox` bileşeni

Marka/Kategori kolonlarına oturan tek amaçlı, aranabilir combobox. Seçenekleri cache'ten çeker (marka: `/api/tecdoc/brands?vehicleId=`, kategori: `/api/tecdoc/categories?vehicleId=` → client'ta `flattenCategoryLeaves`). Listenin altında sabit "Katalogda ara →" kısayolu.

**Files:**
- Create: `src/components/app/part-filter-combobox.tsx`

**Interfaces:**
- Consumes: `flattenCategoryLeaves` (from `@/lib/tecdoc/tree`), `CategoryLeaf`/`PartBrandSummary` (from `@/lib/tecdoc/types`).
- Produces:
  ```ts
  export function PartFilterCombobox(props: {
    kind: "brand" | "category"
    vehicleTypeId: number
    value: string           // seçili ad (boş = seçim yok)
    disabled?: boolean
    onSelect: (id: number, name: string) => void
    onClear: () => void
    onOpenPicker: () => void
  }): JSX.Element
  ```

- [ ] **Step 1: Bileşeni oluştur**

`src/components/app/part-filter-combobox.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox"
import { InputGroupButton } from "@/components/ui/input-group"
import { Search } from "lucide-react"
import { flattenCategoryLeaves } from "@/lib/tecdoc/tree"
import type { CategoryLeaf, CategoryNode, PartBrandSummary } from "@/lib/tecdoc/types"

type Option = { id: number; label: string; sub?: string }

/**
 * Parça satırının Marka/Kategori kolonunda cache'li TecDoc verisinde aranabilir
 * filtre. Seçim aramayı daraltır (satıra persist EDİLMEZ). Liste altında
 * "Katalogda ara →" → canlı picker'ı ön-odaklı açar. Base UI Combobox katı
 * liste-seçim (free-form değil); serbest metin yok.
 */
export function PartFilterCombobox({
  kind,
  vehicleTypeId,
  value,
  disabled,
  onSelect,
  onClear,
  onOpenPicker,
}: {
  kind: "brand" | "category"
  vehicleTypeId: number
  value: string
  disabled?: boolean
  onSelect: (id: number, name: string) => void
  onClear: () => void
  onOpenPicker: () => void
}) {
  const [options, setOptions] = useState<Option[]>([])
  const [loaded, setLoaded] = useState(false)

  // Seçenekleri ilk açılışta / araç değişince bir kez çek (cache, kotasız).
  useEffect(() => {
    let active = true
    setLoaded(false)
    const url =
      kind === "brand"
        ? `/api/tecdoc/brands?vehicleId=${vehicleTypeId}`
        : `/api/tecdoc/categories?vehicleId=${vehicleTypeId}`
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) { if (active) setLoaded(true); return }
        if (kind === "brand") {
          const brands: PartBrandSummary[] = Array.isArray(data.brands) ? data.brands : []
          setOptions(brands.map((b) => ({ id: b.supplierId, label: b.supplierName })))
        } else {
          const tree: CategoryNode[] = Array.isArray(data.categories) ? data.categories : []
          const leaves: CategoryLeaf[] = flattenCategoryLeaves(tree)
          setOptions(leaves.map((l) => ({ id: l.id, label: l.name, sub: l.path || undefined })))
        }
        setLoaded(true)
      })
      .catch(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [kind, vehicleTypeId])

  const placeholder = kind === "brand" ? "Marka" : "Kategori"

  return (
    <Combobox
      items={options}
      value={value}
      onValueChange={(v: string) => {
        if (!v) { onClear(); return }
        const opt = options.find((o) => o.label === v)
        if (opt) onSelect(opt.id, opt.label)
      }}
      itemToStringValue={(o: Option) => o.label}
    >
      <ComboboxInput
        placeholder={placeholder}
        disabled={disabled}
        showClear={!!value}
        className="text-xs"
      />
      <ComboboxContent>
        <ComboboxEmpty>{loaded ? "Bulunamadı" : "Yükleniyor…"}</ComboboxEmpty>
        <ComboboxList>
          {(o: Option) => (
            <ComboboxItem key={o.id} value={o}>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.sub && (
                  <span className="block truncate text-[11px] text-muted-foreground">{o.sub}</span>
                )}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
        <div className="border-t border-border p-1">
          <InputGroupButton
            size="sm"
            variant="ghost"
            className="w-full justify-start"
            // Input blur'ı popup'ı onClick'ten önce kapatmasın diye focus'u koru.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenPicker}
          >
            <Search />
            Katalogda ara →
          </InputGroupButton>
        </div>
      </ComboboxContent>
    </Combobox>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/app/part-filter-combobox.tsx`
Expected: hata yok. (Base UI `Combobox` prop adları — `items`/`value`/`onValueChange`/`itemToStringValue` — mevcut kullanımlarla aynıdır; sapma varsa `src/components/app/part-form.tsx` desenini referans al ve eşle.)

- [ ] **Step 3: Commit**

```bash
git add src/components/app/part-filter-combobox.tsx
git commit -m "feat(parts): marka/kategori filtre combobox bileşeni"
```

---

### Task 3: `PartSearchInput` — filtre prop'ları + böngöz tetikleme

Arama kutusu marka/kategori filtresini alır; filtre seçiliyken boş query'de bile arar (böngöz) ve dropdown'u açar.

**Files:**
- Modify: `src/components/app/part-search-input.tsx`

**Interfaces:**
- Consumes: `GET /api/tecdoc/articles/search?...&supplierId=&categoryId=` (Task 1).
- Produces: `PartSearchInput` iki yeni prop kabul eder: `supplierId?: number | null`, `categoryId?: number | null`.

- [ ] **Step 1: Prop'ları ekle**

`part-search-input.tsx` props tipine ve destructuring'e ekle (mevcut `vehicleTypeId` yanına):

```ts
  supplierId,
  categoryId,
```
```ts
  vehicleTypeId: number | null
  supplierId?: number | null
  categoryId?: number | null
```

- [ ] **Step 2: Arama effect'ini böngöz için güncelle**

Mevcut arama `useEffect` (108-136) içinde tetik koşulunu ve fetch URL'ini değiştir:

```ts
    if (vehicleTypeId == null) return
    const q = query.trim()
    const hasFilter = supplierId != null || categoryId != null
    if (q.length < 2 && !hasFilter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      return
    }
    let active = true
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ vehicleId: String(vehicleTypeId) })
        if (q.length >= 2) qs.set("q", q)
        if (supplierId != null) qs.set("supplierId", String(supplierId))
        if (categoryId != null) qs.set("categoryId", String(categoryId))
        const res = await fetch(`/api/tecdoc/articles/search?${qs.toString()}`)
        const data = await res.json()
        if (active && res.ok) setResults(Array.isArray(data.articles) ? data.articles : [])
      } catch {
        /* arama hatası sessiz — serbest metin girişi çalışmaya devam eder */
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [query, vehicleTypeId, supplierId, categoryId])
```

- [ ] **Step 3: Dropdown görünürlüğünü filtreye aç**

Dropdown gate'ini (`query.trim().length >= 2 && (...)`) böngözü kapsayacak şekilde değiştir:

```tsx
      {(query.trim().length >= 2 || supplierId != null || categoryId != null) && (
      <AutocompleteContent>
```

(Kapanış parantezi mevcut yapıda; sadece koşul metni değişir.)

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/app/part-search-input.tsx`
Expected: hata yok. (Runtime doğrulaması Task 4'te uçtan uca yapılır — bu task tek başına gözlemlenebilir değil.)

- [ ] **Step 5: Commit**

```bash
git add src/components/app/part-search-input.tsx
git commit -m "feat(parts): arama kutusuna marka/kategori filtresi + böngöz tetikleme"
```

---

### Task 4: Grid entegrasyonu + uçtan uca Playwright doğrulama

Salt-görünür Marka/Kategori hücrelerini `PartFilterCombobox` ile değiştir; satır-yerel filtre state'i tut, `PartSearchInput`'a besle, parça seçince senkronla, "Katalogda ara →" picker'ı ön-odaklı aç.

**Files:**
- Modify: `src/components/app/parts-labor-grid.tsx`

**Interfaces:**
- Consumes: `PartFilterCombobox` (Task 2), `PartSearchInput` yeni prop'ları (Task 3), mevcut `TecdocPartPicker` (`initialSupplierId`/`initialCategoryId`).

> **Yapı notu:** Satır JSX'i ayrı bir `GridRow` bileşeninde (satır 264: `function GridRow({ row, locked, vehicle, onCell, onRemove, onClear })`). `fillFromArticle`, `tecdocOpen`/`setTecdocOpen`, `editable`, `isPart` hepsi GridRow kapsamında. Bu yüzden filtre state'i **GridRow'un kendi local state'idir** — her satır bir instance, map/`row.id` anahtarlama gerekmez.

- [ ] **Step 1: Import + GridRow'da satır-yerel filtre state**

`parts-labor-grid.tsx` başına import ekle:

```ts
import { PartFilterCombobox } from "@/components/app/part-filter-combobox"
```

`GridRow` gövdesinde (275 civarı, `tecdocOpen` state'inin yanına) ekle:

```ts
  // Satır-yerel arama filtresi (persist EDİLMEZ). Combobox seçimi buraya yazar;
  // parça seçilince senkronlanır; satır temizlenince sıfırlanır.
  type PartFilter = { supplierId?: number; supplierName?: string; categoryId?: number; categoryName?: string }
  const [filter, setFilter] = useState<PartFilter>({})
  const linked = vehicle?.catalogVehicleTypeId != null
```

- [ ] **Step 2: `PartSearchInput`'a filtre prop'ları + seçimde senkron**

GridRow'daki `PartSearchInput` kullanımına (334-347 civarı) ekle:

```tsx
                supplierId={filter.supplierId ?? null}
                categoryId={filter.categoryId ?? null}
```

`fillFromArticle` (279 civarı) içinde, mevcut `onCell(...)` çağrısından sonra filtreyi seçilen parçaya senkronla:

```ts
    setFilter({
      supplierId: a.supplierId ?? undefined,
      supplierName: a.supplierName || undefined,
      categoryId: a.categoryId ?? undefined,
      categoryName: a.categoryName || undefined,
    })
```

- [ ] **Step 3: Temizlemede filtreyi de sıfırla**

GridRow'da `PartSearchInput`'un `onClear` prop'u (344 civarı `onClear={() => onClear(row)}`) filtreyi de sıfırlasın:

```tsx
                onClear={() => { onClear(row); setFilter({}) }}
```

- [ ] **Step 4: Marka/Kategori hücrelerini combobox ile değiştir**

GridRow'daki mevcut Marka (363-372) ve Kategori (374-383) hücrelerini şununla değiştir. Katalog-bağlı + düzenlenebilir ise combobox, değilse mevcut salt-görünür metin:

```tsx
        {/* Marka */}
        <div className={cn("min-w-0", !(isPart && (row.brand || (linked && editable))) && "hidden md:block")}>
          {isPart && (linked && editable ? (
            <PartFilterCombobox
              kind="brand"
              vehicleTypeId={vehicle!.catalogVehicleTypeId!}
              value={filter.supplierName ?? row.brand ?? ""}
              disabled={row.__saving}
              onSelect={(id, name) => setFilter((f) => ({ ...f, supplierId: id, supplierName: name }))}
              onClear={() => setFilter((f) => ({ ...f, supplierId: undefined, supplierName: undefined }))}
              onOpenPicker={() => setTecdocOpen(true)}
            />
          ) : row.brand ? (
            <span className="block truncate text-xs text-muted-foreground">
              <span className="text-muted-foreground/70 md:hidden">Marka: </span>{row.brand}
            </span>
          ) : (
            <span className="hidden text-xs text-muted-foreground/40 md:block">—</span>
          ))}
        </div>

        {/* Kategori */}
        <div className={cn("min-w-0", !(isPart && (row.category || (linked && editable))) && "hidden md:block")}>
          {isPart && (linked && editable ? (
            <PartFilterCombobox
              kind="category"
              vehicleTypeId={vehicle!.catalogVehicleTypeId!}
              value={filter.categoryName ?? row.category ?? ""}
              disabled={row.__saving}
              onSelect={(id, name) => setFilter((f) => ({ ...f, categoryId: id, categoryName: name }))}
              onClear={() => setFilter((f) => ({ ...f, categoryId: undefined, categoryName: undefined }))}
              onOpenPicker={() => setTecdocOpen(true)}
            />
          ) : row.category ? (
            <span className="block truncate text-xs text-muted-foreground">
              <span className="text-muted-foreground/70 md:hidden">Kategori: </span>{row.category}
            </span>
          ) : (
            <span className="hidden text-xs text-muted-foreground/40 md:block">—</span>
          ))}
        </div>
```

- [ ] **Step 5: Picker'ı filtreye göre ön-odakla**

GridRow'daki `TecdocPartPicker` (443-455) prop'larını, satır değeri yoksa filtreye düşecek şekilde güncelle:

```tsx
          initialCategoryId={row.categoryId ?? filter.categoryId ?? null}
          initialCategoryName={row.category ?? filter.categoryName ?? null}
          initialSupplierId={row.brandSupplierId ?? filter.supplierId ?? null}
          initialSupplierName={row.brand ?? filter.supplierName ?? null}
```

- [ ] **Step 6: Typecheck + lint + build**

Run: `npx tsc --noEmit && npx eslint src/components/app/parts-labor-grid.tsx && npx next build`
Expected: hepsi başarılı. (`next build` — grid client/server sınır ve import bütünlüğünü doğrular.)

- [ ] **Step 7: Uçtan uca Playwright doğrulama**

Dev server: `npm run dev` (arka planda). Playwright ile `admin@bakimx.com` oturumunda `http://localhost:3000/orders/cmri8ldca002v9yxloej5ia6n?tab=parca` → "Yeni satır":

1. **Kategori combobox** aç → cache'li kategoriler (üst-yol muted) listelenir; birini seç (ör. cache'li bir "…filtre…" kategorisi) → **Parça kutusu o grubun parçalarını hemen açar** (böngöz). Ekran görüntüsü al.
2. Parça kutusuna yaz → sonuçlar hem kategoriye hem metne daralır.
3. **Marka combobox** seç → sonuçlar markaya da daralır (AND).
4. Combobox'ta **"Katalogda ara →"** → picker o kategori/markaya ön-odaklı açılır. Ekran görüntüsü al.
5. Bir parça seç → satır dolar; Marka/Kategori combobox'ları seçilen parçanınkini gösterir.
6. Satırı **temizle** (X) → filtreler sıfırlanır, Parça kutusu boşalır.
7. Regresyon: filtre yokken `filtre` yaz → mevcut sonuç listesi; alakasız `zzzq` yaz → "Eşleşen parça yok" + "Katalogdan getir" hâlâ çalışır.

Expected: 1–7 gözlemlenir; konsolda hata yok. Ekran görüntüleri raporlanır, sonra `.playwright-mcp/` ve kök PNG'ler silinir.

- [ ] **Step 8: Commit**

```bash
git add src/components/app/parts-labor-grid.tsx
git commit -m "feat(parts): Marka/Kategori kolonları arama-filtre combobox'ı (böngöz + picker kısayolu)"
```

---

## Self-Review notları

- **Spec kapsamı:** Karar 1 (hibrit) → Task 2 combobox + "Katalogda ara"; Karar 2 (böngöz) → Task 1 lib + Task 3 tetik; Karar 3 (filtre persist edilmez, seçimde senkron) → Task 4 partFilters + fillFromArticle sync; Karar 4 (flatten leaf + path) → Task 2 `flattenCategoryLeaves`; Karar 5 (çapraz-budama yok) → hiçbir task marka↔kategori seçeneklerini karşılıklı daraltmaz; Karar 6 (md+ / fallback) → Task 4 `linked && editable` koşulu + mevcut salt-görünür fallback. Tümü kapsandı.
- **Tip tutarlılığı:** `searchVehicleArticles(..., opts)` imzası Task 1'de tanımlı, Task 3 route üzerinden tüketir; `PartFilterCombobox` props Task 2'de tanımlı, Task 4 tüketir; `supplierId` `a.supplierId` `number | null` (ArticleSummary) → `?? undefined` ile PartFilter'a normalize edilir.
- **Placeholder yok:** tüm adımlarda somut kod/komut var. Filtre state'i `GridRow` local'i (per-satır instance) — `fillFromArticle`/`onClear`/combobox aynı kapsamda; map/`row.id` anahtarlama yok, taslak→gerçek id kenar durumu ortadan kalktı.
- **Bilinen kısıt:** Filtre yalnız cache'li marka/kategorileri gösterir (best-effort); "Katalogda ara →" canlı picker'a köprü. Çapraz-budama v1 dışı (spec Karar 5).
