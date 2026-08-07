# İşçilik Kataloğu Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atölyenin kendi işçilik fiyat listesini Stok / Parçalar ekranından tanımlayabilmesi ve bu listenin iş emri ile teklif ekranlarında öneri olarak çıkması.

**Architecture:** Yeni `LaborCatalogItem` tablosu atölye başına işçilik tanımlarını tutar. `/parts?tab=labor` sekmesi listeyi yönetir. Kod içine gömülü 24 kalemlik mock katalog, yalnız "hazır listeden içe aktarma" için kullanılan bir preset dosyasına indirgenir. Tüketiciler (iş emri grid'i, teklif formu) listeyi sunucudan prop olarak alır; yeni API endpoint'i yoktur.

**Tech Stack:** Next.js 16 (App Router, server components + server actions), Prisma + PostgreSQL, TypeScript (strict), zod/v4, Base UI tabanlı `src/components/ui/*` (ShadcnUI kurulumu), Tailwind, `bun test`.

**Spec:** `docs/superpowers/specs/2026-07-31-iscilik-katalogu-design.md`

## Global Constraints

- Tüm kullanıcı-görünür metinler Türkçe.
- Para birimi her yerde **tamsayı kuruş**. Form TL alır, `liraToKurus`/`kurusToLira` (`src/lib/money.ts`) ile çevrilir. Yeni yuvarlama mantığı yazılmaz.
- Kiracı izolasyonu: her server action `requireWritableWorkshop()` ile `workshopId`'yi oturumdan türetir; istemciden gelen workshop tanımlayıcısına asla güvenilmez. Her okuma/güncelleme `findFirst({ where: { id, workshopId } })` ile kapılanır.
- Yalnız mevcut `src/components/ui/*` bileşenleri kullanılır; yeni özel UI bileşeni yazılmaz.
- Form/kontrol yüksekliği web'de `h-9`. Yeni `fixed`/`sticky` alt CTA barı EKLENMEZ.
- Mobil-öncelikli: `md+` tablo, altında kart listesi.
- TypeScript strict; gerekçesiz `any` yok.
- `.env`, secret, deployment config dosyalarına dokunulmaz.
- Yeni yazma işlemleri `AuditLogAction(workshopId, userId, entityType, entityId, action)` ile loglanır.

---

### Task 1: Prisma modeli ve migration

**Files:**
- Modify: `prisma/schema.prisma` (yeni model + `Workshop` ters ilişkisi)
- Create: `prisma/migrations/<timestamp>_add_labor_catalog_item/migration.sql` (Prisma üretir)

**Interfaces:**
- Consumes: —
- Produces: `prisma.laborCatalogItem` istemcisi; alanlar `id, workshopId, code, name, category, defaultPriceKurus, description, isActive, createdAt, updatedAt`.

**DİKKAT — paylaşılan DB:** `bun run db:migrate` yerel throwaway Postgres'e karşı çalışır (OrbStack). Bu iş izole bir worktree'de yürütülüyorsa o worktree'nin kendi DB'si olmalıdır; paylaşılan AWS dev DB'sine karşı `migrate dev` **asla** çalıştırılmaz.

- [ ] **Step 1: Modeli şemaya ekle**

`prisma/schema.prisma` içinde `StockMovement` modelinden hemen sonra:

```prisma
model LaborCatalogItem {
  id                String   @id @default(cuid())
  workshopId        String
  workshop          Workshop @relation(fields: [workshopId], references: [id])
  code              String?
  name              String
  category          String?
  defaultPriceKurus Int? // kuruş
  description       String?
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([workshopId, code])
  @@index([workshopId, isActive])
  @@index([workshopId, name])
}
```

- [ ] **Step 2: Workshop modeline ters ilişkiyi ekle**

`model Workshop { ... }` içinde, diğer ilişki listelerinin (`partStockItems` benzeri) yanına:

```prisma
  laborCatalogItems LaborCatalogItem[]
```

- [ ] **Step 3: Şemayı doğrula**

Run: `bun run db:validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Migration'ı üret ve yerelde uygula**

Run: `bun run db:migrate --name add_labor_catalog_item`
Expected: yeni `prisma/migrations/<timestamp>_add_labor_catalog_item/` klasörü; çıktıda "Your database is now in sync with your schema."

- [ ] **Step 5: Üretilen SQL'i gözden geçir**

`migration.sql` içinde tek `CREATE TABLE "LaborCatalogItem"`, bir `CREATE UNIQUE INDEX` (workshopId, code) ve iki `CREATE INDEX` olmalı. `DROP` veya `ALTER ... DROP COLUMN` ifadesi **olmamalı** — varsa dur, drift vardır.

- [ ] **Step 6: Prisma istemcisini üret ve tip kontrolü**

Run: `bun run db:generate && bun run typecheck`
Expected: hata yok

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(labor): LaborCatalogItem modeli ve migration"
```

---

### Task 2: Türkçe-duyarlı arama yardımcısı

**Files:**
- Create: `src/lib/labor/types.ts`
- Create: `src/lib/labor/search.ts`
- Test: `src/lib/labor/search.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `type LaborCatalogRow = { id: string; code: string | null; name: string; category: string | null; defaultPriceKurus: number | null; description: string | null; isActive: boolean }`
  - `type LaborKPIs = { total: number; active: number; inactive: number }`
  - `function foldTr(s: string): string`
  - `function searchLaborItems<T extends { name: string; code?: string | null; category?: string | null }>(items: readonly T[], query: string): T[]`

`foldTr` gövdesi, silinecek `src/lib/labor/mock-labor-catalog.ts` içindeki `fold` fonksiyonunun aynısıdır; davranış korunur.

- [ ] **Step 1: Tip dosyasını yaz**

`src/lib/labor/types.ts`:

```ts
/** İstemci bileşenlerinin taşıdığı işçilik tanımı satırı (Prisma modelinin serileştirilmiş hâli). */
export type LaborCatalogRow = {
  id: string
  code: string | null
  name: string
  category: string | null
  /** Önerilen birim ücret, KURUŞ (money.ts kontratı). */
  defaultPriceKurus: number | null
  description: string | null
  isActive: boolean
}

export type LaborKPIs = {
  total: number
  active: number
  inactive: number
}
```

- [ ] **Step 2: Başarısız testi yaz**

`src/lib/labor/search.test.ts`:

```ts
import { expect, test } from "bun:test"
import { foldTr, searchLaborItems } from "@/lib/labor/search"

const ITEMS = [
  { id: "1", code: "ISC-001", name: "Motor yağı ve filtre değişimi", category: "Bakım" },
  { id: "2", code: null, name: "Ön fren balatası değişimi", category: "Fren" },
  { id: "3", code: "ISC-009", name: "Rot balans ayarı", category: "Lastik / Balans" },
]

test("foldTr Türkçe diakritikleri sadeleştirir", () => {
  expect(foldTr("Değişim")).toBe("degisim")
  expect(foldTr("İŞÇİLİK")).toBe("iscilik")
})

test("aksansız yazım eşleşir", () => {
  const res = searchLaborItems(ITEMS, "degisim")
  expect(res.map((i) => i.id)).toEqual(["1", "2"])
})

test("kategori üzerinden eşleşir", () => {
  expect(searchLaborItems(ITEMS, "fren").map((i) => i.id)).toEqual(["2"])
})

test("koda göre eşleşir", () => {
  expect(searchLaborItems(ITEMS, "isc-009").map((i) => i.id)).toEqual(["3"])
})

test("boş sorgu tüm listeyi döndürür", () => {
  expect(searchLaborItems(ITEMS, "   ")).toHaveLength(3)
})

test("eşleşme yoksa boş dizi döner", () => {
  expect(searchLaborItems(ITEMS, "klima")).toEqual([])
})
```

- [ ] **Step 3: Testi çalıştır, başarısız olduğunu gör**

Run: `bun test src/lib/labor/search.test.ts`
Expected: FAIL — "Cannot find module '@/lib/labor/search'"

- [ ] **Step 4: Uygulamayı yaz**

`src/lib/labor/search.ts`:

```ts
/**
 * İşçilik kataloğu araması — Türkçe-duyarlı, aksansız, büyük/küçük harf duyarsız.
 * Liste sayfası, iş emri composer'ı ve teklif formu aynı fonksiyonu kullanır ki
 * "değişim" yazan da "degisim" yazan da aynı sonucu görsün.
 */

/** Küçült + yaygın TR diakritiklerini sadeleştir. */
export function foldTr(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("İ", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
}

/** Ad, kod ve kategoride alt-dize filtresi. Boş/whitespace sorgu → tüm liste. */
export function searchLaborItems<T extends { name: string; code?: string | null; category?: string | null }>(
  items: readonly T[],
  query: string
): T[] {
  const q = foldTr(query.trim())
  if (!q) return [...items]
  return items.filter((i) => foldTr(`${i.name} ${i.code ?? ""} ${i.category ?? ""}`).includes(q))
}
```

- [ ] **Step 5: Testi çalıştır, geçtiğini gör**

Run: `bun test src/lib/labor/search.test.ts`
Expected: PASS (6 test)

- [ ] **Step 6: Commit**

```bash
git add src/lib/labor/types.ts src/lib/labor/search.ts src/lib/labor/search.test.ts
git commit -m "feat(labor): Türkçe-duyarlı işçilik arama yardımcısı"
```

---

### Task 3: Hazır işçilik preset listesi ve yineleme ayıklama

**Files:**
- Create: `src/lib/labor/presets.ts`
- Test: `src/lib/labor/presets.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `type LaborPreset = { name: string; category: string; defaultPriceKurus: number }`
  - `const LABOR_PRESETS: readonly LaborPreset[]` (24 kalem)
  - `function pickNewPresets(presets: readonly LaborPreset[], existingNames: readonly string[]): LaborPreset[]`

`pickNewPresets` **ada göre** ayıklar; karşılaştırma `foldTr(trim())` ile yapılır ki "Buji Değişimi" ile "buji degisimi " aynı sayılsın.

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/labor/presets.test.ts`:

```ts
import { expect, test } from "bun:test"
import { LABOR_PRESETS, pickNewPresets } from "@/lib/labor/presets"

test("preset listesi 24 kalem ve hepsi kuruş tamsayı", () => {
  expect(LABOR_PRESETS).toHaveLength(24)
  for (const p of LABOR_PRESETS) {
    expect(Number.isInteger(p.defaultPriceKurus)).toBe(true)
    expect(p.defaultPriceKurus).toBeGreaterThan(0)
    expect(p.name.trim()).toBe(p.name)
  }
})

test("preset adları kendi içinde tekil", () => {
  const names = new Set(LABOR_PRESETS.map((p) => p.name))
  expect(names.size).toBe(LABOR_PRESETS.length)
})

test("mevcut olmayan tüm presetleri döndürür", () => {
  expect(pickNewPresets(LABOR_PRESETS, [])).toHaveLength(24)
})

test("mevcut adları atlar", () => {
  const res = pickNewPresets(LABOR_PRESETS, ["Buji değişimi"])
  expect(res).toHaveLength(23)
  expect(res.some((p) => p.name === "Buji değişimi")).toBe(false)
})

test("büyük/küçük harf ve boşluk farkına toleranslı", () => {
  const res = pickNewPresets(LABOR_PRESETS, ["  BUJİ DEĞİŞİMİ  "])
  expect(res).toHaveLength(23)
})

test("hepsi mevcutsa boş dizi döner", () => {
  const res = pickNewPresets(LABOR_PRESETS, LABOR_PRESETS.map((p) => p.name))
  expect(res).toEqual([])
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `bun test src/lib/labor/presets.test.ts`
Expected: FAIL — "Cannot find module '@/lib/labor/presets'"

- [ ] **Step 3: Uygulamayı yaz**

`src/lib/labor/presets.ts` — kalemler `src/lib/labor/mock-labor-catalog.ts` içindeki listeden birebir taşınır (id alanı düşer, sıra korunur):

```ts
/**
 * Hazır işçilik önerileri — BakımX.
 *
 * Bu liste ARTIK RUNTIME KATALOĞU DEĞİLDİR. Yalnız Stok / İşçilikler ekranındaki
 * "Hazır listeden ekle" modalını besler: atölye bu kalemleri kendi kataloğuna
 * kopyalar, sonra fiyatlarını kendine göre düzenler. İş emri ve teklif önerileri
 * her zaman atölyenin KENDİ LaborCatalogItem kayıtlarından gelir.
 *
 * Fiyatlar KURUŞ (money.ts kontratı) ve yalnızca başlangıç önerisidir.
 */

import { foldTr } from "@/lib/labor/search"

export type LaborPreset = {
  name: string
  category: string
  defaultPriceKurus: number
}

// TL cinsinden yazılıp kuruşa çevrilen sabit liste (okunurluk için).
const L = (lira: number) => lira * 100

export const LABOR_PRESETS: readonly LaborPreset[] = [
  // Bakım
  { name: "Motor yağı ve filtre değişimi", category: "Bakım", defaultPriceKurus: L(350) },
  { name: "Periyodik bakım işçiliği", category: "Bakım", defaultPriceKurus: L(750) },
  { name: "Hava filtresi değişimi", category: "Bakım", defaultPriceKurus: L(150) },
  { name: "Polen filtresi değişimi", category: "Bakım", defaultPriceKurus: L(200) },
  { name: "Yakıt filtresi değişimi", category: "Bakım", defaultPriceKurus: L(300) },
  // Fren
  { name: "Ön fren balatası değişimi", category: "Fren", defaultPriceKurus: L(400) },
  { name: "Arka fren balatası değişimi", category: "Fren", defaultPriceKurus: L(450) },
  { name: "Fren diski değişimi", category: "Fren", defaultPriceKurus: L(500) },
  { name: "Fren hidroliği değişimi ve hava alma", category: "Fren", defaultPriceKurus: L(350) },
  // Motor
  { name: "Triger seti değişimi", category: "Motor", defaultPriceKurus: L(2500) },
  { name: "Devirdaim (su pompası) değişimi", category: "Motor", defaultPriceKurus: L(900) },
  { name: "Buji değişimi", category: "Motor", defaultPriceKurus: L(350) },
  { name: "Enjektör temizliği", category: "Motor", defaultPriceKurus: L(600) },
  { name: "V kayışı / gergi rulmanı değişimi", category: "Motor", defaultPriceKurus: L(450) },
  // Elektrik
  { name: "Akü değişimi ve kontrolü", category: "Elektrik", defaultPriceKurus: L(150) },
  { name: "Alternatör / marş sökme takma", category: "Elektrik", defaultPriceKurus: L(700) },
  { name: "Far ayarı ve ampul değişimi", category: "Elektrik", defaultPriceKurus: L(200) },
  // Teşhis
  { name: "Motor arıza tespiti (diagnostik)", category: "Teşhis", defaultPriceKurus: L(400) },
  { name: "Yol testi ve genel kontrol", category: "Teşhis", defaultPriceKurus: L(250) },
  // Lastik / Balans
  { name: "Lastik sökme takma (4 adet)", category: "Lastik / Balans", defaultPriceKurus: L(300) },
  { name: "Rot balans ayarı", category: "Lastik / Balans", defaultPriceKurus: L(350) },
  { name: "Ön düzen (rot) ayarı", category: "Lastik / Balans", defaultPriceKurus: L(400) },
  // Kaporta / Boya
  { name: "Panel boyama işçiliği", category: "Kaporta / Boya", defaultPriceKurus: L(1500) },
  { name: "Göçük düzeltme (boyasız)", category: "Kaporta / Boya", defaultPriceKurus: L(800) },
]

/**
 * Atölyede zaten bulunan adları eleyip eklenecek presetleri döndürür.
 * Karşılaştırma aksansız + boşluk/harf duyarsızdır: iki kez içe aktarmak
 * listeyi ikiye katlamaz.
 */
export function pickNewPresets(
  presets: readonly LaborPreset[],
  existingNames: readonly string[]
): LaborPreset[] {
  const existing = new Set(existingNames.map((n) => foldTr(n.trim())))
  return presets.filter((p) => !existing.has(foldTr(p.name.trim())))
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `bun test src/lib/labor/presets.test.ts`
Expected: PASS (6 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/labor/presets.ts src/lib/labor/presets.test.ts
git commit -m "feat(labor): hazır işçilik presetleri ve yineleme ayıklama"
```

---

### Task 4: Doğrulama şeması ve sunucu sorguları

**Files:**
- Create: `src/lib/validations/labor.ts`
- Create: `src/lib/labor/queries.ts`
- Test: `src/lib/validations/labor.test.ts`

**Interfaces:**
- Consumes: `LaborCatalogRow`, `LaborKPIs` (Task 2)
- Produces:
  - `const laborItemSchema` — zod şeması
  - `type LaborItemInput = { code?: string; name: string; category?: string; defaultPriceKurus?: number | null; description?: string; isActive?: boolean }`
  - `async function getLaborCatalog(workshopId: string, opts?: { activeOnly?: boolean }): Promise<LaborCatalogRow[]>`
  - `async function getLaborKPIs(workshopId: string): Promise<LaborKPIs>`
  - `async function getLaborCategories(workshopId: string): Promise<string[]>`

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/validations/labor.test.ts`:

```ts
import { expect, test } from "bun:test"
import { laborItemSchema } from "@/lib/validations/labor"

test("geçerli girdi kabul edilir", () => {
  const res = laborItemSchema.safeParse({ name: "Buji değişimi", defaultPriceKurus: 35000 })
  expect(res.success).toBe(true)
})

test("ad zorunludur", () => {
  const res = laborItemSchema.safeParse({ name: "   " })
  expect(res.success).toBe(false)
})

test("ad 120 karakteri aşamaz", () => {
  const res = laborItemSchema.safeParse({ name: "a".repeat(121) })
  expect(res.success).toBe(false)
})

test("kod 32 karakteri aşamaz", () => {
  const res = laborItemSchema.safeParse({ name: "Test", code: "a".repeat(33) })
  expect(res.success).toBe(false)
})

test("negatif fiyat reddedilir", () => {
  const res = laborItemSchema.safeParse({ name: "Test", defaultPriceKurus: -1 })
  expect(res.success).toBe(false)
})

test("ondalık kuruş reddedilir", () => {
  const res = laborItemSchema.safeParse({ name: "Test", defaultPriceKurus: 100.5 })
  expect(res.success).toBe(false)
})

test("ad baş/son boşluklardan arındırılır", () => {
  const res = laborItemSchema.parse({ name: "  Buji değişimi  " })
  expect(res.name).toBe("Buji değişimi")
})

test("isActive varsayılanı true", () => {
  const res = laborItemSchema.parse({ name: "Test" })
  expect(res.isActive).toBe(true)
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `bun test src/lib/validations/labor.test.ts`
Expected: FAIL — "Cannot find module '@/lib/validations/labor'"

- [ ] **Step 3: Şemayı yaz**

`src/lib/validations/labor.ts`:

```ts
import { z } from "zod/v4"

export const laborItemSchema = z.object({
  code: z.string().trim().max(32, "İşçilik kodu en fazla 32 karakter olabilir").optional(),
  name: z.string().trim().min(1, "İşçilik adı zorunludur").max(120, "İşçilik adı en fazla 120 karakter olabilir"),
  category: z.string().trim().max(60, "Kategori en fazla 60 karakter olabilir").optional(),
  // kuruş — form TL alır, istemci liraToKurus ile çevirip gönderir.
  defaultPriceKurus: z
    .number()
    .int("Ücret kuruş (tam sayı) olmalıdır")
    .min(0, "Ücret negatif olamaz")
    .nullable()
    .optional(),
  description: z.string().trim().max(500, "Açıklama en fazla 500 karakter olabilir").optional(),
  isActive: z.boolean().default(true),
})

export type LaborItemInput = z.infer<typeof laborItemSchema>
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `bun test src/lib/validations/labor.test.ts`
Expected: PASS (8 test)

- [ ] **Step 5: Sorguları yaz**

`src/lib/labor/queries.ts`:

```ts
import { prisma } from "@/lib/db"
import type { LaborCatalogRow, LaborKPIs } from "@/lib/labor/types"

const ROW_SELECT = {
  id: true,
  code: true,
  name: true,
  category: true,
  defaultPriceKurus: true,
  description: true,
  isActive: true,
} as const

/**
 * Atölyenin işçilik tanımları, ada göre sıralı.
 * `activeOnly` iş emri/teklif önerileri için kullanılır: pasif kalemler önerilmez.
 */
export async function getLaborCatalog(
  workshopId: string,
  opts?: { activeOnly?: boolean }
): Promise<LaborCatalogRow[]> {
  return prisma.laborCatalogItem.findMany({
    where: { workshopId, ...(opts?.activeOnly ? { isActive: true } : {}) },
    select: ROW_SELECT,
    orderBy: { name: "asc" },
  })
}

export async function getLaborKPIs(workshopId: string): Promise<LaborKPIs> {
  const [total, active] = await Promise.all([
    prisma.laborCatalogItem.count({ where: { workshopId } }),
    prisma.laborCatalogItem.count({ where: { workshopId, isActive: true } }),
  ])
  return { total, active, inactive: total - active }
}

/** Modal'daki kategori Autocomplete'ini besler: atölyenin kullandığı kategoriler. */
export async function getLaborCategories(workshopId: string): Promise<string[]> {
  const rows = await prisma.laborCatalogItem.findMany({
    where: { workshopId, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  })
  return rows.map((r) => r.category).filter((c): c is string => !!c)
}
```

- [ ] **Step 6: Tip kontrolü**

Run: `bun run typecheck`
Expected: hata yok

- [ ] **Step 7: Commit**

```bash
git add src/lib/validations/labor.ts src/lib/validations/labor.test.ts src/lib/labor/queries.ts
git commit -m "feat(labor): doğrulama şeması ve sunucu sorguları"
```

---

### Task 5: Server action'lar

**Files:**
- Create: `src/app/(app)/parts/labor-actions.ts`

**Interfaces:**
- Consumes: `laborItemSchema` (Task 4), `LABOR_PRESETS`/`pickNewPresets` (Task 3)
- Produces:
  - `createLaborItemAction(input: unknown): Promise<{ success: true; id: string } | { error: string }>`
  - `updateLaborItemAction(id: string, input: unknown): Promise<{ success: true } | { error: string }>`
  - `deactivateLaborItemAction(id: string): Promise<{ success: true } | { error: string }>`
  - `deleteLaborItemAction(id: string): Promise<{ success: true } | { error: string }>`
  - `importLaborPresetsAction(names: string[]): Promise<{ success: true; added: number; skipped: number } | { error: string }>`

`getValidationError` (`src/lib/validations/shared.ts`) ve `AuditLogAction` (`src/lib/audit.ts`) mevcut parça action'larındaki gibi kullanılır.

- [ ] **Step 1: Action dosyasını yaz**

`src/app/(app)/parts/labor-actions.ts`:

```ts
"use server"

import { prisma } from "@/lib/db"
import { requireWritableWorkshop } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { laborItemSchema } from "@/lib/validations/labor"
import { getValidationError } from "@/lib/validations/shared"
import { AuditLogAction } from "@/lib/audit"
import { LABOR_PRESETS, pickNewPresets } from "@/lib/labor/presets"

/** Prisma tekil-kod ihlali (P2002) → kullanıcıya anlaşılır mesaj. */
function isUniqueCodeViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002"
}

const CODE_TAKEN = "Bu işçilik kodu zaten kullanılıyor"

export async function createLaborItemAction(input: unknown) {
  const { user } = await requireWritableWorkshop()
  const workshopId = user.workshopId

  const parsed = laborItemSchema.safeParse(input)
  if (!parsed.success) return { error: getValidationError(parsed) }
  const d = parsed.data

  try {
    const item = await prisma.laborCatalogItem.create({
      data: {
        workshopId,
        code: d.code || null,
        name: d.name,
        category: d.category || null,
        defaultPriceKurus: d.defaultPriceKurus ?? null,
        description: d.description || null,
        isActive: d.isActive,
      },
    })
    await AuditLogAction(workshopId, user.id, "LaborCatalogItem", item.id, "labor_item_created")
    revalidatePath("/parts")
    return { success: true as const, id: item.id }
  } catch (e) {
    if (isUniqueCodeViolation(e)) return { error: CODE_TAKEN }
    throw e
  }
}

export async function updateLaborItemAction(id: string, input: unknown) {
  const { user } = await requireWritableWorkshop()
  const workshopId = user.workshopId

  const existing = await prisma.laborCatalogItem.findFirst({ where: { id, workshopId } })
  if (!existing) return { error: "İşçilik tanımı bulunamadı" }

  const parsed = laborItemSchema.safeParse(input)
  if (!parsed.success) return { error: getValidationError(parsed) }
  const d = parsed.data

  try {
    await prisma.laborCatalogItem.update({
      where: { id },
      data: {
        code: d.code || null,
        name: d.name,
        category: d.category || null,
        defaultPriceKurus: d.defaultPriceKurus ?? null,
        description: d.description || null,
        isActive: d.isActive,
      },
    })
    await AuditLogAction(workshopId, user.id, "LaborCatalogItem", id, "labor_item_updated")
    revalidatePath("/parts")
    return { success: true as const }
  } catch (e) {
    if (isUniqueCodeViolation(e)) return { error: CODE_TAKEN }
    throw e
  }
}

export async function deactivateLaborItemAction(id: string) {
  const { user } = await requireWritableWorkshop()
  const workshopId = user.workshopId

  const existing = await prisma.laborCatalogItem.findFirst({ where: { id, workshopId } })
  if (!existing) return { error: "İşçilik tanımı bulunamadı" }

  await prisma.laborCatalogItem.update({ where: { id }, data: { isActive: false } })
  await AuditLogAction(workshopId, user.id, "LaborCatalogItem", id, "labor_item_deactivated")
  revalidatePath("/parts")
  return { success: true as const }
}

export async function deleteLaborItemAction(id: string) {
  const { user } = await requireWritableWorkshop()
  const workshopId = user.workshopId

  const existing = await prisma.laborCatalogItem.findFirst({ where: { id, workshopId } })
  if (!existing) return { error: "İşçilik tanımı bulunamadı" }

  // Geçmiş iş emri kalemleri ad+fiyat kopyası taşır, FK yoktur → silme güvenli.
  await prisma.laborCatalogItem.delete({ where: { id } })
  await AuditLogAction(workshopId, user.id, "LaborCatalogItem", id, "labor_item_deleted")
  revalidatePath("/parts")
  return { success: true as const }
}

/**
 * Seçilen hazır presetleri atölye kataloğuna kopyalar.
 * Atlanan (zaten var olan) kalem sayısı geri döner — sessiz atlama yoktur.
 */
export async function importLaborPresetsAction(names: string[]) {
  const { user } = await requireWritableWorkshop()
  const workshopId = user.workshopId

  if (!Array.isArray(names) || names.length === 0) return { error: "Hiç kalem seçilmedi" }

  const selected = LABOR_PRESETS.filter((p) => names.includes(p.name))
  if (selected.length === 0) return { error: "Hiç kalem seçilmedi" }

  const existing = await prisma.laborCatalogItem.findMany({
    where: { workshopId },
    select: { name: true },
  })
  const toAdd = pickNewPresets(selected, existing.map((e) => e.name))

  if (toAdd.length > 0) {
    await prisma.laborCatalogItem.createMany({
      data: toAdd.map((p) => ({
        workshopId,
        name: p.name,
        category: p.category,
        defaultPriceKurus: p.defaultPriceKurus,
      })),
    })
    await AuditLogAction(
      workshopId,
      user.id,
      "LaborCatalogItem",
      workshopId,
      "labor_presets_imported",
      JSON.stringify({ added: toAdd.length })
    )
  }

  revalidatePath("/parts")
  return { success: true as const, added: toAdd.length, skipped: selected.length - toAdd.length }
}
```

- [ ] **Step 2: Kiracı izolasyonunu gözden geçir**

Beş action'ın her birinde şunları doğrula: `workshopId` yalnız `requireWritableWorkshop()` sonucundan geliyor; `input`'tan gelen hiçbir alan `workshopId` olarak kullanılmıyor; id ile çalışan her action önce `findFirst({ where: { id, workshopId } })` yapıyor.

- [ ] **Step 3: Tip kontrolü ve lint**

Run: `bun run typecheck && bun run lint`
Expected: hata yok

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/parts/labor-actions.ts"
git commit -m "feat(labor): işçilik tanımı server action'ları"
```

---

### Task 6: İşçilik oluştur/düzenle modalı

**Files:**
- Create: `src/components/labor/labor-item-dialog.tsx`

**Interfaces:**
- Consumes: `LaborCatalogRow` (Task 2), action'lar (Task 5)
- Produces: `<LaborItemDialog open onOpenChange item={LaborCatalogRow | null} categories={string[]} />`
  - `item === null` → oluşturma modu; dolu → düzenleme modu.

Desen kaynağı: `src/components/parts/manual-part-dialog.tsx` (Dialog + InputGroup + `liraToKurus`). Serbest metin + öneri gereken kategori alanı için `Autocomplete` kullanılır — `Combobox` **kullanılmaz** (serbest metin girişinde Enter'da yazılanı geri alıyor).

- [ ] **Step 1: Bileşeni yaz**

`src/components/labor/labor-item-dialog.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput,
  AutocompleteItem, AutocompleteList,
} from "@/components/ui/autocomplete"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { liraToKurus, kurusToLira } from "@/lib/money"
import type { LaborCatalogRow } from "@/lib/labor/types"

export function LaborItemDialog({
  open, onOpenChange, item, categories,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  item: LaborCatalogRow | null
  categories: string[]
}) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [priceDraft, setPriceDraft] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Her açılışta formu düzenlenen kalemden (veya boştan) yeniden doldur.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- açılışta formu sıfırla
    setCode(item?.code ?? "")
    setName(item?.name ?? "")
    setCategory(item?.category ?? "")
    setPriceDraft(item?.defaultPriceKurus != null ? String(kurusToLira(item.defaultPriceKurus)) : "")
    setDescription(item?.description ?? "")
    setIsActive(item?.isActive ?? true)
  }, [open, item])

  const categoryItems = categories.filter((c) =>
    c.toLocaleLowerCase("tr").includes(category.toLocaleLowerCase("tr"))
  )

  async function submit() {
    if (!name.trim() || submitting) return
    setSubmitting(true)

    const lira = Number(priceDraft)
    const defaultPriceKurus =
      priceDraft.trim() && !Number.isNaN(lira) && lira >= 0 ? liraToKurus(lira) : null

    const payload = {
      code: code.trim(),
      name: name.trim(),
      category: category.trim(),
      defaultPriceKurus,
      description: description.trim(),
      isActive,
    }

    const actions = await import("@/app/(app)/parts/labor-actions")
    const res = item
      ? await actions.updateLaborItemAction(item.id, payload)
      : await actions.createLaborItemAction(payload)

    // NOT: sadece `"error" in res` yazılır — `&& res.error` eklemek birleşim
    // tipini erken dönüşten sonra daraltmaz ve başarı dalındaki alanlar derlenmez.
    if ("error" in res) {
      toast.error(res.error)
      setSubmitting(false)
      return
    }

    toast.success(item ? "İşçilik güncellendi" : "İşçilik eklendi")
    onOpenChange(false)
    setSubmitting(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "İşçiliği Düzenle" : "Yeni İşçilik"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_1fr]">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Kod</span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ISC-001"
                className="text-sm"
                maxLength={32}
              />
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">İşçilik adı</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ör. motor yağı ve filtre değişimi"
                className="text-sm"
                maxLength={120}
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Kategori</span>
              <Autocomplete
                items={categoryItems}
                value={category}
                filter={null}
                openOnInputClick
                itemToStringValue={(c: string) => c}
                onValueChange={(v: string) => setCategory(v)}
              >
                <AutocompleteInput
                  render={<Input placeholder="Bakım, Fren, Motor…" className="text-sm" maxLength={60} />}
                />
                <AutocompleteContent>
                  <AutocompleteEmpty>Yeni kategori olarak kaydedilecek</AutocompleteEmpty>
                  <AutocompleteList>
                    {(c: string) => (
                      <AutocompleteItem key={c} value={c} onClick={() => setCategory(c)}>
                        {c}
                      </AutocompleteItem>
                    )}
                  </AutocompleteList>
                </AutocompleteContent>
              </Autocomplete>
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Varsayılan ücret</span>
              <InputGroup className="h-9">
                <InputGroupAddon className="text-muted-foreground">₺</InputGroupAddon>
                <InputGroupInput
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  className="text-sm tabular-nums"
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                />
              </InputGroup>
            </div>
          </div>

          <div className="space-y-1">
            <span className="block text-xs font-medium text-muted-foreground">Açıklama</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="İsteğe bağlı not"
              className="text-sm min-h-16"
              maxLength={500}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Aktif</p>
              <p className="text-xs text-muted-foreground">Pasif kalemler iş emri önerilerinde çıkmaz</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Vazgeç
          </Button>
          <Button type="button" onClick={submit} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {item ? "Kaydet" : "Ekle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Autocomplete ve Switch imzalarını doğrula**

`src/components/ui/autocomplete.tsx` ve `src/components/ui/switch.tsx` dosyalarını aç; kullanılan prop adlarının (`items`, `filter`, `openOnInputClick`, `itemToStringValue`, `onValueChange`, `checked`, `onCheckedChange`) gerçekten dışa verildiğini doğrula. `parts-labor-grid.tsx:417-467` çalışan bir Autocomplete örneğidir — sapma varsa oradaki kullanımı esas al.

- [ ] **Step 3: Tip kontrolü ve lint**

Run: `bun run typecheck && bun run lint`
Expected: hata yok

- [ ] **Step 4: Commit**

```bash
git add src/components/labor/labor-item-dialog.tsx
git commit -m "feat(labor): işçilik oluştur/düzenle modalı"
```

---

### Task 7: Hazır listeden içe aktarma modalı

**Files:**
- Create: `src/components/labor/labor-preset-import-dialog.tsx`

**Interfaces:**
- Consumes: `LABOR_PRESETS` (Task 3), `importLaborPresetsAction` (Task 5)
- Produces: `<LaborPresetImportDialog open onOpenChange />`

- [ ] **Step 1: Bileşeni yaz**

`src/components/labor/labor-preset-import-dialog.tsx`:

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { formatPrice } from "@/lib/parts/format"
import { LABOR_PRESETS } from "@/lib/labor/presets"

export function LaborPresetImportDialog({
  open, onOpenChange,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  // Her açılışta hepsi seçili başlar — en sık kullanım "hepsini ekle".
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- açılışta seçimi sıfırla
    setSelected(new Set(LABOR_PRESETS.map((p) => p.name)))
  }, [open])

  // Kategori başlıklarıyla gruplanmış görünüm (liste sırası korunur).
  const groups = useMemo(() => {
    const map = new Map<string, typeof LABOR_PRESETS[number][]>()
    for (const p of LABOR_PRESETS) {
      const arr = map.get(p.category) ?? []
      arr.push(p)
      map.set(p.category, arr)
    }
    return [...map.entries()]
  }, [])

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const allSelected = selected.size === LABOR_PRESETS.length

  async function submit() {
    if (selected.size === 0 || submitting) return
    setSubmitting(true)

    const { importLaborPresetsAction } = await import("@/app/(app)/parts/labor-actions")
    const res = await importLaborPresetsAction([...selected])

    // NOT: sadece `"error" in res` — bileşik koşul res.added/res.skipped'ı daraltmaz.
    if ("error" in res) {
      toast.error(res.error)
      setSubmitting(false)
      return
    }

    // Atlanan kalem sayısı dürüstçe bildirilir; sessiz atlama yok.
    toast.success(
      res.skipped > 0
        ? `${res.added} kalem eklendi, ${res.skipped} kalem zaten listenizde vardı`
        : `${res.added} kalem eklendi`
    )
    onOpenChange(false)
    setSubmitting(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hazır listeden ekle</DialogTitle>
          <DialogDescription>
            Sık kullanılan işçilikler önerilen fiyatlarıyla listenize kopyalanır. Fiyatları
            sonrasında kendinize göre düzenleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-xs text-muted-foreground">{selected.size} kalem seçili</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(LABOR_PRESETS.map((p) => p.name)))
            }
          >
            {allSelected ? "Seçimi temizle" : "Tümünü seç"}
          </Button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto space-y-3">
          {groups.map(([category, items]) => (
            <div key={category} className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </p>
              {items.map((p) => (
                <label
                  key={p.name}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer"
                >
                  <Checkbox checked={selected.has(p.name)} onCheckedChange={() => toggle(p.name)} />
                  <span className="min-w-0 flex-1 text-sm truncate">{p.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatPrice(p.defaultPriceKurus)}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Vazgeç
          </Button>
          <Button type="button" onClick={submit} disabled={submitting || selected.size === 0}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {selected.size} kalemi ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Checkbox ve DialogDescription varlığını doğrula**

Run: `ls src/components/ui/checkbox.tsx && grep -n "DialogDescription" src/components/ui/dialog.tsx`
Expected: dosya var ve `DialogDescription` dışa veriliyor. Yoksa: `npx shadcn add checkbox` ile ekle (kendi bileşenini yazma), `DialogDescription` yoksa o satırı `<p className="text-sm text-muted-foreground">` ile değiştir.

- [ ] **Step 3: Tip kontrolü ve lint**

Run: `bun run typecheck && bun run lint`
Expected: hata yok

- [ ] **Step 4: Commit**

```bash
git add src/components/labor/labor-preset-import-dialog.tsx
git commit -m "feat(labor): hazır listeden içe aktarma modalı"
```

---

### Task 8: İşçilik listesi ekranı

**Files:**
- Create: `src/components/labor/labor-list.tsx`
- Create: `src/app/(app)/parts/parts-tabs-nav.tsx`

**Interfaces:**
- Consumes: `LaborCatalogRow`/`LaborKPIs` (Task 2), `searchLaborItems` (Task 2), dialoglar (Task 6, 7), `deactivateLaborItemAction`/`deleteLaborItemAction` (Task 5)
- Produces:
  - `<PartsTabsNav active="parts" | "labor" />` — sekme çubuğu, URL'i `router.replace` ile değiştirir
  - `<LaborList items={LaborCatalogRow[]} kpis={LaborKPIs} categories={string[]} currentFilters={{ q: string; status: string }} />`

Sekme çubuğu ayrı bir bileşendir; hem `PartsList` hem `LaborList` kendi başlığının altında onu render eder. Böylece sunucu sayfası yalnız aktif sekmenin verisini çeker.

- [ ] **Step 1: Sekme çubuğunu yaz**

`src/app/(app)/parts/parts-tabs-nav.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Boxes, Wrench } from "lucide-react"

/**
 * Stok ekranının iki sekmesi: Parçalar / İşçilikler.
 * Sekme değişince filtre parametreleri (q, status, category, brand) bilerek
 * DÜŞÜRÜLÜR — parça filtresinin işçilik listesine sızmış gibi görünmesini önler.
 */
export function PartsTabsNav({ active }: { active: "parts" | "labor" }) {
  const router = useRouter()

  function handleChange(key: string | null) {
    if (!key || key === active) return
    router.replace(key === "labor" ? "/parts?tab=labor" : "/parts", { scroll: false })
  }

  return (
    <Tabs value={active} onValueChange={handleChange}>
      <TabsList variant="line" className="flex w-full flex-nowrap gap-1 sm:gap-2 border-b border-border pb-0 -mb-px">
        <TabsTrigger value="parts" className="px-3 py-2.5 shrink-0 flex-none">
          <Boxes className="size-4" /> Parçalar
        </TabsTrigger>
        <TabsTrigger value="labor" className="px-3 py-2.5 shrink-0 flex-none">
          <Wrench className="size-4" /> İşçilikler
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
```

- [ ] **Step 2: Liste bileşenini yaz**

`src/components/labor/labor-list.tsx` — iskelet `src/components/parts/parts-list.tsx` ile aynı (breadcrumb → başlık + birincil buton → sekme çubuğu → KPI'lar → arama kartı → `md+` tablo → mobil kartlar):

```tsx
"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PartsTabsNav } from "@/app/(app)/parts/parts-tabs-nav"
import { LaborItemDialog } from "@/components/labor/labor-item-dialog"
import { LaborPresetImportDialog } from "@/components/labor/labor-preset-import-dialog"
import { searchLaborItems } from "@/lib/labor/search"
import { formatPrice } from "@/lib/parts/format"
import type { LaborCatalogRow, LaborKPIs } from "@/lib/labor/types"
import { Plus, Search, Wrench, Archive, Edit3, Trash2, Sparkles, CheckCircle2 } from "lucide-react"

const STATUS_LABELS: Record<string, string> = { all: "Tümü", active: "Aktif", inactive: "Pasif" }

export function LaborList({
  items, kpis, categories, currentFilters,
}: {
  items: LaborCatalogRow[]
  kpis: LaborKPIs
  categories: string[]
  currentFilters: { q: string; status: string }
}) {
  const router = useRouter()
  const [search, setSearch] = useState(currentFilters.q)
  const [status, setStatus] = useState(currentFilters.status || "all")
  const [editing, setEditing] = useState<LaborCatalogRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<LaborCatalogRow | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Liste küçük (atölye başına onlarca kalem) → filtreleme istemcide, sunucu turu yok.
  const visible = useMemo(() => {
    const byStatus = items.filter((i) =>
      status === "active" ? i.isActive : status === "inactive" ? !i.isActive : true
    )
    return searchLaborItems(byStatus, search)
  }, [items, status, search])

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(item: LaborCatalogRow) {
    setEditing(item)
    setDialogOpen(true)
  }

  async function handleDeactivate(id: string) {
    setBusyId(id)
    const { deactivateLaborItemAction } = await import("@/app/(app)/parts/labor-actions")
    const res = await deactivateLaborItemAction(id)
    if ("error" in res) toast.error(res.error)
    else router.refresh()
    setBusyId(null)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setBusyId(pendingDelete.id)
    const { deleteLaborItemAction } = await import("@/app/(app)/parts/labor-actions")
    const res = await deleteLaborItemAction(pendingDelete.id)
    if ("error" in res) toast.error(res.error)
    else {
      toast.success("İşçilik silindi")
      router.refresh()
    }
    setPendingDelete(null)
    setBusyId(null)
  }

  const isEmpty = items.length === 0

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">Stok / Parçalar</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
          <Wrench className="size-5 text-primary" />
          Stok / Parçalar
        </h2>
        <Button size="sm" className="w-full sm:w-auto" onClick={openCreate}>
          <Plus className="size-3.5 mr-1" /> Yeni İşçilik
        </Button>
      </div>

      <PartsTabsNav active="labor" />

      <div className="grid grid-cols-3 gap-3">
        <KpiStat label="Toplam İşçilik" value={kpis.total} icon={Wrench} accent="text-primary" accentBg="bg-primary/10" />
        <KpiStat label="Aktif" value={kpis.active} icon={CheckCircle2} accent="text-success" accentBg="bg-success/10" />
        <KpiStat label="Pasif" value={kpis.inactive} icon={Archive} accent="text-muted-foreground" accentBg="bg-muted" />
      </div>

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-border bg-card py-12 text-center">
          <Wrench className="size-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">Henüz işçilik tanımlanmadı</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4 px-4">
            Tanımladığınız işçilikler iş emri ve teklif ekranlarında öneri olarak çıkar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 px-4">
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5 mr-1" /> Yeni İşçilik
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Sparkles className="size-3.5 mr-1" /> Hazır listeden ekle
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="İşçilik adı, kod veya kategori ara…"
                  className="pl-9"
                />
              </div>
              <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
                <SelectTrigger className="sm:w-40">
                  <SelectValue placeholder="Durum">
                    {(value: string | null) => (value ? STATUS_LABELS[value] ?? value : null)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="inactive">Pasif</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Sparkles className="size-3.5 mr-1" /> Hazır listeden ekle
              </Button>
            </CardContent>
          </Card>

          <div className="hidden md:block">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <Th>Kod</Th>
                    <Th>İşçilik</Th>
                    <Th>Kategori</Th>
                    <Th align="right">Varsayılan Ücret</Th>
                    <Th align="center">Durum</Th>
                    <Th align="right">İşlem</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((item) => (
                    <tr key={item.id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                        {item.code || <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{item.name}</span>
                        {item.description && (
                          <span className="block text-[11px] text-muted-foreground truncate max-w-xs">
                            {item.description}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {item.category || <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-foreground tabular-nums">
                        {formatPrice(item.defaultPriceKurus)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={item.isActive ? "default" : "secondary"}>
                          {item.isActive ? "Aktif" : "Pasif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => openEdit(item)} />}>
                              <Edit3 className="size-3.5" />
                            </TooltipTrigger>
                            <TooltipContent side="top">Düzenle</TooltipContent>
                          </Tooltip>
                          {item.isActive && (
                            <Tooltip>
                              <TooltipTrigger render={<Button variant="ghost" size="icon" disabled={busyId === item.id} onClick={() => handleDeactivate(item.id)} />}>
                                <Archive className="size-3.5" />
                              </TooltipTrigger>
                              <TooltipContent side="top">Pasifleştir</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger render={<Button variant="ghost" size="icon" disabled={busyId === item.id} onClick={() => setPendingDelete(item)} />}>
                              <Trash2 className="size-3.5" />
                            </TooltipTrigger>
                            <TooltipContent side="top">Sil</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <Wrench className="size-10 mx-auto mb-2 text-muted-foreground/50" />
                  Aramanızla eşleşen işçilik bulunamadı
                </div>
              )}
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {visible.map((item) => (
              <Card key={item.id} size="sm">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.code && (
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {item.code}
                          </span>
                        )}
                        {item.category && <span className="text-[11px] text-muted-foreground">{item.category}</span>}
                      </div>
                    </div>
                    <Badge variant={item.isActive ? "default" : "secondary"}>
                      {item.isActive ? "Aktif" : "Pasif"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground tabular-nums">
                      {formatPrice(item.defaultPriceKurus)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label="Düzenle" onClick={() => openEdit(item)}>
                        <Edit3 className="size-3.5" />
                      </Button>
                      {item.isActive && (
                        <Button variant="ghost" size="icon" aria-label="Pasifleştir" disabled={busyId === item.id} onClick={() => handleDeactivate(item.id)}>
                          <Archive className="size-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" aria-label="Sil" disabled={busyId === item.id} onClick={() => setPendingDelete(item)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {visible.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <Wrench className="size-10 mx-auto mb-2 text-muted-foreground/50" />
                Aramanızla eşleşen işçilik bulunamadı
              </div>
            )}
          </div>
        </>
      )}

      <LaborItemDialog open={dialogOpen} onOpenChange={setDialogOpen} item={editing} categories={categories} />
      <LaborPresetImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İşçilik silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{pendingDelete?.name}&quot; tanımı listenizden kaldırılacak. Geçmiş iş emirleri
              ve teklifler bundan etkilenmez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Sil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Hizalama açık eşlemeyle verilir: `text-${align}` şablon dizisini Tailwind'in
// JIT taraması GÖRMEZ ve sınıf hiç üretilmez.
const TH_ALIGN = { left: "text-left", right: "text-right", center: "text-center" } as const

function Th({ children, align = "left" }: { children: React.ReactNode; align?: keyof typeof TH_ALIGN }) {
  return (
    <th className={`${TH_ALIGN[align]} px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider`}>
      {children}
    </th>
  )
}

function KpiStat({ label, value, icon: Icon, accent, accentBg }: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  accent: string
  accentBg: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">{label}</span>
        <div className={`size-7 sm:size-9 rounded-lg ${accentBg} flex items-center justify-center`}>
          <Icon className={`size-3.5 sm:size-4 ${accent}`} />
        </div>
      </div>
      <p className="text-lg sm:text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}
```

- [ ] **Step 3: Tailwind sınıf üretimini doğrula**

Tabloda "Varsayılan Ücret" ve "İşlem" başlıklarının gerçekten sağa, "Durum" başlığının ortaya hizalandığını tarayıcıda gör. Hizalama olmuyorsa `TH_ALIGN` eşlemesi atlanmış ve şablon dizisi kullanılmış demektir — Tailwind o sınıfları üretmez.

- [ ] **Step 4: Badge ve AlertDialog imzalarını doğrula**

Run: `grep -n "variant" src/components/ui/badge.tsx | head -5 && grep -n "export" src/components/ui/alert-dialog.tsx`
Expected: `default`/`secondary` varyantları ve kullanılan tüm `AlertDialog*` parçaları mevcut. Sapma varsa mevcut varyant adlarını kullan.

- [ ] **Step 5: Tip kontrolü ve lint**

Run: `bun run typecheck && bun run lint`
Expected: hata yok

- [ ] **Step 6: Commit**

```bash
git add src/components/labor/labor-list.tsx "src/app/(app)/parts/parts-tabs-nav.tsx"
git commit -m "feat(labor): işçilik listesi ekranı ve sekme çubuğu"
```

---

### Task 9: /parts sayfasına sekme bağlantısı

**Files:**
- Modify: `src/app/(app)/parts/page.tsx`
- Modify: `src/components/parts/parts-list.tsx` (yalnız sekme çubuğu satırı eklenir)

**Interfaces:**
- Consumes: `LaborList` (Task 8), `PartsTabsNav` (Task 8), `getLaborCatalog`/`getLaborKPIs`/`getLaborCategories` (Task 4)
- Produces: `/parts?tab=labor` çalışır durumda; `/parts` bugünkü davranışını korur.

- [ ] **Step 1: Sayfayı sekmeye duyarlı hâle getir**

`src/app/(app)/parts/page.tsx` — `searchParams` tipine `tab` eklenir ve işçilik sekmesi için **erken dönüş** yapılır. Böylece parça sorgusu ve stok KPI'ları işçilik sekmesinde hiç çalışmaz:

```tsx
import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { PartsList } from "@/components/parts/parts-list"
import { LaborList } from "@/components/labor/labor-list"
import { prisma } from "@/lib/db"
import { getPartKPIs } from "@/lib/parts/queries"
import { getLaborCatalog, getLaborCategories, getLaborKPIs } from "@/lib/labor/queries"
import { getUniqueBrandsAction, getUniqueCategoriesAction } from "./actions"

export default async function PartsPage(props: {
  searchParams?: Promise<{ tab?: string; q?: string; status?: string; category?: string; brand?: string }>
}) {
  const { user, workshop } = await getAppData()
  const searchParams = await props.searchParams

  if (searchParams?.tab === "labor") {
    const [laborItems, laborKpis, laborCategories] = await Promise.all([
      getLaborCatalog(user.workshopId),
      getLaborKPIs(user.workshopId),
      getLaborCategories(user.workshopId),
    ])
    return (
      <AppShell workshopName={workshop?.name} pageTitle="Stok / Parçalar">
        <LaborList
          items={laborItems}
          kpis={laborKpis}
          categories={laborCategories}
          currentFilters={{ q: "", status: "all" }}
        />
      </AppShell>
    )
  }

  const q = searchParams?.q
  // ... mevcut parça akışı olduğu gibi kalır ...
}
```

Mevcut parça akışının (where kurulumu, filtreler, `serialized`, `PartsList` render'ı) hiçbir satırı değiştirilmez.

- [ ] **Step 2: Parça listesine sekme çubuğunu ekle**

`src/components/parts/parts-list.tsx` içinde başlık bloğunun (`Yeni Parça` butonunu içeren `div`) hemen ardına:

```tsx
      <PartsTabsNav active="parts" />
```

ve dosyanın import bloğuna:

```tsx
import { PartsTabsNav } from "@/app/(app)/parts/parts-tabs-nav"
```

- [ ] **Step 3: Uygulamayı çalıştır ve iki sekmeyi de gör**

Run: `bun run dev` (ayrı terminalde `bun run db:tunnel` açık olmalı)
Kontrol et:
- `/parts` → parça listesi, sekme çubuğunda "Parçalar" aktif
- Sekmeden "İşçilikler" → URL `/parts?tab=labor`, boş durum kartı görünür
- Tarayıcıda `/parts?tab=labor` adresini doğrudan yenile → işçilik sekmesi açık kalır
- `/parts?q=fren` iken "İşçilikler"e geç → URL'de `q` kalmaz

- [ ] **Step 4: Tip kontrolü ve lint**

Run: `bun run typecheck && bun run lint`
Expected: hata yok

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/parts/page.tsx" src/components/parts/parts-list.tsx
git commit -m "feat(labor): /parts ekranına İşçilikler sekmesi"
```

---

### Task 10: İş emri composer'ını gerçek kataloğa bağla

**Files:**
- Modify: `src/app/(app)/orders/[id]/page.tsx`
- Modify: `src/components/orders/work-order-detail.tsx` (prop geçişi, ~satır 160-176 ve ~851)
- Modify: `src/components/orders/order-management-panel.tsx` (`PartsLaborCard`, ~satır 180-205)
- Modify: `src/components/orders/parts-labor-grid.tsx` (~satır 22, 94-104, 414-544)
- Delete: `src/lib/labor/mock-labor-catalog.ts`

**Interfaces:**
- Consumes: `getLaborCatalog` (Task 4), `searchLaborItems` (Task 2), `LaborCatalogRow` (Task 2)
- Produces: `PartsLaborGrid`, `PartsLaborCard` ve `WorkOrderDetail` artık `laborCatalog: LaborCatalogRow[]` prop'u alır.

- [ ] **Step 1: Sunucu sayfasında listeyi çek**

`src/app/(app)/orders/[id]/page.tsx` — `getLaborCatalog` import edilir; mevcut veri çekme bloğunun yanında:

```tsx
const laborCatalog = await getLaborCatalog(user.workshopId, { activeOnly: true })
```

ve `<WorkOrderDetail ... />` çağrısına `laborCatalog={laborCatalog}` eklenir. (`user` bu dosyada zaten mevcut; değilse `getAppData()` sonucundan alınır.)

- [ ] **Step 2: WorkOrderDetail prop'unu ekle**

`src/components/orders/work-order-detail.tsx`:
- Prop listesine `laborCatalog` ve tipine `laborCatalog: LaborCatalogRow[]` eklenir
- `import type { LaborCatalogRow } from "@/lib/labor/types"` eklenir
- `<PartsLaborCard ... />` çağrısına `laborCatalog={laborCatalog}` eklenir

- [ ] **Step 3: PartsLaborCard prop'unu geçir**

`src/components/orders/order-management-panel.tsx` — `PartsLaborCard` prop tipine `laborCatalog: LaborCatalogRow[]` eklenir ve `<PartsLaborGrid ... laborCatalog={laborCatalog} />` olarak iletilir.

- [ ] **Step 4: Grid'i mock'tan kopar**

`src/components/orders/parts-labor-grid.tsx`:

Satır 22'deki import kaldırılır, yerine:

```tsx
import { searchLaborItems } from "@/lib/labor/search"
import type { LaborCatalogRow } from "@/lib/labor/types"
```

`PartsLaborGrid` prop tipine `laborCatalog: LaborCatalogRow[]` eklenir ve `LaborComposer`'a geçirilir (`<LaborComposer onAdd={...} disabled={...} catalog={laborCatalog} />`).

`LaborAutocompleteField` şu hâle gelir:

```tsx
// İç işçilik ad alanı: serbest-metin Autocomplete + atölyenin kendi işçilik
// tanımlarından öneriler. Öneri seçilince ad + varsayılan ücret dolar; serbest
// metin de yazılabilir (katalogda olmayan işçilik — fiyat elle girilir).
function LaborAutocompleteField({ draft, onCell, disabled, catalog }: {
  draft: Row; onCell: OnCell; disabled: boolean; catalog: LaborCatalogRow[]
}) {
  const items = useMemo(() => searchLaborItems(catalog, draft.name), [catalog, draft.name])
  return (
    <Autocomplete
      items={items}
      value={draft.name}
      filter={null}
      autoHighlight
      openOnInputClick
      itemToStringValue={(e: LaborCatalogRow) => e.name}
      onValueChange={(v: string) => {
        // Ad tanımlı bir işçiliğe birebir eşleşiyorsa varsayılan ücreti taşı;
        // eşleşme bozulunca/temizlenince fiyatı da düşür ki katalog fiyatı
        // serbest kaleme sızmasın.
        const match = catalog.find((e) => e.name === v)
        onCell(draft, { name: v, unitPrice: match ? match.defaultPriceKurus : null })
      }}
    >
      <AutocompleteInput
        render={
          <Input
            placeholder="İşçilik ara veya kendi kalemini yaz"
            disabled={disabled}
            title={draft.name || undefined}
            className="text-sm"
          />
        }
      />
      <AutocompleteContent>
        <AutocompleteEmpty>
          Tanımlı işçilik yok — Stok / İşçilikler ekranından ekleyebilirsiniz
        </AutocompleteEmpty>
        <AutocompleteList>
          {(e: LaborCatalogRow) => (
            <AutocompleteItem
              key={e.id}
              value={e}
              onClick={() => onCell(draft, { name: e.name, unitPrice: e.defaultPriceKurus })}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{e.name}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {[e.category, e.defaultPriceKurus != null ? formatTRY(e.defaultPriceKurus) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  )
}
```

`LaborComposer` ve `LaborComposerBody` `catalog: LaborCatalogRow[]` prop'unu alıp aşağı geçirir. `LaborComposerBody.submit()` içindeki rozet kararı:

```tsx
    // Atölyenin tanımlı işçiliğine birebir eşleşme → katalog rozeti; değilse manuel.
    const isDefined = mode === "labor" && catalog.some((e) => e.name === draft.name.trim())
```

`LaborComposerBody` içindeki `<LaborAutocompleteField draft={draft} onCell={onCell} disabled={disabled} />` çağrısına `catalog={catalog}` eklenir.

- [ ] **Step 5: Mock dosyasını sil ve artık referans kalmadığını doğrula**

```bash
git rm src/lib/labor/mock-labor-catalog.ts
```

Run: `grep -rn "mock-labor-catalog\|getMockLaborCatalog\|searchLaborCatalog" src`
Expected: çıktı boş

- [ ] **Step 6: Tip kontrolü ve lint**

Run: `bun run typecheck && bun run lint`
Expected: hata yok

- [ ] **Step 7: Tarayıcıda doğrula**

`bun run dev` çalışırken:
1. `/parts?tab=labor` → "Hazır listeden ekle" ile birkaç kalem ekle
2. Bir iş emri aç → Parça & İşçilik sekmesi → İşçilik composer'ında "yag" yaz → öneri çıkmalı
3. Öneriyi seç → ad ve birim fiyat dolmalı; Ekle → satır "katalog" rozetiyle düşmeli
4. Serbest metin yaz ("özel kaynak işi") → öneri yok, satır eklenebilmeli, rozet "manuel"
5. `/parts?tab=labor` üzerinden o kalemi pasifleştir → iş emri sayfasını yenile → öneri listesinde çıkmamalı

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/orders/[id]/page.tsx" src/components/orders/work-order-detail.tsx src/components/orders/order-management-panel.tsx src/components/orders/parts-labor-grid.tsx src/lib/labor/mock-labor-catalog.ts
git commit -m "feat(labor): iş emri işçilik önerileri atölye kataloğundan gelsin"
```

---

### Task 11: Teklif formuna işçilik önerileri

**Files:**
- Modify: `src/app/(app)/quotes/new/page.tsx`
- Modify: `src/components/quotes/quote-create-form.tsx` (~satır 510-530)

**Interfaces:**
- Consumes: `getLaborCatalog` (Task 4), `searchLaborItems` (Task 2), `LaborCatalogRow` (Task 2)
- Produces: `QuoteCreateForm` artık `laborCatalog: LaborCatalogRow[]` prop'u alır.

**DİKKAT — birim farkı:** Teklif formunun `unitPrice` alanı **TL (lira)** tutar; gönderimde `liraToKurus` ile çevrilir (bkz. `selectCatalogPart`, satır ~179-192). Katalogdan gelen `defaultPriceKurus` bu yüzden `kurusToLira` ile çevrilerek yazılmalıdır. Kuruş değerini doğrudan yazmak fiyatı 100 katına çıkarır.

- [ ] **Step 1: Sunucu sayfasında listeyi çek ve geçir**

`src/app/(app)/quotes/new/page.tsx`:

```tsx
import { getLaborCatalog } from "@/lib/labor/queries"
// ...
export default async function NewQuotePage() {
  const { user, workshop } = await getAppData()
  const laborCatalog = await getLaborCatalog(user.workshopId, { activeOnly: true })
  // ...
        <QuoteCreateForm laborCatalog={laborCatalog} />
```

- [ ] **Step 2: Formda ad alanını tipe göre ayır**

`src/components/quotes/quote-create-form.tsx` — bileşen prop'una `laborCatalog: LaborCatalogRow[]` eklenir; `items.${index}.name` alanının `render` gövdesinde `typeVal === "labor"` iken `Input` yerine `Autocomplete` render edilir:

```tsx
                              <FormControl>
                                {typeVal === "labor" ? (
                                  <Autocomplete
                                    items={searchLaborItems(laborCatalog, field.value ?? "")}
                                    value={field.value ?? ""}
                                    filter={null}
                                    autoHighlight
                                    openOnInputClick
                                    itemToStringValue={(e: LaborCatalogRow) => e.name}
                                    onValueChange={(v: string) => field.onChange(v)}
                                  >
                                    <AutocompleteInput
                                      render={<Input placeholder="Yağ değişimi..." className="h-8 text-sm" />}
                                    />
                                    <AutocompleteContent>
                                      <AutocompleteEmpty>
                                        Tanımlı işçilik yok — Stok / İşçilikler ekranından ekleyebilirsiniz
                                      </AutocompleteEmpty>
                                      <AutocompleteList>
                                        {(e: LaborCatalogRow) => (
                                          <AutocompleteItem
                                            key={e.id}
                                            value={e}
                                            onClick={() => {
                                              field.onChange(e.name)
                                              // Form TL tutar; katalog kuruş saklar.
                                              if (e.defaultPriceKurus != null) {
                                                form.setValue(
                                                  `items.${index}.unitPrice`,
                                                  kurusToLira(e.defaultPriceKurus),
                                                  { shouldDirty: true }
                                                )
                                                recomputeTotal(index)
                                              }
                                            }}
                                          >
                                            <span className="min-w-0 flex-1">
                                              <span className="block truncate">{e.name}</span>
                                              {e.category && (
                                                <span className="block text-[11px] text-muted-foreground">
                                                  {e.category}
                                                </span>
                                              )}
                                            </span>
                                          </AutocompleteItem>
                                        )}
                                      </AutocompleteList>
                                    </AutocompleteContent>
                                  </Autocomplete>
                                ) : (
                                  <Input
                                    {...field}
                                    placeholder="Fren balatası..."
                                    className="h-8 text-sm"
                                  />
                                )}
                              </FormControl>
```

Gereken importlar dosyanın başına eklenir:

```tsx
import {
  Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput,
  AutocompleteItem, AutocompleteList,
} from "@/components/ui/autocomplete"
import { searchLaborItems } from "@/lib/labor/search"
import type { LaborCatalogRow } from "@/lib/labor/types"
```

(`kurusToLira` satır 33'te zaten import edilmiş durumda.)

- [ ] **Step 3: Tip kontrolü ve lint**

Run: `bun run typecheck && bun run lint`
Expected: hata yok

- [ ] **Step 4: Tarayıcıda fiyat birimini doğrula**

`/quotes/new` → kalem ekle → tip "İşçilik" → öneri seç.
Beklenen: Birim Fiyat alanında **TL** değeri görünür (ör. 350, 35000 değil) ve toplam doğru hesaplanır. Teklifi kaydet, detay sayfasında tutarın aynı olduğunu gör.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/quotes/new/page.tsx" src/components/quotes/quote-create-form.tsx
git commit -m "feat(labor): teklif formunda işçilik önerileri"
```

---

### Task 12: Bütünsel doğrulama ve manuel QA

**Files:** —

**Interfaces:**
- Consumes: Task 1-11 çıktıları
- Produces: yayına hazır dal

- [ ] **Step 1: Tüm testleri çalıştır**

Run: `bun test`
Expected: tüm testler PASS (yeni: `src/lib/labor/search.test.ts`, `src/lib/labor/presets.test.ts`, `src/lib/validations/labor.test.ts`)

- [ ] **Step 2: Lint ve tip kontrolü**

Run: `bun run lint && bun run typecheck`
Expected: hata yok

- [ ] **Step 3: Üretim derlemesi**

Run: `bun run build`
Expected: derleme başarılı. (Yeni tablo + 4 dosyada prop zinciri değiştiği için bu adım atlanmaz.)

- [ ] **Step 4: Manuel QA — spec'teki 8 madde**

`bun run dev` ile:
1. Boş listede `Hazır listeden ekle` → 24 kalem gelir; **tekrar** bas → "24 kalem zaten listenizde vardı" mesajı, liste 24'te kalır
2. Bir kalemi düzenle (fiyat değiştir) → listede yeni fiyat görünür
3. Pasifleştir → listede "Pasif" rozeti; iş emri önerilerinde çıkmaz
4. İş emrinde öneri seçimi → ad + fiyat dolar, rozet "katalog"; serbest metin hâlâ çalışır
5. Teklifte tip = İşçilik → aynı öneri davranışı, fiyat TL olarak dolar
6. Tarayıcıyı 375 px'e daralt → sekme geçişi, kart listesi ve modal kullanılabilir; yatay kaydırma yok
7. Farklı bir atölye kullanıcısıyla giriş → bu liste görünmez (kiracı izolasyonu)
8. Aynı kodu iki kalemde kullan → "Bu işçilik kodu zaten kullanılıyor" mesajı çıkar, form kapanmaz

- [ ] **Step 5: AWS dev veritabanına migration'ı uygula**

Ayrı terminalde: `bun run db:tunnel` (açık bırak)
Run: `bun run db:deploy`
Expected: `1 migration found` → `Applying migration ...add_labor_catalog_item` → başarı

- [ ] **Step 6: PR aç**

```bash
git push -u origin feat/labor-catalog
gh pr create --base dev --title "feat(labor): işçilik kataloğu" --body "..."
```

PR gövdesinde şunlar belirtilir: yeni tablo ve migration (`add_labor_catalog_item`), mock kataloğun kaldırıldığı, mevcut atölyelerin listeyi "Hazır listeden ekle" ile doldurması gerektiği, `bun run db:deploy` ihtiyacı.

---

## Notlar

- **Spec'ten sapma:** Spec dosya tablosunda `src/lib/labor/types.ts` yoktu. `LaborCatalogRow` tipini istemci bileşenlerinin `prisma` içeren `queries.ts`'ten çekmemesi için ayrı bir tip dosyası eklendi. Davranışsal etkisi yoktur.
- **Sekme kabuğu:** Spec "parts-list.tsx sekme kabuğunu alır" diyordu; uygulamada sekme çubuğu ayrı bir `parts-tabs-nav.tsx` bileşeni oldu ve her iki liste kendi başlığının altında onu render ediyor. Sebep: sunucu sayfasının yalnız aktif sekmenin verisini çekebilmesi (spec'in "işçilik sekmesindeyken parça sorgusu çalışmaz" gereksinimi) ve `parts-list.tsx`'in büyümemesi.
