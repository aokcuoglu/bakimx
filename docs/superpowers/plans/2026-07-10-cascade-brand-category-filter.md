# Cascade Marka/Kategori Filtresi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İş emri parça ızgarasında marka ve kategori seçicilerini, araç+kategoriye göre karşılıklı filtreleyen (kategori öncelikli, tek yön güvenilir) searchable Base UI combobox'lara dönüştür.

**Architecture:** Cascade verisi cache'li `TecdocArticle` satırlarından türetilir. Kategori seçilince o kategorinin makaleleri çekilip (güvenilir) markalar daraltılır ve uyumsuz marka otomatik temizlenir; marka önce seçilirse kategoriler yalnız cache'den best-effort daraltılır (silme yok). İki yeni pure helper (leaf-flatten, tree-prune, brand-dedupe) TDD ile; prisma/API/bileşen katmanı typecheck+build+manuel QA ile doğrulanır.

**Tech Stack:** Next.js 16 (App Router, server routes), TypeScript strict, Prisma 7 (`TecdocArticle`), Base UI `@/components/ui/combobox`, bun test.

## Global Constraints

- Şema değişikliği YOK — yalnız mevcut `TecdocArticle(vehicleTypeId, categoryId, supplierId, supplierName)` ve `ServiceOrderItem(brand, category, categoryId)` alanları kullanılır.
- `TecdocArticle.supplierId` **nullable** (`Int?`) — null supplierId satırları marka listesinden dışlanır (`PartBrandSummary.supplierId` non-null).
- Sabit TecDoc paramları: `TYPE_ID=1`, `LANG_ID=23` (mevcut `types.ts`).
- Mock provider satırları asla persist edilmez / cache'lenmez (mevcut `catalog.ts` davranışı korunur).
- Tüm `/api/tecdoc/*` route'ları `tecdocRouteGuard()` (auth + `partsCatalog` feature gate + rate limit) geçer — yeni/değişen route'larda da korunur.
- tr-locale sıralama: `.localeCompare(x, "tr")` (mevcut `normalize.ts` deseni).
- Katalog-bağlı olmayan araçta (`vehicle.catalogVehicleTypeId == null`) her iki alan serbest-metin fallback'te kalır; katı liste-only yalnız katalog-bağlı araçta.
- `brandSupplierId` yalnız runtime satır state'idir — **asla** sunucuya gönderilmez / persist edilmez.
- Package manager: `bun`. Typecheck: `bun run typecheck`. Lint: `bun run lint`. Test: `bun test`. Build: `bun run build`.

---

## File Structure

- **Create** `src/lib/tecdoc/tree.ts` — pure ağaç yardımcıları: `flattenCategoryLeaves`, `pruneTreeToCategoryIds`.
- **Create** `src/lib/tecdoc/tree.test.ts` — yukarıdakilerin birim testleri.
- **Modify** `src/lib/tecdoc/types.ts` — `CategoryLeaf` tipi eklenir.
- **Modify** `src/lib/tecdoc/normalize.ts` — pure `dedupeBrands` eklenir.
- **Modify** `src/lib/tecdoc/normalize.test.ts` — `dedupeBrands` testi eklenir.
- **Modify** `src/lib/tecdoc/catalog.ts` — `getVehicleBrands`, `getCategoryBrands`, `getBrandCategoryIds` eklenir.
- **Modify** `src/app/api/tecdoc/brands/route.ts` — opsiyonel `vehicleId`/`categoryId` paramları.
- **Modify** `src/app/api/tecdoc/categories/route.ts` — opsiyonel `supplierId` paramı.
- **Modify** `src/components/app/part-brand-combobox.tsx` — scoped veri + strict mod + auto-clear.
- **Modify** `src/components/app/item-category-cascade.tsx` — düz aranabilir combobox + supplierId filtresi.
- **Modify** `src/components/app/parts-labor-grid.tsx` — `GridRow` wiring + `brandSupplierId` state.

---

## Task 1: Pure helpers — leaf flatten, tree prune, brand dedupe (TDD)

**Files:**
- Create: `src/lib/tecdoc/tree.ts`
- Test: `src/lib/tecdoc/tree.test.ts`
- Modify: `src/lib/tecdoc/types.ts` (add `CategoryLeaf`)
- Modify: `src/lib/tecdoc/normalize.ts` (add `dedupeBrands`)
- Test: `src/lib/tecdoc/normalize.test.ts` (add `dedupeBrands` cases)

**Interfaces:**
- Consumes: `CategoryNode` (`{ id: number; name: string; children: CategoryNode[] }`), `PartBrandSummary` (`{ supplierId: number; name: string }`) from `./types`.
- Produces:
  - `CategoryLeaf = { id: number; name: string; path: string }`
  - `flattenCategoryLeaves(nodes: CategoryNode[]): CategoryLeaf[]`
  - `pruneTreeToCategoryIds(nodes: CategoryNode[], allowed: Set<number>): CategoryNode[]`
  - `dedupeBrands(rows: { supplierId: number | null; supplierName: string }[]): PartBrandSummary[]`

- [ ] **Step 1: Add `CategoryLeaf` type**

`src/lib/tecdoc/types.ts` — `CategoryNode` interface'inin hemen altına ekle:

```ts
/** Düzleştirilmiş yaprak kategori — Combobox listesini doldurur. `path` üst kategori yolu (" › " ayraçlı, yaprağın adı hariç). */
export interface CategoryLeaf {
  id: number
  name: string
  path: string
}
```

- [ ] **Step 2: Write failing tests for `tree.ts`**

Create `src/lib/tecdoc/tree.test.ts`:

```ts
import { describe, expect, it } from "bun:test"
import { flattenCategoryLeaves, pruneTreeToCategoryIds } from "./tree"
import type { CategoryNode } from "./types"

const tree: CategoryNode[] = [
  {
    id: 1, name: "Filtre", children: [
      { id: 11, name: "Hava filtresi", children: [] },
      { id: 12, name: "Yağ filtresi", children: [] },
    ],
  },
  { id: 2, name: "Fren", children: [
      { id: 21, name: "Fren balatası", children: [] },
    ],
  },
  { id: 3, name: "Yağ (yaprak-kök)", children: [] },
]

describe("flattenCategoryLeaves", () => {
  it("yalnız yaprakları döner, üst yolu path'e yazar", () => {
    const leaves = flattenCategoryLeaves(tree)
    expect(leaves).toEqual([
      { id: 11, name: "Hava filtresi", path: "Filtre" },
      { id: 12, name: "Yağ filtresi", path: "Filtre" },
      { id: 21, name: "Fren balatası", path: "Fren" },
      { id: 3, name: "Yağ (yaprak-kök)", path: "" },
    ])
  })
  it("boş ağaçta boş dizi", () => {
    expect(flattenCategoryLeaves([])).toEqual([])
  })
})

describe("pruneTreeToCategoryIds", () => {
  it("yalnız izinli yaprak içeren dalları korur", () => {
    const pruned = pruneTreeToCategoryIds(tree, new Set([11, 21]))
    expect(pruned).toEqual([
      { id: 1, name: "Filtre", children: [{ id: 11, name: "Hava filtresi", children: [] }] },
      { id: 2, name: "Fren", children: [{ id: 21, name: "Fren balatası", children: [] }] },
    ])
  })
  it("izinli yaprak yoksa boş dizi", () => {
    expect(pruneTreeToCategoryIds(tree, new Set([999]))).toEqual([])
  })
  it("yaprak-kök izinliyse korunur", () => {
    expect(pruneTreeToCategoryIds(tree, new Set([3]))).toEqual([
      { id: 3, name: "Yağ (yaprak-kök)", children: [] },
    ])
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/void/www/bakimx-cascade-filter && bun test src/lib/tecdoc/tree.test.ts`
Expected: FAIL — `Cannot find module './tree'`.

- [ ] **Step 4: Implement `src/lib/tecdoc/tree.ts`**

```ts
import type { CategoryLeaf, CategoryNode } from "./types"

/**
 * Kategori ağacını yaprak listesine düzleştirir. Bir düğüm yaprak sayılır:
 * children boşsa. `path` yaprağa giden üst kategori adlarının " › " ile
 * birleşimi (yaprağın kendi adı hariç; kök yapraklarda "").
 */
export function flattenCategoryLeaves(nodes: CategoryNode[]): CategoryLeaf[] {
  const out: CategoryLeaf[] = []
  const walk = (list: CategoryNode[], trail: string[]) => {
    for (const node of list) {
      if (node.children.length === 0) {
        out.push({ id: node.id, name: node.name, path: trail.join(" › ") })
      } else {
        walk(node.children, [...trail, node.name])
      }
    }
  }
  walk(nodes, [])
  return out
}

/**
 * Ağacı yalnızca `allowed` içindeki id'lere sahip yaprakları (ve onlara giden
 * dalları) koruyacak şekilde budar. Best-effort marka→kategori filtresi için.
 */
export function pruneTreeToCategoryIds(nodes: CategoryNode[], allowed: Set<number>): CategoryNode[] {
  const out: CategoryNode[] = []
  for (const node of nodes) {
    if (node.children.length === 0) {
      if (allowed.has(node.id)) out.push({ ...node, children: [] })
    } else {
      const children = pruneTreeToCategoryIds(node.children, allowed)
      if (children.length > 0) out.push({ ...node, children })
    }
  }
  return out
}
```

- [ ] **Step 5: Run tree tests to verify they pass**

Run: `bun test src/lib/tecdoc/tree.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Write failing test for `dedupeBrands`**

`src/lib/tecdoc/normalize.test.ts` — dosyanın sonuna ekle (mevcut importlara `dedupeBrands` ekle: `import { normalizeSuppliers, dedupeBrands } from "./normalize"` — mevcut import satırını uygun şekilde genişlet):

```ts
describe("dedupeBrands", () => {
  it("null supplierId'yi dışlar, supplierId'ye göre tekilleştirir, tr-sıralar", () => {
    const rows = [
      { supplierId: 10, supplierName: "MANN-FILTER" },
      { supplierId: 5, supplierName: "BOSCH" },
      { supplierId: 10, supplierName: "MANN-FILTER" },
      { supplierId: null, supplierName: "İSİMSİZ" },
    ]
    expect(dedupeBrands(rows)).toEqual([
      { supplierId: 5, name: "BOSCH" },
      { supplierId: 10, name: "MANN-FILTER" },
    ])
  })
  it("boş girişte boş dizi", () => {
    expect(dedupeBrands([])).toEqual([])
  })
})
```

- [ ] **Step 7: Run to verify it fails**

Run: `bun test src/lib/tecdoc/normalize.test.ts`
Expected: FAIL — `dedupeBrands is not a function` / export yok.

- [ ] **Step 8: Implement `dedupeBrands` in `normalize.ts`**

`src/lib/tecdoc/normalize.ts` sonuna ekle:

```ts
/**
 * TecdocArticle satırlarından (supplierId, supplierName) → tekil, tr-sıralı
 * PartBrandSummary[]. supplierId null olan satırlar (filtrelenemez marka) atlanır.
 */
export function dedupeBrands(
  rows: { supplierId: number | null; supplierName: string }[]
): PartBrandSummary[] {
  const byId = new Map<number, string>()
  for (const r of rows) {
    if (r.supplierId == null) continue
    if (!byId.has(r.supplierId)) byId.set(r.supplierId, r.supplierName)
  }
  return [...byId.entries()]
    .map(([supplierId, name]) => ({ supplierId, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"))
}
```

(Not: `PartBrandSummary` zaten dosyanın en üstünde import edilmiş — `import { ... type PartBrandSummary } from "./types"`.)

- [ ] **Step 9: Run all tecdoc lib tests to verify pass**

Run: `bun test src/lib/tecdoc/`
Expected: PASS (mevcut 5 + tree 5 + dedupeBrands 2 = 12).

- [ ] **Step 10: Commit**

```bash
git add src/lib/tecdoc/tree.ts src/lib/tecdoc/tree.test.ts src/lib/tecdoc/types.ts src/lib/tecdoc/normalize.ts src/lib/tecdoc/normalize.test.ts
git commit -m "feat(tecdoc): cascade için pure ağaç/marka yardımcıları (flatten, prune, dedupe)"
```

---

## Task 2: Catalog server functions (vehicle/category brands, brand→category ids)

**Files:**
- Modify: `src/lib/tecdoc/catalog.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`; `getArticlesByCategory` (mevcut, aynı dosya); `dedupeBrands` from `./normalize`.
- Produces:
  - `getVehicleBrands(vehicleId: number): Promise<PartBrandSummary[]>`
  - `getCategoryBrands(vehicleId: number, categoryId: number): Promise<PartBrandSummary[]>`
  - `getBrandCategoryIds(vehicleId: number, supplierId: number): Promise<number[]>`

**Note on testing:** Bu fonksiyonlar prisma'ya bağlı; codebase'de DB mock harness'i yok. Birim test EKLENMEZ — pure kısım (`dedupeBrands`) Task 1'de test edildi. Doğrulama: typecheck (Step 3) + Task 3/4 route'ları üzerinden manuel QA (Task 8).

- [ ] **Step 1: Add import for `dedupeBrands`**

`src/lib/tecdoc/catalog.ts` — mevcut normalize importunu genişlet:

```ts
import { dedupeBrands, normalizeArticles, normalizeCategories, normalizeSuppliers } from "./normalize"
```

- [ ] **Step 2: Add the three functions at end of `catalog.ts`**

```ts
/**
 * Araç-scoped markalar — bu araç için cache'lenmiş TecdocArticle satırlarındaki
 * distinct supplier'lar. Kategori seçilmeden önce marka combobox'ını doldurur.
 * Best-effort: yalnız daha önce göz atılıp persist edilmiş kategoriler katkı verir.
 */
export async function getVehicleBrands(vehicleId: number): Promise<PartBrandSummary[]> {
  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    throw new TecdocError("invalid_params", "Geçersiz araç katalog kimliği.")
  }
  const rows = await prisma.tecdocArticle.findMany({
    where: { vehicleTypeId: vehicleId },
    select: { supplierId: true, supplierName: true },
  })
  return dedupeBrands(rows)
}

/**
 * Kategori-scoped markalar — GÜVENİLİR yol. getArticlesByCategory o kategorinin
 * makalelerini (yoksa provider'dan çekip persist ederek) döner; distinct supplier.
 */
export async function getCategoryBrands(vehicleId: number, categoryId: number): Promise<PartBrandSummary[]> {
  const articles = await getArticlesByCategory(vehicleId, categoryId)
  return dedupeBrands(articles.map((a) => ({ supplierId: a.supplierId, supplierName: a.supplierName })))
}

/**
 * Bir markanın (supplierId) bu araç için cache'lenmiş makalelerinin bulunduğu
 * distinct categoryId'ler — best-effort marka→kategori filtresi. Sadece DB okur,
 * provider fetch YAPMAZ (eksik olabilir; kabul edilen davranış).
 */
export async function getBrandCategoryIds(vehicleId: number, supplierId: number): Promise<number[]> {
  if (
    !Number.isInteger(vehicleId) || vehicleId <= 0 ||
    !Number.isInteger(supplierId) || supplierId <= 0
  ) {
    throw new TecdocError("invalid_params", "Geçersiz katalog parametreleri.")
  }
  const rows = await prisma.tecdocArticle.findMany({
    where: { vehicleTypeId: vehicleId, supplierId },
    select: { categoryId: true },
    distinct: ["categoryId"],
  })
  return rows.map((r) => r.categoryId)
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS (no errors). (`PartBrandSummary`/`TecdocError` zaten `catalog.ts` üstünde import edilmiş.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/tecdoc/catalog.ts
git commit -m "feat(tecdoc): araç/kategori-scoped marka ve marka→kategori id sorguları"
```

---

## Task 3: `/api/tecdoc/brands` — opsiyonel vehicleId/categoryId paramları

**Files:**
- Modify: `src/app/api/tecdoc/brands/route.ts`

**Interfaces:**
- Consumes: `getPartBrands` (mevcut), `getVehicleBrands`, `getCategoryBrands` (Task 2); `parsePositiveInt`, `tecdocRouteGuard`, `tecdocErrorResponse` (mevcut helpers).
- Produces: `GET /api/tecdoc/brands[?vehicleId=&categoryId=]` → `{ brands: PartBrandSummary[] }`.

- [ ] **Step 1: Rewrite the route**

`src/app/api/tecdoc/brands/route.ts` tamamını değiştir:

```ts
import { NextResponse } from "next/server"
import { getPartBrands, getVehicleBrands, getCategoryBrands } from "@/lib/tecdoc/catalog"
import { tecdocRouteGuard, tecdocErrorResponse, parsePositiveInt } from "@/lib/tecdoc/api-helpers"

/**
 * GET /api/tecdoc/brands — parça markaları (TecDoc suppliers).
 * - parametresiz → global suppliers (geri uyumluluk).
 * - ?vehicleId=X → o araç için cache'li makalelerdeki distinct markalar (araç-scoped).
 * - ?vehicleId=X&categoryId=Y → o kategorinin markaları (güvenilir; gerekirse provider fetch).
 * Auth + partsCatalog feature gate + rate limit tecdocRouteGuard'dan gelir.
 */
export async function GET(request: Request) {
  const guard = await tecdocRouteGuard()
  if (guard instanceof NextResponse) return guard

  const params = new URL(request.url).searchParams
  const vehicleId = parsePositiveInt(params.get("vehicleId"))
  const categoryId = parsePositiveInt(params.get("categoryId"))

  try {
    let brands
    if (vehicleId != null && categoryId != null) {
      brands = await getCategoryBrands(vehicleId, categoryId)
    } else if (vehicleId != null) {
      brands = await getVehicleBrands(vehicleId)
    } else {
      brands = await getPartBrands()
    }
    return NextResponse.json({ brands })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `bun run typecheck && bun run lint src/app/api/tecdoc/brands/route.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tecdoc/brands/route.ts
git commit -m "feat(api): tecdoc/brands vehicleId+categoryId ile scoped marka döner"
```

---

## Task 4: `/api/tecdoc/categories` — opsiyonel supplierId (marka→kategori filtresi)

**Files:**
- Modify: `src/app/api/tecdoc/categories/route.ts`

**Interfaces:**
- Consumes: `getVehicleCategories` (mevcut), `getBrandCategoryIds` (Task 2), `pruneTreeToCategoryIds` (Task 1); `parsePositiveInt`, guard/error helpers.
- Produces: `GET /api/tecdoc/categories?vehicleId=[&supplierId=]` → `{ categories: CategoryNode[] }` (supplierId verildiyse budanmış ağaç).

- [ ] **Step 1: Rewrite the route**

`src/app/api/tecdoc/categories/route.ts` tamamını değiştir:

```ts
import { NextResponse } from "next/server"
import { getVehicleCategories, getBrandCategoryIds } from "@/lib/tecdoc/catalog"
import { pruneTreeToCategoryIds } from "@/lib/tecdoc/tree"
import { tecdocRouteGuard, tecdocErrorResponse, parsePositiveInt } from "@/lib/tecdoc/api-helpers"

export async function GET(request: Request) {
  const guard = await tecdocRouteGuard()
  if (guard instanceof NextResponse) return guard

  const params = new URL(request.url).searchParams
  const vehicleId = parsePositiveInt(params.get("vehicleId"))
  if (vehicleId == null) {
    return NextResponse.json({ error: "Geçersiz araç katalog kimliği (vehicleId)." }, { status: 400 })
  }
  const supplierId = parsePositiveInt(params.get("supplierId"))

  try {
    const categories = await getVehicleCategories(vehicleId)
    if (supplierId == null) {
      return NextResponse.json({ categories })
    }
    // Best-effort marka→kategori: yalnız o markanın cache'li makalelerinin
    // bulunduğu kategorilere ait dalları koru.
    const allowed = new Set(await getBrandCategoryIds(vehicleId, supplierId))
    return NextResponse.json({ categories: pruneTreeToCategoryIds(categories, allowed) })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `bun run typecheck && bun run lint src/app/api/tecdoc/categories/route.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tecdoc/categories/route.ts
git commit -m "feat(api): tecdoc/categories supplierId ile marka→kategori best-effort budama"
```

---

## Task 5: `PartBrandCombobox` — scoped veri + strict mod + auto-clear

**Files:**
- Modify: `src/components/app/part-brand-combobox.tsx`

**Interfaces:**
- Consumes: `GET /api/tecdoc/brands` (Task 3); `PartBrandSummary`.
- Produces: React component prop imzası:
  ```ts
  PartBrandCombobox({
    value: string,
    vehicleTypeId: number | null,
    categoryId: number | null,
    onChange: (name: string, supplierId: number | null) => void,
    placeholder?: string,
  })
  ```
  (`onChange` artık **iki** argüman verir: marka adı + supplierId. supplierId serbest-metinde/temizlemede `null`.)

- [ ] **Step 1: Rewrite the component**

`src/components/app/part-brand-combobox.tsx` tamamını değiştir:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox"
import type { PartBrandSummary } from "@/lib/tecdoc/types"

/**
 * Parça markası seçici.
 * - Katalog-bağlı araç (vehicleTypeId != null): araç/kategori-scoped liste, KATI
 *   (yalnız listeden seçim). Kategori değişince uyumsuz marka otomatik temizlenir.
 * - Katalog-bağlı değil (vehicleTypeId == null): global liste + serbest metin fallback.
 */
export function PartBrandCombobox({
  value,
  vehicleTypeId,
  categoryId,
  onChange,
  placeholder = "Bosch, Mann, OEM...",
}: {
  value: string
  vehicleTypeId: number | null
  categoryId: number | null
  onChange: (name: string, supplierId: number | null) => void
  placeholder?: string
}) {
  const strict = vehicleTypeId != null
  const [brands, setBrands] = useState<PartBrandSummary[]>([])
  // Auto-clear yalnız kategori GERÇEKTEN değişince tetiklensin (ilk mount'ta değil).
  const prevCategoryId = useRef<number | null>(categoryId)

  useEffect(() => {
    let active = true
    const url =
      vehicleTypeId != null && categoryId != null
        ? `/api/tecdoc/brands?vehicleId=${vehicleTypeId}&categoryId=${categoryId}`
        : vehicleTypeId != null
          ? `/api/tecdoc/brands?vehicleId=${vehicleTypeId}`
          : "/api/tecdoc/brands"
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        const list: PartBrandSummary[] = Array.isArray(d?.brands) ? d.brands : []
        setBrands(list)
        // GÜVENİLİR yön auto-clear: kategori değişti, mevcut marka yeni sette yok,
        // liste boş değil (transient/boş cevapta silme yok) → temizle.
        const categoryChanged = prevCategoryId.current !== categoryId
        prevCategoryId.current = categoryId
        if (
          strict && categoryChanged && value &&
          categoryId != null && list.length > 0 &&
          !list.some((b) => b.name === value)
        ) {
          onChange("", null)
        }
      })
      .catch(() => { if (active) setBrands([]) })
    return () => { active = false }
    // value/onChange kasıtlı olarak dep dışı: yalnız scope değişiminde fetch + kontrol.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleTypeId, categoryId])

  return (
    <Combobox
      items={brands}
      filter={(item: PartBrandSummary, query: string) =>
        item.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr"))}
      itemToStringLabel={(b: PartBrandSummary) => b.name}
      itemToStringValue={(b: PartBrandSummary) => b.name}
      inputValue={value}
      onInputValueChange={(v: string) => { if (!strict) onChange(v, null) }}
      onValueChange={(b: PartBrandSummary | null) => { if (b) onChange(b.name, b.supplierId) }}
    >
      <ComboboxInput
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (strict) return // katı modda Base UI varsayılanı (Enter'da revert) istenir
          if (e.key !== "Enter") return
          if (e.currentTarget.getAttribute("aria-activedescendant")) return
          // Serbest metinde Enter: yazılan değeri koru.
          e.preventBaseUIHandler()
          e.preventDefault()
        }}
      />
      <ComboboxContent>
        <ComboboxEmpty className="py-2 text-sm text-muted-foreground">
          {strict ? "Uygun marka bulunamadı" : "Listede yok — yazdığınız değer kullanılacak"}
        </ComboboxEmpty>
        <ComboboxList>
          {(b: PartBrandSummary) => (
            <ComboboxItem key={b.supplierId} value={b}>{b.name}</ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
```

- [ ] **Step 2: Verify typecheck (grid will error until Task 7 — scope check to this file)**

Run: `bun run lint src/components/app/part-brand-combobox.tsx`
Expected: PASS for this file. (Full `typecheck` will report a call-site mismatch in `parts-labor-grid.tsx` — beklenen; Task 7'de düzeltilecek. Bu task'i tek başına commit'le, tam typecheck Task 7 sonunda yeşile döner.)

- [ ] **Step 3: Commit**

```bash
git add src/components/app/part-brand-combobox.tsx
git commit -m "feat(parts): marka combobox araç/kategori-scoped + katı mod + güvenilir-yön auto-clear"
```

---

## Task 6: `ItemCategoryCascade` — düz aranabilir combobox + supplierId filtresi

**Files:**
- Modify: `src/components/app/item-category-cascade.tsx`

**Interfaces:**
- Consumes: `GET /api/tecdoc/categories` (Task 4); `CategoryNode`, `CategoryLeaf`; `flattenCategoryLeaves` (Task 1).
- Produces: React component prop imzası:
  ```ts
  ItemCategoryCascade({
    vehicleTypeId: number | null,
    supplierId: number | null,
    value: string | null,
    onSelect: (sel: { category: string; categoryId: number | null }) => void,
  })
  ```

- [ ] **Step 1: Rewrite the component**

`src/components/app/item-category-cascade.tsx` tamamını değiştir:

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
import { Input } from "@/components/ui/input"
import { flattenCategoryLeaves } from "@/lib/tecdoc/tree"
import type { CategoryLeaf, CategoryNode } from "@/lib/tecdoc/types"

export function ItemCategoryCascade({
  vehicleTypeId,
  supplierId,
  value,
  onSelect,
}: {
  vehicleTypeId: number | null
  supplierId: number | null
  value: string | null
  onSelect: (sel: { category: string; categoryId: number | null }) => void
}) {
  // Araç TecDoc'ta eşleşmemiş → serbest metin fallback (mevcut davranış).
  const [freeText, setFreeText] = useState(value || "")
  if (vehicleTypeId == null) {
    return (
      <Input
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
        onBlur={() => {
          if (freeText !== (value || "")) onSelect({ category: freeText, categoryId: null })
        }}
        placeholder="Kategori (serbest)"
        className="h-8 text-xs w-40"
      />
    )
  }
  return (
    <CategoryComboboxImpl
      vehicleTypeId={vehicleTypeId}
      supplierId={supplierId}
      value={value}
      onSelect={onSelect}
    />
  )
}

function CategoryComboboxImpl({
  vehicleTypeId,
  supplierId,
  value,
  onSelect,
}: {
  vehicleTypeId: number
  supplierId: number | null
  value: string | null
  onSelect: (sel: { category: string; categoryId: number | null }) => void
}) {
  const [leaves, setLeaves] = useState<CategoryLeaf[]>([])

  useEffect(() => {
    let active = true
    const url =
      supplierId != null
        ? `/api/tecdoc/categories?vehicleId=${vehicleTypeId}&supplierId=${supplierId}`
        : `/api/tecdoc/categories?vehicleId=${vehicleTypeId}`
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        const tree: CategoryNode[] = Array.isArray(d?.categories) ? d.categories : []
        setLeaves(flattenCategoryLeaves(tree))
      })
      .catch(() => { if (active) setLeaves([]) })
    return () => { active = false }
  }, [vehicleTypeId, supplierId])

  return (
    <Combobox
      items={leaves}
      filter={(item: CategoryLeaf, query: string) =>
        item.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")) ||
        item.path.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr"))}
      itemToStringLabel={(c: CategoryLeaf) => c.name}
      itemToStringValue={(c: CategoryLeaf) => c.name}
      inputValue={value ?? ""}
      onValueChange={(c: CategoryLeaf | null) => {
        if (c) onSelect({ category: c.name, categoryId: c.id })
      }}
    >
      <ComboboxInput placeholder="Kategori ara..." className="w-40" />
      <ComboboxContent>
        <ComboboxEmpty className="py-2 text-sm text-muted-foreground">
          Uygun kategori bulunamadı
        </ComboboxEmpty>
        <ComboboxList>
          {(c: CategoryLeaf) => (
            <ComboboxItem key={c.id} value={c}>
              <span className="flex flex-col">
                <span>{c.name}</span>
                {c.path && <span className="text-xs text-muted-foreground">{c.path}</span>}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
```

- [ ] **Step 2: Verify lint for this file**

Run: `bun run lint src/components/app/item-category-cascade.tsx`
Expected: PASS. (Full typecheck yeşile Task 7'de döner.)

- [ ] **Step 3: Commit**

```bash
git add src/components/app/item-category-cascade.tsx
git commit -m "feat(parts): kategori seçici düz aranabilir combobox + marka→kategori supplierId filtresi"
```

---

## Task 7: `GridRow` wiring — brandSupplierId state + yeni prop imzaları

**Files:**
- Modify: `src/components/app/parts-labor-grid.tsx`

**Interfaces:**
- Consumes: `PartBrandCombobox` (Task 5, `onChange: (name, supplierId) => void`), `ItemCategoryCascade` (Task 6, `supplierId` prop).
- Produces: (dahili) `Row` tipine `brandSupplierId?: number | null` eklenir; persist edilmez.

- [ ] **Step 1: Extend `Row` type with runtime-only `brandSupplierId`**

`src/components/app/parts-labor-grid.tsx` — mevcut `Row` tipini değiştir (satır ~22):

```ts
// brandSupplierId: yalnız runtime — marka→kategori best-effort filtresi için
// seçili markanın TecDoc supplierId'sini taşır; ASLA persist edilmez.
type Row = OrderItem & { __draft?: boolean; __saving?: boolean; tempId?: string; brandSupplierId?: number | null }
```

- [ ] **Step 2: Update the brand + category render block in `GridRow`**

`GridRow` içindeki mevcut blok (satır ~281-289) — `<div className="flex items-center gap-1.5 flex-wrap">` içeriğini değiştir:

```tsx
<div className="flex items-center gap-1.5 flex-wrap">
  <div className="w-32">
    <PartBrandCombobox
      value={row.brand || ""}
      vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
      categoryId={row.categoryId}
      onChange={(name, supplierId) =>
        onCell(row, { brand: name || null, brandSupplierId: supplierId }, { debounce: true })}
    />
  </div>
  <ItemCategoryCascade
    key={`cat-${row.id}-${row.category ?? ""}`}
    vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
    supplierId={row.brandSupplierId ?? null}
    value={row.category}
    onSelect={(sel) => onCell(row, { category: sel.category, categoryId: sel.categoryId })}
  />
</div>
```

- [ ] **Step 3: Confirm `brandSupplierId` never reaches the server**

`persistUpdate` (satır ~121-131) yalnız bilinen alanları FormData'ya yazar (`quantity`, `unitPrice`, `brand`, `category`, `categoryId`, `sku`, `name`, `unit`). `brandSupplierId` bu listede YOK — dolayısıyla `onCell` → `persistUpdate(patch)` çağrısında `brandSupplierId` sunucuya gitmez; yalnız `patchLocal` ile state'e yazılır. **Bu adımda kod değişikliği yok** — sadece invaryantı doğrula (gözle kontrol). Aynı şekilde `persistDraft` (satır ~78-88) yalnız beyaz-listeli alanları POST eder.

- [ ] **Step 4: Full typecheck (now green across call sites)**

Run: `bun run typecheck`
Expected: PASS (0 errors). Marka combobox'ın 2-argümanlı `onChange`'i ve kategori `supplierId` prop'u artık GridRow ile uyumlu.

- [ ] **Step 5: Lint**

Run: `bun run lint`
Expected: PASS (0 errors/warnings on touched files).

- [ ] **Step 6: Commit**

```bash
git add src/components/app/parts-labor-grid.tsx
git commit -m "feat(parts): grid marka/kategori cascade wiring + runtime brandSupplierId (persist edilmez)"
```

---

## Task 8: Final verification — build + manuel QA

**Files:** (yok — doğrulama)

- [ ] **Step 1: Full lib test suite**

Run: `bun test src/lib/tecdoc/`
Expected: PASS (12 tests).

- [ ] **Step 2: Typecheck + lint (repo geneli)**

Run: `bun run typecheck && bun run lint`
Expected: PASS.

- [ ] **Step 3: Production build**

Run: `bun run build`
Expected: Başarılı derleme (route'lar + client bileşenleri hatasız).

- [ ] **Step 4: Manuel QA — dev sunucu (yerel DB gerekli: OrbStack)**

Gerekirse `docker compose -f docker-compose.local.yml up -d` (Postgres+MinIO), sonra `bun run dev`. Bir iş emrinde (katalog-bağlı araç) parça satırında:

1. Kategori seç → marka listesi o kategoriye daralır; markada arama çalışır.
2. Farklı marka seç → kategori listesi best-effort daralır; kategori değeri **silinmez**.
3. Kategoriyi, seçili markayı içermeyen bir kategoriye değiştir → marka **otomatik temizlenir**.
4. Kategori seçmeden marka aç → yalnız araç-scoped markalar (global jenerik liste yok).
5. Her iki combobox'ta yazarak arama; kategori satırında üst-kategori yolu görünür.
6. Kaydet + sayfayı yenile → `brand`/`category`/`categoryId` doğru persist; `brandSupplierId` DB'ye gitmemiş (satır DB kaydında yok).

Katalog-bağlı OLMAYAN araçta (`catalogVehicleTypeId == null`):

7. Marka ve kategori alanları serbest-metin fallback olarak çalışır (bozulmamış).

- [ ] **Step 5: (Öneri) UI/UX QA skill**

`bakimx-ui-qa` skill'i ile mobil-öncelikli parça satırı akışını gözden geçir (combobox dokunma hedefleri, taşma, tr-arama).

- [ ] **Step 6: Branch'i tamamla**

`superpowers:finishing-a-development-branch` ile PR (hedef: `dev`) veya merge kararını ver.

---

## Self-Review (plan yazarı tarafından tamamlandı)

- **Spec kapsamı:** Karar 1 (veri kaynağı) → Task 2/3; Karar 2 (düz aranabilir kategori) → Task 1 flatten + Task 6; Karar 3 (araç-scoped başlangıç markaları) → Task 2 `getVehicleBrands` + Task 5; Karar 4 (güvenilir-yön auto-clear, best-effort filtrele) → Task 5 auto-clear + Task 4 prune; Karar 5 (katı, serbest-metin yok) → Task 5 `strict`; Karar 6 (fallback) → Task 5/6 `vehicleTypeId == null` dalları. Tümü kapsandı.
- **Placeholder taraması:** Yok — her adımda tam kod/komut var.
- **Tip tutarlılığı:** `onChange(name, supplierId)` (Task 5) ↔ GridRow call-site (Task 7); `supplierId` prop (Task 6) ↔ `row.brandSupplierId` (Task 7); `CategoryLeaf` (Task 1 types) ↔ Task 6 import; `dedupeBrands` imzası (Task 1) ↔ Task 2 çağrısı — hepsi uyumlu.
- **Not:** Task 5/6 tek başına çalıştırıldığında tam `typecheck` GridRow call-site uyumsuzluğu verir (kasıtlı); Task 7 sonunda yeşile döner. Alt-görev yürütücüsü bu sırayı korumalı.
