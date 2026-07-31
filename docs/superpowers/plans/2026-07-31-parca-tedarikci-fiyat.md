# Parça Tedarikçi Bazlı Fiyat + Zorunlu SKU Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parça formunda SKU'yu zorunlu yapmak, marka alanına serbest giriş kazandırmak ve tek alış fiyatı yerine tedarikçi bazlı çoklu alış fiyatı yönetimi getirmek.

**Architecture:** Yeni `PartSupplierPrice` tablosu parça ↔ tedarikçi çoklu ilişkiyi ve her tedarikçinin alış fiyatını tutar. `PartStockItem.purchasePrice` ve `supplierId` kolonları silinmez; kaydetme sırasında "varsayılan" satırdan türetilerek yazılır, böylece analitik/rapor/tedarikçi ekranları dokunulmadan çalışmaya devam eder. Saf türetme ve normalizasyon mantığı test edilebilir bir modüle (`src/lib/parts/supplier-prices.ts`) çıkarılır; server action yalnız doğrulama, tenant kontrolü ve yazma yapar.

**Tech Stack:** Next.js 16 (App Router, server actions), TypeScript strict, Prisma + PostgreSQL, zod v4, react-hook-form, Base UI tabanlı `@/components/ui/*` (shadcn kurulumu), Tailwind, `bun test`.

**Spec:** `docs/superpowers/specs/2026-07-31-parca-tedarikci-fiyat-design.md`

## Global Constraints

- Chat ve tüm kullanıcıya görünen metinler **Türkçe**.
- Yeni UI **yalnız** `@/components/ui/*` bileşenleriyle kurulur; özel/ham HTML kontrol yazılmaz. Yeni bileşen gerekirse `npx shadcn add` ile eklenir.
- Web'de (md+) tüm form kontrolleri `h-9`; `h-10`/`h-11` override yok.
- **Sabit/sticky dip aksiyon barı eklenmez** — aksiyonlar akış içinde satır içi kalır.
- Her server action `requireWritableWorkshop()` / `requireAuth()` içinden gelen `workshopId`'yi kullanır; client'tan gelen hiçbir id doğrulanmadan kullanılmaz (tenant izolasyonu).
- Para birimleri DB'de **kuruş** (Int); formda TRY (lira). Dönüşüm `liraToKurus`/`kurusToLira` (`@/lib/money`).
- Prisma tabloları PascalCase, `@@map` **yok** (yeni tablo adı: `"PartSupplierPrice"`).
- Şema değişikliği `bun run db:migrate` (yerel throwaway Postgres) ile yazılır; AWS dev'e `bun run db:tunnel` + `bun run db:deploy` ile uygulanır. `prisma migrate dev` **asla** paylaşılan buluta karşı çalıştırılmaz.
- Satır-başına `upsert` içeren `$transaction` kullanılmaz (5 sn timeout tuzağı); toplu `deleteMany` + `createMany` tercih edilir.
- TypeScript strict; gerekçesiz `any` yok.
- Testler `bun:test` ile, kaynak dosyanın yanında `*.test.ts` olarak.

## File Structure

**Oluşturulacak:**
- `src/lib/parts/supplier-prices.ts` — saf normalizasyon + türetme mantığı (DB/React bağımsız)
- `src/lib/parts/supplier-prices.test.ts` — yukarıdakinin testleri
- `src/lib/validations/part-supplier-price.test.ts` — zod kurallarının testleri
- `src/components/suppliers/quick-supplier-modal.tsx` — form içinden hızlı cari açma modalı
- `src/components/parts/part-supplier-prices-field.tsx` — tedarikçi + alış fiyatı satır editörü
- `prisma/migrations/<timestamp>_add_part_supplier_price/migration.sql` — tablo + backfill

**Değiştirilecek:**
- `prisma/schema.prisma` — yeni model + ters ilişkiler
- `src/lib/validations/part.ts` — SKU zorunlu, satır şemaları
- `src/app/(app)/parts/actions.ts` — create/update satır yazma + türetme
- `src/lib/parts/queries.ts` — atölye marka listesi
- `src/components/parts/part-form.tsx` — SKU/marka/fiyat/tedarikçi kartları
- `src/app/(app)/parts/new/page.tsx`, `src/app/(app)/parts/[id]/edit/page.tsx` — yeni prop'lar
- `src/app/(app)/parts/[id]/page.tsx`, `src/components/parts/part-detail.tsx` — fiyat tablosu
- `src/app/(app)/suppliers/[id]/page.tsx`, `src/components/suppliers/supplier-detail.tsx` — alış fiyatı kolonu

---

### Task 1: Şema, migration ve backfill

**Files:**
- Modify: `prisma/schema.prisma` (`PartStockItem` ~1023-1062, `Supplier` ~1103-1135, `Workshop` ilişki listesi ~63-65)
- Create: `prisma/migrations/<timestamp>_add_part_supplier_price/migration.sql`

**Interfaces:**
- Consumes: yok (ilk task)
- Produces: `prisma.partSupplierPrice` client modeli; alanlar `id, workshopId, partId, supplierId, purchasePrice (Int, kuruş), currency (String), supplierSku (String?), isPreferred (Boolean), note (String?), createdAt, updatedAt`; `@@unique([partId, supplierId])`

- [ ] **Step 1: Yeni modeli şemaya ekle**

`prisma/schema.prisma` içinde `model StockMovement` bloğunun hemen üstüne ekle:

```prisma
model PartSupplierPrice {
  id            String        @id @default(cuid())
  workshopId    String
  workshop      Workshop      @relation(fields: [workshopId], references: [id])
  partId        String
  part          PartStockItem @relation(fields: [partId], references: [id], onDelete: Cascade)
  supplierId    String
  supplier      Supplier      @relation(fields: [supplierId], references: [id])
  purchasePrice Int // kuruş
  currency      String        @default("TRY")
  supplierSku   String? // tedarikçinin kendi parça kodu
  isPreferred   Boolean       @default(false)
  note          String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@unique([partId, supplierId])
  @@index([workshopId])
  @@index([partId])
  @@index([supplierId])
}
```

- [ ] **Step 2: Ters ilişkileri ekle**

`model PartStockItem` içinde, `quoteItems QuoteItem[]` satırının altına:

```prisma
  supplierPrices    PartSupplierPrice[]
```

`model Supplier` içinde, `orderItems ServiceOrderItem[]` satırının altına:

```prisma
  partPrices PartSupplierPrice[]
```

`model Workshop` içinde, `suppliers Supplier[]` satırının altına:

```prisma
  partSupplierPrices     PartSupplierPrice[]
```

- [ ] **Step 3: Şemayı doğrula**

Run: `bun run db:validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Migration'ı uygulamadan üret**

Run: `bun run db:migrate --name add_part_supplier_price --create-only`
Expected: `prisma/migrations/<timestamp>_add_part_supplier_price/migration.sql` oluşur, DB'ye uygulanmaz.

- [ ] **Step 5: Backfill SQL'ini migration'ın sonuna ekle**

Üretilen `migration.sql` dosyasının **en sonuna** ekle:

```sql
-- Backfill: mevcut tekil tedarikçi + alış fiyatı olan parçalar için varsayılan satır üret
INSERT INTO "PartSupplierPrice" ("id", "workshopId", "partId", "supplierId", "purchasePrice", "currency", "isPreferred", "createdAt", "updatedAt")
SELECT
  replace(gen_random_uuid()::text, '-', ''),
  p."workshopId",
  p."id",
  p."supplierId",
  p."purchasePrice",
  p."currency",
  true,
  NOW(),
  NOW()
FROM "PartStockItem" p
WHERE p."supplierId" IS NOT NULL
  AND p."purchasePrice" IS NOT NULL
ON CONFLICT ("partId", "supplierId") DO NOTHING;
```

- [ ] **Step 6: Migration'ı yerel DB'ye uygula**

Run: `bun run db:migrate`
Expected: `Your database is now in sync with your schema.` Hata verirse `docker compose -f docker-compose.local.yml up -d db` ile yerel Postgres'i başlat ve tekrar dene.

- [ ] **Step 7: Tablo ve backfill'i doğrula**

Run:
```bash
docker exec bakimx-db-1 psql -U bakimx -d bakimx -c '\d "PartSupplierPrice"' \
  && docker exec bakimx-db-1 psql -U bakimx -d bakimx -c 'SELECT count(*) FROM "PartSupplierPrice";'
```
Expected: tablo yapısı listelenir (unique index `PartSupplierPrice_partId_supplierId_key` görünür) ve sayım sorgusu hatasız döner. Yerel throwaway DB boşsa sayım `0` olabilir — bu normaldir, gerçek backfill doğrulaması AWS dev'de yapılacak (Task 8).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(parts): PartSupplierPrice tablosu + mevcut tedarikçi fiyatı backfill"
```

---

### Task 2: Saf türetme mantığı (`supplier-prices.ts`)

**Files:**
- Create: `src/lib/parts/supplier-prices.ts`
- Test: `src/lib/parts/supplier-prices.test.ts`

**Interfaces:**
- Consumes: yok (saf modül, Prisma'ya bağımlı değil)
- Produces:
  - `type SupplierPriceRow = { supplierId: string; purchasePrice: number; supplierSku: string; isPreferred: boolean }`
  - `normalizeSupplierPriceRows(rows: SupplierPriceRow[]): SupplierPriceRow[]`
  - `derivePartPricing(rows: SupplierPriceRow[]): { purchasePrice: number | null; supplierId: string | null }`

**Not:** `purchasePrice` bu modülde **birim-nötr**dür (form katmanında lira, server katmanında kuruş aynı fonksiyonları kullanır). Para birimi türetilmez; tüm satırlar parçanın para birimini paylaşır (spec kararı), bu yüzden `currency` formdaki değerden yazılır.

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/parts/supplier-prices.test.ts`:

```ts
import { expect, test } from "bun:test"
import { normalizeSupplierPriceRows, derivePartPricing, type SupplierPriceRow } from "./supplier-prices"

function row(over: Partial<SupplierPriceRow> = {}): SupplierPriceRow {
  return { supplierId: "s1", purchasePrice: 1000, supplierSku: "", isPreferred: false, ...over }
}

test("boş liste boş döner", () => {
  expect(normalizeSupplierPriceRows([])).toEqual([])
})

test("tedarikçisi seçilmemiş satırlar atılır", () => {
  const rows = [row({ supplierId: "" }), row({ supplierId: "s2" })]
  const result = normalizeSupplierPriceRows(rows)
  expect(result).toHaveLength(1)
  expect(result[0].supplierId).toBe("s2")
})

test("hiç varsayılan yoksa ilk satır varsayılan olur", () => {
  const result = normalizeSupplierPriceRows([row({ supplierId: "s1" }), row({ supplierId: "s2" })])
  expect(result.map((r) => r.isPreferred)).toEqual([true, false])
})

test("birden fazla varsayılan varsa yalnız ilki kalır", () => {
  const result = normalizeSupplierPriceRows([
    row({ supplierId: "s1", isPreferred: true }),
    row({ supplierId: "s2", isPreferred: true }),
  ])
  expect(result.map((r) => r.isPreferred)).toEqual([true, false])
})

test("varsayılan satır atılırsa kalan ilk satır varsayılan olur", () => {
  const result = normalizeSupplierPriceRows([
    row({ supplierId: "", isPreferred: true }),
    row({ supplierId: "s2" }),
    row({ supplierId: "s3" }),
  ])
  expect(result.map((r) => [r.supplierId, r.isPreferred])).toEqual([
    ["s2", true],
    ["s3", false],
  ])
})

test("satır yoksa parça fiyatı ve tedarikçisi null olur", () => {
  expect(derivePartPricing([])).toEqual({ purchasePrice: null, supplierId: null })
})

test("varsayılan satırın fiyatı ve tedarikçisi parçaya taşınır", () => {
  const rows = normalizeSupplierPriceRows([
    row({ supplierId: "s1", purchasePrice: 5000 }),
    row({ supplierId: "s2", purchasePrice: 4000, isPreferred: true }),
  ])
  expect(derivePartPricing(rows)).toEqual({ purchasePrice: 4000, supplierId: "s2" })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `bun test src/lib/parts/supplier-prices.test.ts`
Expected: FAIL — `Cannot find module './supplier-prices'`

- [ ] **Step 3: Modülü yaz**

`src/lib/parts/supplier-prices.ts`:

```ts
/**
 * Parça ↔ tedarikçi alış fiyatı satırlarının saf mantığı.
 *
 * `purchasePrice` birim-nötrdür: form katmanı lira, server katmanı kuruş
 * geçirir. Para birimi burada türetilmez — tüm satırlar parçanın para
 * birimini paylaşır.
 */
export type SupplierPriceRow = {
  supplierId: string
  purchasePrice: number
  supplierSku: string
  isPreferred: boolean
}

/**
 * Tedarikçisi seçilmemiş satırları atar ve tam olarak bir satırı varsayılan
 * bırakır (işaretli yoksa ilk satır). Boş liste boş döner.
 */
export function normalizeSupplierPriceRows(rows: SupplierPriceRow[]): SupplierPriceRow[] {
  const filled = rows.filter((r) => r.supplierId.trim().length > 0)
  if (filled.length === 0) return []
  const preferredIndex = filled.findIndex((r) => r.isPreferred)
  const winner = preferredIndex === -1 ? 0 : preferredIndex
  return filled.map((r, i) => ({ ...r, isPreferred: i === winner }))
}

/**
 * `PartStockItem` üzerindeki türetilmiş alanları hesaplar. Varsayılan satır
 * yoksa (hiç tedarikçi eklenmemişse) ikisi de null olur.
 */
export function derivePartPricing(rows: SupplierPriceRow[]): {
  purchasePrice: number | null
  supplierId: string | null
} {
  const preferred = rows.find((r) => r.isPreferred)
  if (!preferred) return { purchasePrice: null, supplierId: null }
  return { purchasePrice: preferred.purchasePrice, supplierId: preferred.supplierId }
}
```

- [ ] **Step 4: Testleri çalıştır, geçtiğini gör**

Run: `bun test src/lib/parts/supplier-prices.test.ts`
Expected: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/parts/supplier-prices.ts src/lib/parts/supplier-prices.test.ts
git commit -m "feat(parts): tedarikçi fiyat satırı normalizasyon + türetme mantığı"
```

---

### Task 3: Doğrulama şemaları (zorunlu SKU + satır şemaları)

**Files:**
- Modify: `src/lib/validations/part.ts`
- Test: `src/lib/validations/part-supplier-price.test.ts`

**Interfaces:**
- Consumes: yok
- Produces:
  - `partSupplierPriceFormRowSchema` / `partSupplierPricesFormSchema` — **lira** cinsinden, `partSchema.supplierPrices` alanında kullanılır
  - `partSupplierPriceRowSchema` / `partSupplierPricesSchema` — **kuruş** cinsinden, server action'da kullanılır
  - `PartFormValues` artık `supplierPrices: { supplierId: string; purchasePrice: number; supplierSku: string; isPreferred: boolean }[]` içerir
  - `partSchema.sku` ve `partCreateSchema.sku` artık zorunlu

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/validations/part-supplier-price.test.ts`:

```ts
import { expect, test } from "bun:test"
import { partSupplierPricesSchema, partCreateSchema } from "./part"

const base = { supplierId: "s1", purchasePrice: 1000, supplierSku: "", isPreferred: true }

test("boş liste geçerlidir", () => {
  expect(partSupplierPricesSchema.safeParse([]).success).toBe(true)
})

test("geçerli tek satır kabul edilir", () => {
  expect(partSupplierPricesSchema.safeParse([base]).success).toBe(true)
})

test("tedarikçisiz satır reddedilir", () => {
  const result = partSupplierPricesSchema.safeParse([{ ...base, supplierId: "" }])
  expect(result.success).toBe(false)
})

test("negatif fiyat reddedilir", () => {
  const result = partSupplierPricesSchema.safeParse([{ ...base, purchasePrice: -1 }])
  expect(result.success).toBe(false)
})

test("aynı tedarikçi iki kez eklenemez", () => {
  const result = partSupplierPricesSchema.safeParse([base, { ...base, isPreferred: false }])
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.message).toBe("Aynı tedarikçi birden fazla eklenemez")
})

test("satır varken varsayılan seçilmemişse reddedilir", () => {
  const result = partSupplierPricesSchema.safeParse([{ ...base, isPreferred: false }])
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.message).toBe("Bir varsayılan tedarikçi seçilmelidir")
})

test("birden fazla varsayılan reddedilir", () => {
  const result = partSupplierPricesSchema.safeParse([base, { ...base, supplierId: "s2" }])
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.message).toBe("Bir varsayılan tedarikçi seçilmelidir")
})

test("parça kodu zorunludur", () => {
  const result = partCreateSchema.safeParse({ name: "Fren balatası", sku: "" })
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.message).toBe("Parça kodu zorunludur")
})

test("parça kodu doluysa kabul edilir", () => {
  const result = partCreateSchema.safeParse({ name: "Fren balatası", sku: "0986424815" })
  expect(result.success).toBe(true)
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `bun test src/lib/validations/part-supplier-price.test.ts`
Expected: FAIL — `partSupplierPricesSchema` export edilmemiş.

- [ ] **Step 3: Şemaları ekle ve SKU'yu zorunlu yap**

`src/lib/validations/part.ts` içinde, `partSchema`'nın **üstüne** ekle:

```ts
/** Form katmanı: fiyat TRY (lira) girilir. */
export const partSupplierPriceFormRowSchema = z.object({
  supplierId: z.string().min(1, "Tedarikçi seçilmelidir"),
  purchasePrice: z.coerce.number().min(0, "Alış fiyatı negatif olamaz").default(0),
  supplierSku: z.string().optional().default(""),
  isPreferred: z.boolean().default(false),
})

/** Sunucu katmanı: fiyat kuruş (tam sayı). */
export const partSupplierPriceRowSchema = z.object({
  supplierId: z.string().min(1, "Tedarikçi seçilmelidir"),
  purchasePrice: z.coerce
    .number()
    .int("Alış fiyatı kuruş (tam sayı) olmalıdır")
    .min(0, "Alış fiyatı negatif olamaz"),
  supplierSku: z.string().optional().default(""),
  isPreferred: z.boolean().default(false),
})

function withRowRules<T extends z.ZodType<{ supplierId: string; isPreferred: boolean }[]>>(schema: T) {
  return schema
    .refine(
      (rows) => new Set(rows.map((r) => r.supplierId)).size === rows.length,
      "Aynı tedarikçi birden fazla eklenemez"
    )
    .refine(
      (rows) => rows.length === 0 || rows.filter((r) => r.isPreferred).length === 1,
      "Bir varsayılan tedarikçi seçilmelidir"
    )
}

export const partSupplierPricesFormSchema = withRowRules(
  z.array(partSupplierPriceFormRowSchema).max(20, "En fazla 20 tedarikçi eklenebilir")
)

export const partSupplierPricesSchema = withRowRules(
  z.array(partSupplierPriceRowSchema).max(20, "En fazla 20 tedarikçi eklenebilir")
)
```

`partSchema` içinde `sku` satırını değiştir:

```ts
  sku: z.string().min(1, "Parça kodu zorunludur"),
```

`partSchema` içinden `purchasePrice` satırını **sil** (form artık alış fiyatını tedarikçi satırlarından alıyor; `PartFormValues` bu alanı taşımamalı):

```ts
  // SİL: purchasePrice: z.coerce.number().min(0).optional().default(0),
```

`partSchema`'nın son alanı `barcode`'un altına:

```ts
  supplierPrices: partSupplierPricesFormSchema.default([]),
```

**Not:** `partCreateSchema.purchasePrice` **kalır** — form artık bu alanı göndermiyor (opsiyonel olduğu için sorun değil), ama şemayı sadeleştirmek bu task'ın kapsamı dışında.

`partCreateSchema` içinde `sku` satırını değiştir:

```ts
  sku: z.string().min(1, "Parça kodu zorunludur"),
```

**Not:** `withRowRules` jenerik imzası `tsc` altında sorun çıkarırsa, `refine` zincirini iki şemaya ayrı ayrı (kopyalayarak) uygula — davranış aynı kalmalı, hata mesajları birebir korunmalı.

- [ ] **Step 4: Testleri çalıştır, geçtiğini gör**

Run: `bun test src/lib/validations/part-supplier-price.test.ts`
Expected: PASS (9 test)

- [ ] **Step 5: Tip kontrolü**

Run: `bun run typecheck`
Expected: `part-form.tsx` içinde `supplierPrices` alanı eksik olduğu için hata verebilir — bu beklenen, Task 6'da kapanacak. Başka bir dosyada hata olmamalı. Yalnız `src/lib/validations` ve `src/lib/parts` altında hata **olmamalı**.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validations/part.ts src/lib/validations/part-supplier-price.test.ts
git commit -m "feat(parts): parça kodu zorunlu + tedarikçi fiyat satırı doğrulama şemaları"
```

---

### Task 4: Server action — satırları yaz, türetilmiş alanları senkronla

**Files:**
- Modify: `src/app/(app)/parts/actions.ts:12-73` (`createPartAction`), `:75-126` (`updatePartAction`)
- Modify: `src/lib/parts/queries.ts` (yeni `getWorkshopBrands`)

**Interfaces:**
- Consumes: `normalizeSupplierPriceRows`, `derivePartPricing`, `SupplierPriceRow` (Task 2); `partSupplierPricesSchema` (Task 3)
- Produces:
  - `createPartAction(formData)` / `updatePartAction(partId, formData)` artık `formData.get("supplierPrices")` içindeki **JSON dizisini** (kuruş) okur
  - `getWorkshopBrands(workshopId: string): Promise<string[]>` — `src/lib/parts/queries.ts`

- [ ] **Step 1: Ortak yardımcıyı actions.ts'e ekle**

`src/app/(app)/parts/actions.ts` importlarına ekle:

```ts
import { partSupplierPricesSchema } from "@/lib/validations/part"
import { normalizeSupplierPriceRows, derivePartPricing, type SupplierPriceRow } from "@/lib/parts/supplier-prices"
```

`createPartAction`'ın üstüne ekle:

```ts
type SupplierPricesResult =
  | { error: string }
  | { rows: SupplierPriceRow[]; derived: { purchasePrice: number | null; supplierId: string | null } }

/**
 * `supplierPrices` JSON alanını okur, doğrular ve tedarikçilerin bu atölyeye
 * ait olduğunu teyit eder. workshopId çağırandan gelir — client'a güvenilmez.
 */
async function parseSupplierPrices(formData: FormData, workshopId: string): Promise<SupplierPricesResult> {
  const raw = formData.get("supplierPrices")
  if (typeof raw !== "string" || raw.trim() === "") {
    return { rows: [], derived: { purchasePrice: null, supplierId: null } }
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { error: "Tedarikçi fiyatları okunamadı" }
  }

  const parsed = partSupplierPricesSchema.safeParse(json)
  if (!parsed.success) return { error: getValidationError(parsed) ?? "Tedarikçi fiyatları geçersiz" }

  const rows = normalizeSupplierPriceRows(parsed.data)
  if (rows.length > 0) {
    const ids = rows.map((r) => r.supplierId)
    const owned = await prisma.supplier.count({ where: { workshopId, id: { in: ids } } })
    if (owned !== ids.length) return { error: "Geçersiz tedarikçi" }
  }

  return { rows, derived: derivePartPricing(rows) }
}
```

- [ ] **Step 2: `createPartAction`'ı güncelle**

`createPartAction` içinde, `const parsed = partCreateSchema.safeParse(raw)` bloğundan sonra gelen **tekil tedarikçi doğrulamasını** (`if (parsed.data.supplierId) { ... }`) şununla değiştir:

```ts
  const prices = await parseSupplierPrices(formData, workshopId)
  if ("error" in prices) return { error: prices.error }
```

`prisma.partStockItem.create` çağrısındaki fiyat/tedarikçi alanlarını değiştir:

```ts
      purchasePrice: prices.derived.purchasePrice,
      salePrice: parsed.data.salePrice ?? null,
      currency: parsed.data.currency || "TRY",
      supplierName: null,
      supplierPhone: null,
      supplierId: prices.derived.supplierId,
```

`create` çağrısının hemen ardına, stok hareketi bloğunun **üstüne** ekle:

```ts
  if (prices.rows.length > 0) {
    await prisma.partSupplierPrice.createMany({
      data: prices.rows.map((r) => ({
        workshopId,
        partId: part.id,
        supplierId: r.supplierId,
        purchasePrice: r.purchasePrice,
        currency: parsed.data.currency || "TRY",
        supplierSku: r.supplierSku || null,
        isPreferred: r.isPreferred,
      })),
    })
  }
```

- [ ] **Step 3: `updatePartAction`'ı güncelle**

`updatePartAction` içinde tekil tedarikçi doğrulamasını (`if (parsed.data.supplierId) { ... }`) şununla değiştir:

```ts
  const prices = await parseSupplierPrices(formData, workshopId)
  if ("error" in prices) return { error: prices.error }
```

`await prisma.partStockItem.updateMany({...})` çağrısını tümüyle şununla değiştir (legacy metin alanları **yazılmaz**, mevcut değerleri korunur):

```ts
  await prisma.$transaction([
    prisma.partSupplierPrice.deleteMany({ where: { partId, workshopId } }),
    ...(prices.rows.length > 0
      ? [
          prisma.partSupplierPrice.createMany({
            data: prices.rows.map((r) => ({
              workshopId,
              partId,
              supplierId: r.supplierId,
              purchasePrice: r.purchasePrice,
              currency: parsed.data.currency || "TRY",
              supplierSku: r.supplierSku || null,
              isPreferred: r.isPreferred,
            })),
          }),
        ]
      : []),
    prisma.partStockItem.updateMany({
      where: { id: partId, workshopId },
      data: {
        name: parsed.data.name,
        sku: parsed.data.sku || null,
        oemNo: parsed.data.oemNo || null,
        brand: parsed.data.brand || null,
        category: parsed.data.category || null,
        description: parsed.data.description || null,
        unit: parsed.data.unit || "adet",
        stockQty: parsed.data.stockQty,
        criticalStockQty: parsed.data.criticalStockQty,
        purchasePrice: prices.derived.purchasePrice,
        salePrice: parsed.data.salePrice ?? null,
        currency: parsed.data.currency || "TRY",
        supplierId: prices.derived.supplierId,
        shelfLocation: parsed.data.shelfLocation || null,
        barcode: parsed.data.barcode || null,
      },
    }),
  ])
```

`revalidatePath` çağrılarının yanına ekle:

```ts
  revalidatePath("/suppliers")
```

- [ ] **Step 4: Marka listesi sorgusunu ekle**

`src/lib/parts/queries.ts` sonuna ekle:

```ts
/** Bu atölyenin daha önce kullandığı marka adları (marka önerileri için). */
export async function getWorkshopBrands(workshopId: string): Promise<string[]> {
  const rows = await prisma.partStockItem.findMany({
    where: { workshopId, brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
    orderBy: { brand: "asc" },
  })
  return rows.map((r) => r.brand).filter((b): b is string => !!b && b.trim().length > 0)
}
```

- [ ] **Step 5: Lint + tip kontrolü**

Run: `bun run lint && bun run typecheck`
Expected: `actions.ts` ve `queries.ts` temiz. `part-form.tsx` hâlâ hata verebilir (Task 6'da kapanacak); başka dosyada hata olmamalı.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/parts/actions.ts src/lib/parts/queries.ts
git commit -m "feat(parts): server action tedarikçi fiyat satırlarını yazar, türetilmiş alanları senkronlar"
```

---

### Task 5: Hızlı tedarikçi modalı

**Files:**
- Create: `src/components/suppliers/quick-supplier-modal.tsx`

**Interfaces:**
- Consumes: `createSupplierAction(formData: FormData): Promise<{ error?: string; success?: boolean; id?: string }>` (`@/app/(app)/suppliers/actions`)
- Produces: `QuickSupplierModal` bileşeni — props `{ open: boolean; onOpenChange: (b: boolean) => void; onCreated: (supplier: { id: string; name: string; phone: string | null }) => void }`

- [ ] **Step 1: Bileşeni yaz**

`src/components/suppliers/quick-supplier-modal.tsx`:

```tsx
"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus } from "lucide-react"

/**
 * Parça formundan ayrılmadan tedarikçi carisi açar. Yalnız zorunlu alanı (ad)
 * ister; kalan cari bilgileri /suppliers ekranından tamamlanır.
 */
export function QuickSupplierModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  onCreated: (supplier: { id: string; name: string; phone: string | null }) => void
}) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [city, setCity] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function reset() {
    setName("")
    setPhone("")
    setCity("")
    setError(null)
  }

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Tedarikçi adı zorunludur")
      return
    }
    setPending(true)
    setError(null)
    try {
      const { createSupplierAction } = await import("@/app/(app)/suppliers/actions")
      const fd = new FormData()
      fd.set("name", trimmed)
      if (phone.trim()) fd.set("phone", phone.trim())
      if (city.trim()) fd.set("city", city.trim())
      const result = await createSupplierAction(fd)
      if (result?.error || !result?.id) {
        setError(result?.error ?? "Tedarikçi oluşturulamadı")
        return
      }
      onCreated({ id: result.id, name: trimmed, phone: phone.trim() || null })
      reset()
      onOpenChange(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Yeni Tedarikçi</DialogTitle>
          <DialogDescription className="text-xs">
            Cari kaydı hemen açılır; detayları sonra Tedarikçiler ekranından tamamlayabilirsiniz.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="quick-supplier-name">Tedarikçi Adı *</Label>
            <Input
              id="quick-supplier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Yılmaz Otomotiv"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quick-supplier-phone">Telefon</Label>
              <Input
                id="quick-supplier-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05XX XXX XX XX"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-supplier-city">Şehir</Label>
              <Input
                id="quick-supplier-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Opsiyonel"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" onClick={handleSubmit} disabled={pending} className="flex-1 sm:flex-none">
            {pending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Plus className="size-3.5 mr-1" />}
            Oluştur
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            İptal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Gerekli ui bileşenlerinin varlığını doğrula**

Run: `ls src/components/ui/dialog.tsx src/components/ui/label.tsx src/components/ui/alert.tsx src/components/ui/input.tsx`
Expected: dördü de listelenir. Eksik varsa `npx shadcn add <bileşen>` ile ekle (elle yazma).

- [ ] **Step 3: Lint + tip kontrolü**

Run: `bun run lint && bun run typecheck`
Expected: bu dosyada hata yok.

- [ ] **Step 4: Commit**

```bash
git add src/components/suppliers/quick-supplier-modal.tsx
git commit -m "feat(suppliers): parça formundan hızlı tedarikçi oluşturma modalı"
```

---

### Task 6: Tedarikçi fiyat satır editörü

**Files:**
- Create: `src/components/parts/part-supplier-prices-field.tsx`

**Interfaces:**
- Consumes: `QuickSupplierModal` (Task 5), `normalizeSupplierPriceRows` (Task 2)
- Produces:
  - `type SupplierOption = { id: string; name: string; phone: string | null }`
  - `type SupplierPriceFormRow = { supplierId: string; purchasePrice: number; supplierSku: string; isPreferred: boolean }` (fiyat **lira**)
  - `PartSupplierPricesField` — props `{ suppliers: SupplierOption[]; value: SupplierPriceFormRow[]; onChange: (rows: SupplierPriceFormRow[]) => void }`

- [ ] **Step 1: Bileşeni yaz**

`src/components/parts/part-supplier-prices-field.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QuickSupplierModal } from "@/components/suppliers/quick-supplier-modal"
import { normalizeSupplierPriceRows } from "@/lib/parts/supplier-prices"
import { Plus, Trash2, Star, Store } from "lucide-react"

export type SupplierOption = { id: string; name: string; phone: string | null }

/** Fiyat bu katmanda TRY (lira); kuruşa çevrim gönderim anında yapılır. */
export type SupplierPriceFormRow = {
  supplierId: string
  purchasePrice: number
  supplierSku: string
  isPreferred: boolean
}

const EMPTY_ROW: SupplierPriceFormRow = { supplierId: "", purchasePrice: 0, supplierSku: "", isPreferred: false }

export function PartSupplierPricesField({
  suppliers,
  value,
  onChange,
}: {
  suppliers: SupplierOption[]
  value: SupplierPriceFormRow[]
  onChange: (rows: SupplierPriceFormRow[]) => void
}) {
  const [options, setOptions] = useState<SupplierOption[]>(suppliers)
  const [modalOpen, setModalOpen] = useState(false)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)

  function patchRow(index: number, patch: Partial<SupplierPriceFormRow>) {
    onChange(value.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRow() {
    onChange([...value, { ...EMPTY_ROW, isPreferred: value.length === 0 }])
  }

  function removeRow(index: number) {
    const next = value.filter((_, i) => i !== index)
    // Varsayılan satır silindiyse kalan ilk satır varsayılan olur.
    onChange(next.length > 0 && !next.some((r) => r.isPreferred) ? next.map((r, i) => ({ ...r, isPreferred: i === 0 })) : next)
  }

  function setPreferred(index: number) {
    onChange(value.map((r, i) => ({ ...r, isPreferred: i === index })))
  }

  function openModal(index: number | null) {
    setTargetIndex(index)
    setModalOpen(true)
  }

  function handleCreated(supplier: SupplierOption) {
    setOptions((prev) => [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name, "tr")))
    if (targetIndex != null) {
      patchRow(targetIndex, { supplierId: supplier.id })
    } else {
      onChange(normalizeSupplierPriceRows([...value, { ...EMPTY_ROW, supplierId: supplier.id }]))
    }
    setTargetIndex(null)
  }

  const usedIds = new Set(value.map((r) => r.supplierId).filter(Boolean))

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <Store className="size-6 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Bu parça için henüz tedarikçi eklenmedi.</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            Alış fiyatı tedarikçi bazlı tutulur; en az bir tedarikçi ekleyin.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((row, index) => {
            const selected = options.find((o) => o.id === row.supplierId)
            return (
              <div key={index} className="rounded-lg border p-3 space-y-3 md:space-y-0 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end md:gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tedarikçi *</Label>
                  <Select
                    value={row.supplierId}
                    onValueChange={(v: string | null) => {
                      if (v === "__new__") {
                        openModal(index)
                        return
                      }
                      patchRow(index, { supplierId: v ?? "" })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tedarikçi seçin">
                        {(v: string | null) => {
                          if (!v) return null
                          const s = options.find((o) => o.id === v)
                          return s ? s.name : v
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {options
                        .filter((o) => o.id === row.supplierId || !usedIds.has(o.id))
                        .map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                            {o.phone ? ` — ${o.phone}` : ""}
                          </SelectItem>
                        ))}
                      <SelectItem value="__new__">+ Yeni tedarikçi oluştur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Alış Fiyatı (₺)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.purchasePrice}
                    onChange={(e) => patchRow(index, { purchasePrice: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Tedarikçi Parça Kodu</Label>
                  <Input
                    value={row.supplierSku}
                    onChange={(e) => patchRow(index, { supplierSku: e.target.value })}
                    placeholder="Opsiyonel"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={row.isPreferred ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreferred(index)}
                    aria-pressed={row.isPreferred}
                    title="Varsayılan tedarikçi"
                  >
                    <Star className="size-3.5" />
                    <span className="ml-1 md:hidden">Varsayılan</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeRow(index)}
                    aria-label={`${selected?.name ?? "Tedarikçi"} satırını sil`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {row.isPreferred && (
                  <div className="md:col-span-4">
                    <Badge variant="secondary" className="text-[10px]">
                      Varsayılan — parçanın alış fiyatı bu satırdan alınır
                    </Badge>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={value.length >= 20}>
          <Plus className="size-3.5 mr-1" />
          Tedarikçi ekle
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => openModal(null)}>
          <Plus className="size-3.5 mr-1" />
          Yeni tedarikçi oluştur
        </Button>
      </div>

      <QuickSupplierModal open={modalOpen} onOpenChange={setModalOpen} onCreated={handleCreated} />
    </div>
  )
}
```

- [ ] **Step 2: Badge bileşeninin varlığını doğrula**

Run: `ls src/components/ui/badge.tsx`
Expected: dosya listelenir. Yoksa `npx shadcn add badge`.

- [ ] **Step 3: Lint + tip kontrolü**

Run: `bun run lint && bun run typecheck`
Expected: bu dosyada hata yok. `Select` value tipinde uyarı çıkarsa `onValueChange` imzasını `(v: unknown) => ...` yerine bu dosyadaki gibi `string | null` olarak bırak ve `SelectValue` render fonksiyonunu koru (Base UI `SelectValue` etiketi değil ham değeri basar).

- [ ] **Step 4: Commit**

```bash
git add src/components/parts/part-supplier-prices-field.tsx
git commit -m "feat(parts): tedarikçi + alış fiyatı satır editörü"
```

---

### Task 7: Parça formunu yeniden bağla

**Files:**
- Modify: `src/components/parts/part-form.tsx`
- Modify: `src/app/(app)/parts/new/page.tsx`
- Modify: `src/app/(app)/parts/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `PartSupplierPricesField`, `SupplierPriceFormRow` (Task 6); `getWorkshopBrands` (Task 4); `partSchema.supplierPrices` (Task 3)
- Produces: `PartForm` props artık `{ part?: PartData; suppliers?: SupplierOption[]; workshopBrands?: string[]; supplierPrices?: SupplierPriceFormRow[] }`

- [ ] **Step 1: Form tipini ve varsayılanlarını güncelle**

`src/components/parts/part-form.tsx` içinde importları ekle:

```tsx
import { Autocomplete, AutocompleteInput, AutocompleteContent, AutocompleteList, AutocompleteItem, AutocompleteEmpty } from "@/components/ui/autocomplete"
import { PartSupplierPricesField, type SupplierPriceFormRow } from "@/components/parts/part-supplier-prices-field"
```

`Combobox` importunu ve `Brand` tipini koru (marka önerileri hâlâ TecDoc'tan geliyor) ama `Combobox*` importları artık kullanılmayacaksa **sil**.

`PartForm` imzasını değiştir:

```tsx
export function PartForm({
  part,
  suppliers,
  workshopBrands = [],
  supplierPrices = [],
}: {
  part?: PartData
  suppliers?: SupplierOption[]
  workshopBrands?: string[]
  supplierPrices?: SupplierPriceFormRow[]
}) {
```

`toDefaults` imzasını `function toDefaults(part?: PartData, supplierPrices: SupplierPriceFormRow[] = []): PartFormValues` yap; dönen nesnede `purchasePrice` alanını **kaldır**, sona ekle:

```ts
    supplierPrices,
```

`useForm` çağrısında `defaultValues: toDefaults(part, supplierPrices)`.

- [ ] **Step 2: SKU alanını zorunlu göster**

`sku` `FormField` içinde:

```tsx
                      <FormLabel>Parça Kodu / SKU *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Örn. 0986424815" />
                      </FormControl>
```

- [ ] **Step 3: Marka alanını serbest girişli Autocomplete'e çevir**

`brand` `FormField` içindeki `<Combobox>…</Combobox>` bloğunu tümüyle şununla değiştir:

```tsx
                        <Autocomplete
                          items={brandOptions}
                          value={field.value}
                          autoHighlight
                          openOnInputClick
                          itemToStringValue={(b: string) => b}
                          onValueChange={(v: string) => field.onChange(v)}
                        >
                          <AutocompleteInput render={<Input placeholder="Bosch, Mann, OEM..." />} />
                          <AutocompleteContent>
                            <AutocompleteEmpty>Listede yok — yazdığınız marka kaydedilir</AutocompleteEmpty>
                            <AutocompleteList>
                              {(b: string) => (
                                <AutocompleteItem key={b} value={b} onClick={() => field.onChange(b)}>
                                  <span className="block truncate">{b}</span>
                                </AutocompleteItem>
                              )}
                            </AutocompleteList>
                          </AutocompleteContent>
                        </Autocomplete>
```

`brands` state'inin altına birleşik öneri listesini ekle:

```tsx
  // Öneriler: atölyenin kendi markaları önce, ardından TecDoc markaları (tekilleştirilmiş).
  const brandOptions = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const b of [...workshopBrands, ...brands.map((x) => x.name)]) {
      const key = b.trim().toLocaleLowerCase("tr")
      if (!b.trim() || seen.has(key)) continue
      seen.add(key)
      out.push(b.trim())
    }
    return out
  }, [workshopBrands, brands])
```

`useMemo`'yu React importuna ekle.

- [ ] **Step 4: Alış fiyatını karttan çıkar**

"Fiyat Bilgileri" `Card`'ında `purchasePrice` `FormField`'ını **sil** ve grid'i ikiye indir:

```tsx
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

- [ ] **Step 5: Tedarikçi kartını değiştir**

"Tedarikçi Bilgisi" `Card`'ının tamamını (başlık dâhil) şununla değiştir:

```tsx
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Tedarikçiler & Alış Fiyatları</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="supplierPrices"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PartSupplierPricesField
                        suppliers={suppliers ?? []}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-[11px] text-muted-foreground/70 mt-3">
                Alış fiyatı tedarikçi bazlı tutulur. Varsayılan tedarikçinin fiyatı parçanın alış fiyatı olarak kullanılır.
              </p>
            </CardContent>
          </Card>
```

- [ ] **Step 6: Gönderimi güncelle**

`onSubmit` içindeki gövdeyi şununla değiştir:

```tsx
  function onSubmit(values: PartFormValues) {
    const formData = new FormData()
    for (const [key, value] of Object.entries(values)) {
      if (key === "supplierPrices") continue
      formData.set(key, String(value))
    }
    // Satış fiyatı TRY girilir, kuruş saklanır.
    formData.set("salePrice", String(liraToKurus(Number(values.salePrice) || 0)))
    // Tedarikçi satırları JSON olarak gider; fiyatlar kuruşa çevrilir.
    formData.set(
      "supplierPrices",
      JSON.stringify(
        values.supplierPrices.map((r) => ({
          supplierId: r.supplierId,
          purchasePrice: liraToKurus(Number(r.purchasePrice) || 0),
          supplierSku: r.supplierSku,
          isPreferred: r.isPreferred,
        }))
      )
    )
    startTransition(() => formAction(formData))
  }
```

`PartData` tipinden `purchasePrice`, `supplierName`, `supplierPhone`, `supplierId` alanlarını **silme** (sayfa hâlâ tüm parçayı geçiriyor); yalnız `toDefaults` içinde kullanılmadıklarından emin ol — `purchasePrice` artık `PartFormValues`'ta olmadığı için (Task 3) `toDefaults` dönüşünden çıkarılmalı, aksi halde `tsc` fazla alan hatası verir. `kurusToLira` importu satış fiyatı için hâlâ gerekli.

- [ ] **Step 7: `/parts/new` sayfasını güncelle**

`src/app/(app)/parts/new/page.tsx`:

```tsx
import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { PartForm } from "@/components/parts/part-form"
import { getActiveSuppliersForSelect } from "@/lib/suppliers/queries"
import { getWorkshopBrands } from "@/lib/parts/queries"

export default async function NewPartPage() {
  const { user, workshop } = await getAppData()
  const [suppliers, workshopBrands] = await Promise.all([
    getActiveSuppliersForSelect(user.workshopId),
    getWorkshopBrands(user.workshopId),
  ])
  return (
    <AppShell constrained workshopName={workshop?.name} pageTitle="Yeni Parça">
      <PartForm suppliers={suppliers} workshopBrands={workshopBrands} />
    </AppShell>
  )
}
```

- [ ] **Step 8: `/parts/[id]/edit` sayfasını güncelle**

`src/app/(app)/parts/[id]/edit/page.tsx` içinde `part` sorgusuna satırları ekle ve prop olarak geçir:

```tsx
  const part = await prisma.partStockItem.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      supplierPrices: {
        orderBy: [{ isPreferred: "desc" }, { purchasePrice: "asc" }],
      },
    },
  })

  if (!part) notFound()

  const [suppliers, workshopBrands] = await Promise.all([
    getActiveSuppliersForSelect(user.workshopId),
    getWorkshopBrands(user.workshopId),
  ])

  const supplierPrices = part.supplierPrices.map((p) => ({
    supplierId: p.supplierId,
    purchasePrice: kurusToLira(p.purchasePrice),
    supplierSku: p.supplierSku ?? "",
    isPreferred: p.isPreferred,
  }))
```

`serialized` nesnesinden `supplierPrices` ilişkisini **çıkar** (client'a ham Prisma satırlarını Date alanlarıyla geçirmeye gerek yok):

```tsx
  const { supplierPrices: _rawPrices, ...partFields } = part
  const serialized = {
    ...partFields,
    createdAt: part.createdAt.toISOString(),
    updatedAt: part.updatedAt.toISOString(),
  }
```

Importlara ekle: `import { getWorkshopBrands } from "@/lib/parts/queries"` ve `import { kurusToLira } from "@/lib/money"`.

`PartForm` çağrısını güncelle:

```tsx
      <PartForm part={serialized as any} suppliers={suppliers} workshopBrands={workshopBrands} supplierPrices={supplierPrices} />
```

**Not:** Satırdaki tedarikçi pasifleştirilmişse `getActiveSuppliersForSelect` onu döndürmez ve select boş görünür. Bunu önlemek için `suppliers` listesine, satırlarda geçen ama listede olmayan tedarikçileri ekle:

```tsx
  const missingIds = supplierPrices.map((p) => p.supplierId).filter((sid) => !suppliers.some((s) => s.id === sid))
  const extraSuppliers = missingIds.length
    ? await prisma.supplier.findMany({
        where: { workshopId: user.workshopId, id: { in: missingIds } },
        select: { id: true, name: true, phone: true },
      })
    : []
  const supplierOptions = [...suppliers, ...extraSuppliers].sort((a, b) => a.name.localeCompare(b.name, "tr"))
```

ve `PartForm`'a `suppliers={supplierOptions}` geçir.

- [ ] **Step 9: Lint, tip, test**

Run: `bun run lint && bun run typecheck && bun test`
Expected: üçü de temiz geçer.

- [ ] **Step 10: Commit**

```bash
git add src/components/parts/part-form.tsx src/app/\(app\)/parts/new/page.tsx src/app/\(app\)/parts/\[id\]/edit/page.tsx
git commit -m "feat(parts): form — zorunlu SKU, serbest marka, tedarikçi bazlı alış fiyatları"
```

---

### Task 8: Parça detayı ve tedarikçi detayı görünümleri

**Files:**
- Modify: `src/app/(app)/parts/[id]/page.tsx`
- Modify: `src/components/parts/part-detail.tsx:180-205`
- Modify: `src/app/(app)/suppliers/[id]/page.tsx`
- Modify: `src/components/suppliers/supplier-detail.tsx:15-29` (tip), `:157-183` (parça listesi)

**Interfaces:**
- Consumes: `prisma.partSupplierPrice` (Task 1)
- Produces: kullanıcıya görünen fiyat tabloları; başka task bunlara dayanmaz.

- [ ] **Step 1: Parça detay sayfasında satırları çek**

`src/app/(app)/parts/[id]/page.tsx` içindeki `include` bloğuna ekle:

```tsx
      supplierPrices: {
        include: { supplier: { select: { id: true, name: true, phone: true } } },
        orderBy: [{ isPreferred: "desc" }, { purchasePrice: "asc" }],
      },
```

`serialized` nesnesine ekle:

```tsx
    supplierPrices: part.supplierPrices.map((p) => ({
      id: p.id,
      supplierId: p.supplierId,
      supplierName: p.supplier.name,
      purchasePrice: p.purchasePrice,
      currency: p.currency,
      supplierSku: p.supplierSku,
      isPreferred: p.isPreferred,
    })),
```

- [ ] **Step 2: Parça detayında fiyat tablosunu göster**

`src/components/parts/part-detail.tsx` içinde `PartType` tipine ekle:

```ts
  supplierPrices: {
    id: string
    supplierId: string
    supplierName: string
    purchasePrice: number
    currency: string
    supplierSku: string | null
    isPreferred: boolean
  }[]
```

"Fiyat Bilgileri" kartındaki `Alış Fiyatı` satırını şununla değiştir:

```tsx
              <PriceRow
                label="Alış Fiyatı (varsayılan)"
                value={part.purchasePrice != null ? formatPrice(part.purchasePrice, part.currency) : "—"}
              />
```

"Tedarikçi Bilgisi" kartının `CardContent`'inin **en üstüne** ekle:

```tsx
              {part.supplierPrices.length > 0 ? (
                <div className="space-y-1.5">
                  {part.supplierPrices.map((sp) => (
                    <Link key={sp.id} href={`/suppliers/${sp.supplierId}`}>
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted text-sm hover:bg-muted/70 transition-colors">
                        <div className="min-w-0">
                          <span className="font-medium text-foreground truncate block">{sp.supplierName}</span>
                          {sp.supplierSku && (
                            <span className="text-[10px] font-mono text-muted-foreground">{sp.supplierSku}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {sp.isPreferred && <span className="text-[10px] font-medium text-primary">Varsayılan</span>}
                          <span className="font-semibold text-foreground">{formatPrice(sp.purchasePrice, sp.currency)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Tedarikçi fiyatı girilmemiş.</p>
              )}
```

Mevcut `part.supplier ? (...)` bloğunu **koru** ama yalnız satır yoksa göster: dış koşulu `{part.supplierPrices.length === 0 && part.supplier ? (` biçimine getir; legacy `supplierName` metni de bu koşulun altında kalsın.

- [ ] **Step 3: Tedarikçi detayında alış fiyatı kolonu**

`src/app/(app)/suppliers/[id]/page.tsx` içinde `criticalParts` çağrısının ardına ekle:

```tsx
  const partPrices = await prisma.partSupplierPrice.findMany({
    where: { workshopId: user.workshopId, supplierId: id },
    select: { partId: true, purchasePrice: true, currency: true },
  })
  const priceByPartId = Object.fromEntries(
    partPrices.map((p) => [p.partId, { purchasePrice: p.purchasePrice, currency: p.currency }])
  )
```

`prisma` importunu ekle (`import { prisma } from "@/lib/db"`), `SupplierDetail`'e prop geçir:

```tsx
      <SupplierDetail supplier={serialized as any} criticalParts={criticalParts} priceByPartId={priceByPartId} />
```

`src/components/suppliers/supplier-detail.tsx` imzasını genişlet:

```tsx
export function SupplierDetail({
  supplier,
  criticalParts,
  priceByPartId = {},
}: {
  supplier: SupplierType
  criticalParts: CriticalSupplierPart[]
  priceByPartId?: Record<string, { purchasePrice: number; currency: string }>
}) {
```

"İlişkili Parçalar" listesinde, `salePrice` gösteren `<span>`'in **üstüne** ekle:

```tsx
                          {priceByPartId[p.id] && (
                            <span className="text-xs font-semibold text-foreground w-20 text-right">
                              {formatPrice(priceByPartId[p.id].purchasePrice, priceByPartId[p.id].currency)}
                            </span>
                          )}
```

- [ ] **Step 4: Lint, tip, test**

Run: `bun run lint && bun run typecheck && bun test`
Expected: hepsi temiz.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/parts/\[id\]/page.tsx src/components/parts/part-detail.tsx src/app/\(app\)/suppliers/\[id\]/page.tsx src/components/suppliers/supplier-detail.tsx
git commit -m "feat(parts): parça ve tedarikçi detayında tedarikçi bazlı alış fiyatları"
```

---

### Task 9: Doğrulama turu ve manuel QA

**Files:** yok (yalnız çalıştırma ve doğrulama)

**Interfaces:**
- Consumes: Task 1-8 çıktısının tamamı
- Produces: yok

- [ ] **Step 1: Tam kontrol setini çalıştır**

Run: `bun install --frozen-lockfile && bun run lint && bun run typecheck && bun test && bun run build`
Expected: dördü de hatasız. Build uyarıları mevcut baseline'ın ötesine geçmemeli.

- [ ] **Step 2: Migration'ı AWS dev'e uygula**

Bir terminalde: `bun run db:tunnel` (açık bırak)
Diğerinde: `bun run db:deploy`
Expected: `1 migration applied`. Ardından backfill'i doğrula:

```bash
bunx prisma db execute --url "$DATABASE_URL" --stdin <<'SQL'
SELECT count(*) FROM "PartSupplierPrice";
SQL
```
Expected: hata yok. Dev DB'de tedarikçili+fiyatlı parça varsa sayım > 0.

- [ ] **Step 3: Manuel QA (`bun run dev`, http://localhost:3000)**

Her maddeyi tek tek doğrula:

1. `/parts/new` → SKU boş bırak, kaydet → **"Parça kodu zorunludur"** hatası; kayıt oluşmaz.
2. Marka alanına listede olmayan bir değer yaz (ör. "Testmarka"), kaydet → parça detayında marka **"Testmarka"** görünür.
3. İki tedarikçi satırı ekle, farklı fiyat gir, ikinciyi varsayılan yap, kaydet → parça detayında "Alış Fiyatı (varsayılan)" ikinci satırın fiyatını gösterir; tedarikçi listesinde iki satır görünür.
4. Satırdaki select'ten **"+ Yeni tedarikçi oluştur"** → ad gir → oluştur → satıra seçilir; `/suppliers` listesinde cari görünür.
5. Aynı tedarikçiyi ikinci satıra seçmeye çalış → listede görünmez (kullanılmış tedarikçi filtrelenir).
6. Backfill kontrolü: daha önce tedarikçisi + alış fiyatı olan bir parçayı düzenle → satır önceden dolu gelir.
7. Tüm satırları sil, kaydet → parça detayında "Tedarikçi fiyatı girilmemiş." ve alış fiyatı "—".
8. `/reports/parts` ve `/analytics` (Operasyonel Analiz) → stok değeri değişiklikten önceki değerle tutarlı (varsayılan satır fiyatı eski `purchasePrice` ile aynı olduğu sürece).
9. `/suppliers/[id]` → İlişkili Parçalar listesinde alış fiyatı kolonu görünür.
10. Mobil (375 px, DevTools) → tedarikçi satırları kart olarak alt alta, yatay kaydırma yok, butonlar erişilebilir.
11. Farklı atölye kullanıcısıyla (varsa) başka atölyenin tedarikçi id'si gönderilmiş bir istek → "Geçersiz tedarikçi" (server action üzerinden test edilebiliyorsa).

- [ ] **Step 4: QA sonucunu raporla**

Geçen/kalan maddeleri açıkça bildir. Kalan varsa düzelt ve Step 1'den itibaren tekrarla.

- [ ] **Step 5: Dal ve PR**

```bash
git log --oneline origin/dev..HEAD
git push -u origin HEAD
gh pr create --base dev --title "feat(parts): tedarikçi bazlı alış fiyatları + zorunlu parça kodu" --body "$(cat <<'EOF'
## Ne değişti
- Parça formunda **Parça Kodu (SKU) zorunlu** oldu.
- Marka alanı serbest girişli Autocomplete'e çevrildi; öneriler = atölyenin markaları + TecDoc markaları.
- Tek "Alış Fiyatı" alanı kaldırıldı; yerine **tedarikçi bazlı alış fiyatı** satırları geldi (`PartSupplierPrice`).
- Form içinden **hızlı tedarikçi carisi** oluşturulabiliyor.
- Parça ve tedarikçi detay ekranlarında tedarikçi bazlı fiyatlar görünüyor.

## Şema
Yeni tablo `PartSupplierPrice` + geri alınabilir backfill (mevcut tedarikçi/fiyat çifti olan parçalar için varsayılan satır). Mevcut kolon silinmedi; `PartStockItem.purchasePrice` ve `supplierId` artık varsayılan satırdan türetiliyor — analitik/rapor akışları değişmedi.

## Risk alanları
- SKU'su boş eski kayıtlar düzenlenirken kod girmek zorunlu.
- Tüm tedarikçi satırları silinirse parçanın alış fiyatı null olur (stok değerinde 0 sayılır).

## Manuel QA
Plandaki 11 maddelik QA listesi çalıştırıldı.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notları

- **Spec kapsamı:** zorunlu SKU (Task 3, 7) · serbest marka (Task 4 sorgusu, Task 7 Autocomplete) · `PartSupplierPrice` tablosu + backfill (Task 1) · türetilmiş `purchasePrice`/`supplierId` (Task 2, 4) · çoklu tedarikçi satır UI + hızlı cari (Task 5, 6, 7) · tenant izolasyonu (Task 4) · toplu yazma, satır-başına upsert yok (Task 4) · parça/tedarikçi detayları (Task 8) · unit test + manuel QA (Task 2, 3, 9). Kapsam dışı bırakılanlar (fiyat geçmişi, SKU benzersizliği, toplu içe aktarma) spec'te de kapsam dışı.
- **Para birimi:** spec "varsayılan satırın currency'si parçaya yazılır" diyordu; satırlar parçanın para birimini paylaştığı için `derivePartPricing` currency döndürmez, `currency` formdaki değerden yazılır — sonuç aynı.
- **Legacy alanlar:** `supplierName`/`supplierPhone` update'te **yazılmaz** (eski kayıtların verisi korunur), create'te `null` geçilir.
