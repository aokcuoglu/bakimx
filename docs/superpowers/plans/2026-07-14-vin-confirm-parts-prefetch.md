# VIN oto-teyit + yaygın parça prefetch + model-önek dedupe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VIN API'den kataloğa bağlanınca `vinConfirmed`'i otomatik set et, o aracın yaygın bakım parçalarını arka planda TecDoc cache'ine indir, ve aynı modelin farklı VIN'lerinde VIN-check kotasını yeniden tüketme.

**Architecture:** Üç bağımsız değişiklik. (A) `linkVehicleCatalogAction` katalog bağlarken `vinConfirmed=true` yazar. (B) Yeni `src/lib/tecdoc/prefetch.ts` modülü, teyit anında `after()` ile arka planda curated bakım kategorilerinin parçalarını mevcut cache-first `catalog.ts` yollarıyla `TecdocArticle`'a doldurur; parça-ekleme UI'ı değişmeden dolu cache'ten okur. (C) `lookupVin` cache'i tam-VIN yerine model-önek (WMI+VDS = VIN ilk 9 hane) ile dedupe eder.

**Tech Stack:** Next.js 16.2.6 (App Router, `after` from `next/server`), TypeScript strict, Prisma + Postgres, Bun test runner (`bun:test`), RapidAPI TecDoc.

## Global Constraints

- Test runner: `bun test`; testler `import { test, expect } from "bun:test"`. Mevcut testler **saf fonksiyon** testleridir — Prisma/provider mock YOK. Yeni testler de saf olmalı.
- TypeScript strict, `any` yok.
- Tenant izolasyonu: server action'lar `workshopId`'yi `requireWritableWorkshop()`'tan alır, client param'a güvenmez.
- Parça-ekleme UI bileşenleri (`parts-labor-grid.tsx`, `part-search-input.tsx`, `tecdoc-part-picker.tsx`) **değişmez**.
- Mock provider prod/dev'de asla cache'lenmez; prefetch mock'ta erken çıkar.
- Prisma kolon adları camelCase (ör. yeni kolon SQL'de `"modelKey"`, index `"vin_lookups_modelKey_idx"`).
- Küçük commit'ler; her task sonunda commit.
- Docker YOK (yerel DB OrbStack compose ile zaten ayakta).

---

### Task 1: VinLookup.modelKey şeması + migration (backfill'li)

**Files:**
- Modify: `prisma/schema.prisma` (model `VinLookup`, ~satır 1485-1495)
- Create: `prisma/migrations/<timestamp>_add_vinlookup_model_key/migration.sql` (prisma üretir, backfill elle eklenir)

**Interfaces:**
- Produces: `VinLookup.modelKey String?` kolonu + `@@index([modelKey])`. SQL kolon adı `"modelKey"`.

- [ ] **Step 1: Şemaya kolon + index ekle**

`prisma/schema.prisma` içinde `model VinLookup` bloğunu güncelle (mevcut alanların altına `modelKey`, index'lerin yanına yeni index):

```prisma
model VinLookup {
  vin         String          @id // normalized: uppercase, 17 chars
  /// VIN model-önek (WMI+VDS = ilk 9 hane) — aynı modelin farklı VIN'leri tek
  /// API çağrısını paylaşsın diye cache bu önekle dedupe edilir (bkz. lookupVin).
  modelKey    String?
  status      VinLookupStatus
  provider    String // "rapidapi" | "mock"
  rawResponse Json? // raw provider payload, null for not_found
  hitCount    Int             @default(1) // cache hits, for observability
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([createdAt])
  @@index([modelKey])
  @@map("vin_lookups")
}
```

- [ ] **Step 2: Migration'ı uygulamadan üret**

Run: `bunx prisma migrate dev --create-only --name add_vinlookup_model_key`
Expected: `prisma/migrations/<timestamp>_add_vinlookup_model_key/migration.sql` oluşur; `ALTER TABLE "vin_lookups" ADD COLUMN "modelKey" TEXT;` ve `CREATE INDEX "vin_lookups_modelKey_idx" ...` içerir. Henüz uygulanmadı.

- [ ] **Step 3: Migration SQL'ine backfill ekle**

Üretilen `migration.sql` dosyasının **sonuna** ekle:

```sql
-- Backfill: mevcut satırların önekini VIN'in ilk 9 hanesinden doldur.
UPDATE "vin_lookups" SET "modelKey" = substring("vin" from 1 for 9);
```

- [ ] **Step 4: Migration'ı uygula**

Run: `bunx prisma migrate dev`
Expected: migration uygulanır, `The following migration(s) have been applied`. Hata yoksa geç.

> **Not (drift):** `migrate dev` "yabancı migration drift" verirse (paylaşılan/başka worktree DB'si), hafıza kuralı: elle SQL + `migrate deploy`/`resolve`. Bu branch ana worktree'de olduğundan normalde sorun çıkmaz.

- [ ] **Step 5: Prisma client'ı doğrula**

Run: `bunx prisma generate && bun run typecheck`
Expected: hata yok (client `modelKey` alanını tanır).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(vin): VinLookup.modelKey kolonu + backfill migration"
```

---

### Task 2: `vinModelKey` saf yardımcı + test

**Files:**
- Modify: `src/lib/vin/types.ts` (`normalizeVin`'in yanına)
- Test: `src/lib/vin/resolve.test.ts` (mevcut dosyaya test ekle — `normalizeVin` zaten burada test ediliyor)

**Interfaces:**
- Consumes: `normalizeVin(input): string` (mevcut, `types.ts`).
- Produces: `vinModelKey(input: string): string` — normalize edip ilk 9 hane döner.

- [ ] **Step 1: Failing test yaz**

`src/lib/vin/resolve.test.ts` sonuna ekle (üstteki import'a `vinModelKey` ekle: `import { extractMatchSections, isValidVin, normalizeVin, vinModelKey } from "./types"`):

```ts
test("vinModelKey: WMI+VDS (ilk 9 hane); aynı modelin farklı VIN'leri eşleşir", () => {
  expect(vinModelKey("WBA5A1109ED608488")).toBe("WBA5A1109")
  // aynı model, farklı seri (VIS) → aynı önek
  expect(vinModelKey("WBA5A1109FZ111222")).toBe("WBA5A1109")
  // normalize: boşluk/küçük harf
  expect(vinModelKey(" wba5a1109ed608488 ")).toBe("WBA5A1109")
})
```

- [ ] **Step 2: Testin fail ettiğini doğrula**

Run: `bun test src/lib/vin/resolve.test.ts`
Expected: FAIL — `vinModelKey is not a function` / import hatası.

- [ ] **Step 3: `vinModelKey`'i implemente et**

`src/lib/vin/types.ts` içinde `normalizeVin`'in hemen altına ekle:

```ts
/** VIN model-öneki (WMI+VDS = ilk 9 hane). Aynı model/varyantın farklı VIN'leri
 *  bu öneki paylaşır; VIN cache dedupe anahtarıdır (bkz. lookupVin). */
export function vinModelKey(input: string): string {
  return normalizeVin(input).slice(0, 9)
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `bun test src/lib/vin/resolve.test.ts`
Expected: PASS (tüm testler yeşil).

- [ ] **Step 5: Commit**

```bash
git add src/lib/vin/types.ts src/lib/vin/resolve.test.ts
git commit -m "feat(vin): vinModelKey saf yardımcı (WMI+VDS önek)"
```

---

### Task 3: `lookupVin` model-önek dedupe

**Files:**
- Modify: `src/lib/vin/lookup.ts` (cache okuma + yazma)

**Interfaces:**
- Consumes: `vinModelKey(input): string` (Task 2), `normalizeVin`, `isValidVin` (mevcut).
- Produces: davranış değişikliği — cache okuma `modelKey` ile; yeni satır `modelKey` yazar. İmza değişmez (`lookupVin(input): Promise<VinLookupResult>`).

- [ ] **Step 1: Import'a `vinModelKey` ekle**

`src/lib/vin/lookup.ts` başındaki import satırını güncelle:

```ts
import { VinLookupError, isValidVin, normalizeVin, vinModelKey } from "./types"
```

- [ ] **Step 2: Cache okumayı `modelKey`'e çevir**

`lookupVin` içinde `vin` hesaplandıktan sonra `modelKey` türet ve cache okumayı değiştir. Mevcut blok:

```ts
  const cachedRow = await prisma.vinLookup.findUnique({ where: { vin } })
  if (cachedRow) {
    prisma.vinLookup
      .update({ where: { vin }, data: { hitCount: { increment: 1 } } })
      .catch(() => {}) // observability only — never block or fail the lookup
    return { vin, status: cachedRow.status, raw: cachedRow.rawResponse, cached: true, provider: cachedRow.provider }
  }
```

şununla değiştir:

```ts
  // Cache dedupe anahtarı = model-önek (WMI+VDS). Aynı modelin farklı VIN'leri
  // aynı tecdoc-vin-check yanıtını hak eder; böylece her yeni VIN kota harcamaz.
  // Motor-varyant seçimi resolveVinToCatalog içinde her VIN için yerelde yapılır.
  const modelKey = vinModelKey(vin)
  const cachedRow = await prisma.vinLookup.findFirst({
    where: { modelKey },
    orderBy: { createdAt: "asc" },
  })
  if (cachedRow) {
    prisma.vinLookup
      .update({ where: { vin: cachedRow.vin }, data: { hitCount: { increment: 1 } } })
      .catch(() => {}) // observability only — never block or fail the lookup
    return { vin, status: cachedRow.status, raw: cachedRow.rawResponse, cached: true, provider: cachedRow.provider }
  }
```

- [ ] **Step 3: Yeni satır yazımına `modelKey` ekle**

Aynı fonksiyondaki `upsert`'ün `create` bloğuna `modelKey` ekle:

```ts
  const row = await prisma.vinLookup.upsert({
    where: { vin }, // upsert: concurrent first-lookups of the same VIN must not crash
    create: {
      vin,
      modelKey,
      status: result.status,
      provider: provider.name,
      rawResponse: result.raw === null ? undefined : (result.raw as object),
    },
    update: { hitCount: { increment: 1 } },
  })
```

- [ ] **Step 4: Typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: hata yok.

- [ ] **Step 5: Regresyon — VIN testleri geçiyor**

Run: `bun test src/lib/vin/`
Expected: PASS (saf testler etkilenmez; davranış değişikliği DB yolunda, manuel QA'da doğrulanır).

- [ ] **Step 6: Commit**

```bash
git add src/lib/vin/lookup.ts
git commit -m "feat(vin): lookupVin model-önek dedupe (aynı model tek kota)"
```

---

### Task 4: `prefetch.ts` — matcher listesi + `selectPrefetchTargets` (saf) + test

**Files:**
- Create: `src/lib/tecdoc/prefetch.ts`
- Test: `src/lib/tecdoc/prefetch.test.ts`

**Interfaces:**
- Consumes: `flattenCategoryLeaves(nodes): CategoryLeaf[]` (`src/lib/tecdoc/tree.ts`), `CategoryNode` (`./types`), `normalizeCategories(raw): CategoryNode[]` (test'te, `./normalize`).
- Produces: `COMMON_CATEGORY_MATCHERS: readonly string[]`, `selectPrefetchTargets(tree: CategoryNode[]): number[]`.

- [ ] **Step 1: Failing test yaz**

`src/lib/tecdoc/prefetch.test.ts`:

```ts
import { test, expect } from "bun:test"
import categoriesFixture from "./fixtures/categories-v2.json"
import { normalizeCategories } from "./normalize"
import { selectPrefetchTargets } from "./prefetch"

test("selectPrefetchTargets: bakım kategorilerini seçer (fren balatası 100030 dahil)", () => {
  const tree = normalizeCategories(categoriesFixture)
  const ids = selectPrefetchTargets(tree)
  // fixture'da kesin var olan bakım kategorileri seçilmeli
  expect(ids).toContain(100030) // Fren balatası
  expect(ids).toContain(100032) // Fren diski
  expect(ids).toContain(100259) // Yağ filtresi
  expect(ids).toContain(100260) // Hava filtresi
  expect(ids).toContain(100452) // Triger kayışı
  // makul üst sınır: yaygın set, tüm 422 yaprak değil
  expect(ids.length).toBeGreaterThan(10)
  expect(ids.length).toBeLessThan(120)
  // dedupe: benzersiz
  expect(new Set(ids).size).toBe(ids.length)
})

test("selectPrefetchTargets: boş ağaç → boş", () => {
  expect(selectPrefetchTargets([])).toEqual([])
})
```

- [ ] **Step 2: Testin fail ettiğini doğrula**

Run: `bun test src/lib/tecdoc/prefetch.test.ts`
Expected: FAIL — `Cannot find module './prefetch'`.

- [ ] **Step 3: `prefetch.ts` matcher + saf seçiciyi implemente et**

`src/lib/tecdoc/prefetch.ts` (bu adımda yalnız matcher + saf fonksiyon; I/O Task 5'te):

```ts
import { flattenCategoryLeaves } from "./tree"
import type { CategoryNode } from "./types"

/**
 * Teyit anında öncelikli indirilecek yaygın bakım kategorileri — küçük-harf isim
 * parçaları. Kategori ağacı araca göre değiştiği (ör. dizel araçta "Ateşleme
 * bobini" yok) ve evrensel categoryId tahmini riskli olduğu için ID yerine
 * PROVIDER kategori ADIYLA eşleştiririz (fixture canlı endpoint çıktısıdır,
 * adlar tutarlı). Eşleşmeyen kategori sessizce lazy-picker'a düşer — asla
 * yanlış veri değil. Türkçe küçük-harf ("tr-TR") ile karşılaştırılır.
 */
export const COMMON_CATEGORY_MATCHERS: readonly string[] = [
  "fren balata",
  "fren disk",
  "fren kaliper",
  "fren hidro",
  "fren hortum",
  "el fren",
  "ana fren silindir",
  "fren servo",
  "yağ filtre",
  "hava filtre", // "hava filtresi" + "araç içi hava filtresi" (polen) ikisini de yakalar
  "yakıt filtre",
  "filtre takım",
  "kurum filtre",
  "triger",
  "v kayış",
  "kayış geric",
  "kayış kasna",
  "buji", // "buji" + "kızdırma bujisi"
  "ateşleme bobin",
  "akü",
  "silecek",
  "debriyaj",
  "amortisör",
  "rot",
  "salıncak",
  "termostat",
  "su pompas",
  "radyat",
  "direksiyon",
  "marş motor",
  "alternatör",
  "karter conta",
  "silindir kapağı conta",
  "enjektör",
]

/**
 * Aracın kategori ağacındaki yaprak kategorilerden, adı bir yaygın-bakım
 * matcher'ını içerenlerin id'leri (deduplike). SAF — I/O yok, test edilebilir.
 */
export function selectPrefetchTargets(tree: CategoryNode[]): number[] {
  const ids = new Set<number>()
  for (const leaf of flattenCategoryLeaves(tree)) {
    const name = leaf.name.toLocaleLowerCase("tr-TR")
    if (COMMON_CATEGORY_MATCHERS.some((m) => name.includes(m))) {
      ids.add(leaf.id)
    }
  }
  return [...ids]
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `bun test src/lib/tecdoc/prefetch.test.ts`
Expected: PASS. (Eğer `ids.length` sınırları patlarsa, matcher listesini fixture'a göre daralt/gevşet; ör. bir matcher beklenmedik çok kategori yakalıyorsa daha spesifik yaz.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tecdoc/prefetch.ts src/lib/tecdoc/prefetch.test.ts
git commit -m "feat(tecdoc): yaygın parça matcher listesi + selectPrefetchTargets"
```

---

### Task 5: `prefetchCommonVehicleParts` — arka plan orkestrasyonu

**Files:**
- Modify: `src/lib/tecdoc/prefetch.ts` (I/O fonksiyonu ekle)

**Interfaces:**
- Consumes: `getTecdocProvider()` (`./provider`), `getVehicleCategories(vehicleId)`, `getArticlesByCategory(vehicleId, categoryId)` (`./catalog`), `TecdocError` (`./types`), `selectPrefetchTargets` (Task 4).
- Produces: `prefetchCommonVehicleParts(vehicleTypeId: number): Promise<void>` — hiçbir zaman throw ETMEZ (arka planda `after()` ile çağrılır).

- [ ] **Step 1: Import'ları ekle**

`src/lib/tecdoc/prefetch.ts` başına ekle:

```ts
import { getTecdocProvider } from "./provider"
import { getVehicleCategories, getArticlesByCategory } from "./catalog"
import { TecdocError } from "./types"
```

- [ ] **Step 2: `prefetchCommonVehicleParts`'ı implemente et**

Dosyanın sonuna ekle:

```ts
/**
 * Teyit sonrası arka planda (after()) çağrılır: aracın yaygın bakım kategorilerinin
 * parçalarını TecdocArticle cache'ine doldurur, böylece parça-ekleme UI'ı (ad
 * arama + marka/kategori) dolu cache'ten beslenir. HİÇBİR ZAMAN throw ETMEZ.
 *
 * - mock provider'da erken çıkar (mock persist etmez).
 * - getArticlesByCategory cache-first + idempotent (zaten cache'liyse API atlar).
 * - quota_exceeded'da döngü durur (kalan kotayı korur); diğer hatada kategori atlanır.
 */
export async function prefetchCommonVehicleParts(vehicleTypeId: number): Promise<void> {
  try {
    if (!Number.isInteger(vehicleTypeId) || vehicleTypeId <= 0) return
    if (getTecdocProvider().name === "mock") return

    const tree = await getVehicleCategories(vehicleTypeId)
    const targets = selectPrefetchTargets(tree)

    for (const categoryId of targets) {
      try {
        await getArticlesByCategory(vehicleTypeId, categoryId)
      } catch (err) {
        if (err instanceof TecdocError && err.code === "quota_exceeded") {
          console.warn(`[tecdoc] prefetch durdu (kota): vehicleType=${vehicleTypeId}`)
          return
        }
        // tekil kategori hatası — atla, prefetch devam etsin
        console.warn(`[tecdoc] prefetch kategori atlandı ${categoryId}:`, err instanceof Error ? err.message : err)
      }
    }
  } catch (err) {
    // getVehicleCategories dahil her şeyi yut — arka plan görevi asla patlamamalı
    console.warn(`[tecdoc] prefetch başarısız vehicleType=${vehicleTypeId}:`, err instanceof Error ? err.message : err)
  }
}
```

- [ ] **Step 3: Typecheck + mevcut test geçiyor**

Run: `bun run typecheck && bun test src/lib/tecdoc/prefetch.test.ts`
Expected: hata yok, saf test hâlâ PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tecdoc/prefetch.ts
git commit -m "feat(tecdoc): prefetchCommonVehicleParts arka plan orkestrasyonu"
```

---

### Task 6: `linkVehicleCatalogAction` — VIN oto-teyit + prefetch tetikleme

**Files:**
- Modify: `src/app/(app)/vehicles/actions.ts` (`linkVehicleCatalogAction`, ~satır 268-300)

**Interfaces:**
- Consumes: `prefetchCommonVehicleParts` (Task 5), `after` (`next/server`), `isValidVin` (`@/lib/vin/types`).
- Produces: katalog bağlanınca `vinConfirmed=true` (VIN geçerliyse) + arka plan prefetch.

- [ ] **Step 1: Import'ları ekle**

`src/app/(app)/vehicles/actions.ts` en üstteki import'lara ekle (mevcut import bloğuna uygun şekilde):

```ts
import { after } from "next/server"
import { isValidVin } from "@/lib/vin/types"
import { prefetchCommonVehicleParts } from "@/lib/tecdoc/prefetch"
```

> Not: `isValidVin` zaten import'luysa tekrar ekleme. Dosyadaki mevcut import'ları kontrol et.

- [ ] **Step 2: `select`'e vin + vinConfirmed ekle**

`linkVehicleCatalogAction` içindeki mevcut:

```ts
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workshopId: user.workshopId },
    select: { id: true },
  })
```

şununla değiştir:

```ts
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workshopId: user.workshopId },
    select: { id: true, vin: true, vinConfirmed: true },
  })
```

- [ ] **Step 3: update'e oto-teyit ekle + audit + prefetch tetikle**

Mevcut `update` + audit + revalidate + return bloğunu:

```ts
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      catalogVehicleTypeId: data.catalogVehicleTypeId,
      ...(data.catalogBrandId != null ? { catalogBrandId: data.catalogBrandId } : {}),
      ...(data.catalogModelId != null ? { catalogModelId: data.catalogModelId } : {}),
    },
  })

  await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_catalog_linked")

  revalidatePath("/vehicles")
  revalidatePath(`/vehicles/${vehicleId}`)
  return { success: true as const }
```

şununla değiştir:

```ts
  // Katalog VIN API'sinden bağlandı → şase teyidini otomatik işaretle (elle
  // "Teyit Et" gerekmesin). Yalnız geçerli VIN varsa ve henüz teyitli değilse.
  const autoConfirm = isValidVin(vehicle.vin) && !vehicle.vinConfirmed

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      catalogVehicleTypeId: data.catalogVehicleTypeId,
      ...(data.catalogBrandId != null ? { catalogBrandId: data.catalogBrandId } : {}),
      ...(data.catalogModelId != null ? { catalogModelId: data.catalogModelId } : {}),
      ...(autoConfirm ? { vinConfirmed: true } : {}),
    },
  })

  await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_catalog_linked")
  if (autoConfirm) {
    await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_vin_confirmed")
  }

  // Arka planda yaygın bakım parçalarını cache'e doldur (response'u bloklamaz).
  after(() => prefetchCommonVehicleParts(data.catalogVehicleTypeId))

  revalidatePath("/vehicles")
  revalidatePath(`/vehicles/${vehicleId}`)
  return { success: true as const }
```

- [ ] **Step 4: Typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: hata yok.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/vehicles/actions.ts"
git commit -m "feat(vehicle): VIN'den bağlanınca oto-teyit + arka plan parça prefetch"
```

---

### Task 7: Diğer tetik noktaları — manuel teyit + smart-capture

**Files:**
- Modify: `src/app/(app)/vehicles/actions.ts` (`confirmVehicleVinAction`, ~satır 302-322)
- Modify: `src/app/api/smart-capture/confirm/route.ts` (katalog-link bloğu sonrası)

**Interfaces:**
- Consumes: `prefetchCommonVehicleParts` (Task 5), `after` (`next/server`).
- Produces: manuel teyit ve smart-capture yollarında da (araç kataloğa bağlıysa) arka plan prefetch.

- [ ] **Step 1: `confirmVehicleVinAction`'a prefetch ekle**

`confirmVehicleVinAction` içinde mevcut:

```ts
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { vinConfirmed: true },
  })

  await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_vin_confirmed")

  revalidatePath("/vehicles")
  revalidatePath(`/vehicles/${vehicleId}`)
  return { success: true as const }
```

şununla değiştir:

```ts
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { vinConfirmed: true },
  })

  await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_vin_confirmed")

  // Araç zaten kataloğa bağlıysa, teyit anında yaygın parçaları arka planda doldur.
  if (vehicle.catalogVehicleTypeId) {
    const vehicleTypeId = vehicle.catalogVehicleTypeId
    after(() => prefetchCommonVehicleParts(vehicleTypeId))
  }

  revalidatePath("/vehicles")
  revalidatePath(`/vehicles/${vehicleId}`)
  return { success: true as const }
```

> Not: `confirmVehicleVinAction` `vehicle`'ı `select`'siz `findFirst` ile yükler (tüm alanlar), `catalogVehicleTypeId` erişilebilir. `after` import'u Task 6'da eklendi.

- [ ] **Step 2: smart-capture confirm'e prefetch ekle**

`src/app/api/smart-capture/confirm/route.ts` içinde katalog-link bloğunda, araç `catalogVehicleTypeId` ile güncellenip `catalogLinked = true` yapıldığı yerde, tip-daralmasını closure'a taşımak için değeri bir `const`'a yakala ve arka plan tetiklemesi ekle. Mevcut `catalogLinked = true` satırını:

```ts
            catalogLinked = true
```

şununla değiştir:

```ts
            catalogLinked = true
            // Tip daralmasını (autoSelected != null) closure'a taşımak için yakala.
            const linkedVehicleTypeId = resolution.autoSelected
            after(() => prefetchCommonVehicleParts(linkedVehicleTypeId))
```

(`resolution.autoSelected` bu dalda `number`'dır — `if (resolution.status === "resolved" && resolution.autoSelected != null)` içindeyiz.)

- [ ] **Step 3: smart-capture import'larını ekle**

`src/app/api/smart-capture/confirm/route.ts` başına ekle (yoksa):

```ts
import { after } from "next/server"
import { prefetchCommonVehicleParts } from "@/lib/tecdoc/prefetch"
```

- [ ] **Step 4: Typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: hata yok.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/vehicles/actions.ts" "src/app/api/smart-capture/confirm/route.ts"
git commit -m "feat(vehicle): manuel teyit + smart-capture yollarında parça prefetch"
```

---

### Task 8: Bütünsel doğrulama + manuel QA

**Files:** — (yalnız doğrulama)

- [ ] **Step 1: Tüm testler**

Run: `bun test`
Expected: tüm testler PASS.

- [ ] **Step 2: Typecheck + lint (tam)**

Run: `bun run typecheck && bun run lint`
Expected: hata yok.

- [ ] **Step 3: Manuel QA (dev, `.env.local` TECDOC_PROVIDER=rapidapi + VIN_PROVIDER=rapidapi + RAPIDAPI_KEY)**

`bun run dev` ile aç, sonra:
1. VIN'i olan (ör. `WBA5A1109ED608488`) bir araçta iş emri → Parça sekmesi → 🔍 → "VIN'den bağla". Araç bağlanır, araç özetinde **"Teyit Edildi"** otomatik yeşile döner (elle tıklamadan).
2. ~10-30 sn sonra parça satırında ad araması "balata" yaz → gerçek sonuçlar gelir.
3. Marka ve kategori dropdown'ları dolu gelir.
4. Aynı araç tipini ikinci bir araçta bağla → yeni RapidAPI çağrısı olmaz (admin `getRapidApiUsage` sayacı artmaz; cache-hit).
5. Aynı modelin **farklı** VIN'ini (ör. `WBA5A1109` önekli başka VIN) çözümle → VIN-check çağrısı yapılmaz (modelKey cache-hit), araç yine doğru çözülür.

- [ ] **Step 4: (Opsiyonel) build**

Değişiklik `after()` ilk kullanımı içerdiğinden prod build'i doğrula:
Run: `bun run build`
Expected: build başarılı.

- [ ] **Step 5: Bakımx release-check + code-review skill'leri (öneri)**

`bakimx-release-check` ve `bakimx-code-review` skill'lerini çalıştırıp çıktıyı gözden geçir. Sonra PR aşamasına geç.

---

## Notlar

- **Staging env (kod dışı):** parçaların staging'de gelmesi için VPS `.env`'inde `TECDOC_PROVIDER=rapidapi` + `RAPIDAPI_KEY` olmalı + container restart. PR açıklamasına hatırlatma eklenir. `getTecdocProvider` modül-singleton'dır → env değişince restart şart.
- **Tetikleme kapsamı:** vehicle create/edit formunda VIN resolve ile katalog set edilirse oto-teyit ordan gelmez (bu PR'da linkVehicleCatalogAction + smart-capture + manuel teyit kapsanır). Form yolu ayrı bir iyileştirme; kapsam dışı.
