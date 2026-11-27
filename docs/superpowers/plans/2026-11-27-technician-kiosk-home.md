# Teknisyen kiosk ana ekranı (#1035) — uygulama planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/technician` ana ekranını kiosk düzenine çevirmek: İşlerim (büyük kartlar) + iki büyük tuş + açılır Atölyedeki diğer işler / Taslak / Bugün biten grupları, e-santral kalıbında.

**Architecture:** Gruplama saf bir fonksiyonda (`groupKioskOrders`), birim testli. Sayfa atölyenin tüm açık işlerini her zaman çeker (BAK-157 görünürlüğü) ve "odak teknisyeni"ne göre gruplar. Saha rolünde odak kendisi, yöneticide seçilen teknisyendir. Bileşen yalnız sunum yapar. Şema/action değişikliği yok.

**Tech Stack:** Next.js 16 App Router (server page, `searchParams` Promise), React client component, shadcn/ui Radix hattı (`Button asChild`, `Collapsible`, `Item`, `Select`), Tailwind v4, `bun test`.

**Spec:** `docs/superpowers/specs/2026-11-27-technician-kiosk-design.md` (§ Ana ekran)

## Global Constraints

- Worktree: `/Users/void/www/bakimx-1035`, dal `issue/1035-technician-kiosk-home`. Primary checkout'a dokunma.
- Görünürlük değişmez: `technicianOrderListWhere` ve `order-visibility.test.ts` olduğu gibi kalır. Kiracı filtresi `user.workshopId`.
- `Button`'da `h-*`, `size-*`, `rounded-*`, `text-*`, `py-*`, `font-*`, nötr `bg-*` yok. Ölçü `size`, görünüm `variant` ile (`control-call-sites.test.ts`). `w-full` serbest.
- Ham `<button>` / `<a>` tuş yok. Link-tuş `<Button asChild><Link …>…</Link></Button>`.
- Aç/kapa `Collapsible` + `CollapsibleTrigger asChild` + `Button` ile; elle `aria-expanded`/`<details>` yok.
- Gün sınırı `istanbulDayStart()` (`@/lib/istanbul-time`), tarih biçimi `@/lib/format-date`. `new Date(y,m,d)` / `setHours` / `toLocale*` yok.
- Renk yalnız tema token'ı. Tint + metin aynı elemandaysa `-strong` ton.
- Kopya (Türkçe, aynen): bölüm başlıkları `İşlerim`, `Atölyedeki diğer işler`, `Taslak`, `Bugün biten`. Tuşlar `Araç Kabul`, `Parça Ara`. Boş durum `Sana atanmış iş yok`.
- Kapılar, sırayla: `bun test` → `bun run lint` (0 hata) → `bun run typecheck` → `bun run build`.

## Review Focus

1. **Yönetici hiç teknisyen seçmeden gelir** (`?technician` yok): `resolveSelectedTechnicianId` ilk teknisyeni seçer, İşlerim o teknisyenin işleri olur. Sayfa çökmez. → Task 3 sayfa testi.
2. **Saha kullanıcısının `technicianId`'si yok ya da pasif:** bugünkü "Henüz teknisyen kaydı yok" kartı yerine kendi işi olmayan saha kullanıcısı da listeyi görebilmeli. Odak yoksa İşlerim boştur, diğer işler yine görünür. → Task 1 `focusTechnicianId: null` testi.
3. **Taslak bana atanmış:** taslak her zaman Taslak grubundadır, İşlerim'e girmez. Aynı iş iki grupta görünmez. → Task 1.
4. **Gece yarısı sınırı:** TR 00:30'da tamamlanan iş "Bugün biten"de, TR dün 23:30'da tamamlanan iş yoktur (UTC prod). → Task 2.
5. **50 iş sınırı:** `getTechnicianOrders` `take: 50` ile atölyeyi keser. Kalabalık atölyede ustanın kendi işi bu 50'nin dışında kalabilir. İşlerim ayrı sorguyla (odak teknisyeniyle filtreli) çekilir, diğer işler 50 ile sınırlı kalır. → Task 3.

---

### Task 1: Gruplama fonksiyonu

**Files:**
- Create: `src/lib/technician/kiosk-home.ts`
- Test: `src/lib/technician/kiosk-home.test.ts`

**Interfaces:**
- Consumes: `TechnicianOrderRow` (`@/lib/technician/queries`).
- Produces:
  ```ts
  export type KioskOrderGroups = { mine: TechnicianOrderRow[]; others: TechnicianOrderRow[]; drafts: TechnicianOrderRow[] }
  export function groupKioskOrders(mine: TechnicianOrderRow[], workshop: TechnicianOrderRow[], focusTechnicianId: string | null): KioskOrderGroups
  ```
  - `mine`: ilk argümandan `status !== "draft"` olanlar.
  - `drafts`: iki listenin birleşiminden (id ile tekilleştirilmiş) `status === "draft"` olanlar.
  - `others`: `workshop`'tan, `mine`'da olmayan ve taslak olmayanlar.
  - Sıra her grupta: `in_progress` önce, sonra `createdAt` azalan. `hasActiveLabor` olan `in_progress` en üstte.

- [ ] **Step 1: Failing testleri yaz.** Bir `row(overrides)` yardımcısı ile:
  - `taslak iş İşlerim'e girmez, Taslak'ta bir kez görünür`: mine=[d(draft, mine)], workshop=[d] → `mine` boş, `drafts.map(id)` = `["d"]`.
  - `bana atanan iş diğer işlerde tekrar görünmez`: mine=[a], workshop=[a,b] → `others.map(id)` = `["b"]`.
  - `serviste olan önce gelir, aktif işçilik en üstte`: üç `in_progress`/`waiting_parts` iş → beklenen id sırası.
  - `odak yoksa İşlerim boş, atölye işleri görünür`: `groupKioskOrders([], [a,b], null)` → `mine` = [], `others` uzunluğu 2.
- [ ] **Step 2:** `bun test src/lib/technician/kiosk-home.test.ts`. Beklenen: modül yok hatasıyla FAIL.
- [ ] **Step 3:** `kiosk-home.ts`'i yaz (saf, Prisma import'u yok; `TechnicianOrderRow` yalnız `import type`).
- [ ] **Step 4:** Aynı komut. Beklenen: PASS.
- [ ] **Step 5:** Commit: `feat(#1035): kiosk ana ekranı iş gruplaması`.

### Task 2: "Bugün biten" İstanbul gününe göre

**Files:**
- Modify: `src/lib/technician/queries.ts:165` (`getRecentCompletedTechnicianOrders`)
- Modify: `src/lib/technician/queries.ts:15-85` (`getTechnicianDashboardStats` ve `TechnicianDashboardStats`; Task 3'ten sonra çağıranı kalmayacak, silinir)
- Test: `src/lib/technician/kiosk-home.test.ts` (ekle)

**Interfaces:**
- Produces:
  - `export function completedTodayWhere(workshopId: string, now: Date, technicianId?: string): Prisma.ServiceOrderWhereInput` (`kiosk-home.ts` içinde). `completedAt: { gte: istanbulDayStart(now) }`, `status: { in: ["ready_for_delivery", "delivered"] }`.
  - `getCompletedTodayTechnicianOrders(workshopId: string, technicianId?: string): Promise<TechnicianOrderRow[]>`. Eski `getRecentCompletedTechnicianOrders`'ın yerine geçer; satır eşlemesi aynı kalır. Eşlemeyi iki fonksiyon arasında ortak bir `toTechnicianOrderRow` yardımcısına çekmek serbest.
- [ ] **Step 1: Failing test.** `completedTodayWhere("w", new Date("2026-11-27T21:30:00Z"))` (TR 28-11 00:30) → `completedAt.gte` = `new Date("2026-11-27T21:00:00Z")`. `now = 2026-11-27T20:30:00Z` (TR 27-11 23:30) → `gte` = `2026-11-26T21:00:00Z`. `workshopId` her zaman var; `technicianId` verilmezse `assignedTechnicianId` anahtarı yok.
- [ ] **Step 2:** `bun test src/lib/technician/kiosk-home.test.ts`. Beklenen: FAIL.
- [ ] **Step 3:** Fonksiyonu yaz; sorguyu ona bağla. `getTechnicianDashboardStats`'ı silmeyi Task 3'e bırak (o anda çağıranı hâlâ var).
- [ ] **Step 4:** Test PASS. `bun test src/lib/istanbul-bounds-coverage.test.ts src/lib/format-date-coverage.test.ts` PASS.
- [ ] **Step 5:** Commit: `feat(#1035): bugün biten işler İstanbul gün sınırıyla`.

### Task 3: Sayfa + kiosk ana ekran bileşeni

**Files:**
- Modify: `src/app/(app)/technician/page.tsx`
- Modify (yeniden yaz): `src/components/technician/technician-dashboard.tsx` → `TechnicianKioskHome` dışa aktarımı (dosya adı kalabilir)
- Modify: `src/components/technician/technician-quick-actions.tsx`
- Modify: `src/lib/technician/queries.ts` (`getTechnicianDashboardStats` sil)
- Test (yeniden yaz): `src/components/technician/technician-dashboard.test.ts`
- Test (dokunma, yeşil kalmalı): `src/lib/sidebarless-route.test.ts`

**Interfaces:**
- Consumes: `groupKioskOrders`, `getCompletedTodayTechnicianOrders`, `getTechnicianOrders(workshopId, technicianId?)`.
- Sayfa:
  - Odak:
    - Saha rolü: `focusTechnicianId = user.technicianId`, aktif teknisyenlerde yoksa `null`.
    - Yönetici: `resolveSelectedTechnicianId(params.technician, ids)`.
  - Sorgular (paralel):
    - `getTechnicianOrders(ws, focusId)` (yalnız focusId varsa, yoksa `[]`)
    - `getTechnicianOrders(ws)`
    - `getCompletedTodayTechnicianOrders(ws, canSelect ? focusId : undefined)`
  - Kalkanlar: `mine` / `filter` parametreleri ve `getTechnicianDashboardStats`.
  - "Henüz teknisyen kaydı yok" kartı yalnız **yönetici** ve atölyede hiç aktif teknisyen yokken gösterilir. Saha rolü odaksız da olsa listeyi görür.
- Bileşen props:
  ```ts
  { technicians: { id: string; fullName: string }[]; focusTechnicianId: string | null; canSelectTechnician: boolean;
    greetingName: string | null; groups: KioskOrderGroups; completedToday: TechnicianOrderRow[] }
  ```
- `TECHNICIAN_QUICK_ACTIONS` dışa aktarımı ve `href`'leri aynı kalır (sidebarless testi buna bakıyor). `title` `Parça Sorgulama` → `Parça Ara`. `tone` alanı kalkar, yerine `variant: "default" | "outline"`.

Düzen (telefon önce, e-santral):
- Üst satır: `Merhaba {greetingName}` ve `{mine.length} iş`. Yöneticide altında teknisyen `Select`.
- `grid grid-cols-2 gap-3`: iki `Button asChild size="xl" className="w-full"`. Araç Kabul `variant="default"`, Parça Ara `variant="outline"`. İkon + başlık.
- **İşlerim:** çerçevesiz beyaz kart listesi. Her iş, mevcut `OrderCard`'ın sadeleşmiş hâli (`Item` link → `/technician/orders/{id}`):
  - `Plate size="lg"`, `StatusBadge`;
  - marka model · şikâyet (tek satır, kırpılır);
  - kontrol ilerlemesi `completed/total` (total > 0 ise);
  - `hasActiveLabor` rozeti.
  - Kart en az 44px dokunma hedefi.
- Boş İşlerim: `Sana atanmış iş yok` + açıklama "Atölyedeki diğer işler aşağıda".
- Üç `Collapsible` (kapalı başlar, `variant`'lı `Button` tetikleyici, başlıkta sayı): Atölyedeki diğer işler, Taslak, Bugün biten. Sayısı 0 olan grup hiç çizilmez. Diğer işlerde kartta atanan teknisyen adı (yoksa "Atanmamış") görünür.
- Sayfalama (`useDashboardPage`) ve KPI kartları kalkar. Kullanılmayan yardımcılar silinir.

- [ ] **Step 1: Kaynak testini yeniden yaz** (`technician-dashboard.test.ts`, mevcut dosyanın kaynağı okuma desenini izle). Testler:
  - `İşlerim, Atölyedeki diğer işler, Taslak, Bugün biten başlıklarını içerir`.
  - `KPI filtre kartı ve Bana atananlar anahtarı yoktur`: kaynakta `filter=`, `"mine"`, `Switch` geçmez.
  - `gruplar Collapsible ile açılır kapanır`: `CollapsibleTrigger asChild` var, `aria-expanded` yok.
  - `hızlı işlemler Button asChild + size="xl"`: quick-actions kaynağında `asChild`, `size="xl"` var, `min-h-36` yok.
  - `iş kartı teknisyen iş ekranına gider`: `/technician/orders/` geçer.
- [ ] **Step 2:** `bun test src/components/technician/technician-dashboard.test.ts`. Beklenen: FAIL.
- [ ] **Step 3:** `technician-quick-actions.tsx`'i Button tabanlı yaz.
- [ ] **Step 4:** Bileşeni yaz.
- [ ] **Step 5:** Sayfayı yaz. `getTechnicianDashboardStats`'ı sil.
- [ ] **Step 6:** `bun test src/components/technician src/lib/technician src/lib/sidebarless-route.test.ts src/components/ui src/lib/ui-contract.test.ts src/lib/theme-tokens.test.ts src/lib/nested-radius.test.ts`. Beklenen: hepsi PASS.
- [ ] **Step 7:** Commit: `feat(#1035): teknisyen kiosk ana ekranı`.

### Task 4: Kapılar + tarayıcı QA

- [ ] **Step 1:** `git fetch origin dev && git merge origin/dev`. Çakışma olursa çöz: #1017 `technician-quick-actions.tsx`'e dokunuyor.
- [ ] **Step 2:** `bun test` (çıkış kodu 0, `0 fail`), `bun run lint` (0 error), `bun run typecheck`, `bun run build`.
- [ ] **Step 3:** QA (bakimx-qa).
  - Ortam: port 3235, izole yerel DB + seed.
  - Genişlikler: 375px ve 1280px.
  - (a) `admin@bakimx.com`: teknisyen seçimi değişince İşlerim değişir.
  - (b) seed `usta`:
    - kendi işleri üstte;
    - Araç Kabul ile açılan atanmamış kayıt "Atölyedeki diğer işler"de;
    - Taslak ve Bugün biten açılıp kapanır;
    - iş kartı iş ekranını açar.
  - Konsol hatası olmamalı.
- [ ] **Step 4:** PR → `dev`, gövdede `Closes #1035`.
