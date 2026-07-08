# İş Emri Parça Satırında Inline Düzenleme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İş emri "Parça & İşçilik" sekmesinde parça satırlarını tablo üzerinde inline düzenlenebilir yapmak — miktar stepper, fiyat inline, marka dropdown, kategori cascade.

**Architecture:** `ServiceOrderItem`'a `brand`/`category`/`categoryId` nullable kolonları eklenir. Yeni `updateOrderItemAction` (partial patch) miktar/fiyat/marka/kategori günceller ve `partId`'li parçalarda saf `computeStockDelta` yardımcısıyla stok farkını mutabık kılar. `ItemRow` optimistik local state + `router.refresh()` ile inline editörlere dönüşür; kategori cascade TecDoc araç ağacını (araç eşleşmemişse serbest metin) kullanır.

**Tech Stack:** Next.js (App Router, server actions), Prisma (Postgres), Zod v4, React 19, Base UI Combobox/Popover, bun test, Tailwind.

## Global Constraints

- Para birimi **kuruş (integer)** olarak saklanır; input TRY (lira) tutar → `liraToKurus`/`kurusToLira` ile çevir (`src/lib/money.ts`).
- Her server action `requireWritableWorkshop()` ile `workshopId`'yi **sunucudan** türetir; client param'a asla güvenilmez (tenant izolasyonu).
- Kilitli iş emri (`isOrderLocked(status)` — teslim/iptal) düzenlenemez → action 403, UI salt-görünüm.
- Şema değişiklikleri `prisma migrate dev` ile; yeni kolonlar **nullable** (veri kaybı yok). Şema sonrası `db.ts` singleton nedeniyle **dev server restart** şart.
- ShadcnUI/Base UI bileşenleri kullan; custom UI/native control hand-roll etme. Bileşen yüksekliği web'de `h-9`.
- TS strict; `any` kullanma.
- Mobil-öncelikli; dokunma hedefleri yeterli boyutta.
- Testler `bun test` ile; yalnızca saf `src/lib/*` mantığı test edilir (DB/component test harness'ı yoktur → action/UI manuel QA + build/lint/typecheck ile doğrulanır).

---

## File Structure

- `prisma/schema.prisma` — `ServiceOrderItem`'a `brand`, `category`, `categoryId` (Modify) + yeni migration (Create)
- `src/lib/parts/stock-delta.ts` — saf `computeStockDelta` yardımcısı (Create) + `stock-delta.test.ts` (Create)
- `src/lib/validations/order.ts` — create şemasına 3 alan + `serviceOrderItemUpdateSchema` (Modify) + `order-update-schema.test.ts` (Create)
- `src/app/(app)/orders/actions.ts` — `updateOrderItemAction` + create action'a yeni alanlar (Modify)
- `src/app/api/orders/items/route.ts` — `PATCH` handler (Modify)
- `src/app/(app)/orders/[id]/page.tsx` — items mapping'e `brand`/`category`/`categoryId` (Modify, 2 yer)
- `src/components/app/part-brand-combobox.tsx` — paylaşılan marka combobox (Create)
- `src/components/app/item-category-cascade.tsx` — kategori cascade popover + serbest metin fallback (Create)
- `src/components/app/order-management-panel.tsx` — `OrderItem` tipi, `ItemRow` inline editörler, add-form alanları, reload→router.refresh (Modify)

---

## Task 1: Şema — brand/category/categoryId kolonları + migration

**Files:**
- Modify: `prisma/schema.prisma` (`ServiceOrderItem` modeli, ~741-765)
- Create: migration (prisma otomatik üretir)

**Interfaces:**
- Produces: `ServiceOrderItem.brand: String?`, `ServiceOrderItem.category: String?`, `ServiceOrderItem.categoryId: Int?`

- [ ] **Step 1: `ServiceOrderItem` modeline 3 kolon ekle**

`note String?` satırının hemen ardına ekle (mevcut alan sıralamasını koru):

```prisma
  note            String?
  // Parça markası (TecDoc supplier adı veya serbest). Eski satırlarda marka note'ta kalabilir.
  brand           String?
  // Seçilen yaprak kategori etiketi (örn. "Yağ filtresi").
  category        String?
  // TecDoc kategori düğüm id'si (ileride filtre/rapor için); serbest metin kategoride null.
  categoryId      Int?
```

- [ ] **Step 2: Şemayı doğrula**

Run: `bun run db:validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Migration üret ve uygula**

Run: `bun run db:migrate -- --name add_order_item_brand_category`
Expected: yeni migration klasörü oluşur (`prisma/migrations/<ts>_add_order_item_brand_category/`), `migrate dev` "Your database is now in sync" der, `prisma generate` çalışır.

> Not: Local DB kapalıysa `ECONNREFUSED localhost:5432` alırsın → OrbStack Postgres'i başlat: `docker compose -f docker-compose.local.yml up -d`, sonra Step 3'ü tekrarla.

- [ ] **Step 4: Prisma client tiplerini doğrula**

Run: `bun run typecheck`
Expected: PASS (mevcut kod yeni nullable kolonlardan etkilenmez).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(schema): ServiceOrderItem'a brand/category/categoryId kolonları

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Saf stok-delta yardımcısı (TDD)

Miktar değişince `partId`'li parçada ne kadar stok düşülecek/iade edilecek — bu saf hesap `bun test` ile korunur.

**Files:**
- Create: `src/lib/parts/stock-delta.ts`
- Test: `src/lib/parts/stock-delta.test.ts`

**Interfaces:**
- Produces: `computeStockDelta(oldQty: number, newQty: number): { direction: "reserve" | "return" | "none"; amount: number }`
  - `reserve` → yeni miktar arttı, `amount` kadar ek stok düşülmeli
  - `return` → yeni miktar azaldı, `amount` kadar stok iade edilmeli
  - `none` → değişim yok, `amount: 0`

- [ ] **Step 1: Failing test yaz**

`src/lib/parts/stock-delta.test.ts`:

```ts
import { expect, test } from "bun:test"
import { computeStockDelta } from "./stock-delta"

test("miktar artınca farkı rezerve eder", () => {
  expect(computeStockDelta(2, 5)).toEqual({ direction: "reserve", amount: 3 })
})

test("miktar azalınca farkı iade eder", () => {
  expect(computeStockDelta(5, 2)).toEqual({ direction: "return", amount: 3 })
})

test("miktar değişmezse hiçbir şey yapmaz", () => {
  expect(computeStockDelta(3, 3)).toEqual({ direction: "none", amount: 0 })
})

test("1'e düşürünce farkı iade eder", () => {
  expect(computeStockDelta(4, 1)).toEqual({ direction: "return", amount: 3 })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `bun test src/lib/parts/stock-delta.test.ts`
Expected: FAIL — `Cannot find module './stock-delta'`

- [ ] **Step 3: Minimal implementasyon yaz**

`src/lib/parts/stock-delta.ts`:

```ts
/**
 * İş emri parça satırının miktarı değiştiğinde stok mutabakatı için farkı hesaplar.
 * Yalnızca partId'ye bağlı (kendi stoğumuzdan) parça satırları için anlamlıdır.
 */
export function computeStockDelta(
  oldQty: number,
  newQty: number,
): { direction: "reserve" | "return" | "none"; amount: number } {
  const diff = newQty - oldQty
  if (diff > 0) return { direction: "reserve", amount: diff }
  if (diff < 0) return { direction: "return", amount: -diff }
  return { direction: "none", amount: 0 }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `bun test src/lib/parts/stock-delta.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parts/stock-delta.ts src/lib/parts/stock-delta.test.ts
git commit -m "feat(parts): computeStockDelta saf yardımcısı + testleri

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Validation şemaları — create + update (TDD)

**Files:**
- Modify: `src/lib/validations/order.ts`
- Test: `src/lib/validations/order-update-schema.test.ts`

**Interfaces:**
- Consumes: mevcut `serviceOrderItemSchema` (order.ts)
- Produces:
  - `serviceOrderItemSchema` artık `brand?`, `category?`, `categoryId?` içerir
  - `serviceOrderItemUpdateSchema` — tüm alanlar optional partial patch: `{ quantity?, unitPrice?, brand?, category?, categoryId?, name?, sku?, unit?, note? }`

- [ ] **Step 1: Failing test yaz**

`src/lib/validations/order-update-schema.test.ts`:

```ts
import { expect, test } from "bun:test"
import { serviceOrderItemUpdateSchema } from "./order"

test("kısmi patch: sadece quantity geçerli", () => {
  const r = serviceOrderItemUpdateSchema.safeParse({ quantity: 3 })
  expect(r.success).toBe(true)
})

test("boş patch geçerlidir (hiçbir alan zorunlu değil)", () => {
  expect(serviceOrderItemUpdateSchema.safeParse({}).success).toBe(true)
})

test("quantity 0 reddedilir", () => {
  expect(serviceOrderItemUpdateSchema.safeParse({ quantity: 0 }).success).toBe(false)
})

test("negatif unitPrice reddedilir", () => {
  expect(serviceOrderItemUpdateSchema.safeParse({ unitPrice: -5 }).success).toBe(false)
})

test("brand/category/categoryId kabul edilir", () => {
  const r = serviceOrderItemUpdateSchema.safeParse({ brand: "BOSCH", category: "Yağ filtresi", categoryId: 100200 })
  expect(r.success).toBe(true)
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `bun test src/lib/validations/order-update-schema.test.ts`
Expected: FAIL — `serviceOrderItemUpdateSchema` export edilmemiş.

- [ ] **Step 3: order.ts'i güncelle**

`src/lib/validations/order.ts`'in sonuna, `serviceOrderItemSchema` objesine 3 alanı ekle ve update şemasını ekle. `serviceOrderItemSchema` içindeki son alan `tecdocArticleId` satırından sonra, kapanış `})`'den önce:

```ts
  // Parça markası (TecDoc supplier adı veya serbest metin).
  brand: z.string().optional(),
  // Seçilen kategori etiketi (yaprak düğüm adı veya serbest metin).
  category: z.string().optional(),
  // TecDoc kategori düğüm id'si; serbest metin kategoride gönderilmez.
  categoryId: z.coerce.number().int("Kategori id tam sayı olmalıdır").positive().optional(),
```

Dosyanın sonuna ekle:

```ts
/**
 * İş emri kalemi kısmi güncelleme şeması — yalnızca gönderilen alanlar güncellenir.
 * quantity/unitPrice create ile aynı kurallara tabidir; hepsi optional.
 */
export const serviceOrderItemUpdateSchema = z.object({
  name: z.string().min(1, "Kalem adı boş olamaz").optional(),
  sku: z.string().optional(),
  unit: z.string().optional(),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır").optional(),
  unitPrice: z.coerce.number().int("Birim fiyat kuruş (tam sayı) olmalıdır").min(0, "Birim fiyat negatif olamaz").optional(),
  note: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  categoryId: z.coerce.number().int("Kategori id tam sayı olmalıdır").positive().optional(),
})
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `bun test src/lib/validations/order-update-schema.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/order.ts src/lib/validations/order-update-schema.test.ts
git commit -m "feat(validations): kalem create'e brand/category + update şeması

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `updateOrderItemAction` + create action'a yeni alanlar

**Files:**
- Modify: `src/app/(app)/orders/actions.ts`

**Interfaces:**
- Consumes: `computeStockDelta` (Task 2), `serviceOrderItemUpdateSchema` (Task 3), mevcut `reserveStockInTx`/`returnStockInTx`/`getActiveWorkshopPart`, `recalcOrderPayment`, `isOrderLocked`, `AuditLogAction`.
- Produces: `updateOrderItemAction(itemId: string, orderId: string, formData: FormData): Promise<{ success: true } | { error: string }>`

- [ ] **Step 1: İmportlara update şemasını ve stok-delta'yı ekle**

`actions.ts` üst importlarını güncelle:

```ts
import { serviceOrderItemSchema, serviceOrderItemUpdateSchema } from "@/lib/validations/order"
import { computeStockDelta } from "@/lib/parts/stock-delta"
```

- [ ] **Step 2: create action'a brand/category/categoryId ekle**

`addOrderItemAction` içinde:

`raw` objesine ekle (mevcut `partId` satırından sonra):

```ts
    brand: formData.get("brand") as string,
    category: formData.get("category") as string,
    categoryId: formData.get("categoryId") as string,
```

`orderItemCreateSchema.safeParse({...})` çağrısına ekle (mevcut `partId: raw.partId || undefined,` satırından sonra):

```ts
    brand: raw.brand || undefined,
    category: raw.category || undefined,
    categoryId: raw.categoryId ? Number(raw.categoryId) : undefined,
```

`tx.serviceOrderItem.create({ data: {...} })` içindeki data'ya ekle (mevcut `partId: partId,` satırından sonra):

```ts
          brand: parsed.data.brand || null,
          category: parsed.data.category || null,
          categoryId: parsed.data.categoryId ?? null,
```

- [ ] **Step 3: `updateOrderItemAction`'ı ekle**

`removeOrderItemAction`'ın hemen ardına ekle:

```ts
export async function updateOrderItemAction(itemId: string, orderId: string, formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop()

  const item = await prisma.serviceOrderItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
  })
  if (!item) return { error: "Kalem bulunamadı" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "Servis emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: "Teslim edilmiş veya iptal edilmiş iş emri düzenlenemez" }

  // Yalnızca formData'da gerçekten bulunan alanlar patch'lenir (kısmi güncelleme).
  const has = (k: string) => formData.get(k) !== null
  const raw = {
    name: has("name") ? (formData.get("name") as string).trim() : undefined,
    sku: has("sku") ? (formData.get("sku") as string) : undefined,
    unit: has("unit") ? (formData.get("unit") as string) : undefined,
    quantity: has("quantity") ? Number(formData.get("quantity")) : undefined,
    unitPrice: has("unitPrice") ? Number(formData.get("unitPrice")) : undefined,
    note: has("note") ? (formData.get("note") as string) : undefined,
    brand: has("brand") ? (formData.get("brand") as string) : undefined,
    category: has("category") ? (formData.get("category") as string) : undefined,
    categoryId: has("categoryId") ? Number(formData.get("categoryId")) : undefined,
  }

  const parsed = serviceOrderItemUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  // Boş string gönderilen serbest-metin alanları null'a çevrilir (temizleme).
  const data: {
    name?: string
    sku?: string | null
    unit?: string | null
    quantity?: number
    unitPrice?: number | null
    note?: string | null
    brand?: string | null
    category?: string | null
    categoryId?: number | null
  } = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.sku !== undefined) data.sku = parsed.data.sku || null
  if (parsed.data.unit !== undefined) data.unit = parsed.data.unit || null
  if (parsed.data.quantity !== undefined) data.quantity = parsed.data.quantity
  if (parsed.data.unitPrice !== undefined) data.unitPrice = parsed.data.unitPrice
  if (parsed.data.note !== undefined) data.note = parsed.data.note || null
  if (parsed.data.brand !== undefined) data.brand = parsed.data.brand || null
  if (parsed.data.category !== undefined) data.category = parsed.data.category || null
  if (parsed.data.categoryId !== undefined) data.categoryId = parsed.data.categoryId ?? null

  // Miktar değiştiyse ve satır kendi stoğumuza bağlıysa (partId + type=part) stok farkını mutabık kıl.
  const newQty = parsed.data.quantity
  const stockNeedsSync =
    newQty !== undefined && newQty !== item.quantity && item.partId != null && item.type === "part"

  try {
    await prisma.$transaction(async (tx) => {
      await tx.serviceOrderItem.update({
        where: { id: itemId, workshopId: user.workshopId },
        data,
      })

      if (stockNeedsSync && item.partId) {
        const delta = computeStockDelta(item.quantity, newQty!)
        if (delta.direction === "reserve") {
          await reserveStockInTx(
            tx, user.workshopId, item.partId, delta.amount, "work_order", itemId, user.id,
            `İş emri ${order.workOrderNo || ""}: miktar güncellendi (${item.name})`,
          )
        } else if (delta.direction === "return") {
          await returnStockInTx(
            tx, user.workshopId, item.partId, delta.amount, "work_order", itemId, user.id,
            `İş emri ${order.workOrderNo || ""}: miktar düşürüldü (${item.name})`,
          )
        }
      }

      await recalcOrderPayment(tx, orderId, user.workshopId)
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Kalem güncellenemedi" }
  }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrderItem",
    itemId,
    "order_item_updated",
    JSON.stringify({ name: item.name, changes: data }),
    orderId,
  )

  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}
```

- [ ] **Step 4: Audit action string'ini doğrula**

`order_item_updated` string'i `AuditLogAction`'ın action parametresi olarak serbest string kabul ediyorsa (mevcut `order_item_added`/`order_item_removed` gibi) ek tanım gerekmez. Kontrol et:

Run: `grep -n "order_item_added" src/lib/audit.ts src/app/\(app\)/orders/actions.ts`
Expected: `order_item_added` bir string literal olarak geçiyor (enum kısıtı yoksa `order_item_updated` da geçerlidir). Eğer `AuditLogAction`'ın action parametresi union/enum ise, `order_item_updated`'ı o tipe ekle.

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/orders/actions.ts
git commit -m "feat(orders): updateOrderItemAction + create'e brand/category

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `/api/orders/items` PATCH handler

**Files:**
- Modify: `src/app/api/orders/items/route.ts`

**Interfaces:**
- Consumes: `updateOrderItemAction` (Task 4)
- Produces: `PATCH` — query `?id=&orderId=`, body `FormData` → `{ success }` | `{ error }`

- [ ] **Step 1: PATCH handler ekle**

Mevcut `DELETE` handler'ın altına ekle (import'a `updateOrderItemAction`'ı da ekle):

```ts
import { addOrderItemAction, removeOrderItemAction, updateOrderItemAction } from "@/app/(app)/orders/actions"

export async function PATCH(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  const orderId = url.searchParams.get("orderId")
  if (!id || !orderId) {
    return Response.json({ error: "Eksik parametre" }, { status: 400 })
  }
  const formData = await req.formData()
  const result = await updateOrderItemAction(id, orderId, formData)
  return Response.json(result, { status: "error" in result ? 400 : 200 })
}
```

> Not: mevcut `POST`/`DELETE` handler'larının import ve Response biçimini birebir izle; yukarıdaki import satırı mevcut import'la birleştirilecek (iki kez import etme).

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orders/items/route.ts
git commit -m "feat(api): orders/items PATCH endpoint

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Order detail page — items mapping'e yeni alanlar + panel tipi

**Files:**
- Modify: `src/app/(app)/orders/[id]/page.tsx` (2 mapping: ~98-108 ve ~214)
- Modify: `src/components/app/order-management-panel.tsx` (`OrderItem` tipi ~39-49)

**Interfaces:**
- Produces: `OrderItem` artık `brand: string | null`, `category: string | null`, `categoryId: number | null` içerir; page bunları besler.

- [ ] **Step 1: `OrderItem` tipini genişlet**

`order-management-panel.tsx` ~39-49:

```ts
export type OrderItem = {
  id: string
  type: string
  name: string
  sku: string | null
  unit: string | null
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  note: string | null
  brand: string | null
  category: string | null
  categoryId: number | null
}
```

- [ ] **Step 2: page.tsx birinci mapping'i güncelle (~98)**

`note: i.note,` satırından sonra ekle:

```ts
      brand: i.brand,
      category: i.category,
      categoryId: i.categoryId,
```

- [ ] **Step 3: page.tsx ikinci mapping'i kontrol et (~214)**

Run: `grep -n "note: i.note\|items: order.items.map" src/app/\(app\)/orders/\[id\]/page.tsx`

İkinci mapping (~214) da `PartsLaborCard`/aynı tip için ise, oraya da aynı 3 satırı ekle. Eğer ikinci mapping farklı bir tüketici (örn. PDF/summary) için ve brand/category istemiyorsa dokunma. Tüketiciyi doğrula: mapping'in atandığı prop'un tipini izle.

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: PASS (page yeni alanları besler, tip uyumlu).

- [ ] **Step 5: Commit**

```bash
git add src/components/app/order-management-panel.tsx src/app/\(app\)/orders/\[id\]/page.tsx
git commit -m "feat(orders): OrderItem tipine brand/category + page mapping

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Paylaşılan marka combobox bileşeni

`part-form.tsx`'teki marka combobox desenini tek bileşene çıkarıp hem add-form hem ItemRow'da kullan (DRY).

**Files:**
- Create: `src/components/app/part-brand-combobox.tsx`

**Interfaces:**
- Produces: `PartBrandCombobox({ value, onChange, placeholder? }: { value: string; onChange: (v: string) => void; placeholder?: string })` — TecDoc markalarını `/api/tecdoc/brands`'ten çeker, serbest yazımı destekler.

- [ ] **Step 1: Bileşeni oluştur**

`src/components/app/part-brand-combobox.tsx`:

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
import type { PartBrandSummary } from "@/lib/tecdoc/types"

/**
 * Parça markası seçici — TecDoc supplier listesi + serbest giriş.
 * Liste boş olsa da yazılan değer geçerlidir (onChange serbest metni de iletir).
 */
export function PartBrandCombobox({
  value,
  onChange,
  placeholder = "Bosch, Mann, OEM...",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [brands, setBrands] = useState<PartBrandSummary[]>([])
  useEffect(() => {
    let active = true
    fetch("/api/tecdoc/brands")
      .then((r) => r.json())
      .then((d) => { if (active) setBrands(Array.isArray(d?.brands) ? d.brands : []) })
      .catch(() => { if (active) setBrands([]) })
    return () => { active = false }
  }, [])

  return (
    <Combobox
      items={brands}
      filter={(item: PartBrandSummary, query: string) =>
        item.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr"))}
      itemToStringLabel={(b: PartBrandSummary) => b.name}
      itemToStringValue={(b: PartBrandSummary) => b.name}
      inputValue={value}
      onInputValueChange={(v: string) => onChange(v)}
      onValueChange={(b: PartBrandSummary | null) => { if (b) onChange(b.name) }}
    >
      <ComboboxInput placeholder={placeholder} />
      <ComboboxContent>
        <ComboboxEmpty className="py-2 text-sm text-muted-foreground">
          Listede yok — yazdığınız değer kullanılacak
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

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/app/part-brand-combobox.tsx
git commit -m "feat(parts): paylaşılan PartBrandCombobox bileşeni

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Kategori cascade bileşeni (TecDoc ağacı + serbest metin fallback)

**Files:**
- Create: `src/components/app/item-category-cascade.tsx`

**Interfaces:**
- Consumes: `CategoryNode` (`@/lib/tecdoc/types`), `GET /api/tecdoc/categories?vehicleId=<catalogVehicleTypeId>`
- Produces: `ItemCategoryCascade({ vehicleTypeId, value, onSelect }: { vehicleTypeId: number | null; value: string | null; onSelect: (sel: { category: string; categoryId: number | null }) => void })`
  - `vehicleTypeId` null → Popover yerine serbest metin input; kaydedince `{ category, categoryId: null }`.
  - `vehicleTypeId` var → Popover içinde `CategoryNode` ağacında drill (next: alt kategoriye in, ChevronLeft ile geri); herhangi bir düğüme dokununca `{ category: node.name, categoryId: node.id }`.

- [ ] **Step 1: Bileşeni oluştur**

`src/components/app/item-category-cascade.tsx`:

```tsx
"use client"

import { useCallback, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Loader2, Tag } from "lucide-react"
import type { CategoryNode } from "@/lib/tecdoc/types"
import { cn } from "@/lib/utils"

export function ItemCategoryCascade({
  vehicleTypeId,
  value,
  onSelect,
}: {
  vehicleTypeId: number | null
  value: string | null
  onSelect: (sel: { category: string; categoryId: number | null }) => void
}) {
  // Araç TecDoc'ta eşleşmemiş → serbest metin fallback.
  const [freeText, setFreeText] = useState(value || "")
  if (vehicleTypeId == null) {
    return (
      <Input
        value={freeText}
        onChange={(e) => setFreeText(e.target.value)}
        onBlur={() => { if (freeText !== (value || "")) onSelect({ category: freeText, categoryId: null }) }}
        placeholder="Kategori (serbest)"
        className="h-8 text-xs w-40"
      />
    )
  }
  return <CascadePopover vehicleTypeId={vehicleTypeId} value={value} onSelect={onSelect} />
}

function CascadePopover({
  vehicleTypeId,
  value,
  onSelect,
}: {
  vehicleTypeId: number
  value: string | null
  onSelect: (sel: { category: string; categoryId: number | null }) => void
}) {
  const [open, setOpen] = useState(false)
  const [tree, setTree] = useState<CategoryNode[] | null>(null)
  const [stack, setStack] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/tecdoc/categories?vehicleId=${vehicleTypeId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Katalog yüklenemedi.")
      setTree(data.categories as CategoryNode[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Katalog yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [vehicleTypeId])

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && tree == null) void load()
    if (!next) setStack([])
  }

  const currentNodes = stack.length === 0 ? tree ?? [] : stack[stack.length - 1].children

  function pick(node: CategoryNode) {
    if (node.children.length > 0) {
      // Alt kategorisi var → cascade: içine in (next).
      setStack((s) => [...s, node])
    } else {
      // Yaprak → seç ve kapat.
      onSelect({ category: node.name, categoryId: node.id })
      setOpen(false)
      setStack([])
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-border bg-white text-xs text-foreground hover:bg-muted transition-colors max-w-40"
      >
        <Tag className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{value || "Kategori"}</span>
        <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
          {stack.length > 0 && (
            <button
              type="button"
              onClick={() => setStack((s) => s.slice(0, -1))}
              className="p-1 rounded hover:bg-muted"
              aria-label="Geri"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          <span className="text-xs font-medium text-muted-foreground truncate">
            {stack.length === 0 ? "Kategori seç" : stack[stack.length - 1].name}
          </span>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {loading && <div className="flex items-center justify-center py-4"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>}
          {error && <div className="px-3 py-2 text-xs text-destructive">{error}</div>}
          {!loading && !error && currentNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => pick(node)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted border-b border-border last:border-0",
              )}
            >
              <span className="truncate">{node.name}</span>
              {node.children.length > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
            </button>
          ))}
          {!loading && !error && currentNodes.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Alt kategori yok</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

> Not: `PopoverTrigger`'ın `render`/`asChild` API'sini mevcut `src/components/ui/popover.tsx` (Base UI) imzasına göre teyit et; gerekiyorsa trigger'ı bileşenin beklediği biçime uyarla (Base UI'de `PopoverTrigger` genelde `render` prop ile özelleştirilir). Yapıyı bozmadan mevcut popover kullanımına bak: `grep -rn "PopoverTrigger" src/components`.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/app/item-category-cascade.tsx
git commit -m "feat(orders): kategori cascade bileşeni (TecDoc + serbest metin)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `ItemRow` inline editörler + `PartsLaborCard` güncelleme kablolaması

Bu asıl UX task'ı: satırı optimistik inline editöre çevir, `updateItem` fonksiyonu ekle, `window.location.reload()`'ları `router.refresh()`'e çevir.

**Files:**
- Modify: `src/components/app/order-management-panel.tsx`

**Interfaces:**
- Consumes: `PartBrandCombobox` (Task 7), `ItemCategoryCascade` (Task 8), `PATCH /api/orders/items` (Task 5).
- Produces: `ItemRow` içinde stepper/fiyat/marka/kategori inline; `PartsLaborCard.updateItem(itemId, patch)` optimistik + debounce.

- [ ] **Step 1: İmportları ekle ve router/useTransition getir**

`order-management-panel.tsx` başına:

```ts
import { useRouter } from "next/navigation"
import { PartBrandCombobox } from "@/components/app/part-brand-combobox"
import { ItemCategoryCascade } from "@/components/app/item-category-cascade"
```

`PartsLaborCard` içinde en üste:

```ts
  const router = useRouter()
```

- [ ] **Step 2: `handleAdd`/`handleRemove` reload'larını router.refresh yap**

`PartsLaborCard` içindeki iki `window.location.reload()` çağrısını `router.refresh()` ile değiştir (`handleAdd` başarı dalı ve `handleRemove`).

- [ ] **Step 3: `updateItem` fonksiyonunu ekle**

`handleRemove`'un altına, `PartsLaborCard` içine:

```ts
  // Optimistik local kopya — sunucu güncellenene kadar UI anında yanıt versin.
  const [localItems, setLocalItems] = useState<OrderItem[]>(items)
  useEffect(() => { setLocalItems(items) }, [items])

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  function updateItem(itemId: string, patch: Partial<OrderItem>, opts?: { debounce?: boolean }) {
    // 1) Optimistik güncelleme
    setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))
    // 2) Sunucuya gönder (miktar stepper için debounce)
    const send = async () => {
      const fd = new FormData()
      if (patch.quantity !== undefined) fd.set("quantity", String(patch.quantity))
      if (patch.unitPrice !== undefined) fd.set("unitPrice", String(patch.unitPrice))
      if (patch.brand !== undefined) fd.set("brand", patch.brand ?? "")
      if (patch.category !== undefined) fd.set("category", patch.category ?? "")
      if (patch.categoryId !== undefined) fd.set("categoryId", patch.categoryId != null ? String(patch.categoryId) : "")
      try {
        const res = await fetch(`/api/orders/items?id=${itemId}&orderId=${orderId}`, { method: "PATCH", body: fd })
        const data = await res.json()
        if (!data.success) {
          onError(data.error || "Kalem güncellenemedi")
          setLocalItems(items) // rollback
        } else {
          router.refresh() // toplamları/fiyatlandırmayı tazele
        }
      } catch {
        onError("Bir hata oluştu")
        setLocalItems(items) // rollback
      }
    }
    if (opts?.debounce) {
      clearTimeout(saveTimers.current[itemId])
      saveTimers.current[itemId] = setTimeout(send, 500)
    } else {
      void send()
    }
  }
```

`useEffect`/`useRef` importlarını dosyanın React import satırına ekle: `import { useState, useTransition, useEffect, useRef } from "react"`.

- [ ] **Step 4: parts/labor listelerini localItems'tan türet ve ItemRow'a updateItem geçir**

`const parts = items.filter(...)` / `const labor = items.filter(...)` satırlarını `localItems` kullanacak şekilde değiştir:

```ts
  const parts = localItems.filter((i) => i.type === "part")
  const labor = localItems.filter((i) => i.type === "labor")
```

`ItemRow` render'larına (parça listesi) `vehicleTypeId` ve `onUpdate` prop'larını geçir:

```tsx
                <ItemRow
                  key={item.id}
                  item={item}
                  lineTotal={lineTotal(item)}
                  onRemove={locked ? undefined : handleRemove}
                  onUpdate={locked ? undefined : updateItem}
                  vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
                  editable={!locked && item.type === "part"}
                />
```

İşçilik (labor) listesindeki `ItemRow`'a da aynı prop'ları geçirebilirsin ama `editable={false}` (marka/kategori işçilikte yok; stepper/fiyat istenirse açılabilir — MVP'de parça odaklı, labor eski görünümde kalsın: `editable={false}`, `onUpdate` verme).

- [ ] **Step 5: `ItemRow`'u inline editörlerle yeniden yaz**

Mevcut `ItemRow`'u değiştir:

```tsx
function ItemRow({
  item,
  lineTotal,
  onRemove,
  onUpdate,
  vehicleTypeId,
  editable,
}: {
  item: OrderItem
  lineTotal: number | null
  onRemove?: (id: string) => void
  onUpdate?: (id: string, patch: Partial<OrderItem>, opts?: { debounce?: boolean }) => void
  vehicleTypeId?: number | null
  editable?: boolean
}) {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState("")
  const [brandOpen, setBrandOpen] = useState(false)

  function startPrice() {
    setPriceDraft(item.unitPrice != null ? String(kurusToLira(item.unitPrice)) : "")
    setEditingPrice(true)
  }
  function commitPrice() {
    setEditingPrice(false)
    const lira = Number(priceDraft)
    if (!priceDraft || Number.isNaN(lira)) return
    const kurus = liraToKurus(lira)
    if (kurus !== item.unitPrice) onUpdate?.(item.id, { unitPrice: kurus })
  }

  return (
    <div className="p-2.5 bg-muted rounded-lg space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
          {item.sku && <span className="text-[10px] font-mono text-muted-foreground bg-white px-1.5 py-0.5 rounded border border-border">{item.sku}</span>}
        </div>
        <div className="text-right shrink-0 flex items-center gap-2">
          <span className={cn("text-sm font-semibold", lineTotal == null ? "text-muted-foreground/70 font-normal text-xs" : "text-foreground")}>
            {lineTotal != null ? formatTRY(lineTotal) : "—"}
          </span>
          {onRemove && (
            <button
              onClick={() => onRemove(item.id)}
              className="p-1 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
              aria-label="Kalemi sil"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {editable && onUpdate ? (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Miktar stepper */}
          <div className="inline-flex items-center rounded-lg border border-border bg-white">
            <button
              type="button"
              disabled={item.quantity <= 1}
              onClick={() => onUpdate(item.id, { quantity: item.quantity - 1 }, { debounce: true })}
              className="px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Azalt"
            >
              −
            </button>
            <span className="px-2 text-xs font-medium tabular-nums">{item.quantity} {item.unit || "adet"}</span>
            <button
              type="button"
              onClick={() => onUpdate(item.id, { quantity: item.quantity + 1 }, { debounce: true })}
              className="px-2 py-1 text-muted-foreground hover:text-foreground"
              aria-label="Arttır"
            >
              +
            </button>
          </div>

          {/* Fiyat inline */}
          {editingPrice ? (
            <Input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitPrice()
                if (e.key === "Escape") setEditingPrice(false)
              }}
              className="h-8 w-24 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={startPrice}
              className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-border bg-white text-xs hover:bg-muted"
            >
              <Pencil className="size-3 text-muted-foreground" />
              {item.unitPrice != null ? formatTRY(item.unitPrice) : "Fiyat"}
            </button>
          )}

          {/* Marka */}
          {brandOpen ? (
            <div className="w-40">
              <PartBrandCombobox
                value={item.brand || ""}
                onChange={(v) => { onUpdate(item.id, { brand: v }); }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBrandOpen(true)}
              className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-border bg-white text-xs hover:bg-muted max-w-40"
            >
              <span className="truncate">{item.brand || "Marka"}</span>
            </button>
          )}

          {/* Kategori cascade */}
          <ItemCategoryCascade
            vehicleTypeId={vehicleTypeId ?? null}
            value={item.category}
            onSelect={(sel) => onUpdate(item.id, { category: sel.category, categoryId: sel.categoryId })}
          />
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {item.quantity} {item.unit || (item.type === "part" ? "adet" : "saat")}
          {item.unitPrice ? ` × ${formatTRY(item.unitPrice)}` : ""}
          {item.brand && ` • ${item.brand}`}
          {item.category && ` • ${item.category}`}
          {item.note && ` • ${item.note}`}
        </div>
      )}
    </div>
  )
}
```

> Marka combobox'ı ilk tıkta açmak için basit bir toggle (`brandOpen`) kullanıldı; combobox açıldığında kullanıcı seçince değeri kaydeder. İstenirse `brandOpen`'ı seçim/blur sonrası kapatacak `onValueChange` eklenebilir (MVP: açık kalması sorun değil).

- [ ] **Step 6: Lint + typecheck + build**

Run: `bun run lint && bun run typecheck`
Expected: PASS

Run: `bun run build`
Expected: başarılı derleme (bu değişiklik belirgin olduğu için build önerilir).

- [ ] **Step 7: Commit**

```bash
git add src/components/app/order-management-panel.tsx
git commit -m "feat(orders): parça satırında inline miktar/fiyat/marka/kategori

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Add-form'a marka + kategori alanları

Yeni parça eklerken de marka combobox + kategori cascade + FormData alanları.

**Files:**
- Modify: `src/components/app/order-management-panel.tsx` (`PartsLaborCard` add formu ~350-430, `handleAdd` ~229-262, `resetForm`, TecDoc onSelect ~388-396)

**Interfaces:**
- Consumes: `PartBrandCombobox`, `ItemCategoryCascade`.
- Produces: `handleAdd` FormData'ya `brand`/`category`/`categoryId` ekler.

- [ ] **Step 1: Yeni form state ekle**

`PartsLaborCard` state'lerine ekle:

```ts
  const [brand, setBrand] = useState("")
  const [category, setCategory] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
```

`resetForm`'a ekle: `setBrand(""); setCategory(""); setCategoryId(null)`.

- [ ] **Step 2: TecDoc onSelect'i marka'ya yaz (note yerine)**

TecdocPartPicker `onSelect` içinde `if (!note && sel.supplierName) setNote(sel.supplierName)` satırını değiştir:

```ts
                    if (!brand && sel.supplierName) setBrand(sel.supplierName)
```

- [ ] **Step 3: Add formuna marka + kategori alanları ekle**

`addingType === "part"` bloğunda, mevcut "Not" input'unun üstüne ekle (yalnızca part için):

```tsx
            {addingType === "part" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Marka</Label>
                  <PartBrandCombobox value={brand} onChange={setBrand} />
                </div>
                <div>
                  <Label className="text-xs">Kategori</Label>
                  <div className="mt-1">
                    <ItemCategoryCascade
                      vehicleTypeId={vehicle?.catalogVehicleTypeId ?? null}
                      value={category || null}
                      onSelect={(sel) => { setCategory(sel.category); setCategoryId(sel.categoryId) }}
                    />
                  </div>
                </div>
              </div>
            )}
```

- [ ] **Step 4: `handleAdd`'e FormData alanlarını ekle**

`handleAdd` içinde, `if (note) formData.set("note", note)` satırından sonra:

```ts
    if (addingType === "part" && brand) formData.set("brand", brand)
    if (addingType === "part" && category) formData.set("category", category)
    if (addingType === "part" && categoryId != null) formData.set("categoryId", String(categoryId))
```

- [ ] **Step 5: Lint + typecheck**

Run: `bun run lint && bun run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/app/order-management-panel.tsx
git commit -m "feat(orders): parça ekleme formuna marka + kategori cascade

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Uçtan uca doğrulama (manuel QA)

**Files:** (yok — çalıştırma/doğrulama)

- [ ] **Step 1: Dev server'ı yeniden başlat** (şema değişti → `db.ts` singleton)

Run: OrbStack DB açık mı doğrula (`docker compose -f docker-compose.local.yml up -d`), sonra `bun run dev`

- [ ] **Step 2: verify skill ile akışı sür**

`/verify` (veya `bakimx-ui-qa` skill) ile bir iş emri detayında Parça & İşçilik sekmesini aç ve QA listesini yürüt:
1. Miktar +/- : satır toplamı + Fiyatlandırma kartı anında güncelleniyor; `partId`'li parçada stok doğru artıp azalıyor (Parça stok sayfasından teyit).
2. Fiyata tıkla → düzenle → Enter kaydeder, Esc iptal.
3. Marka: TecDoc listesi + serbest yazım kaydediliyor.
4. Kategori: araç TecDoc'ta eşleşmişse cascade drill+seç; eşleşmemişse serbest metin fallback.
5. Yeni parça ekle: marka + kategori alanları doluyor ve kaydediliyor; TecDoc picker seçince marka doluyor.
6. Kilitli (teslim/iptal) iş emrinde tüm inline kontroller salt-görünüm; PATCH denemesi 403 + UI rollback.
7. Mobil genişlikte chip'ler düzgün wrap oluyor, dokunma hedefleri yeterli.

- [ ] **Step 3: Tüm testleri çalıştır**

Run: `bun test`
Expected: yeni testler dahil tümü PASS.

- [ ] **Step 4: Release-check**

`bakimx-release-check` skill ile build/lint/typecheck/migration/env risklerini gözden geçir.

---

## Self-Review Notları

- **Spec kapsamı:** miktar stepper (Task 9), marka dropdown (Task 7+9+10), kategori cascade (Task 8+9+10), fiyat inline (Task 9), şema (Task 1), update action + stok mutabakatı (Task 2+4), PATCH (Task 5), page mapping (Task 6), add-form (Task 10), QA (Task 11) — tüm spec maddeleri karşılanıyor.
- **Tip tutarlılığı:** `updateItem(id, patch, opts)` imzası Task 9'da tanımlı, `ItemRow.onUpdate` aynı imza; `computeStockDelta` dönüşü `{direction,amount}` Task 2/4'te tutarlı; `serviceOrderItemUpdateSchema` alanları Task 3/4 tutarlı; `PartBrandCombobox`/`ItemCategoryCascade` prop imzaları Task 7/8'de tanımlı, Task 9/10'da aynı kullanılıyor.
- **Belirsizlik giderildi:** Base UI `PopoverTrigger`/`Combobox` API'si mevcut kullanımdan (part-form, tecdoc-part-picker) doğrulanmalı — Task 8 Step 1 notu bunu işaret ediyor.
- **Risk:** en kritik nokta Task 4 stok mutabakatı; saf `computeStockDelta` TDD ile korunuyor, transaction içinde `reserveStockInTx`/`returnStockInTx` mevcut desenle çağrılıyor.
