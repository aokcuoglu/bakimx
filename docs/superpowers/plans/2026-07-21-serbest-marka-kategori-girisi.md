# Serbest Marka/Kategori Girişi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İş emri parça satırındaki Marka/Kategori kolonlarını, katalog önerisi sunan **ama serbest metin de kabul eden** düzenlenebilir alana çevirmek (mobil dahil, araç TecDoc'a bağlı olmasa bile).

**Architecture:** Base UI **Combobox** (katı liste-seçim) → **Autocomplete** (free-form) geçişi. Yazılan metin bir katalog seçeneğiyle eşleşmiyorsa liste altında `＋ "{yazılan}" ekle` aksiyonu belirir; tıklama serbest değeri satıra persist eder. "Göster/gizle + commit değeri" kararı saf bir helper'a çıkarılır ve `bun test` ile test edilir. Persist boru hattı (`onCell` → POST/PATCH) ve sunucu API'si (`brand`/`category`/`categoryId` kabulü) zaten mevcut → **API/Prisma/migration değişikliği YOK**.

**Tech Stack:** Next.js (client component), TypeScript strict, Base UI Autocomplete (`@/components/ui/autocomplete`), `bun test`.

## Global Constraints

- TypeScript strict; `any` yok.
- Prisma şema / migration / API rota değişikliği YOK — yalnız frontend.
- Tenant izolasyonu: bu değişiklik yeni sorgu eklemez (mevcut `onCell` persist yolu korunur).
- Mobil-öncelikli: alanlar mobilde de düzenlenebilir olmalı.
- ShadcnUI/Base UI bileşenleri kullan; elle özel UI yazma.
- Web'de form bileşen yüksekliği h-9 kuralı (bu alanlar grid içi kompakt `text-xs`; mevcut desenle hizalı kalır).
- Kilitli emirde (`isOrderLocked`) alanlar disabled.
- Chat/QA yanıtları Türkçe.

---

## File Structure

- **Create** `src/components/app/part-attribute-commit.ts` — saf helper: `freeTextCommit(query, options)` → `＋ekle` gösterilsin mi + commit değeri. `AttrOption` tipi burada tanımlı.
- **Create** `src/components/app/part-attribute-commit.test.ts` — helper için `bun test` birim testleri.
- **Create** `src/components/app/part-attribute-field.tsx` — Autocomplete tabanlı free-form Marka/Kategori alanı (eski `part-filter-combobox.tsx`'in yerini alır).
- **Delete** `src/components/app/part-filter-combobox.tsx` — Combobox tabanlı eski filtre (katı liste-seçim).
- **Modify** `src/components/app/parts-labor-grid.tsx` — import değişimi + paylaşılan `AttrCell` hücre bileşeni ekle (persist + unlinked + free-form); `DesktopPartRow` ve `MobilePartRow`'da Marka/Kategori'yi bununla değiştir (mobil düzenlenebilir).

> **GÜNCELLEME (2026-07-21):** `parts-labor-grid.tsx` bu plan yazıldıktan sonra `refactor(orders): parça/işçilik grid'i shadcn Base <table>'a taşı` (commit `fd055c5`) ile yeniden yapılandırıldı. Artık paylaşılan `useRowEditor` hook'u + layout-bağımsız hücre bileşenleri (`PartField`, `QtyStepper`, `PriceField`, `DeleteButton`, `RowTecdocPicker`) + ayrı `DesktopPartRow` (gerçek `<table>` satırı) ve `MobilePartRow` (kart) var. Task 2 aşağıda BU yapıya göre yazılmıştır (eski `GridRow` yok). Branch: `feat/serbest-marka-kategori` (base `fd055c5`).

---

## Task 1: Serbest-commit karar helper'ı (saf + test)

Proje React DOM test altyapısına sahip değil (`bun test`, saf `.ts` mantık testleri — bkz. `src/components/app/vin-resolve.ts` deseni). Bu yüzden test edilebilir tek çekirdek olan "`＋ekle` gösterilsin mi + hangi değer" kararını saf helper'a çıkarıp test ediyoruz.

**Files:**
- Create: `src/components/app/part-attribute-commit.ts`
- Test: `src/components/app/part-attribute-commit.test.ts`

**Interfaces:**
- Produces:
  - `type AttrOption = { id: number; label: string; sub?: string }`
  - `function freeTextCommit(query: string, options: AttrOption[]): { show: boolean; value: string }`

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`src/components/app/part-attribute-commit.test.ts`:

```ts
import { test, expect } from "bun:test"
import { freeTextCommit, type AttrOption } from "./part-attribute-commit"

const OPTS: AttrOption[] = [
  { id: 1, label: "Bosch" },
  { id: 2, label: "Mann Filter" },
]

test("boş/whitespace query → gösterme", () => {
  expect(freeTextCommit("", OPTS)).toEqual({ show: false, value: "" })
  expect(freeTextCommit("   ", OPTS)).toEqual({ show: false, value: "" })
})

test("katalogda olmayan değer → ＋ekle göster, trim'li", () => {
  expect(freeTextCommit("  seta ", OPTS)).toEqual({ show: true, value: "seta" })
})

test("birebir eşleşen (case-insensitive) → gösterme", () => {
  expect(freeTextCommit("bosch", OPTS)).toEqual({ show: false, value: "bosch" })
})

test("kısmi eşleşme yine ＋ekle gösterir", () => {
  expect(freeTextCommit("Mann", OPTS)).toEqual({ show: true, value: "Mann" })
})

test("boş seçenek listesi (unlinked) → dolu query'de göster", () => {
  expect(freeTextCommit("seta", [])).toEqual({ show: true, value: "seta" })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `bun test src/components/app/part-attribute-commit.test.ts`
Expected: FAIL — "Cannot find module './part-attribute-commit'" (helper henüz yok).

- [ ] **Step 3: Helper'ı yaz (minimal)**

`src/components/app/part-attribute-commit.ts`:

```ts
export type AttrOption = { id: number; label: string; sub?: string }

/**
 * Serbest "＋ ekle" aksiyonu gösterilsin mi ve hangi değeri commit etmeli.
 * - query boş/boşluk ise gösterme.
 * - mevcut bir seçenekle (Türkçe case-insensitive) birebir eşleşiyorsa gösterme
 *   (zaten listeden seçilebilir).
 * - aksi halde göster; commit değeri trim'li query.
 */
export function freeTextCommit(
  query: string,
  options: AttrOption[]
): { show: boolean; value: string } {
  const value = query.trim()
  if (!value) return { show: false, value: "" }
  const lower = value.toLocaleLowerCase("tr")
  const exact = options.some((o) => o.label.toLocaleLowerCase("tr") === lower)
  return { show: !exact, value }
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `bun test src/components/app/part-attribute-commit.test.ts`
Expected: PASS (6 test / 5 test bloğu, tümü yeşil).

- [ ] **Step 5: Commit**

```bash
git add src/components/app/part-attribute-commit.ts src/components/app/part-attribute-commit.test.ts
git commit -m "feat(parts): serbest marka/kategori commit karar helper'ı + test"
```

---

## Task 2: Autocomplete alanı + grid wiring (yeni <table> yapısına göre)

`parts-labor-grid.tsx` artık paylaşılan `useRowEditor` hook'u + layout-bağımsız hücre bileşenleri (`PartField`, `QtyStepper`, `PriceField`, `DeleteButton`, `RowTecdocPicker`) + `DesktopPartRow`/`MobilePartRow` kullanıyor. Bu görev, aynı desende **paylaşılan bir `AttrCell` hücre bileşeni** ekler (Marka/Kategori için) ve iki satır bileşeninde de kullanır → mobil düzenleme doğal olarak gelir. Bileşenin yeni arayüzü ile grid tüketimi birbirine bağlı → tek görev, sonunda build yeşil.

**Files:**
- Create: `src/components/app/part-attribute-field.tsx`
- Delete: `src/components/app/part-filter-combobox.tsx`
- Modify: `src/components/app/parts-labor-grid.tsx`
  - import satırı `24` (`PartFilterCombobox` → `PartAttributeField`)
  - yeni `AttrCell` bileşeni (mevcut `RowTecdocPicker`'dan hemen sonra, ~`489`)
  - `DesktopPartRow` Marka hücresi (`527-545`) ve Kategori hücresi (`547-566`)
  - `MobilePartRow` Marka/Kategori salt-görünür bloğu (`633-643`)

**Interfaces:**
- Consumes (Task 1, commit'li): `freeTextCommit`, `AttrOption` from `@/components/app/part-attribute-commit`.
- Mevcut grid iç tipleri: `Row`, `OnCell`, `RowEditor` (= `ReturnType<typeof useRowEditor>`), `PickerVehicle`. `RowEditor` şu alanları sağlar: `isPart`, `editable`, `linked`, `filter`, `setFilter`, `setTecdocOpen`.
- Produces:
  - `PartAttributeField` props:
    ```ts
    {
      kind: "brand" | "category"
      vehicleTypeId: number | null   // null → katalog fetch YOK, saf serbest metin
      value: string                  // row.brand / row.category (source of truth)
      disabled?: boolean
      onSelect: (id: number, name: string) => void        // katalog seçimi
      onCommitFreeText: (value: string) => void            // "＋ ekle"
      onClear: () => void
      onOpenPicker?: () => void       // yalnız linked'de verilir → "Katalogda ara →"
    }
    ```
  - `AttrCell` props: `{ kind: "brand" | "category"; row: Row; ed: RowEditor; vehicle?: PickerVehicle; onCell: OnCell }`

- [ ] **Step 1: Yeni bileşen dosyasını oluştur**

`src/components/app/part-attribute-field.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "@/components/ui/autocomplete"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Plus, Search, XIcon } from "lucide-react"
import { flattenCategoryLeaves } from "@/lib/tecdoc/tree"
import { freeTextCommit, type AttrOption } from "@/components/app/part-attribute-commit"
import type { CategoryLeaf, CategoryNode, PartBrandSummary } from "@/lib/tecdoc/types"

/**
 * Parça satırının Marka/Kategori alanı: katalog (cache'li TecDoc) önerisi sunar
 * AMA serbest metin de kabul eder. Base UI Combobox katı liste-seçim olduğu için
 * (free-form değil) Autocomplete kullanılır. Yazılan metin bir öneriyle
 * eşleşmezse liste altında `＋ "{yazılan}" ekle` aksiyonu belirir; commit yalnız
 * bu aksiyon ile (Enter/blur otomatik commit YOK — kazara kayıt önlenir).
 * Araç TecDoc'a bağlı değilse (vehicleTypeId=null) fetch yapılmaz; saf serbest
 * metin girişi olur.
 */
export function PartAttributeField({
  kind,
  vehicleTypeId,
  value,
  disabled,
  onSelect,
  onCommitFreeText,
  onClear,
  onOpenPicker,
}: {
  kind: "brand" | "category"
  vehicleTypeId: number | null
  value: string
  disabled?: boolean
  onSelect: (id: number, name: string) => void
  onCommitFreeText: (value: string) => void
  onClear: () => void
  onOpenPicker?: () => void
}) {
  const [options, setOptions] = useState<AttrOption[]>([])
  const [loaded, setLoaded] = useState(false)
  const [query, setQuery] = useState(value)

  // Dış value (kayıtlı row.brand/category) → iç query senkronu (React↔prop).
  useEffect(() => {
    if (value !== query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(value)
    }
    // yalnız dış value değişimini izler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Katalog seçeneklerini yükle — yalnız araç bağlıysa (kotasız cache).
  useEffect(() => {
    if (vehicleTypeId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptions([])
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoaded(true)
      return
    }
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(false)
    const url =
      kind === "brand"
        ? `/api/tecdoc/brands?vehicleId=${vehicleTypeId}`
        : `/api/tecdoc/categories?vehicleId=${vehicleTypeId}`
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return
        if (!data) { setLoaded(true); return }
        if (kind === "brand") {
          const brands: PartBrandSummary[] = Array.isArray(data.brands) ? data.brands : []
          setOptions(brands.map((b) => ({ id: b.supplierId, label: b.name })))
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
  const commit = freeTextCommit(query, options)
  const linked = vehicleTypeId != null
  const showFooter = commit.show || (linked && !!onOpenPicker)

  return (
    <Autocomplete
      items={options}
      value={query}
      autoHighlight
      openOnInputClick
      itemToStringValue={(o: AttrOption) => o.label}
      onValueChange={(v: string) => setQuery(v)}
    >
      <InputGroup>
        <AutocompleteInput
          render={
            <InputGroupInput placeholder={placeholder} disabled={disabled} className="text-xs" />
          }
        />
        {value && !disabled && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-label="Temizle"
              // Input blur'ı popup'ı onClick'ten önce kapatmasın diye focus'u koru.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onClear(); setQuery("") }}
            >
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      <AutocompleteContent>
        <AutocompleteEmpty>{loaded ? "Bulunamadı" : "Yükleniyor…"}</AutocompleteEmpty>
        <AutocompleteList>
          {(o: AttrOption) => (
            <AutocompleteItem
              key={o.id}
              value={o}
              onClick={() => { onSelect(o.id, o.label); setQuery(o.label) }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{o.label}</span>
                {o.sub && (
                  <span className="block truncate text-[11px] text-muted-foreground">{o.sub}</span>
                )}
              </span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
        {showFooter && (
          <div className="space-y-0.5 border-t border-border p-1">
            {commit.show && (
              <InputGroupButton
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onCommitFreeText(commit.value); setQuery(commit.value) }}
              >
                <Plus />
                <span className="truncate">&ldquo;{commit.value}&rdquo; ekle</span>
              </InputGroupButton>
            )}
            {linked && onOpenPicker && (
              <InputGroupButton
                size="sm"
                variant="ghost"
                className="w-full justify-start"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onOpenPicker}
              >
                <Search />
                Katalogda ara →
              </InputGroupButton>
            )}
          </div>
        )}
      </AutocompleteContent>
    </Autocomplete>
  )
}
```

- [ ] **Step 2: Eski bileşeni sil**

```bash
git rm src/components/app/part-filter-combobox.tsx
```

- [ ] **Step 3: Grid import satırını değiştir (`parts-labor-grid.tsx:24`)**

Değiştir:

```tsx
import { PartFilterCombobox } from "@/components/app/part-filter-combobox"
```

Yerine:

```tsx
import { PartAttributeField } from "@/components/app/part-attribute-field"
```

- [ ] **Step 4: Paylaşılan `AttrCell` bileşenini ekle**

`RowTecdocPicker` fonksiyonunun kapanış `}`'inden hemen SONRA (mevcut `// ── Masaüstü satırı` yorumundan ÖNCE) şu bileşeni ekle:

```tsx
// Marka/Kategori hücresi (masaüstü + mobil ortak). Düzenlenebilirken katalog
// önerili + serbest-metin Autocomplete; kilitliyken salt-görünür etiket.
// Seçim/serbest-commit satıra persist EDER (onCell) ve katalog seçimi ayrıca
// parça aramasını daraltan filtreyi (ed.filter) set eder.
function AttrCell({ kind, row, ed, vehicle, onCell }: {
  kind: "brand" | "category"; row: Row; ed: RowEditor; vehicle?: PickerVehicle; onCell: OnCell
}) {
  if (!ed.isPart) return null
  const value = kind === "brand" ? row.brand : row.category

  if (!ed.editable) {
    return value ? (
      <span className="block truncate text-xs text-muted-foreground" title={value}>{value}</span>
    ) : (
      <span className="text-xs text-muted-foreground/40">—</span>
    )
  }

  return (
    <PartAttributeField
      kind={kind}
      vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
      value={value ?? ""}
      disabled={row.__saving}
      onSelect={(id, name) => {
        if (kind === "brand") {
          ed.setFilter((f) => ({ ...f, supplierId: id, supplierName: name }))
          onCell(row, { brand: name })
        } else {
          ed.setFilter((f) => ({ ...f, categoryId: id, categoryName: name }))
          onCell(row, { category: name, categoryId: id })
        }
      }}
      onCommitFreeText={(v) => {
        if (kind === "brand") {
          ed.setFilter((f) => ({ ...f, supplierId: undefined, supplierName: undefined }))
          onCell(row, { brand: v })
        } else {
          ed.setFilter((f) => ({ ...f, categoryId: undefined, categoryName: undefined }))
          onCell(row, { category: v, categoryId: null })
        }
      }}
      onClear={() => {
        if (kind === "brand") {
          ed.setFilter((f) => ({ ...f, supplierId: undefined, supplierName: undefined }))
          onCell(row, { brand: null })
        } else {
          ed.setFilter((f) => ({ ...f, categoryId: undefined, categoryName: undefined }))
          onCell(row, { category: null, categoryId: null })
        }
      }}
      onOpenPicker={ed.linked ? () => ed.setTecdocOpen(true) : undefined}
    />
  )
}
```

- [ ] **Step 5: `DesktopPartRow` Marka + Kategori hücrelerini değiştir**

Mevcut `{/* Marka */}` `<TableCell>` bloğunun İÇİNİ (satır `527-545` civarı; `{ed.isPart && ( ... )}` ifadesinin tamamı) şununla değiştir:

```tsx
      {/* Marka */}
      <TableCell className="whitespace-normal">
        <AttrCell kind="brand" row={row} ed={ed} vehicle={vehicle} onCell={onCell} />
      </TableCell>
```

Mevcut `{/* Kategori */}` `<TableCell>` bloğunun İÇİNİ (satır `547-566` civarı) şununla değiştir:

```tsx
      {/* Kategori */}
      <TableCell className="whitespace-normal">
        <AttrCell kind="category" row={row} ed={ed} vehicle={vehicle} onCell={onCell} />
      </TableCell>
```

- [ ] **Step 6: `MobilePartRow` Marka/Kategori bloğunu düzenlenebilir yap**

Mevcut mobil salt-görünür bloğu (satır `633-643`):

```tsx
      {/* Marka / Kategori (mobilde yalnız salt-görünür metin — combobox mobilde yok) */}
      {ed.isPart && row.brand && (
        <p className="mt-1.5 truncate text-xs text-muted-foreground">
          <span className="text-muted-foreground/70">Marka: </span>{row.brand}
        </p>
      )}
      {ed.isPart && row.category && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          <span className="text-muted-foreground/70">Kategori: </span>{row.category}
        </p>
      )}
```

şununla değiştir (düzenlenebilirken input; kilitliyken yalnız dolu olanları etiketle gösterir):

```tsx
      {/* Marka / Kategori — mobilde de düzenlenebilir (AttrCell ortak hücre). */}
      {ed.isPart && (ed.editable || row.brand || row.category) && (
        <div className="mt-2 space-y-1.5">
          {(ed.editable || row.brand) && (
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-muted-foreground">Marka</span>
              <div className="min-w-0 flex-1">
                <AttrCell kind="brand" row={row} ed={ed} vehicle={vehicle} onCell={onCell} />
              </div>
            </div>
          )}
          {(ed.editable || row.category) && (
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-muted-foreground">Kategori</span>
              <div className="min-w-0 flex-1">
                <AttrCell kind="category" row={row} ed={ed} vehicle={vehicle} onCell={onCell} />
              </div>
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 7: Typecheck**

Run: `bun run typecheck`
Expected: PASS. `PartFilterCombobox` kalıntı importu/kullanımı kalmadığını, `AttrCell` tiplerinin (`Row`/`OnCell`/`RowEditor`/`PickerVehicle`) tuttuğunu doğrular.

- [ ] **Step 8: Lint**

Run: `bun run lint`
Expected: PASS (yeni dosyada `set-state-in-effect` satırları bilinçli eslint-disable'lı).

- [ ] **Step 9: Build**

Run: `bun run build`
Expected: PASS.

- [ ] **Step 10: Manuel QA (kontrolöre/kullanıcıya bırakılır)**

> Otomatik değil — çalışan dev sunucu + `bun run db:tunnel` + tarayıcı gerekir. Implementer bunu ÇALIŞTIRMAZ; kontrolör/kullanıcı doğrular. Senaryolar (bir iş emri `/orders/[id]` → "Kullanılan Parçalar & İşçilikler"):
> 1. Bağlı araç + katalog markası seç → arama daralır **ve** satırda marka görünür; yenile → durur.
> 2. Bağlı araç + "seta" yaz → `＋ "seta" ekle` → satırda durur; yenile → durur.
> 3. Bağlı araç + serbest kategori → `categoryId=null` gider, kaydolur.
> 4. Bağlı OLMAYAN araç → Marka/Kategori serbest girilebilir + persist.
> 5. Mobil (dar ekran) → (1)–(4) düzenlenebilir + persist.
> 6. Kilitli/teslim emir → alanlar salt-görünür.
> 7. Temizle (X) → satırda marka/kategori temizlenir.

- [ ] **Step 11: Commit**

```bash
git add src/components/app/part-attribute-field.tsx src/components/app/parts-labor-grid.tsx
git commit -m "feat(parts): iş emri Marka/Kategori serbest giriş + mobil düzenlenebilir (Faz 1)"
```

---

## Self-Review Notları

- **Spec coverage:** (1) Autocomplete free-form → Task 2 Step 1. (2) `＋ekle` açık aksiyon → helper Task 1 + footer Task 2 Step 1. (3) her-seçim-persist → grid onSelect/onCommitFreeText Task 2 Step 4-5. (4) unlinked mod → `vehicleTypeId=null` fetch guard + grid `editable` gate. (5) mobil düzenlenebilir → grid hücre yeniden yapısı Step 4-5. (6) API/şema yok → doğrulandı (onCell/POST-PATCH mevcut). Hepsi kapsanıyor.
- **Type consistency:** `AttrOption` tek yerde (helper), bileşen import eder. Bileşen prop adları (`onSelect`/`onCommitFreeText`/`onClear`/`onOpenPicker`) grid çağrılarıyla birebir. `vehicleTypeId: number | null`.
- **Risk:** Base UI Autocomplete default filtre Türkçe-diakritik farkında olmayabilir (katalog listesi daraltma best-effort; free-form commit'i etkilemez — commit helper `toLocaleLowerCase("tr")` kullanır). Bloklayıcı değil.
