# Parça Prefetch Tetiklemesini Genişletme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Katalog-bağlı + VIN-teyitli araçlarda yaygın bakım parçalarının `tecdoc_articles` cache'ine kayıt anında ve Parça sekmesi ilk açılışında otomatik dolması; böylece iş emri parça aramasında "Katalogdan getir"e tıklamak gerekmesin.

**Architecture:** Mevcut `prefetchCommonVehicleParts(vehicleTypeId)` altyapısı korunur; yalnızca yeni tetikleme noktaları eklenir. (1) `createVehicleAction`/`updateVehicle` içinde saf bir karar yardımcısıyla koşullu eager prefetch; (2) `ensureVehiclePartsPrefetched` server action'ı + `UnifiedPartComposer` mount'unda güvenlik ağı tetiği + "hazırlanıyor" notu. Şema değişikliği yok.

**Tech Stack:** Next.js (App Router, server actions, `next/server` `after()`), TypeScript strict, Prisma, `bun:test`.

## Global Constraints

- TypeScript strict; `any` yok.
- Tenant izolasyonu: her data sorgusu `workshopId`'yi `requireAuth()`/`requireWritableWorkshop()`'tan türetir, client param'a asla güvenmez.
- Şema değişikliği yok.
- mock provider'da prefetch no-op'tur ve asla throw etmez (mevcut `prefetchCommonVehicleParts` davranışı korunur).
- Küçük, güvenli, gözden geçirilebilir commit'ler; her task sonunda tek bir mantıklı deliverable.
- Docker yok; testler `bun test` ile lokal çalışır.
- Sohbet/PR dili Türkçe.

---

### Task 1: Saf karar yardımcısı — `eagerPrefetchTarget`

Eager prefetch koşulunu (`catalogVehicleTypeId` dolu **ve** `vinConfirmed === true`) tek saf fonksiyonda topla. Hem `createVehicleAction` hem `updateVehicle` bunu kullanacak (DRY) ve tek bir yerde test edilecek.

**Files:**
- Modify: `src/lib/tecdoc/prefetch.ts`
- Test: `src/lib/tecdoc/prefetch.test.ts`

**Interfaces:**
- Consumes: yok.
- Produces: `export function eagerPrefetchTarget(v: { catalogVehicleTypeId?: number | null; vinConfirmed?: boolean | null }): number | null` — koşul sağlanıyorsa prefetch edilecek `vehicleTypeId`'yi (pozitif tam sayı), aksi halde `null` döner.

- [ ] **Step 1: Failing test ekle**

`src/lib/tecdoc/prefetch.test.ts` dosyasının SONUNA ekle (mevcut import satırındaki `selectPrefetchTargets`'ı `eagerPrefetchTarget` ile genişlet):

```ts
import { selectPrefetchTargets, eagerPrefetchTarget } from "./prefetch"

test("eagerPrefetchTarget: katalog-bağlı + VIN teyitli → vehicleTypeId döner", () => {
  expect(eagerPrefetchTarget({ catalogVehicleTypeId: 12345, vinConfirmed: true })).toBe(12345)
})

test("eagerPrefetchTarget: VIN teyitsiz → null", () => {
  expect(eagerPrefetchTarget({ catalogVehicleTypeId: 12345, vinConfirmed: false })).toBeNull()
})

test("eagerPrefetchTarget: katalog bağlı değil → null", () => {
  expect(eagerPrefetchTarget({ catalogVehicleTypeId: null, vinConfirmed: true })).toBeNull()
})

test("eagerPrefetchTarget: eksik/undefined alanlar → null", () => {
  expect(eagerPrefetchTarget({})).toBeNull()
  expect(eagerPrefetchTarget({ catalogVehicleTypeId: 0, vinConfirmed: true })).toBeNull()
})
```

(Not: dosyanın en üstündeki mevcut `import { selectPrefetchTargets } from "./prefetch"` satırını yukarıdaki iki-isimli import ile değiştir; `normalizeCategories`/fixture importları aynen kalsın.)

- [ ] **Step 2: Testin fail ettiğini doğrula**

Run: `bun test src/lib/tecdoc/prefetch.test.ts`
Expected: FAIL — `eagerPrefetchTarget is not a function` / export bulunamadı.

- [ ] **Step 3: Yardımcıyı ekle**

`src/lib/tecdoc/prefetch.ts` içinde, `selectPrefetchTargets` fonksiyonundan HEMEN SONRA ekle:

```ts
/**
 * Kayıt/güncelleme anında eager prefetch yapılmalı mı? Kullanıcı beklentisi:
 * "VIN teyit edildi ise" parçalar hazır olsun. Katalog-bağlı DEĞİLSE ya da VIN
 * teyitli DEĞİLSE null döner (o araçlar Parça sekmesi güvenlik ağıyla dolar,
 * boşuna RapidAPI kotası harcanmaz). SAF — I/O yok, test edilebilir.
 */
export function eagerPrefetchTarget(v: {
  catalogVehicleTypeId?: number | null
  vinConfirmed?: boolean | null
}): number | null {
  const id = v.catalogVehicleTypeId
  if (v.vinConfirmed === true && typeof id === "number" && Number.isInteger(id) && id > 0) {
    return id
  }
  return null
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `bun test src/lib/tecdoc/prefetch.test.ts`
Expected: PASS (6 test: 2 mevcut + 4 yeni).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tecdoc/prefetch.ts src/lib/tecdoc/prefetch.test.ts
git commit -m "feat(tecdoc): eagerPrefetchTarget saf karar yardımcısı + testleri"
```

---

### Task 2: Kayıt/güncelleme anında eager prefetch tetiği

`createVehicleAction` ve `updateVehicle` başarılı yazma sonrası, `eagerPrefetchTarget` null değilse arka planda (`after`) prefetch tetikler.

**Files:**
- Modify: `src/app/(app)/vehicles/actions.ts`

**Interfaces:**
- Consumes: `eagerPrefetchTarget` (Task 1), mevcut `prefetchCommonVehicleParts` (zaten import edilmiş, `src/app/(app)/vehicles/actions.ts:11`), mevcut `after` (`next/server`, satır 7'de import edilmiş).
- Produces: yok (side-effect wiring).

- [ ] **Step 1: Import'a `eagerPrefetchTarget` ekle**

`src/app/(app)/vehicles/actions.ts:11` satırındaki:

```ts
import { prefetchCommonVehicleParts } from "@/lib/tecdoc/prefetch"
```

yerine:

```ts
import { prefetchCommonVehicleParts, eagerPrefetchTarget } from "@/lib/tecdoc/prefetch"
```

- [ ] **Step 2: `createVehicleAction` — prefetch tetiği ekle**

`createVehicleAction` içinde, `await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicle.id, "vehicle_created")` satırından SONRA, `revalidatePath("/vehicles")`'ten ÖNCE ekle:

```ts
    const prefetchId = eagerPrefetchTarget({
      catalogVehicleTypeId: parsed.data.catalogVehicleTypeId ?? null,
      vinConfirmed: parsed.data.vinConfirmed ?? false,
    })
    if (prefetchId != null) {
      after(() => prefetchCommonVehicleParts(prefetchId))
    }
```

- [ ] **Step 3: `updateVehicle` — prefetch tetiği ekle**

`updateVehicleAction` içinde, `await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_updated")` satırından SONRA, `revalidatePath("/vehicles")`'ten ÖNCE ekle:

```ts
  const prefetchId = eagerPrefetchTarget({
    catalogVehicleTypeId: parsed.data.catalogVehicleTypeId ?? null,
    vinConfirmed: parsed.data.vinConfirmed ?? false,
  })
  if (prefetchId != null) {
    after(() => prefetchCommonVehicleParts(prefetchId))
  }
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck` (yoksa `npx tsc --noEmit`)
Expected: PASS — yeni tip hatası yok. (`parsed.data.catalogVehicleTypeId` create'te `number | undefined`, `?? null` ile `number | null` olur; `eagerPrefetchTarget` bunu kabul eder.)

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/vehicles/actions.ts
git commit -m "feat(vehicles): VIN-teyitli katalog-bağlı araçta kayıt/güncelleme anında parça prefetch"
```

---

### Task 3: Güvenlik ağı server action'ı — `ensureVehiclePartsPrefetched`

Mevcut (kayıt anını kaçırmış) araçlar için: araç katalog-bağlı ama `tecdoc_articles` cache'i boşsa arka planda prefetch tetikleyen tenant-izolasyonlu server action.

**Files:**
- Modify: `src/app/(app)/parts/actions.ts`

**Interfaces:**
- Consumes: mevcut `prisma`, `requireAuth` (zaten `src/app/(app)/parts/actions.ts:3-4`'te import), `prefetchCommonVehicleParts` (yeni import).
- Produces: `export async function ensureVehiclePartsPrefetched(vehicleId: string): Promise<{ status: "cached" | "started" | "skipped" }>` — `"skipped"`: araç yok/katalog-bağlı değil; `"cached"`: cache zaten dolu; `"started"`: arka plan prefetch tetiklendi.

- [ ] **Step 1: Import'ları ekle**

`src/app/(app)/parts/actions.ts` üst kısmındaki importlara ekle (`after` ve `prefetchCommonVehicleParts`):

```ts
import { after } from "next/server"
import { prefetchCommonVehicleParts } from "@/lib/tecdoc/prefetch"
```

- [ ] **Step 2: Action'ı ekle**

`src/app/(app)/parts/actions.ts` dosyasının SONUNA ekle:

```ts
/**
 * Parça sekmesi güvenlik ağı: araç kataloğa bağlı ama parça cache'i boşsa
 * (ör. kayıt anını kaçırmış mevcut araçlar) yaygın bakım parçalarını arka
 * planda (after) doldurur. Kota + mock guard'ları prefetch içinde. Tenant
 * izolasyonu: workshopId requireAuth()'tan; client'ın vehicleId'si workshop'a
 * ait mi doğrulanır, catalogVehicleTypeId client'tan ALINMAZ (DB'den okunur).
 */
export async function ensureVehiclePartsPrefetched(
  vehicleId: string
): Promise<{ status: "cached" | "started" | "skipped" }> {
  const user = await requireAuth()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workshopId: user.workshopId },
    select: { catalogVehicleTypeId: true },
  })
  if (!vehicle?.catalogVehicleTypeId) return { status: "skipped" }

  const vehicleTypeId = vehicle.catalogVehicleTypeId
  const existing = await prisma.tecdocArticle.findFirst({
    where: { vehicleTypeId },
    select: { id: true },
  })
  if (existing) return { status: "cached" }

  after(() => prefetchCommonVehicleParts(vehicleTypeId))
  return { status: "started" }
}
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck` (yoksa `npx tsc --noEmit`)
Expected: PASS. (`prisma.tecdocArticle` modeli `vehicleTypeId` alanıyla `prisma/schema.prisma`'da tanımlı; `requireAuth` `user.workshopId` sağlar.)

- [ ] **Step 4: Lint**

Run: `bun run lint`
Expected: PASS — kullanılmayan import yok.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/parts/actions.ts
git commit -m "feat(parts): ensureVehiclePartsPrefetched güvenlik ağı server action"
```

---

### Task 4: Parça composer'da güvenlik ağı tetiği + "hazırlanıyor" notu

`UnifiedPartComposer` mount olduğunda, araç katalog-bağlıysa `ensureVehiclePartsPrefetched`'i bir kez çağırır; `"started"` dönerse ince bir "Araca uygun parçalar hazırlanıyor…" notu gösterir (bloklamaz). Debounce'lı arama parçalar cache'e düştükçe sonuçları getirir.

**Files:**
- Modify: `src/components/app/parts-labor-grid.tsx`

**Interfaces:**
- Consumes: `ensureVehiclePartsPrefetched` (Task 3), mevcut `vehicle: PickerVehicle` (alanları: `id: string`, `catalogVehicleTypeId: number | null`), mevcut `linked` değişkeni (`UnifiedPartComposer` içinde `vehicle?.catalogVehicleTypeId != null`, satır 518), mevcut React `useEffect`/`useRef`/`useState` (satır 3'te import).
- Produces: yok (UI davranışı).

- [ ] **Step 1: Server action'ı import et**

`src/components/app/parts-labor-grid.tsx` importlarına ekle (mevcut `import type { ArticleSearchResult } ...` bloğunun yakınına, `@/app/(app)/...` action importu):

```ts
import { ensureVehiclePartsPrefetched } from "@/app/(app)/parts/actions"
```

- [ ] **Step 2: `UnifiedPartComposer` içine prefetch state + effect ekle**

`UnifiedPartComposer` gövdesinde, `const linked = vehicle?.catalogVehicleTypeId != null` satırından SONRA ekle:

```ts
  const [prefetching, setPrefetching] = useState(false)
  const prefetchStartedRef = useRef(false)

  // Güvenlik ağı: araç katalog-bağlı ama parça cache'i boşsa arka planda
  // doldur. Mount başına EN FAZLA bir kez (StrictMode çift-invoke'a karşı ref).
  useEffect(() => {
    if (!linked || !vehicle?.id || prefetchStartedRef.current) return
    prefetchStartedRef.current = true
    let cancelled = false
    let hideTimer: ReturnType<typeof setTimeout> | undefined
    void ensureVehiclePartsPrefetched(vehicle.id).then((res) => {
      if (cancelled) return
      if (res.status === "started") {
        setPrefetching(true)
        // Not yalnız bilgilendirme; debounce'lı arama sonuçları getirir.
        // ~12sn sonra gizle (prefetch'in tamamlanması için makul üst sınır).
        hideTimer = setTimeout(() => setPrefetching(false), 12000)
      }
    })
    return () => {
      cancelled = true
      if (hideTimer) clearTimeout(hideTimer)
    }
  }, [linked, vehicle?.id])
```

- [ ] **Step 3: Notu render et**

`UnifiedPartComposer` return'ünde, `<PartSearchInput ... />` bloğunun HEMEN ALTINA (kapanış `/>`'inden sonra) ekle:

```tsx
      {prefetching && (
        <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Araca uygun parçalar hazırlanıyor…
        </p>
      )}
```

(Not: `Loader2` zaten `lucide-react`'ten import edilmiş — `src/components/app/parts-labor-grid.tsx:18`.)

- [ ] **Step 4: Typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: PASS — kullanılmayan değişken/import yok; `useEffect` bağımlılıkları `[linked, vehicle?.id]`.

- [ ] **Step 5: Build (değişiklik client+server sınırında olduğu için)**

Run: `bun run build`
Expected: PASS — server action client component'e başarıyla import edilir, derleme hatası yok.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/parts-labor-grid.tsx
git commit -m "feat(parts): Parça sekmesinde güvenlik ağı prefetch tetiği + hazırlanıyor notu"
```

---

## Manuel QA (tüm task'lar sonrası)

Lokal ortamda GERÇEK provider ile (`TECDOC_PROVIDER=rapidapi`; mock'ta prefetch no-op). Bkz. [[local-dev-env-and-db]].

1. **Yeni araç, VIN teyitli:** VIN teyitli + katalog-bağlı araç oluştur → İş emri aç → Parça sekmesi → "filtre" yaz → "Katalogdan getir" olmadan sonuç gelmeli.
2. **Mevcut araç (ekrandaki senaryo):** Katalog-bağlı ama cache'i boş bir araç (ör. BMW 1 F20) → İş emri → Parça sekmesi aç → kısa süre "Araca uygun parçalar hazırlanıyor…" notu → birkaç saniye sonra "filtre" araması sonuç vermeli.
3. **VIN'siz araç:** Kayıt anında prefetch tetiklenmemeli (kota harcanmamalı); araç yine de katalog-bağlıysa Parça sekmesi açılınca güvenlik ağı devreye girmeli.
4. **Cache dolu araç:** Parça sekmesi ikinci açılışta "hazırlanıyor" notu GÖRÜNMEMELİ (action `"cached"` döner), gereksiz RapidAPI çağrısı olmamalı.
5. **mock provider:** Hiçbir prefetch çalışmamalı, hata fırlatmamalı, not görünmemeli.
6. **Kota tükenmişse:** UI patlamamalı; sonuç boş kalabilir + "Katalogdan getir" fallback picker çalışmalı.

## Risk alanları

- **Çift tetik:** `createVehicleAction`/`updateVehicle` `confirmVehicleVinAction`/`linkVehicleCatalogAction`'dan bağımsız akışlar; aynı istekte üst üste tetik yok. Olsa bile `getArticlesByCategory` cache-first → sonuç doğru.
- **Not zamanlaması:** 12sn sabit gizleme heuristiği; prefetch daha uzun sürerse not erken kaybolur ama arama yine çalışır (not bilgilendirme amaçlı, bloklamaz).
- **Kota:** Eager tetik yalnız VIN-teyitli araçlarda; güvenlik ağı yalnız cache boşken; ikisi de araç başına tek seferlik idempotent.
