# Teknisyen İş Takibi — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teknisyene atanan iş emrinde jenerik kontrol maddeleri otomatik oluşsun ve zorunlu olsun; iş emrindeki her parça/işçilik kaleminin yapılıp yapılmadığı takip edilsin; parça talebi araç kataloğundan yapılsın ve ofis talebi tek tıkla iş emri kalemine çevirsin.

**Architecture:** Kontrol listesi kodda sabit bir şablondan (`CHECKLIST_TEMPLATE`) teknisyen atama anında `templateKey` ile idempotent şekilde seed edilir. Zorunluluk kapıları saf yardımcı fonksiyonlarda (`gates.ts`) hesaplanır, server action'larda uygulanır, UI'da yalnız görünürlük için tekrarlanır. Kalem tamamlama `ServiceOrderItem` üzerinde üç kolonla tutulur — kopya kayıt yok.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma + PostgreSQL, TypeScript strict, Zod v4, Base UI tabanlı `src/components/ui/*`, `bun test`.

## Global Constraints

- Paket yöneticisi **bun**. Testler `bun test`, lint `bun run lint`, typecheck `bun run typecheck`.
- Şema değişikliği **yalnız** `bun run db:migrate --name <ad>` ile yazılır (yerel throwaway Postgres); AWS dev'e `bun run db:tunnel` + `bun run db:deploy` ile gider. `prisma db push` KULLANILMAZ.
- Her sorgu tenant izolasyonlu: `workshopId` her zaman `requireWritableWorkshop()`ten gelen `user.workshopId`; istemciden gelen workshop parametresine asla güvenilmez.
- Kilitli iş emri (`isOrderLocked(status)` → delivered/cancelled) hiçbir yazma işlemini kabul etmez; hata metni mevcut `ORDER_LOCKED_ERROR` sabiti.
- Tüm kullanıcıya görünen metinler Türkçe.
- Mobil öncelikli: dokunma hedefleri ≥44px, `touch-manipulation` sınıfı, yatay taşma yok. Yeni `fixed`/`sticky` alt CTA barı EKLENMEZ.
- `any` kullanılmaz. Yeni UI bileşenleri `src/components/ui/*` (Base UI) üzerinden kurulur, elle özel UI yazılmaz.
- Bu repoda server action / DB testi altyapısı YOK. Test yazılabilen yerler yalnız saf fonksiyonlar ve Zod şemalarıdır; geri kalanı typecheck + manuel QA ile doğrulanır. Test yokluğu bir görevi "test yazılmadı" diye atlamak için gerekçe değildir — saf mantık her zaman ayrı bir fonksiyona çıkarılıp test edilir.
- Çalışma dizini: `/Users/void/www/bakimx-tech-tracking` (worktree), dal `feat/technician-work-tracking`, base `dev`. PR base'i `dev`.
- Spec: `docs/superpowers/specs/2026-07-27-technician-work-tracking-design.md`

---

## Dosya Haritası

**Yeni:**
- `src/lib/technician/checklist-template.ts` — sabit şablon + `missingTemplateItems` (saf)
- `src/lib/technician/checklist-template.test.ts`
- `src/lib/technician/checklist-seed.ts` — `seedChecklistFromTemplate` (Prisma transaction client alır)
- `src/lib/technician/gates.ts` — kapı hesapları + hata metinleri (saf)
- `src/lib/technician/gates.test.ts`
- `src/components/technician/order-items-checklist.tsx` — teknisyen "Yapılacak İşler" bölümü
- `src/components/orders/parts-request-panel.tsx` — ofis "Parça Talepleri" kartı

**Değişecek:**
- `prisma/schema.prisma` — 7 kolon + 1 adlandırılmış relation
- `src/app/(app)/technician/actions.ts` — seed bağlama, kapılar, silme koruması, kalem toggle, talep alanları
- `src/app/(app)/orders/actions.ts` — talebi kaleme çevirme (dosya yoksa teknisyen actions'a eklenir, bkz. Task 9)
- `src/lib/validations/technician.ts` — `partsRequestSchema` genişletme
- `src/app/(app)/technician/orders/[id]/page.tsx` — `catalogVehicleTypeId`, kalem `completedAt`, talep `brand`
- `src/components/technician/technician-order-detail.tsx` — kalem bölümü, kapı görünürlüğü, talep formu
- `src/app/(app)/orders/[id]/page.tsx` — `partsRequests` include + kalem `completedAt`
- `src/components/orders/work-order-detail.tsx` — "parca" sekmesine talep kartı
- `src/components/orders/order-management-panel.tsx` — `OrderItem` tipine `completedAt`
- `src/components/orders/parts-labor-grid.tsx` — "Yapıldı" rozeti

---

### Task 1: Şema + migration

**Files:**
- Modify: `prisma/schema.prisma` (`ChecklistItem` ~1175, `ServiceOrderItem` ~761, `PartsRequest` ~1222, `Technician` ~627)

**Interfaces:**
- Produces: `ChecklistItem.isRequired`, `ChecklistItem.templateKey`, `ServiceOrderItem.completedAt/completedById/completionNote`, `PartsRequest.brand/tecdocArticleId` — sonraki tüm görevler bu alanlara dayanır.

- [ ] **Step 1: `ChecklistItem`'a iki kolon ekle**

`prisma/schema.prisma` içinde `model ChecklistItem` gövdesine, `sortOrder` satırının hemen altına:

```prisma
  /// Sistem şablonundan gelen madde mi — teknisyen silemez, kapılarda zorunlu sayılır.
  isRequired     Boolean           @default(false)
  /// Şablon maddesinin sabit anahtarı (örn. "inspection.mileage_fuel").
  /// Dolu ⇒ şablondan geldi; seed'in idempotent olmasını sağlar. Serbest maddede null.
  templateKey    String?
```

ve `@@index([isCompleted])` satırının altına:

```prisma
  @@index([serviceOrderId, templateKey])
```

- [ ] **Step 2: `ServiceOrderItem`'a üç kolon ekle**

`model ServiceOrderItem` içinde `photos VehiclePhoto[]` satırının hemen üstüne:

```prisma
  // --- Teknisyen tamamlama takibi ---
  // Dolu ⇒ kalem sahada yapıldı. Ofis buradan işaretlemez, yalnız görür.
  completedAt        DateTime?
  // Atanmış usta (Technician↔User bağı yok); gerçek kullanıcı AuditLog'a düşer.
  completedById      String?
  completedBy        Technician?      @relation("ItemCompletedBy", fields: [completedById], references: [id])
  completionNote     String?
```

ve index bloğuna:

```prisma
  @@index([serviceOrderId, completedAt])
```

- [ ] **Step 3: `Technician`'a ters ilişki ekle**

`model Technician` içinde `purchasedItems ServiceOrderItem[]` satırının altına:

```prisma
  completedItems ServiceOrderItem[] @relation("ItemCompletedBy")
```

Dikkat: `purchasedItems` ilişkisi zaten `ServiceOrderItem`'a bakıyor; adlandırılmış relation olmadan Prisma "ambiguous relation" hatası verir.

- [ ] **Step 4: `PartsRequest`'e iki kolon ekle**

`model PartsRequest` içinde `partSku` satırının altına:

```prisma
  /// Katalogdan seçildiyse parça markası (TecDoc supplier adı); serbest metinde null.
  brand          String?
  /// Katalogdan seçildiyse TecDoc article id — ofis talebi kalemlerken taşınır.
  tecdocArticleId Int?
```

- [ ] **Step 5: Şemayı doğrula**

```bash
bun run db:validate
```
Beklenen: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 6: Migration üret**

```bash
bun run db:migrate --name technician_work_tracking
```
Beklenen: `prisma/migrations/<zaman>_technician_work_tracking/migration.sql` oluşur, yalnız `ALTER TABLE ... ADD COLUMN` ve `CREATE INDEX` içerir. `DROP` veya `NOT NULL` (varsayılansız) ifadesi varsa DUR ve nedenini araştır.

Not: yerel Postgres kapalıysa script OrbStack'i kendisi ayağa kaldırır (`docker-compose.local.yml`). Bu, üretim Docker'ı değil — kural ihlali değildir.

- [ ] **Step 7: Prisma client'ı üret ve typecheck**

```bash
bun run db:generate && bun run typecheck
```
Beklenen: hata yok.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): teknisyen iş takibi kolonları — zorunlu kontrol maddesi, kalem tamamlama, talep marka/article"
```

---

### Task 2: Kontrol listesi şablonu (TDD)

**Files:**
- Create: `src/lib/technician/checklist-template.ts`
- Test: `src/lib/technician/checklist-template.test.ts`

**Interfaces:**
- Consumes: Task 1'in `templateKey` alanı.
- Produces:
  - `CHECKLIST_TEMPLATE: ChecklistTemplateItem[]`
  - `interface ChecklistTemplateItem { key: string; category: ChecklistCategory; description: string }`
  - `missingTemplateItems(existingKeys: string[]): ChecklistTemplateItem[]`
  - `templateSortOrder(key: string): number`

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/technician/checklist-template.test.ts`:

```ts
import { test, expect } from "bun:test"
import { CHECKLIST_TEMPLATE, missingTemplateItems, templateSortOrder } from "./checklist-template"

test("şablon üç kategoriyi de kapsar", () => {
  const cats = new Set(CHECKLIST_TEMPLATE.map((t) => t.category))
  expect(cats).toEqual(new Set(["inspection", "repair", "delivery"]))
})

test("şablon anahtarları benzersizdir", () => {
  const keys = CHECKLIST_TEMPLATE.map((t) => t.key)
  expect(new Set(keys).size).toBe(keys.length)
})

test("boş iş emrinde tüm maddeler eksik sayılır", () => {
  expect(missingTemplateItems([])).toHaveLength(CHECKLIST_TEMPLATE.length)
})

test("var olan anahtarlar tekrar üretilmez (idempotent seed)", () => {
  const half = CHECKLIST_TEMPLATE.slice(0, 3).map((t) => t.key)
  const missing = missingTemplateItems(half)
  expect(missing).toHaveLength(CHECKLIST_TEMPLATE.length - 3)
  expect(missing.some((m) => half.includes(m.key))).toBe(false)
})

test("bilinmeyen anahtarlar eksik hesabını bozmaz", () => {
  expect(missingTemplateItems(["serbest.madde"])).toHaveLength(CHECKLIST_TEMPLATE.length)
})

test("sortOrder şablon sırasını korur", () => {
  expect(templateSortOrder(CHECKLIST_TEMPLATE[0].key)).toBe(0)
  expect(templateSortOrder(CHECKLIST_TEMPLATE[2].key)).toBe(2)
  expect(templateSortOrder("yok")).toBe(0)
})

test("kategoriler şablonda bloklar hâlinde sıralıdır", () => {
  const order = CHECKLIST_TEMPLATE.map((t) => t.category)
  const firstDelivery = order.indexOf("delivery")
  const lastInspection = order.lastIndexOf("inspection")
  expect(lastInspection).toBeLessThan(firstDelivery)
})
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

```bash
bun test src/lib/technician/checklist-template.test.ts
```
Beklenen: FAIL — `Cannot find module './checklist-template'`

- [ ] **Step 3: Şablonu yaz**

`src/lib/technician/checklist-template.ts`:

```ts
import type { ChecklistCategory } from "@prisma/client"

/**
 * Sabit sistem şablonu: teknisyene atanan her iş emrinde otomatik oluşan
 * jenerik kontrol maddeleri. Atölye-özel şablon bilinçli olarak kapsam dışı —
 * önce bu sabit set sahada denenecek.
 *
 * `key` KALICI bir sözleşmedir: seed idempotanlığı ve "zorunlu madde silinemez"
 * kuralı buna dayanır. Var olan bir anahtarı DEĞİŞTİRME (eski iş emirlerinde
 * kopya madde üretir); metni düzeltmek serbesttir, anahtarı sabit bırak.
 */
export interface ChecklistTemplateItem {
  key: string
  category: ChecklistCategory
  description: string
}

export const CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  // Kontrol — araç teslim alınırken
  { key: "inspection.mileage_fuel", category: "inspection", description: "Araç KM ve yakıt seviyesi kaydedildi" },
  { key: "inspection.visible_damage", category: "inspection", description: "Görünür hasar/çizik kontrol edildi" },
  { key: "inspection.complaint_confirmed", category: "inspection", description: "Müşteri şikayeti araç üzerinde teyit edildi" },
  { key: "inspection.personal_items", category: "inspection", description: "Araç içi kişisel eşya kontrolü yapıldı" },
  { key: "inspection.fluid_levels", category: "inspection", description: "Motor yağı ve soğutma sıvısı seviyeleri kontrol edildi" },
  { key: "inspection.battery", category: "inspection", description: "Akü ve şarj durumu kontrol edildi" },
  { key: "inspection.tires", category: "inspection", description: "Lastik durumu ve hava basıncı kontrol edildi" },
  { key: "inspection.brakes", category: "inspection", description: "Fren balata/disk gözle kontrol edildi" },

  // Onarım
  { key: "repair.items_done", category: "repair", description: "İş emrindeki tüm parça ve işçilik kalemleri tamamlandı" },
  { key: "repair.old_parts_kept", category: "repair", description: "Sökülen parçalar müşteriye gösterilmek üzere ayrıldı" },
  { key: "repair.retested", category: "repair", description: "Arıza tekrar test edildi, giderildiği doğrulandı" },
  { key: "repair.fault_codes", category: "repair", description: "Hata kodu / uyarı lambası kontrolü yapıldı" },

  // Teslim
  { key: "delivery.road_test", category: "delivery", description: "Yol testi yapıldı" },
  { key: "delivery.leak_check", category: "delivery", description: "Sıvı kaçağı kontrolü yapıldı" },
  { key: "delivery.cleanup", category: "delivery", description: "Araç içi/dışı temizlik yapıldı, aletler toplandı" },
  { key: "delivery.customer_summary", category: "delivery", description: "Yapılan işlemler müşteriye aktarılacak şekilde özetlendi" },
]

const ORDER_BY_KEY = new Map(CHECKLIST_TEMPLATE.map((t, i) => [t.key, i]))

/** Şablondaki sabit sıra — listede kategori blokları bozulmasın diye. */
export function templateSortOrder(key: string): number {
  return ORDER_BY_KEY.get(key) ?? 0
}

/** Şablondan, verilen iş emrinde HENÜZ olmayan maddeler. */
export function missingTemplateItems(existingKeys: string[]): ChecklistTemplateItem[] {
  const seen = new Set(existingKeys)
  return CHECKLIST_TEMPLATE.filter((t) => !seen.has(t.key))
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

```bash
bun test src/lib/technician/checklist-template.test.ts
```
Beklenen: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/technician/checklist-template.ts src/lib/technician/checklist-template.test.ts
git commit -m "feat(technician): jenerik kontrol listesi şablonu + idempotent eksik-madde hesabı"
```

---

### Task 3: Seed'i atamaya bağla + zorunlu madde silme koruması

**Files:**
- Create: `src/lib/technician/checklist-seed.ts`
- Modify: `src/app/(app)/technician/actions.ts` (`assignTechnicianAction` 13-50, `deleteChecklistItemAction` 277-298)

**Interfaces:**
- Consumes: `CHECKLIST_TEMPLATE`, `missingTemplateItems`, `templateSortOrder` (Task 2).
- Produces: `seedChecklistFromTemplate(tx, workshopId, serviceOrderId): Promise<number>` — eklenen madde sayısını döner.

- [ ] **Step 1: Seed yardımcısını yaz**

`src/lib/technician/checklist-seed.ts`:

```ts
import type { Prisma } from "@prisma/client"
import { missingTemplateItems, templateSortOrder } from "./checklist-template"

/**
 * İş emrine sistem şablonundaki eksik kontrol maddelerini ekler.
 *
 * İdempotent: var olan `templateKey`ler atlanır — yeniden atama veya usta
 * değişikliği madde çoğaltmaz, işaretlenmiş maddeleri sıfırlamaz.
 * Satır-başına upsert yerine tek `createMany` (transaction süresi kritik).
 */
export async function seedChecklistFromTemplate(
  tx: Prisma.TransactionClient,
  workshopId: string,
  serviceOrderId: string
): Promise<number> {
  const existing = await tx.checklistItem.findMany({
    where: { workshopId, serviceOrderId, templateKey: { not: null } },
    select: { templateKey: true },
  })

  const missing = missingTemplateItems(
    existing.map((e) => e.templateKey).filter((k): k is string => k !== null)
  )
  if (missing.length === 0) return 0

  await tx.checklistItem.createMany({
    data: missing.map((t) => ({
      workshopId,
      serviceOrderId,
      category: t.category,
      description: t.description,
      isRequired: true,
      templateKey: t.key,
      sortOrder: templateSortOrder(t.key),
    })),
  })

  return missing.length
}
```

- [ ] **Step 2: `assignTechnicianAction`'ı transaction'a al ve seed'i çağır**

`src/app/(app)/technician/actions.ts` içinde mevcut `await prisma.serviceOrder.updateMany({...})` bloğunu (satır ~29-37) şununla değiştir:

```ts
  const seededCount = await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.updateMany({
      where: { id: orderId, workshopId: user.workshopId },
      data: {
        assignedTechnicianId: technicianId,
        assignedAt: new Date(),
        technicianName: technician.fullName,
      },
    })
    // Jenerik kontrol maddeleri atama anında oluşur; idempotent olduğu için
    // yeniden atamada tekrar eklenmez.
    return seedChecklistFromTemplate(tx, user.workshopId, orderId)
  })
```

Dosyanın üstüne import ekle:

```ts
import { seedChecklistFromTemplate } from "@/lib/technician/checklist-seed"
```

Aynı action'daki `AuditLogAction` çağrısının metadata'sına seed sayısını ekle:

```ts
  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, "technician_assigned", JSON.stringify({ technicianId, technicianName: technician.fullName, checklistSeeded: seededCount }))
```

ve `revalidatePath` listesine teknisyen detayını ekle:

```ts
  revalidatePath(`/technician/orders/${orderId}`)
```

- [ ] **Step 3: Zorunlu maddenin silinmesini engelle**

`deleteChecklistItemAction` içinde `if (!item) return { error: "Kontrol maddesi bulunamadı" }` satırının hemen altına:

```ts
  if (item.isRequired) return { error: "Zorunlu kontrol maddesi silinemez" }
```

- [ ] **Step 4: Typecheck + lint**

```bash
bun run typecheck && bun run lint
```
Beklenen: hata yok.

- [ ] **Step 5: Manuel doğrulama**

Dev sunucusu açıkken (`bun run dev`, DB tüneli açık): ofis `/orders/<id>` → Ekip/atama alanından bir usta ata → `/technician/orders/<id>` sayfasında 16 madde üç kategoride görünür. Aynı emri başka bir ustaya ata → madde sayısı 16 kalır.

- [ ] **Step 6: Commit**

```bash
git add src/lib/technician/checklist-seed.ts "src/app/(app)/technician/actions.ts"
git commit -m "feat(technician): atamada jenerik kontrol listesi seed'i + zorunlu madde silme koruması"
```

---

### Task 4: Kapı hesapları (TDD)

**Files:**
- Create: `src/lib/technician/gates.ts`
- Test: `src/lib/technician/gates.test.ts`

**Interfaces:**
- Produces:
  - `interface GateChecklistItem { category: string; isCompleted: boolean; isRequired: boolean }`
  - `interface GateOrderItem { completedAt: Date | string | null }`
  - `countBlockingChecklist(items: GateChecklistItem[], categories: string[]): number`
  - `countIncompleteItems(items: GateOrderItem[]): number`
  - `startWorkBlockMessage(missingChecklist: number): string | null`
  - `completeWorkBlockMessage(missingChecklist: number, missingItems: number): string | null`
  - `START_GATE_CATEGORIES`, `COMPLETE_GATE_CATEGORIES` sabitleri

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/technician/gates.test.ts`:

```ts
import { test, expect } from "bun:test"
import {
  countBlockingChecklist,
  countIncompleteItems,
  startWorkBlockMessage,
  completeWorkBlockMessage,
  START_GATE_CATEGORIES,
  COMPLETE_GATE_CATEGORIES,
} from "./gates"

const req = (category: string, isCompleted: boolean) => ({ category, isCompleted, isRequired: true })

test("yalnız zorunlu maddeler bloklar", () => {
  const items = [
    req("inspection", false),
    { category: "inspection", isCompleted: false, isRequired: false },
  ]
  expect(countBlockingChecklist(items, START_GATE_CATEGORIES)).toBe(1)
})

test("başlama kapısı yalnız kontrol kategorisine bakar", () => {
  const items = [req("inspection", true), req("repair", false), req("delivery", false)]
  expect(countBlockingChecklist(items, START_GATE_CATEGORIES)).toBe(0)
})

test("tamamlama kapısı onarım + teslim kategorilerine bakar", () => {
  const items = [req("inspection", false), req("repair", false), req("delivery", false)]
  expect(countBlockingChecklist(items, COMPLETE_GATE_CATEGORIES)).toBe(2)
})

test("tamamlanmamış kalem sayısı completedAt'e bakar", () => {
  expect(countIncompleteItems([{ completedAt: null }, { completedAt: new Date() }, { completedAt: "2026-07-27T00:00:00.000Z" }])).toBe(1)
})

test("kalem yoksa engel yok", () => {
  expect(countIncompleteItems([])).toBe(0)
})

test("eksik yoksa başlama mesajı null", () => {
  expect(startWorkBlockMessage(0)).toBeNull()
})

test("eksik varsa başlama mesajı sayıyı içerir", () => {
  expect(startWorkBlockMessage(3)).toBe("Araç kabul kontrolleri tamamlanmadan işe başlanamaz (3 madde eksik)")
})

test("tamamlama mesajı iki eksiği birlikte anlatır", () => {
  expect(completeWorkBlockMessage(2, 3)).toBe("İş tamamlanamaz: 2 kontrol maddesi ve 3 iş kalemi eksik")
})

test("tamamlama mesajı yalnız kontrol eksiğinde", () => {
  expect(completeWorkBlockMessage(2, 0)).toBe("İş tamamlanamaz: 2 kontrol maddesi eksik")
})

test("tamamlama mesajı yalnız kalem eksiğinde", () => {
  expect(completeWorkBlockMessage(0, 1)).toBe("İş tamamlanamaz: 1 iş kalemi \"yapıldı\" olarak işaretlenmedi")
})

test("hiç eksik yoksa tamamlama mesajı null", () => {
  expect(completeWorkBlockMessage(0, 0)).toBeNull()
})
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

```bash
bun test src/lib/technician/gates.test.ts
```
Beklenen: FAIL — `Cannot find module './gates'`

- [ ] **Step 3: Kapı yardımcılarını yaz**

`src/lib/technician/gates.ts`:

```ts
/**
 * Zorunluluk kapılarının saf hesabı. Server action'lar veriyi çeker,
 * burada karar verilir; aynı fonksiyonlar UI'da buton durumunu göstermek
 * için de kullanılır (tek doğruluk kaynağı, iki yerde kopya mantık yok).
 */

export interface GateChecklistItem {
  category: string
  isCompleted: boolean
  isRequired: boolean
}

export interface GateOrderItem {
  completedAt: Date | string | null
}

/** "İşe Başla" kapısı: araç teslim alınırken yapılması gerekenler. */
export const START_GATE_CATEGORIES = ["inspection"] as const
/** "Tamamla" kapısı: onarım ve teslim kontrolleri. */
export const COMPLETE_GATE_CATEGORIES = ["repair", "delivery"] as const

export function countBlockingChecklist(
  items: GateChecklistItem[],
  categories: readonly string[]
): number {
  return items.filter((i) => i.isRequired && !i.isCompleted && categories.includes(i.category)).length
}

export function countIncompleteItems(items: GateOrderItem[]): number {
  return items.filter((i) => !i.completedAt).length
}

export function startWorkBlockMessage(missingChecklist: number): string | null {
  if (missingChecklist <= 0) return null
  return `Araç kabul kontrolleri tamamlanmadan işe başlanamaz (${missingChecklist} madde eksik)`
}

export function completeWorkBlockMessage(
  missingChecklist: number,
  missingItems: number
): string | null {
  if (missingChecklist <= 0 && missingItems <= 0) return null
  if (missingChecklist > 0 && missingItems > 0) {
    return `İş tamamlanamaz: ${missingChecklist} kontrol maddesi ve ${missingItems} iş kalemi eksik`
  }
  if (missingChecklist > 0) {
    return `İş tamamlanamaz: ${missingChecklist} kontrol maddesi eksik`
  }
  return `İş tamamlanamaz: ${missingItems} iş kalemi "yapıldı" olarak işaretlenmedi`
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

```bash
bun test src/lib/technician/gates.test.ts
```
Beklenen: PASS (11 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/technician/gates.ts src/lib/technician/gates.test.ts
git commit -m "feat(technician): zorunluluk kapılarının saf hesabı + hata metinleri"
```

---

### Task 5: Kapıları server action'lara uygula

**Files:**
- Modify: `src/app/(app)/technician/actions.ts` (`startWorkAction` 85-116, `completeWorkAction` 151-185)

**Interfaces:**
- Consumes: Task 4'ün tüm dışa açık fonksiyonları.
- Produces: `startWorkAction`/`completeWorkAction` artık `{ error: string }` ile bloklayabilir — UI aynı şekli zaten işliyor.

- [ ] **Step 1: `startWorkAction`'a kontrol kapısını ekle**

`canTransitionOrder` kontrolünün hemen ALTINA (durum geçişi zaten geçersizse kapıyı hesaplamaya gerek yok):

```ts
  const checklist = await prisma.checklistItem.findMany({
    where: { serviceOrderId: orderId, workshopId: user.workshopId },
    select: { category: true, isCompleted: true, isRequired: true },
  })
  const startBlock = startWorkBlockMessage(countBlockingChecklist(checklist, START_GATE_CATEGORIES))
  if (startBlock) return { error: startBlock }
```

- [ ] **Step 2: `completeWorkAction`'a iki kapıyı ekle**

Aynı konuma (`canTransitionOrder` kontrolünün altına):

```ts
  const [checklist, items] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { serviceOrderId: orderId, workshopId: user.workshopId },
      select: { category: true, isCompleted: true, isRequired: true },
    }),
    prisma.serviceOrderItem.findMany({
      where: { serviceOrderId: orderId, workshopId: user.workshopId },
      select: { completedAt: true },
    }),
  ])
  const completeBlock = completeWorkBlockMessage(
    countBlockingChecklist(checklist, COMPLETE_GATE_CATEGORIES),
    countIncompleteItems(items)
  )
  if (completeBlock) return { error: completeBlock }
```

- [ ] **Step 3: Import'ları ekle**

Dosya başındaki import bloğuna:

```ts
import {
  countBlockingChecklist,
  countIncompleteItems,
  startWorkBlockMessage,
  completeWorkBlockMessage,
  START_GATE_CATEGORIES,
  COMPLETE_GATE_CATEGORIES,
} from "@/lib/technician/gates"
```

- [ ] **Step 4: Typecheck + testler**

```bash
bun run typecheck && bun test
```
Beklenen: hata yok, tüm testler geçer.

- [ ] **Step 5: Manuel doğrulama**

Teknisyen sayfasında kontrol maddeleri işaretsizken "İşe Başla" → kırmızı hata: "Araç kabul kontrolleri tamamlanmadan işe başlanamaz (8 madde eksik)". 8 maddeyi işaretle → buton çalışır.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/technician/actions.ts"
git commit -m "feat(technician): işe başlama ve tamamlama kapıları — zorunlu kontrol + kalem takibi"
```

---

### Task 6: Kalem tamamlama action'ı

**Files:**
- Modify: `src/app/(app)/technician/actions.ts` (dosya sonuna)

**Interfaces:**
- Produces: `toggleOrderItemCompletedAction(itemId: string, done: boolean): Promise<{ success: true } | { error: string }>`

- [ ] **Step 1: Action'ı yaz**

`src/app/(app)/technician/actions.ts` sonuna:

```ts
/**
 * İş emri kalemini (parça/işçilik) "yapıldı" işaretler veya işareti kaldırır.
 *
 * Attribution: Technician↔User ilişkisi olmadığı için `completedById` iş emrinin
 * ATANMIŞ ustasıdır; eylemi yapan gerçek kullanıcı AuditLog'a yazılır.
 */
export async function toggleOrderItemCompletedAction(itemId: string, done: boolean) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop()

  const item = await prisma.serviceOrderItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
    select: { id: true, name: true, serviceOrderId: true },
  })
  if (!item) return { error: "İş kalemi bulunamadı" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: item.serviceOrderId, workshopId: user.workshopId },
    select: { id: true, status: true, assignedTechnicianId: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.serviceOrderItem.updateMany({
    where: { id: itemId, workshopId: user.workshopId },
    data: {
      completedAt: done ? new Date() : null,
      completedById: done ? order.assignedTechnicianId : null,
    },
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrderItem",
    itemId,
    done ? "order_item_completed" : "order_item_uncompleted",
    JSON.stringify({ orderId: item.serviceOrderId, name: item.name })
  )

  revalidatePath(`/technician/orders/${item.serviceOrderId}`)
  revalidatePath(`/orders/${item.serviceOrderId}`)
  return { success: true }
}
```

- [ ] **Step 2: `toggleChecklistItemAction`'daki no-op'u düzelt**

Mevcut `completedById: checked ? null : null` satırı hiçbir zaman kimseyi yazmıyor. Action içinde `order` sorgusunun `select`'ine `assignedTechnicianId: true` ekle (sorgu zaten var, satır ~239) ve `data` bloğunu şununla değiştir:

```ts
    data: {
      isCompleted: checked,
      completedAt: checked ? new Date() : null,
      completedById: checked ? (order?.assignedTechnicianId ?? null) : null,
    },
```

- [ ] **Step 3: Typecheck**

```bash
bun run typecheck
```
Beklenen: hata yok.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/technician/actions.ts"
git commit -m "feat(technician): iş kalemi yapıldı/yapılmadı action'ı + checklist attribution düzeltmesi"
```

---

### Task 7: Teknisyen UI — "Yapılacak İşler" bölümü

**Files:**
- Create: `src/components/technician/order-items-checklist.tsx`
- Modify: `src/components/technician/technician-order-detail.tsx` (`OrderData.items` tipi ~68, "İş Kalemleri" bloğu 355-405)
- Modify: `src/app/(app)/technician/orders/[id]/page.tsx` (`items` serileştirme ~110)

**Interfaces:**
- Consumes: `toggleOrderItemCompletedAction` (Task 6).
- Produces: `<OrderItemsChecklist items={OrderItemRow[]} locked={boolean} />`, `OrderItemRow = { id, type, name, quantity, unitPrice, totalPrice, note, completedAt }`.

- [ ] **Step 1: Sunucudan `completedAt` gönder**

`src/app/(app)/technician/orders/[id]/page.tsx` içinde `items: order.items.map((i) => ({ ... }))` bloğuna ekle:

```ts
      completedAt: i.completedAt ? i.completedAt.toISOString() : null,
```

- [ ] **Step 2: Bileşeni yaz**

`src/components/technician/order-items-checklist.tsx`:

```tsx
"use client"

import { useTransition } from "react"
import { CheckSquare, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTRY } from "@/lib/money"
import { toggleOrderItemCompletedAction } from "@/app/(app)/technician/actions"

export interface OrderItemRow {
  id: string
  type: string
  name: string
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  note: string | null
  completedAt: string | null
}

/**
 * Teknisyenin iş emri kalemlerini tek dokunuşla "yapıldı" işaretlediği liste.
 * Kalemler tamamlanmadan iş tamamlanamaz (kapı server action'da).
 */
export function OrderItemsChecklist({
  items,
  locked,
}: {
  items: OrderItemRow[]
  locked: boolean
}) {
  const [isPending, startTransition] = useTransition()

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground/70">Bu iş emrinde henüz parça veya işçilik kalemi yok.</p>
  }

  const parts = items.filter((i) => i.type === "part")
  const labor = items.filter((i) => i.type !== "part")

  return (
    <div className="space-y-4">
      <ItemGroup title="Parçalar" items={parts} locked={locked} isPending={isPending} startTransition={startTransition} />
      <ItemGroup title="İşçilik" items={labor} locked={locked} isPending={isPending} startTransition={startTransition} />
    </div>
  )
}

function ItemGroup({
  title, items, locked, isPending, startTransition,
}: {
  title: string
  items: OrderItemRow[]
  locked: boolean
  isPending: boolean
  startTransition: (cb: () => void) => void
}) {
  if (items.length === 0) return null
  const done = items.filter((i) => i.completedAt).length

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs font-medium text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground/70">{done}/{items.length}</span>
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const isDone = !!item.completedAt
          return (
            <button
              key={item.id}
              type="button"
              disabled={isPending || locked}
              onClick={() => {
                startTransition(async () => {
                  await toggleOrderItemCompletedAction(item.id, !isDone)
                })
              }}
              className="w-full flex items-start gap-2 py-2.5 px-2 rounded-lg text-left touch-manipulation hover:bg-muted disabled:opacity-60"
            >
              {isDone
                ? <CheckSquare className="size-5 shrink-0 text-success" />
                : <Square className="size-5 shrink-0 text-muted-foreground/70" />}
              <span className="flex-1 min-w-0">
                <span className={cn("block text-sm", isDone ? "line-through text-muted-foreground/70" : "text-foreground")}>
                  {item.name}
                </span>
                {item.note && <span className="block text-xs text-muted-foreground mt-0.5">{item.note}</span>}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm text-foreground">
                  {item.totalPrice != null
                    ? formatTRY(item.totalPrice)
                    : item.unitPrice != null
                      ? formatTRY(item.unitPrice * item.quantity)
                      : "—"}
                </span>
                <span className="text-xs text-muted-foreground">×{item.quantity}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

Not: `external_labor` ("Dış İşçilik") bilinçli olarak "İşçilik" grubunda toplanıyor — teknisyen için ayrım anlamsız, iki grup mobilde yeterli.

- [ ] **Step 3: Detay bileşenine bağla**

`technician-order-detail.tsx` içinde:

1. `OrderData` tipindeki `items` dizisine `completedAt: string | null` alanını ekle (satır ~68).
2. Import ekle: `import { OrderItemsChecklist } from "@/components/technician/order-items-checklist"`.
3. "İş Kalemleri" kartındaki (satır 355-383) kalem listesi `<div className="space-y-2"> ... </div>` bloğunu şununla değiştir; fiyat özeti bloğu (`order.totals.hasAnyPrice` koşullusu) OLDUĞU GİBİ KALIR:

```tsx
          <OrderItemsChecklist items={order.items} locked={locked} />
```

4. Kart başlığını güncelle: `İş Kalemleri` → `Yapılacak İşler`, ve başlığın yanına ilerleme ekle:

```tsx
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Yapılacak İşler
            <span className="ml-2 text-xs font-normal text-muted-foreground/70">
              {order.items.filter((i) => i.completedAt).length}/{order.items.length}
            </span>
          </h3>
```

5. Kartın `{order.items.length > 0 && (...)}` koşulunu KALDIR — kalem yokken de bölüm görünmeli (bileşen kendi boş durumunu basıyor).

`locked` değişkeni bileşende zaten mevcut (kontrol listesi bölümü kullanıyor); yoksa `const locked = isOrderLocked(order.status as OrderStatus)` satırını dosyadaki mevcut kullanımdan kopyala.

- [ ] **Step 4: Typecheck + lint**

```bash
bun run typecheck && bun run lint
```
Beklenen: hata yok (kullanılmayan sabit uyarısı gelirse Step 2'deki nota göre temizle).

- [ ] **Step 5: Manuel doğrulama**

`/technician/orders/<id>` → "Yapılacak İşler" bölümünde parça ve işçilik ayrı gruplarda; bir kaleme dokun → ✓ olur, üstü çizilir, sayaç artar. Sayfayı yenile → durum korunur. 375px genişlikte yatay taşma yok.

- [ ] **Step 6: Commit**

```bash
git add src/components/technician/order-items-checklist.tsx src/components/technician/technician-order-detail.tsx "src/app/(app)/technician/orders/[id]/page.tsx"
git commit -m "feat(technician): iş kalemleri yapıldı takibi — Yapılacak İşler bölümü"
```

---

### Task 8: Teknisyen UI — kapı görünürlüğü

**Files:**
- Modify: `src/components/technician/technician-order-detail.tsx` (aksiyon butonları 424-465)

**Interfaces:**
- Consumes: Task 4'ün saf fonksiyonları (istemcide de çalışır, Prisma import'u yok).

- [ ] **Step 1: Eksik sayılarını hesapla**

Bileşenin gövdesinde, `canStart`/`canComplete` hesaplarının yanına:

```tsx
  const startMissing = countBlockingChecklist(order.checklistItems, START_GATE_CATEGORIES)
  const completeChecklistMissing = countBlockingChecklist(order.checklistItems, COMPLETE_GATE_CATEGORIES)
  const completeItemsMissing = countIncompleteItems(order.items)
  const startBlockedMessage = startWorkBlockMessage(startMissing)
  const completeBlockedMessage = completeWorkBlockMessage(completeChecklistMissing, completeItemsMissing)
```

Import:

```tsx
import {
  countBlockingChecklist,
  countIncompleteItems,
  startWorkBlockMessage,
  completeWorkBlockMessage,
  START_GATE_CATEGORIES,
  COMPLETE_GATE_CATEGORIES,
} from "@/lib/technician/gates"
```

`OrderData["checklistItems"]` tipine `isRequired: boolean` alanını ekle ve sunucu tarafında (`src/app/(app)/technician/orders/[id]/page.tsx`, `checklistItems` serileştirmesi) gönder:

```ts
      isRequired: c.isRequired,
```

- [ ] **Step 2: Butonları kapıya bağla**

"İşe Başla" butonunda `disabled={isPending}` → `disabled={isPending || !!startBlockedMessage}`.
"Tamamla" butonunda `disabled={isPending}` → `disabled={isPending || !!completeBlockedMessage}`.

Buton grubunu saran `<div className="mt-2 border-t ...">` bloğunun İÇİNE, buton satırının altına açıklama ekle (blok `flex gap-2` olduğu için dış sarmalayıcıyı `flex-col` yapıp buton satırını kendi `div`'ine al):

```tsx
      <div className="mt-2 border-t border-border -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 space-y-2">
        <div className="flex gap-2 sm:justify-center">
          {/* mevcut butonlar olduğu gibi */}
        </div>
        {canStart && startBlockedMessage && (
          <p className="text-xs text-warning-foreground text-center">{startBlockedMessage}</p>
        )}
        {canComplete && completeBlockedMessage && (
          <p className="text-xs text-warning-foreground text-center">{completeBlockedMessage}</p>
        )}
      </div>
```

`text-warning-foreground` sınıfı projede tanımlı değilse `text-muted-foreground` kullan — yeni renk token'ı EKLEME.

- [ ] **Step 3: Typecheck + lint**

```bash
bun run typecheck && bun run lint
```
Beklenen: hata yok.

- [ ] **Step 4: Manuel doğrulama**

Kontrol maddeleri eksikken "İşe Başla" gri ve altında "…(8 madde eksik)" yazar. Maddeler tamamlanınca buton aktifleşir. Bir kalem işaretsizken "Tamamla" kapalı, altında kalem uyarısı görünür.

- [ ] **Step 5: Commit**

```bash
git add src/components/technician/technician-order-detail.tsx "src/app/(app)/technician/orders/[id]/page.tsx"
git commit -m "feat(technician): kapı durumunu butonlarda göster — eksik madde/kalem uyarısı"
```

---

### Task 9: Parça talebi → katalog araması

**Files:**
- Modify: `src/lib/validations/technician.ts` (`partsRequestSchema` 17-23)
- Modify: `src/app/(app)/technician/actions.ts` (`createPartsRequestAction` 355-401)
- Modify: `src/app/(app)/technician/orders/[id]/page.tsx` (`vehicle` ve `partsRequests` serileştirmesi)
- Modify: `src/components/technician/technician-order-detail.tsx` (`AddPartsRequestForm` 757-848, `PartsRequestSection` 692-755)
- Test: `src/lib/validations/technician.test.ts` (yeni)

**Interfaces:**
- Consumes: `PartSearchInput` (`src/components/parts/part-search-input.tsx`), `ArticleSearchResult` (`@/lib/tecdoc/catalog`).
- Produces: `partsRequestSchema` artık `brand?: string`, `tecdocArticleId?: number` kabul eder.

- [ ] **Step 1: Şema testini yaz**

`src/lib/validations/technician.test.ts`:

```ts
import { test, expect } from "bun:test"
import { partsRequestSchema } from "./technician"

const base = { serviceOrderId: "ord_1", partName: "Yağ filtresi", quantity: "2" }

test("marka ve article id opsiyoneldir", () => {
  const r = partsRequestSchema.safeParse(base)
  expect(r.success).toBe(true)
})

test("katalog seçimi marka ve article id ile parse edilir", () => {
  const r = partsRequestSchema.safeParse({ ...base, brand: "MANN-FILTER", tecdocArticleId: "12345" })
  expect(r.success).toBe(true)
  if (r.success) {
    expect(r.data.brand).toBe("MANN-FILTER")
    expect(r.data.tecdocArticleId).toBe(12345)
  }
})

test("boş article id alanı yok sayılır (serbest metin talebi)", () => {
  const r = partsRequestSchema.safeParse({ ...base, brand: "", tecdocArticleId: "" })
  expect(r.success).toBe(true)
  if (r.success) expect(r.data.tecdocArticleId).toBeUndefined()
})

test("geçersiz article id reddedilir", () => {
  expect(partsRequestSchema.safeParse({ ...base, tecdocArticleId: "abc" }).success).toBe(false)
})
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

```bash
bun test src/lib/validations/technician.test.ts
```
Beklenen: FAIL — marka/article id alanları henüz yok, üçüncü ve dördüncü test kalır.

- [ ] **Step 3: Şemayı genişlet**

`src/lib/validations/technician.ts` içinde `partsRequestSchema`'ya ekle:

```ts
  /** Katalogdan seçildiyse parça markası; serbest metin talebinde boş. */
  brand: z.string().max(120).optional().or(z.literal("")),
  /** Katalogdan seçildiyse TecDoc article id; boş string → undefined. */
  tecdocArticleId: z
    .union([z.literal(""), z.coerce.number().int().positive()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
```

- [ ] **Step 4: Testlerin geçtiğini gör**

```bash
bun test src/lib/validations/technician.test.ts
```
Beklenen: PASS (4 test)

- [ ] **Step 5: Action'ı alanlarla besle**

`createPartsRequestAction` içinde `raw` nesnesine ekle:

```ts
    brand: (formData.get("brand") as string) || "",
    tecdocArticleId: (formData.get("tecdocArticleId") as string) || "",
```

`prisma.partsRequest.create` `data` bloğuna ekle:

```ts
      brand: parsed.data.brand || null,
      tecdocArticleId: parsed.data.tecdocArticleId ?? null,
```

- [ ] **Step 6: Sunucudan araç katalog id'sini ve talep markasını gönder**

`src/app/(app)/technician/orders/[id]/page.tsx`:

`safeOrder.vehicle` bloğuna:

```ts
      catalogVehicleTypeId: order.intakeForm.vehicle.catalogVehicleTypeId,
```

`safeOrder.partsRequests` map'ine:

```ts
      brand: p.brand,
```

- [ ] **Step 7: Formu `PartSearchInput` ile değiştir**

`technician-order-detail.tsx`:

1. `OrderData["vehicle"]` tipine `catalogVehicleTypeId: number | null`, `OrderData["partsRequests"]` tipine `brand: string | null` ekle.
2. `AddPartsRequestForm`'a `vehicleTypeId` prop'u geçir: çağrı yerini `<AddPartsRequestForm orderId={order.id} vehicleTypeId={order.vehicle.catalogVehicleTypeId} />` yap.
3. Bileşen imzasını ve "Parça adı" input'unu değiştir:

```tsx
function AddPartsRequestForm({ orderId, vehicleTypeId }: { orderId: string; vehicleTypeId: number | null }) {
  const [show, setShow] = useState(false)
  const [partName, setPartName] = useState("")
  const [partSku, setPartSku] = useState("")
  const [brand, setBrand] = useState("")
  const [tecdocArticleId, setTecdocArticleId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState("1")
  const [note, setNote] = useState("")
  const [isPending, startTransition] = useTransition()
```

`fd.set(...)` bloğuna ekle:

```tsx
        fd.set("brand", brand)
        fd.set("tecdocArticleId", tecdocArticleId != null ? String(tecdocArticleId) : "")
```

ve sıfırlamaya `setBrand(""); setTecdocArticleId(null)` ekle.

Mevcut "Parça adı *" `<Input>`'unu şununla değiştir:

```tsx
      <PartSearchInput
        value={partName}
        sku={partSku || null}
        vehicleTypeId={vehicleTypeId}
        placeholder="Parça adı *"
        onNameChange={(name) => {
          setPartName(name)
          // Serbest yazmaya dönülürse önceki katalog seçimi geçersizdir.
          setTecdocArticleId(null)
          setBrand("")
        }}
        onSelectArticle={(a) => {
          setPartName(a.name)
          setPartSku(a.articleNumber ?? "")
          setBrand(a.supplierName ?? "")
          setTecdocArticleId(a.id ?? null)
        }}
        showClear={!!partName}
        onClear={() => { setPartName(""); setPartSku(""); setBrand(""); setTecdocArticleId(null) }}
      />
```

Import: `import { PartSearchInput } from "@/components/parts/part-search-input"`.

`ArticleSearchResult` alan adları (`name`, `articleNumber`, `supplierName`, `id`) `@/lib/tecdoc/catalog` içinde tanımlıdır — yazmadan ÖNCE o tipi aç ve gerçek alan adlarıyla eşleştir; farklıysa doğru adları kullan, tip hatasını `any` ile susturma.

4. `PartsRequestSection` satırında markayı göster: `{req.partSku && ...}` çipinin yanına:

```tsx
                {req.brand && <span className="text-xs text-muted-foreground">{req.brand}</span>}
```

- [ ] **Step 8: Typecheck + lint + testler**

```bash
bun run typecheck && bun run lint && bun test
```
Beklenen: hata yok.

- [ ] **Step 9: Manuel doğrulama**

Kataloğa bağlı araçta (VIN çözülmüş, `catalogVehicleTypeId` dolu) "Parça Talep Et" → yazarken öneriler gelir, seçince SKU ve marka dolar. Kataloğa bağlı olmayan araçta düz metin girişi çalışır ve talep kaydedilir.

- [ ] **Step 10: Commit**

```bash
git add src/lib/validations/technician.ts src/lib/validations/technician.test.ts "src/app/(app)/technician/actions.ts" "src/app/(app)/technician/orders/[id]/page.tsx" src/components/technician/technician-order-detail.tsx
git commit -m "feat(technician): parça talebi araç kataloğuna bağlandı — marka + TecDoc article kalıcı"
```

---

### Task 10: Ofis — Parça Talepleri paneli + kaleme çevirme

**Files:**
- Create: `src/components/orders/parts-request-panel.tsx`
- Modify: `src/app/(app)/technician/actions.ts` (yeni action; ofis akışı olsa da parça-talebi mantığı bu dosyada toplu)
- Modify: `src/app/(app)/orders/[id]/page.tsx` (sorgu + serileştirme)
- Modify: `src/components/orders/work-order-detail.tsx` ("parca" sekmesi, satır 769)

**Interfaces:**
- Consumes: `PartsRequest` alanları (Task 1, 9).
- Produces: `convertPartsRequestToOrderItemAction(requestId: string): Promise<{ success: true } | { error: string }>`; `<PartsRequestPanel requests={...} locked={boolean} />` — `requests` şekli `{ id, partName, partSku, brand, quantity, note, status, createdAt, requestedByName }[]`.

- [ ] **Step 1: Çevirme action'ını yaz**

`src/app/(app)/technician/actions.ts` sonuna:

```ts
/**
 * Teknisyenin parça talebini iş emri kalemine çevirir (ofis aksiyonu).
 * Fiyat alanları boş bırakılır — ofis kalem satırında girer.
 * Çift tıklamaya karşı: yalnız `requested` durumundaki talep çevrilebilir.
 */
export async function convertPartsRequestToOrderItemAction(requestId: string) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop()

  const request = await prisma.partsRequest.findFirst({
    where: { id: requestId, workshopId: user.workshopId },
  })
  if (!request) return { error: "Parça talebi bulunamadı" }
  if (request.status !== "requested") return { error: "Bu talep zaten işlendi" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: request.serviceOrderId, workshopId: user.workshopId },
    select: { id: true, status: true, intakeFormId: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrderItem.create({
      data: {
        workshopId: user.workshopId,
        serviceOrderId: request.serviceOrderId,
        type: "part",
        name: request.partName,
        sku: request.partSku,
        brand: request.brand,
        quantity: request.quantity,
        note: request.note,
        tecdocArticleId: request.tecdocArticleId,
        source: request.tecdocArticleId ? "catalog" : "manual",
      },
    })
    await tx.partsRequest.updateMany({
      where: { id: requestId, workshopId: user.workshopId, status: "requested" },
      data: { status: "prepared" },
    })
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "PartsRequest",
    requestId,
    "parts_request_converted",
    JSON.stringify({ orderId: request.serviceOrderId, partName: request.partName })
  )

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "parts_request_converted",
    description: `Parça talebi kaleme eklendi: ${request.partName}`,
  })

  revalidatePath(`/orders/${request.serviceOrderId}`)
  revalidatePath(`/technician/orders/${request.serviceOrderId}`)
  return { success: true }
}
```

`addTimelineEvent`'in `eventType` parametresi bir enum ise (`prisma/schema.prisma` içinde `TimelineEventType` ara), `parts_request_converted` değeri yoksa mevcut `parts_requested` değerini kullan — bu iş için şemaya YENİ enum değeri EKLEME.

- [ ] **Step 2: Ofis sorgusuna talepleri ekle**

`src/app/(app)/orders/[id]/page.tsx` içindeki `prisma.serviceOrder.findFirst` include bloğuna (`assignedTechnician` satırının yanına):

```ts
      partsRequests: {
        orderBy: { createdAt: "desc" },
        include: { requestedBy: { select: { fullName: true } } },
      },
```

Serileştirmeye (`items` map'inin altına, aynı nesne içinde):

```ts
    partsRequests: order.partsRequests.map((p) => ({
      id: p.id,
      partName: p.partName,
      partSku: p.partSku,
      brand: p.brand,
      quantity: p.quantity,
      note: p.note,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      requestedByName: p.requestedBy?.fullName ?? null,
    })),
```

Ayrıca kalem serileştirmesine (Task 11'deki rozet için gerekli) ekle:

```ts
      completedAt: i.completedAt ? i.completedAt.toISOString() : null,
```

- [ ] **Step 3: Paneli yaz**

`src/components/orders/parts-request-panel.tsx`:

```tsx
"use client"

import { useTransition } from "react"
import { Package, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { convertPartsRequestToOrderItemAction } from "@/app/(app)/technician/actions"

export interface PartsRequestRow {
  id: string
  partName: string
  partSku: string | null
  brand: string | null
  quantity: number
  note: string | null
  status: string
  createdAt: string
  requestedByName: string | null
}

const STATUS: Record<string, { label: string; color: string }> = {
  requested: { label: "Talep edildi", color: "bg-warning/10 text-warning-foreground border-warning/20" },
  prepared: { label: "Hazırlandı", color: "bg-primary/10 text-foreground border-primary/20" },
  delivered: { label: "Teslim edildi", color: "bg-success/10 text-success border-success/20" },
}

/**
 * Ustanın sahadan gönderdiği parça talepleri. "Kaleme Ekle" talebi iş emri
 * kalemine çevirir (fiyat ofiste girilir) ve talebi "hazırlandı" yapar.
 */
export function PartsRequestPanel({
  requests,
  locked,
  onError,
}: {
  requests: PartsRequestRow[]
  locked: boolean
  onError: (msg: string) => void
}) {
  const [isPending, startTransition] = useTransition()

  if (requests.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
        <Package className="size-4" />
        Parça Talepleri
        <span className="text-xs font-normal text-muted-foreground/70">({requests.length})</span>
      </h3>
      <div className="space-y-2">
        {requests.map((req) => {
          const status = STATUS[req.status]
          return (
            <div key={req.id} className="flex flex-wrap items-start justify-between gap-2 py-2 px-3 rounded-lg bg-muted">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{req.partName}</span>
                  {req.partSku && <span className="text-xs font-mono text-muted-foreground">{req.partSku}</span>}
                  {req.brand && <span className="text-xs text-muted-foreground">{req.brand}</span>}
                  <span className="text-xs text-muted-foreground">×{req.quantity}</span>
                </div>
                {req.note && <p className="text-xs text-muted-foreground mt-0.5">{req.note}</p>}
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {req.requestedByName ? `${req.requestedByName} · ` : ""}
                  {new Date(req.createdAt).toLocaleDateString("tr-TR")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", status?.color)}>
                  {status?.label || req.status}
                </span>
                {!locked && req.status === "requested" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const res = await convertPartsRequestToOrderItemAction(req.id)
                        if (res && "error" in res && res.error) onError(res.error)
                      })
                    }}
                    className="touch-manipulation"
                  >
                    <Plus className="size-3.5" />
                    Kaleme Ekle
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

`bg-warning/10` gibi token'lar projede yoksa mevcut rozet stillerini (`src/components/technician/technician-order-detail.tsx` içindeki `PARTS_REQUEST_STATUS` sabiti) birebir kopyala — yeni renk token'ı ekleme.

- [ ] **Step 4: "parca" sekmesine bağla**

`src/components/orders/work-order-detail.tsx`:

1. Import ekle: `import { PartsRequestPanel } from "@/components/orders/parts-request-panel"`.
2. Bileşenin `order` prop tipine `partsRequests: PartsRequestRow[]` alanını ekle (tip `parts-request-panel.tsx`'ten import edilir).
3. `<TabsContent value="parca" ...>` içinde `<PartsLaborCard ... />` satırının HEMEN ÜSTÜNE:

```tsx
          <PartsRequestPanel
            requests={order.partsRequests}
            locked={isOrderLocked(order.status as OrderStatus)}
            onError={setError}
          />
```

`setError` ve `isOrderLocked` bu dosyada zaten mevcut.

- [ ] **Step 5: Typecheck + lint**

```bash
bun run typecheck && bun run lint
```
Beklenen: hata yok.

- [ ] **Step 6: Manuel doğrulama**

Teknisyen sayfasından parça talebi oluştur → ofis `/orders/<id>` → "Parça" sekmesinde talep görünür → "Kaleme Ekle" → kalem tablosuna satır düşer, talep "Hazırlandı" olur, buton kaybolur. Teknisyen sayfasını yenile → yeni kalem "Yapılacak İşler"de işaretlenebilir görünür.

- [ ] **Step 7: Commit**

```bash
git add src/components/orders/parts-request-panel.tsx src/components/orders/work-order-detail.tsx "src/app/(app)/orders/[id]/page.tsx" "src/app/(app)/technician/actions.ts"
git commit -m "feat(orders): ofis parça talepleri paneli + tek tıkla iş emri kalemine çevirme"
```

---

### Task 11: Ofis kalem tablosunda "Yapıldı" rozeti

**Files:**
- Modify: `src/components/orders/order-management-panel.tsx` (`OrderItem` tipi 34-58)
- Modify: `src/components/orders/parts-labor-grid.tsx` (`SourceBadge` civarı ~998, masaüstü satır ~1236, mobil kart ~1313)

**Interfaces:**
- Consumes: Task 10 Step 2'de eklenen `completedAt` serileştirmesi.

- [ ] **Step 1: Tipi genişlet**

`order-management-panel.tsx` içindeki `OrderItem` tipine:

```ts
  // Teknisyen "yapıldı" işaretlediyse dolu — ofiste salt-okunur rozet.
  completedAt?: string | null
```

- [ ] **Step 2: Rozeti yaz**

`parts-labor-grid.tsx` içinde `SourceBadge` fonksiyonunun hemen altına:

```tsx
/** Teknisyen kalemi yaptıysa görünen salt-okunur rozet (ofis işaretleyemez). */
function DoneBadge({ completedAt }: { completedAt?: string | null }) {
  if (!completedAt) return null
  return (
    <span
      title={`Yapıldı · ${new Date(completedAt).toLocaleDateString("tr-TR")}`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-success/10 text-success"
    >
      <Check className="size-3" />
      Yapıldı
    </span>
  )
}
```

`Check` ikonu import listesinde yoksa `lucide-react` import'una ekle. `bg-success/10 text-success` token'ları bu dosyada kullanılmıyorsa, dosyada zaten var olan bir başarı rengi sınıfını kullan.

- [ ] **Step 3: İki satır düzenine de yerleştir**

Masaüstü satırında (`<SourceBadge source={row.source} />` sonrası, ~1236) ve mobil kartta (~1313) aynı satıra ekle:

```tsx
          <DoneBadge completedAt={row.completedAt} />
```

- [ ] **Step 4: Typecheck + lint**

```bash
bun run typecheck && bun run lint
```
Beklenen: hata yok.

- [ ] **Step 5: Manuel doğrulama**

Teknisyen bir kalemi ✓ işaretle → ofis "Parça" sekmesinde o satırda "Yapıldı" rozeti görünür; ofisten işaretlenemez (rozet tıklanabilir değil). Kalem düzenleme/otosave bozulmamış olmalı: bir kalemin adını değiştir, "✓ Kaydedildi" işareti çıkmalı.

- [ ] **Step 6: Commit**

```bash
git add src/components/orders/parts-labor-grid.tsx src/components/orders/order-management-panel.tsx
git commit -m "feat(orders): kalem tablosunda teknisyen tamamlama rozeti"
```

---

### Task 12: Bütün doğrulama + PR

**Files:** (yalnız doğrulama; kod değişikliği yalnız çıkan hataları düzeltmek için)

- [ ] **Step 1: Tam doğrulama zinciri**

```bash
bun install
bun run lint
bun run typecheck
bun test
bun run build
```
Beklenen: hepsi hatasız. `build` başarısız olursa DUR ve düzelt — bu değişiklik seti prod build'i etkileyecek kadar geniş.

- [ ] **Step 2: Migration'ı AWS dev'e uygula**

Ayrı terminalde tünel açık olmalı (`bun run db:tunnel`), sonra:

```bash
bun run db:deploy
```
Beklenen: yeni migration uygulanır (`technician_work_tracking`). Tünel kapalıysa hata verir — kullanıcıdan tüneli açmasını iste, `.env` DOKUNMA.

- [ ] **Step 3: Spec'teki manuel QA listesini uçtan uca koştur**

`docs/superpowers/specs/2026-07-27-technician-work-tracking-design.md` → "Manuel QA" başlığındaki 10 maddeyi sırayla dene. Her maddenin sonucunu (geçti/kaldı + gözlem) not al. Kalan varsa düzelt ve doğrulama zincirini tekrar koştur.

- [ ] **Step 4: Değişiklik özetini gözden geçir**

```bash
git log --oneline origin/dev..HEAD
git diff origin/dev...HEAD --stat
```
Beklenen: 11 commit civarı; migration dizini + ~12 dosya.

- [ ] **Step 5: Dalı gönder ve PR aç**

```bash
git push -u origin feat/technician-work-tracking
gh pr create --base dev --title "feat(technician): zorunlu kontrol listesi, kalem tamamlama takibi, katalog bağlı parça talebi" --body "$(cat <<'EOF'
## Ne değişti

- **Jenerik kontrol listesi**: teknisyene atama anında 16 maddelik sistem şablonu idempotent olarak oluşur (`templateKey`), maddeler zorunlu ve silinemez.
- **Zorunluluk kapıları**: Kontrol maddeleri bitmeden "İşe Başla", Onarım+Teslim maddeleri ve tüm parça/işçilik kalemleri bitmeden "Tamamla" çalışmaz (server action'da uygulanır, UI'da gösterilir).
- **Kalem takibi**: `ServiceOrderItem.completedAt/completedById/completionNote`; teknisyen sayfasında "Yapılacak İşler" bölümü, ofis kalem tablosunda salt-okunur "Yapıldı" rozeti.
- **Parça talebi kataloğa bağlandı**: teknisyen talebi araca uygun TecDoc aramasından seçer; marka + article id talepte saklanır.
- **Ofis parça talepleri**: `/orders/[id]` "Parça" sekmesinde talep listesi + tek tıkla iş emri kalemine çevirme.

## Şema

Tek migration, 7 kolon — hepsi nullable veya varsayılanlı, mevcut satırlar etkilenmez.

## Risk alanları

- Tamamlama kapısı sıkıdır: ofis iş tamamlandıktan sonra kalem eklerse emir tekrar "eksik" duruma düşer (bilinçli tercih).
- `assignTechnicianAction` artık transaction içinde çalışıyor (atama + seed birlikte).
- Attribution: `completedById` atanmış ustadır (Technician↔User bağı yok); gerçek kullanıcı AuditLog'da.

## Manuel QA

Spec'teki 10 maddelik liste koşuldu: `docs/superpowers/specs/2026-07-27-technician-work-tracking-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: PR bağlantısını kullanıcıya bildir**

PR numarasını ve URL'sini rapor et. Merge'i kullanıcı yapar; merge sonrası ana checkout'ta `git pull` gerekir (yerel dev, origin/dev'in gerisinde kalır).

---

## Kapsam Dışı (bilinçli — spec ile aynı)

- Atölye-özel düzenlenebilir kontrol şablonu (Ayarlar CRUD)
- Servis tipine göre değişen madde setleri
- Kalemde adet bazlı kısmi tamamlama
- Kontrol listesinin ofis `/orders` detayında gösterilmesi
