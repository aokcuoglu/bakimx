# Excel-Benzeri Düzenlenebilir Parça/İşçilik Tablosu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İş emri "Parça & İşçilik" sekmesini Excel-benzeri tek düzenlenebilir tabloya çevirmek — satır ekle/sil, per-satır tür (parça/işçilik/dış işçilik), parçada TecDoc modalı (kategori→marka filtreli→parça), taslak satır + otomatik kaydet.

**Architecture:** `OrderItemType` enum'una `external_labor` eklenir. `PartsLaborCard`'ın ekleme formu + `ItemRow`'u kalkar; yeni `PartsLaborGrid` (parts-labor-grid.tsx) tüm kalemleri düzenlenebilir satır olarak gösterir; taslak satırlar client-side, zorunlu alan dolunca `addOrderItemAction` (artık created id döner) ile kaydolur, sonra `updateOrderItemAction` (mevcut CAS stok) ile inline patch'lenir. TecDoc picker Sheet→Dialog'a çevrilir, marka filtresi + kategori yakalama eklenir. Az önce merge edilen inline editör altyapısı (stepper/fiyat/marka/kategori, computeStockDelta, PATCH route) yeniden kullanılır.

**Tech Stack:** Next.js (App Router, server actions), Prisma (Postgres enum), Zod v4, React 19, Base UI (Dialog/Select/Combobox/Popover), bun test, Tailwind.

## Global Constraints

- Para = kuruş (integer); input TRY → `liraToKurus`/`kurusToLira` (`src/lib/money.ts`).
- Her server action `requireWritableWorkshop()` → `workshopId` sunucudan; client param'a güvenme (tenant izolasyonu).
- Kilitli iş emri (`isOrderLocked`) düzenlenemez → action error, UI salt-görüntü.
- Şema: `prisma migrate dev`; enum `ADD VALUE` additive. Sonrasında **dev server restart** (db.ts singleton).
- Testler `bun test`; yalnız saf `src/lib/*` (DB/component harness yok) → grid/action/picker manuel QA + build/lint/typecheck.
- ShadcnUI/Base UI kullan; custom UI hand-roll etme. Bileşen yüksekliği web'de `h-9`.
- TS strict; `any` yok.
- Mobil-öncelikli; masaüstü grid / mobil kart.
- Yeniden kullan, yeniden yazma: `updateOrderItemAction`, `computeStockDelta`, `PartBrandCombobox`, `ItemCategoryCascade`, `/api/orders/items` route.
- WIP dosyalarına dokunma: `customer-search-or-create.tsx`, `vehicle-detail.tsx`. `git add` yalnız isimle.

---

## File Structure

- `prisma/schema.prisma` — `OrderItemType` enum'a `external_labor` (Modify) + migration (Create)
- `src/lib/totals.ts` — `externalLaborTotal`/`externalLaborCount`, subtotal'a dahil (Modify) + `totals.test.ts` (Modify)
- `src/lib/validations/order.ts` — type enum'a `external_labor` (Modify)
- `src/app/(app)/orders/actions.ts` — `external_labor` kabul + `addOrderItemAction` created id döndür (Modify)
- `src/app/api/orders/items/route.ts` — POST created id'yi geçir (Modify)
- `src/components/app/order-management-panel.tsx` — `Totals` tipi + `PricingSummaryCard` "Dış İşçilik" satırı + `PartsLaborCard` → `PartsLaborGrid` delege, eski `ItemRow`+add-form sil (Modify)
- `src/app/(app)/orders/[id]/page.tsx` — totals mapping'e `externalLaborTotal` (Modify)
- `src/components/app/tecdoc-part-picker.tsx` — Sheet→Dialog + marka filtresi + kategori yakalama + controlled trigger + `onSelect` genişler (Modify)
- Yeni: `src/components/app/parts-labor-grid.tsx` — `PartsLaborGrid` + `GridRow` (Create)

---

## Task 1: Şema — OrderItemType'a external_labor + migration

**Files:**
- Modify: `prisma/schema.prisma` (enum `OrderItemType`, ~773)
- Create: migration

**Interfaces:**
- Produces: `OrderItemType = part | labor | external_labor`

- [ ] **Step 1: Enum'a değer ekle**

```prisma
enum OrderItemType {
  part
  labor
  external_labor
}
```

- [ ] **Step 2: Şemayı doğrula**

Run: `bun run db:validate`
Expected: `valid 🚀`

- [ ] **Step 3: Migration üret**

Run: `bun run db:migrate -- --name add_external_labor_item_type`
Expected: migration klasörü oluşur (`ALTER TYPE "OrderItemType" ADD VALUE 'external_labor';`), "in sync", `prisma generate` çalışır.
> DB kapalıysa `docker compose -f docker-compose.local.yml up -d`, tekrar dene.

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): OrderItemType'a external_labor (dış işçilik)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: totals.ts — externalLaborTotal + subtotal'a dahil (TDD)

**Kritik:** `calculateOrderTotals` şu an `subtotal = partsTotal + laborTotal` — external_labor'ı dışlar. Dahil edilmezse dış işçilik satırları UI toplamına girmez (recalc/ödeme zaten `calculateOrderTotalsFromMinimal` ile tüm türleri sayıyor, orası doğru).

**Files:**
- Modify: `src/lib/totals.ts` (`calculateOrderTotals`, `formatOrderSummary`)
- Test: `src/lib/totals.test.ts`

**Interfaces:**
- Consumes: mevcut `calculateGroupTotal(items, type)`, `sumKurus`.
- Produces: `calculateOrderTotals` dönüşü `externalLaborTotal: number` + `externalLaborCount: number` içerir; `subtotal` artık parts+labor+external; `formatOrderSummary` `externalLaborTotal: string` döner.

- [ ] **Step 1: Failing test ekle**

`src/lib/totals.test.ts`'e ekle (mevcut import satırından `calculateOrderTotals`/`formatOrderSummary` zaten import'lu; değilse ekle):

```ts
test("external_labor satırı subtotal ve grandTotal'a dahil edilir", () => {
  const items = [
    { type: "part", name: "Yağ filtresi", quantity: 1, unitPrice: 6000, totalPrice: null },
    { type: "labor", name: "Yağ değişimi", quantity: 1, unitPrice: 10000, totalPrice: null },
    { type: "external_labor", name: "Rektifiye", quantity: 1, unitPrice: 50000, totalPrice: null },
  ]
  const t = calculateOrderTotals(items)
  expect(t.partsTotal).toBe(6000)
  expect(t.laborTotal).toBe(10000)
  expect(t.externalLaborTotal).toBe(50000)
  expect(t.externalLaborCount).toBe(1)
  expect(t.subtotal).toBe(66000)
  expect(t.grandTotal).toBe(66000)
})

test("formatOrderSummary dış işçilik toplamını biçimler, yoksa —", () => {
  const withExt = formatOrderSummary([{ type: "external_labor", name: "X", quantity: 1, unitPrice: 50000, totalPrice: null }])
  expect(withExt.externalLaborTotal).not.toBe("—")
  const without = formatOrderSummary([{ type: "part", name: "Y", quantity: 1, unitPrice: 6000, totalPrice: null }])
  expect(without.externalLaborTotal).toBe("—")
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `bun test src/lib/totals.test.ts`
Expected: FAIL — `externalLaborTotal` yok.

- [ ] **Step 3: calculateOrderTotals'ı güncelle**

`calculateOrderTotals` içinde `laborTotal` satırından sonra ve `subtotal` satırını değiştir:

```ts
  const partsTotal = calculateGroupTotal(items, "part")
  const laborTotal = calculateGroupTotal(items, "labor")
  const externalLaborTotal = calculateGroupTotal(items, "external_labor")
  const subtotal = sumKurus([partsTotal, laborTotal, externalLaborTotal])
```

Return objesine ekle (mevcut `laborTotal,` sonrası) ve `partsCount`/`laborCount` yanına:

```ts
    externalLaborTotal,
    externalLaborCount: items.filter((i) => i.type === "external_labor").length,
```

Return tipi imzasına da ekle (`laborTotal: number` sonrası): `externalLaborTotal: number` ve `laborCount: number` sonrası: `externalLaborCount: number`.

- [ ] **Step 4: formatOrderSummary'yi güncelle**

Return tipine `externalLaborTotal: string` ekle (imza + obje). Obje içinde:

```ts
    externalLaborTotal: totals.externalLaborCount > 0 ? formatKurus(totals.externalLaborTotal) : "—",
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Run: `bun test src/lib/totals.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/totals.ts src/lib/totals.test.ts
git commit -m "feat(totals): external_labor toplamı subtotal'a dahil + externalLaborTotal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Validation + actions — external_labor kabul + addOrderItemAction id döndür

**Files:**
- Modify: `src/lib/validations/order.ts`
- Modify: `src/app/(app)/orders/actions.ts`
- Modify: `src/app/api/orders/items/route.ts`

**Interfaces:**
- Produces: `serviceOrderItemSchema.type` `external_labor` kabul eder; `addOrderItemAction` `{ success: true, id: string }` döner; POST route bu `id`'yi geçirir.

- [ ] **Step 1: Zod enum'una external_labor ekle**

`src/lib/validations/order.ts`, `serviceOrderItemSchema.type`:

```ts
  type: z.enum(["part", "labor", "external_labor"], {
    error: "Geçerli bir kalem tipi seçiniz (parça/işçilik/dış işçilik)",
  }),
```

- [ ] **Step 2: addOrderItemAction başarı dönüşüne id ekle**

`src/app/(app)/orders/actions.ts`, `addOrderItemAction` sonundaki `return { success: true }`'i değiştir:

```ts
  return { success: true, id: createdItemId }
```

(`createdItemId` zaten transaction'dan dönen değişken.)

- [ ] **Step 3: POST route created id'yi geçir**

`src/app/api/orders/items/route.ts`, POST handler'ında `addOrderItemAction` sonucunu döndürürken id'yi de geçir:

```ts
    const result = await addOrderItemAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, id: result.id })
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: PASS (stok mantığı yalnız `type === "part"` + `partId` için çalışır; `external_labor` doğal olarak stok tutmaz — ek değişiklik yok).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/order.ts "src/app/(app)/orders/actions.ts" src/app/api/orders/items/route.ts
git commit -m "feat(orders): external_labor tipi + addOrderItemAction created id döndürür

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Totals tipi + page mapping + PricingSummaryCard "Dış İşçilik Toplamı"

**Files:**
- Modify: `src/components/app/order-management-panel.tsx` (`Totals` tipi + `PricingSummaryCard`)
- Modify: `src/app/(app)/orders/[id]/page.tsx` (totals mapping)

**Interfaces:**
- Consumes: `calculateOrderTotals` artık `externalLaborTotal` içerir (Task 2).
- Produces: `Totals` tipine `externalLaborTotal: number` + `externalLaborCount: number`; page bunları besler; `PricingSummaryCard` "Dış İşçilik Toplamı" satırı gösterir.

- [ ] **Step 1: Totals tipini genişlet**

`order-management-panel.tsx`, `export type Totals`:

```ts
export type Totals = {
  partsTotal: number
  laborTotal: number
  externalLaborTotal: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  grandTotal: number
  hasAnyPrice: boolean
  partsCount: number
  laborCount: number
  externalLaborCount: number
}
```

- [ ] **Step 2: page.tsx totals mapping'e ekle**

`src/app/(app)/orders/[id]/page.tsx`, `totals:` objesi (`laborTotal: totals.laborTotal,` sonrası ve `laborCount` yanı):

```ts
      externalLaborTotal: totals.externalLaborTotal,
```
ve `partsCount`/`laborCount` ile birlikte:
```ts
      externalLaborCount: totals.externalLaborCount,
```

- [ ] **Step 3: PricingSummaryCard'a satır ekle**

`PricingSummaryCard` içinde "İşçilik Toplamı" satırının hemen ardına, aynı desende bir satır ekle (yalnız `externalLaborCount > 0` ise değeri, yoksa "—"). Mevcut labor satırının markup'ını izle; örnek:

```tsx
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Dış İşçilik Toplamı</span>
          <span className={totals.externalLaborCount > 0 ? "text-foreground" : "text-muted-foreground/70"}>
            {totals.externalLaborCount > 0 ? formatTRY(totals.externalLaborTotal) : "—"}
          </span>
        </div>
```

(Var olan labor satırının class'larına birebir uy; `formatTRY` bu dosyada import'lu.)

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/app/order-management-panel.tsx "src/app/(app)/orders/[id]/page.tsx"
git commit -m "feat(orders): Fiyatlandırma'ya Dış İşçilik Toplamı satırı

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: TecDoc picker → Dialog + marka filtresi + kategori yakalama + controlled trigger

**Files:**
- Modify: `src/components/app/tecdoc-part-picker.tsx`

**Interfaces:**
- Produces: `TecdocPartSelection` genişler → `{ name, articleNo, tecdocArticleId, supplierName, categoryName, categoryId }`; `TecdocPartPicker` yeni opsiyonel props `open?`/`onOpenChange?` (controlled) + `hideTrigger?` (grid kendi 🔍 trigger'ını kullanır); Sheet yerine `Dialog`.

- [ ] **Step 1: TecdocPartSelection tipini genişlet**

`tecdoc-part-picker.tsx`:

```ts
export type TecdocPartSelection = {
  name: string
  articleNo: string
  tecdocArticleId: number
  supplierName: string
  categoryName: string
  categoryId: number
}
```

- [ ] **Step 2: onSelect'i genişlet — kategori yakala**

`openLeaf(node)` çağrısı bir kategori düğümünün parçalarını yükler; o düğüm = seçilen kategori. Article seçim `onClick`'inde `stack[stack.length - 1]` (parçaların yüklendiği düğüm) kategori olur:

Article `onSelect` çağrısını değiştir:

```tsx
                    onClick={() => {
                      const cat = stack[stack.length - 1]
                      onSelect({
                        name: a.productName,
                        articleNo: a.articleNo,
                        tecdocArticleId: a.tecdocArticleId,
                        supplierName: a.supplierName,
                        categoryName: cat?.name ?? "",
                        categoryId: cat?.id ?? 0,
                      })
                      handleOpenChange(false)
                    }}
```

- [ ] **Step 3: Marka (supplier) filtresi ekle**

Component'e state ekle: `const [supplierFilter, setSupplierFilter] = useState<string>("")` ("" = tümü). `resetForm`/kapanışta sıfırla (open false olunca `setSupplierFilter("")`).

`filteredArticles` useMemo'sunu supplier filtresini de uygulayacak şekilde güncelle:

```tsx
  const supplierOptions = useMemo(() => {
    if (!articles) return []
    const names = Array.from(new Set(articles.map((a) => a.supplierName).filter(Boolean)))
    return names.sort((x, y) => x.localeCompare(y, "tr"))
  }, [articles])

  const filteredArticles = useMemo(() => {
    if (!articles) return null
    const q = filter.trim()
    let list = supplierFilter ? articles.filter((a) => a.supplierName === supplierFilter) : articles
    if (q) list = list.filter((a) => trIncludes(a.productName, q) || trIncludes(a.articleNo, q) || trIncludes(a.supplierName, q))
    return list
  }, [articles, filter, supplierFilter])
```

Article listesinin üstündeki sticky arama bloğuna, arama input'unun yanına marka Select'i ekle (Base UI Select; `supplierOptions` boşsa gizle):

```tsx
                {supplierOptions.length > 0 && (
                  <Select value={supplierFilter || "all"} onValueChange={(v) => setSupplierFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="h-9 mt-2"><SelectValue placeholder="Tüm markalar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm markalar</SelectItem>
                      {supplierOptions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
```

(Base UI Select import'ları: `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@/components/ui/select`. Base UI Select.Value ham değer gösterir uyarısı için `SelectValue placeholder` + `SelectItem` children yeterli; değer=label olduğu için sorun yok.)

- [ ] **Step 4: Sheet → Dialog + controlled trigger**

Import'ları `@/components/ui/dialog`'a çevir (`Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription`). Component props'a ekle:

```ts
export function TecdocPartPicker({
  vehicle,
  onSelect,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
}: {
  vehicle: PickerVehicle | undefined
  onSelect: (sel: TecdocPartSelection) => void
  open?: boolean
  onOpenChange?: (v: boolean) => void
  hideTrigger?: boolean
}) {
```

`open` state'ini controlled/uncontrolled birleştir:
```ts
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen
```
(`handleOpenChange` içinde `setOpen(next)` kullan; mevcut `setOpen` çağrıları korunur.)

Render'da: `hideTrigger` true ise trigger Button'ı render etme. Ayrıca `hideTrigger` ve `vehicleTypeId == null` durumunda `VinLinkPrompt` yerine `return null` (grid controlled kullanımda inline prompt istemez; grid zaten yalnız eşleşmiş araçta mount eder). `<Sheet>`/`<SheetContent>`/`<SheetHeader>`/`<SheetTitle>`/`<SheetDescription>` → `<Dialog open={open} onOpenChange={handleOpenChange}>` / `<DialogContent className="p-0 gap-0 sm:max-w-md max-h-[85vh] flex flex-col">` / `<DialogHeader>` / `<DialogTitle>` / `<DialogDescription>`. İç gövde (kategori/parça listesi) aynen korunur; `flex-1 overflow-y-auto` scroll bölgesi Dialog içinde de çalışır.

- [ ] **Step 5: Lint + typecheck + build**

Run: `bun run lint && bun run typecheck`
Expected: PASS (bilinen pre-existing `admin/health/page.tsx` hatası hariç).
Run: `bun run build`
Expected: başarılı (bu belirgin bir değişiklik).

- [ ] **Step 6: Commit**

```bash
git add src/components/app/tecdoc-part-picker.tsx
git commit -m "feat(tecdoc): parça picker Dialog + marka filtresi + kategori yakalama + controlled trigger

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: PartsLaborGrid — düzenlenebilir tablo (taslak satır + otomatik kaydet + inline hücreler + 🔍 + sil)

**Files:**
- Create: `src/components/app/parts-labor-grid.tsx`

**Interfaces:**
- Consumes: `OrderItem` tipi (order-management-panel.tsx'ten export), `PartBrandCombobox`, `ItemCategoryCascade`, `TecdocPartPicker` (controlled), `liraToKurus`/`kurusToLira`/`formatTRY`, `/api/orders/items` (POST/PATCH/DELETE), `isOrderLocked`.
- Produces: `PartsLaborGrid({ orderId, status, items, vehicle, onError, onLoading, loading })` — `PartsLaborCard`'ın aldığı props ile birebir.

- [ ] **Step 1: Bileşeni oluştur (tam kod)**

`src/components/app/parts-labor-grid.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Search, Loader2, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/format"
import { liraToKurus, kurusToLira } from "@/lib/money"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import type { OrderItem } from "@/components/app/order-management-panel"
import { PartBrandCombobox } from "@/components/app/part-brand-combobox"
import { ItemCategoryCascade } from "@/components/app/item-category-cascade"
import { TecdocPartPicker, type PickerVehicle } from "@/components/app/tecdoc-part-picker"

type ItemType = "part" | "labor" | "external_labor"
const TYPE_LABELS: Record<ItemType, string> = { part: "Yedek Parça", labor: "İşçilik", external_labor: "Dış İşçilik" }

type Row = OrderItem & { __draft?: boolean; __saving?: boolean; tempId?: string }

function toRow(i: OrderItem): Row { return { ...i } }

export function PartsLaborGrid({
  orderId, status, items, vehicle, onError, onLoading, loading,
}: {
  orderId: string
  status: string
  items: OrderItem[]
  vehicle?: PickerVehicle
  onError: (msg: string) => void
  onLoading: (b: boolean) => void
  loading: boolean
}) {
  const router = useRouter()
  const locked = isOrderLocked(status as OrderStatus)
  const [rows, setRows] = useState<Row[]>(items.map(toRow))
  const draftCounter = useRef(0)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Sunucu items'ı senkronla ama kaydedilmemiş taslakları KORU.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows((prev) => [...items.map(toRow), ...prev.filter((r) => r.__draft)])
  }, [items])

  useEffect(() => {
    const timers = saveTimers.current
    return () => { Object.values(timers).forEach((t) => clearTimeout(t)) }
  }, [])

  function addDraft() {
    draftCounter.current += 1
    const tempId = `draft-${draftCounter.current}`
    setRows((prev) => [...prev, {
      id: tempId, tempId, __draft: true, type: "part", name: "", sku: null, unit: "adet",
      quantity: 1, unitPrice: null, totalPrice: null, note: null, brand: null, category: null, categoryId: null,
    }])
  }

  function patchLocal(rowId: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }

  // Taslak satırı sunucuya kaydet (ad dolunca). Çift-kaydet guard: __saving.
  async function persistDraft(row: Row) {
    if (!row.__draft || row.__saving || !row.name.trim()) return
    patchLocal(row.id, { __saving: true })
    const fd = new FormData()
    fd.set("serviceOrderId", orderId)
    fd.set("type", row.type)
    fd.set("name", row.name)
    if (row.sku) fd.set("sku", row.sku)
    if (row.unit) fd.set("unit", row.unit)
    fd.set("quantity", String(row.quantity))
    if (row.unitPrice != null) fd.set("unitPrice", String(row.unitPrice))
    if (row.brand) fd.set("brand", row.brand)
    if (row.category) fd.set("category", row.category)
    if (row.categoryId != null) fd.set("categoryId", String(row.categoryId))
    try {
      const res = await fetch("/api/orders/items", { method: "POST", body: fd })
      const data = await res.json()
      if (data.success && data.id) {
        // temp satırı gerçek id ile değiştir; __draft kalkar. router.refresh totalleri tazeler.
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, id: data.id, tempId: undefined, __draft: false, __saving: false } : r)))
        router.refresh()
      } else {
        onError(data.error || "Kalem eklenemedi")
        patchLocal(row.id, { __saving: false })
      }
    } catch {
      onError("Bir hata oluştu")
      patchLocal(row.id, { __saving: false })
    }
  }

  // Kalıcı satır hücre patch'i (debounce'lu, alan-bazlı anahtar).
  function persistUpdate(rowId: string, patch: Partial<OrderItem>, opts?: { debounce?: boolean }) {
    const send = async () => {
      const fd = new FormData()
      if (patch.quantity !== undefined) fd.set("quantity", String(patch.quantity))
      if (patch.unitPrice !== undefined) fd.set("unitPrice", String(patch.unitPrice))
      if (patch.brand !== undefined) fd.set("brand", patch.brand ?? "")
      if (patch.category !== undefined) fd.set("category", patch.category ?? "")
      if (patch.categoryId !== undefined) fd.set("categoryId", patch.categoryId != null ? String(patch.categoryId) : "")
      if (patch.sku !== undefined) fd.set("sku", patch.sku ?? "")
      if (patch.name !== undefined) fd.set("name", patch.name)
      if (patch.unit !== undefined) fd.set("unit", patch.unit ?? "")
      try {
        const res = await fetch(`/api/orders/items?id=${rowId}&orderId=${orderId}`, { method: "PATCH", body: fd })
        const data = await res.json()
        if (!data.success) { onError(data.error || "Kalem güncellenemedi"); setRows(items.map(toRow)) }
        else router.refresh()
      } catch { onError("Bir hata oluştu"); setRows(items.map(toRow)) }
    }
    if (opts?.debounce) {
      const key = `${rowId}:${Object.keys(patch).sort().join(",")}`
      clearTimeout(saveTimers.current[key])
      saveTimers.current[key] = setTimeout(send, 500)
    } else { void send() }
  }

  // Bir satırdaki değişikliği uygula: taslak → local + (ad ise) kaydet; kalıcı → optimistik + PATCH.
  function onCell(row: Row, patch: Partial<Row>, opts?: { debounce?: boolean }) {
    patchLocal(row.id, patch)
    if (row.__draft) {
      const next = { ...row, ...patch }
      if (next.name.trim() && !row.__saving) void persistDraft(next)
      return
    }
    persistUpdate(row.id, patch, opts)
  }

  async function removeRow(row: Row) {
    if (row.__draft) { setRows((prev) => prev.filter((r) => r.id !== row.id)); return }
    try {
      await fetch(`/api/orders/items?id=${row.id}&orderId=${orderId}`, { method: "DELETE" })
      router.refresh()
    } catch { onError("Kalem silinemedi") }
  }

  return (
    <div className="space-y-2">
      {/* Masaüstü tablo başlığı */}
      <div className="hidden md:grid grid-cols-[7rem_1fr_auto_auto_auto] gap-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span>Tür</span><span>Parça / İşçilik</span><span>Miktar</span><span>Birim Fiyat</span><span className="text-right">Toplam</span>
      </div>

      {rows.length === 0 && (
        <p className="text-center py-6 text-sm text-muted-foreground">Henüz kalem eklenmedi</p>
      )}

      <div className="space-y-1.5">
        {rows.map((row) => (
          <GridRow
            key={row.id}
            row={row}
            locked={locked}
            vehicle={vehicle}
            onCell={onCell}
            onRemove={removeRow}
          />
        ))}
      </div>

      {!locked && (
        <Button type="button" size="sm" variant="outline" onClick={addDraft} className="w-full sm:w-auto" disabled={loading}>
          <Plus className="size-3.5 mr-1" /> Yeni satır
        </Button>
      )}
    </div>
  )
}

function GridRow({ row, locked, vehicle, onCell, onRemove }: {
  row: Row
  locked: boolean
  vehicle?: PickerVehicle
  onCell: (row: Row, patch: Partial<Row>, opts?: { debounce?: boolean }) => void
  onRemove: (row: Row) => void
}) {
  const isPart = row.type === "part"
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState("")
  const [tecdocOpen, setTecdocOpen] = useState(false)

  const lineTotal = row.totalPrice != null && row.totalPrice > 0
    ? row.totalPrice
    : (row.unitPrice != null && row.unitPrice > 0 ? row.unitPrice * row.quantity : null)

  function startPrice() { setPriceDraft(row.unitPrice != null ? String(kurusToLira(row.unitPrice)) : ""); setEditingPrice(true) }
  function commitPrice() {
    setEditingPrice(false)
    const lira = Number(priceDraft)
    if (!priceDraft || Number.isNaN(lira) || lira < 0) return
    const kurus = liraToKurus(lira)
    if (kurus !== row.unitPrice) onCell(row, { unitPrice: kurus })
  }

  const editable = !locked

  return (
    <div className="rounded-lg border border-border bg-card p-2.5 md:p-0 md:border-0 md:bg-transparent">
      <div className="grid gap-2 md:grid-cols-[7rem_1fr_auto_auto_auto] md:items-center md:px-2 md:py-1.5 md:rounded-lg md:bg-muted">
        {/* Tür */}
        <div className="flex items-center justify-between md:block">
          {row.__draft && editable ? (
            <Select value={row.type} onValueChange={(v) => onCell(row, { type: v as ItemType })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="part">Yedek Parça</SelectItem>
                <SelectItem value="labor">İşçilik</SelectItem>
                <SelectItem value="external_labor">Dış İşçilik</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">{TYPE_LABELS[row.type as ItemType] ?? row.type}</span>
          )}
          {/* mobilde sil butonu üst satırda */}
          {editable && (
            <button onClick={() => onRemove(row)} className="md:hidden p-1 text-muted-foreground/70 hover:text-destructive" aria-label="Sil">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>

        {/* Parça / Ad */}
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <Input
              value={row.name}
              onChange={(e) => onCell(row, { name: e.target.value })}
              onBlur={() => { if (row.__draft && row.name.trim()) onCell(row, {}) }}
              placeholder={isPart ? "Parça adı" : "İşçilik adı"}
              disabled={!editable || row.__saving}
              className="h-8 text-sm"
            />
            {isPart && editable && (
              <button
                type="button"
                onClick={() => setTecdocOpen(true)}
                disabled={vehicle?.catalogVehicleTypeId == null}
                title={vehicle?.catalogVehicleTypeId == null ? "Araç TecDoc'ta eşleşmedi" : "TecDoc kataloğundan seç"}
                className="shrink-0 p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40"
                aria-label="Katalogdan parça seç"
              >
                <Search className="size-3.5" />
              </button>
            )}
            {row.__saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />}
          </div>
          {row.sku && <span className="text-[10px] font-mono text-muted-foreground">{row.sku}</span>}
          {isPart && editable && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="w-32"><PartBrandCombobox value={row.brand || ""} onChange={(v) => onCell(row, { brand: v }, { debounce: true })} /></div>
              <ItemCategoryCascade
                key={`cat-${row.id}-${row.category ?? ""}`}
                vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
                value={row.category}
                onSelect={(sel) => onCell(row, { category: sel.category, categoryId: sel.categoryId })}
              />
            </div>
          )}
        </div>

        {/* Miktar */}
        <div className="flex items-center gap-2 md:justify-center">
          <span className="md:hidden text-xs text-muted-foreground">Miktar</span>
          <div className="inline-flex items-center rounded-lg border border-border bg-white">
            <button type="button" disabled={!editable || row.quantity <= 1} onClick={() => onCell(row, { quantity: row.quantity - 1 }, { debounce: true })} className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label="Azalt">−</button>
            <span className="px-2 text-xs font-medium tabular-nums">{row.quantity}</span>
            <button type="button" disabled={!editable} onClick={() => onCell(row, { quantity: row.quantity + 1 }, { debounce: true })} className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40" aria-label="Arttır">+</button>
          </div>
        </div>

        {/* Birim Fiyat */}
        <div className="flex items-center gap-2 md:justify-end">
          <span className="md:hidden text-xs text-muted-foreground">Fiyat</span>
          {editingPrice ? (
            <Input type="number" min="0" step="0.01" autoFocus value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)} onBlur={commitPrice}
              onKeyDown={(e) => { if (e.key === "Enter") commitPrice(); if (e.key === "Escape") setEditingPrice(false) }}
              className="h-8 w-24 text-xs" />
          ) : (
            <button type="button" onClick={() => editable && startPrice()} disabled={!editable}
              className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-border bg-white text-xs hover:bg-muted disabled:opacity-60">
              <Pencil className="size-3 text-muted-foreground" />
              {row.unitPrice != null ? formatTRY(row.unitPrice) : "Fiyat"}
            </button>
          )}
        </div>

        {/* Toplam + sil (masaüstü) */}
        <div className="flex items-center justify-between md:justify-end gap-2">
          <span className="md:hidden text-xs text-muted-foreground">Toplam</span>
          <span className={cn("text-sm font-semibold", lineTotal == null ? "text-muted-foreground/70 font-normal text-xs" : "text-foreground")}>
            {lineTotal != null ? formatTRY(lineTotal) : "—"}
          </span>
          {editable && (
            <button onClick={() => onRemove(row)} className="hidden md:inline-flex p-1 text-muted-foreground/70 hover:text-destructive" aria-label="Sil">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* TecDoc modal — yalnız part satırı VE araç TecDoc'ta eşleşmişse mount edilir
          (eşleşmemişse picker VinLinkPrompt döner, tabloyu kirletir; 🔍 butonu zaten disabled). */}
      {isPart && editable && vehicle?.catalogVehicleTypeId != null && (
        <TecdocPartPicker
          vehicle={vehicle}
          hideTrigger
          open={tecdocOpen}
          onOpenChange={setTecdocOpen}
          onSelect={(sel) => {
            onCell(row, { name: sel.name, sku: sel.articleNo, brand: sel.supplierName, category: sel.categoryName || null, categoryId: sel.categoryId || null })
            setTecdocOpen(false)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint + typecheck + build**

Run: `bun run lint && bun run typecheck`
Expected: PASS (pre-existing `admin/health/page.tsx` hariç; `OrderItem` import'u order-management-panel'den gelir).
Run: `bun run build`
Expected: başarılı.

> Not: Bu adımda `PartsLaborGrid` henüz hiçbir yerden render EDİLMEZ (Task 7 bağlar) — kullanılmayan export lint uyarısı vermez (export'tur). Build yeşil olmalı.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/parts-labor-grid.tsx
git commit -m "feat(orders): düzenlenebilir PartsLaborGrid (taslak satır + otomatik kaydet + TecDoc)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: PartsLaborCard'a bağla + eski ItemRow/add-form sil

**Files:**
- Modify: `src/components/app/order-management-panel.tsx`

**Interfaces:**
- Consumes: `PartsLaborGrid` (Task 6).
- Produces: `PartsLaborCard` artık grid render eder; eski `ItemRow` + inline add-form + ilgili state/handler'lar silinir.

- [ ] **Step 1: PartsLaborGrid import + PartsLaborCard gövdesini değiştir**

`order-management-panel.tsx`:
1. Import ekle: `import { PartsLaborGrid } from "@/components/app/parts-labor-grid"`.
2. `PartsLaborCard` içindeki tüm add-form state'leri, `searchCatalog`/`selectCatalogPart`/`resetForm`/`handleAdd`/`updateItem`/`ItemRow` render bloklarını **kaldır**; `PartsLaborCard`'ın `CardContent`'i yalnızca `<PartsLaborGrid ... />` render etsin:

```tsx
      <CardContent>
        <PartsLaborGrid
          orderId={orderId}
          status={status}
          items={items}
          vehicle={vehicle}
          onError={onError}
          onLoading={onLoading}
          loading={loading}
        />
      </CardContent>
```

3. Artık kullanılmayan `ItemRow` fonksiyonunu ve yalnız add-form/ItemRow tarafından kullanılan import'ları (örn. `TecdocPartPicker` doğrudan panelde kullanılmıyorsa, `StockStatusBadge`, `formatPrice`, `Save`, `X` vb.) **sil** — typecheck/lint kullanılmayanları gösterir, ona göre temizle. `OrderItem` tipi export'u KALIR (grid onu import eder).

- [ ] **Step 2: Kullanılmayanları temizle (lint güdümlü)**

Run: `bun run lint`
Kalan "unused" hatalarını (silinen ItemRow/add-form'a ait import/değişken) gider. `PartsLaborCard`'ın hâlâ `orderId/status/items/vehicle/onError/onLoading/loading` prop'larını aldığından emin ol (grid'e geçiyor).

- [ ] **Step 3: Typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: PASS + başarılı build.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/order-management-panel.tsx
git commit -m "feat(orders): PartsLaborCard grid'e geçti, eski ItemRow+ekleme formu kaldırıldı

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Uçtan uca doğrulama (manuel QA)

**Files:** (yok)

- [ ] **Step 1: Dev server restart** (şema değişti → db.ts singleton). OrbStack DB açık (`docker compose -f docker-compose.local.yml up -d`), sonra `bun run dev`.

- [ ] **Step 2: Tüm test paketi**

Run: `bun test`
Expected: yeni totals testleri dahil tümü PASS.

- [ ] **Step 3: verify/ui-qa ile akışı sür** (bir iş emri, Parça & İşçilik sekmesi):
1. "+ Yeni satır" → boş taslak; ad yazınca otomatik kaydolur (kalem sayısı+Fiyatlandırma güncellenir).
2. Tür dropdown: Yedek Parça/İşçilik/Dış İşçilik; part'ta 🔍+marka+kategori aktif, diğerlerinde yok.
3. 🔍 → TecDoc Dialog: kategori → marka filtresi → parça seç; satır ad/SKU/marka/kategori dolar.
4. Miktar stepper + fiyat inline: partId'li parçada stok doğru; toplam/özet anında.
5. Dış İşçilik: stok tutmaz; Fiyatlandırma'da "Dış İşçilik Toplamı" görünür, grand total'a dahil.
6. Sil: taslak satır sunucusuz; kalıcı satır DB'den (partId'li ise stok iade).
7. Kaydedilmiş satırda tür kilitli (salt-görüntü).
8. Kilitli iş emri: tüm tablo salt-görüntü.
9. Mobil (dar ekran): satırlar kart; düzenleme çalışır, yatay taşma yok.
10. Çift-tık: taslak iki kez kaydolmaz (__saving guard).

- [ ] **Step 4: Release-check** (`bakimx-release-check`): build/lint/typecheck/migration/env.

---

## Self-Review Notları

- **Spec kapsamı:** enum (T1), totals+external (T2), validation+action+id (T3), pricing UI (T4), TecDoc modal+marka+kategori (T5), grid+taslak+otomatik kaydet+🔍 (T6), entegrasyon+eski kod silme (T7), QA (T8) — tüm spec maddeleri karşılanıyor.
- **Tip tutarlılığı:** `onCell(row, patch, opts)` grid içinde tanımlı; `persistUpdate` debounce anahtarı `${rowId}:${alanlar}` (merge edilen özellikle tutarlı); `TecdocPartSelection` T5'te genişler, T6 aynı alanları tüketir; `Totals.externalLaborTotal` T2/T4 tutarlı; `addOrderItemAction` `{success,id}` T3'te üretilir, T6 tüketir.
- **Reconcile riski:** T6 useEffect `items` sync'inde taslaklar korunur; kalıcı satır optimistik ed'leri refresh sonrası server-truth ile değişir (kabul).
- **Belirsizlik:** T7'de silinecek import seti lint güdümlü (dosya büyük); implementer typecheck/lint çıktısına göre temizler.
- **Risk:** en kritik T6 taslak→kalıcı id geçişi + çift-kaydet guard (__saving) — manuel QA Step 10 bunu doğrular.
