# Kapanmış İş Emri Tam Kilit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teslim edilmiş (`delivered`) veya iptal edilmiş (`cancelled`) iş emrinde bilgi düzenleme, fotoğraf/hasar ekleme ve (tam ödenmişse) tahsilat eklemeyi hem sunucuda hem UI'da kapatmak.

**Architecture:** Mevcut `isOrderLocked` kilit desenini genişletir. Kilit koşulları saf yardımcı fonksiyonlara (`src/lib/status-transitions.ts`) çıkarılır ve birim-test edilir; sunucu aksiyonları bu yardımcıları çağırır (asıl güvenlik katmanı); UI yalnızca yüzey gizler. Şema değişikliği ve migration yok.

**Tech Stack:** Next.js server actions, Prisma, bun test.

**Spec:** `docs/superpowers/specs/2026-07-12-closed-order-full-lock-design.md`

## Global Constraints

- Teslim edilmiş ama borcu kalan iş emrine tahsilat AÇIK kalır (yalnız `delivered` + `paymentStatus ∈ {paid, overpaid}` kilitler).
- İptal → `draft` reaktivasyonu kilidi açar (mevcut davranış, dokunma).
- Tenant izolasyonu korunur: tüm sorgular `workshopId: user.workshopId` filtresini zaten içeriyor, değiştirme.
- Hata mesajları Türkçe.
- `any` yok; TypeScript strict.
- Commit adımları: bu worktree'de `fix/tecdoc-picker-search` dalında ilgisiz değişiklikler duruyor — commit'ler YALNIZCA bu planın dosyalarını içermeli (`git add` ile tek tek), ya da kullanıcı ayrı dal isterse ertelenmeli.

---

### Task 1: Kilit yardımcıları + birim testleri

**Files:**
- Modify: `src/lib/status-transitions.ts` (dosya sonuna ekle)
- Test: `src/lib/status-transitions.test.ts` (dosya sonuna ekle)

**Interfaces:**
- Consumes: mevcut `isOrderLocked(status: OrderStatus): boolean`
- Produces:
  - `isIntakeWriteLocked(intakeStatus: IntakeStatus, orderStatus?: OrderStatus | null): boolean`
  - `isCollectionLockedForOrder(orderStatus: OrderStatus, paymentStatus: PaymentStatus): boolean`

- [ ] **Step 1: Failing testleri yaz** — `src/lib/status-transitions.test.ts` sonuna ekle (import satırına yeni fonksiyonları da ekle):

```ts
import { canTransitionIntake, isOrderLocked, isIntakeWriteLocked, isCollectionLockedForOrder } from "./status-transitions"

test("intake yazma kilidi: teslim/iptal edilen intake kilitli", () => {
  expect(isIntakeWriteLocked("delivered")).toBe(true)
  expect(isIntakeWriteLocked("cancelled")).toBe(true)
  expect(isIntakeWriteLocked("in_progress")).toBe(false)
  expect(isIntakeWriteLocked("draft")).toBe(false)
})

test("intake yazma kilidi: bağlı order teslim/iptal ise kilitli", () => {
  expect(isIntakeWriteLocked("in_progress", "delivered")).toBe(true)
  expect(isIntakeWriteLocked("in_progress", "cancelled")).toBe(true)
  expect(isIntakeWriteLocked("in_progress", "in_progress")).toBe(false)
  expect(isIntakeWriteLocked("in_progress", null)).toBe(false)
})

test("tahsilat kilidi: teslim edilmiş + tam ödenmiş kilitli", () => {
  expect(isCollectionLockedForOrder("delivered", "paid")).toBe(true)
  expect(isCollectionLockedForOrder("delivered", "overpaid")).toBe(true)
})

test("tahsilat kilidi: teslim edilmiş ama borçlu AÇIK", () => {
  expect(isCollectionLockedForOrder("delivered", "unpaid")).toBe(false)
  expect(isCollectionLockedForOrder("delivered", "partial")).toBe(false)
})

test("tahsilat kilidi: teslim edilmemişse ödenmiş olsa da AÇIK", () => {
  expect(isCollectionLockedForOrder("in_progress", "paid")).toBe(false)
  expect(isCollectionLockedForOrder("ready_for_delivery", "paid")).toBe(false)
})
```

- [ ] **Step 2: Testin FAIL ettiğini doğrula**

Run: `bun test src/lib/status-transitions.test.ts`
Expected: FAIL — "isIntakeWriteLocked is not exported" / not a function.

- [ ] **Step 3: Minimal implementasyon** — `src/lib/status-transitions.ts` sonuna ekle:

```ts
/**
 * Intake tarafı yazma kilidi (bilgi düzenleme, foto ekleme, hasar işareti).
 * Intake'in kendisi VEYA bağlı iş emri delivered/cancelled ise yazma kapalıdır.
 * Bağlı order'ı olmayan intake'lerde intake statüsü tek başına belirleyicidir.
 */
export function isIntakeWriteLocked(intakeStatus: IntakeStatus, orderStatus?: OrderStatus | null): boolean {
  if (intakeStatus === "delivered" || intakeStatus === "cancelled") return true
  return orderStatus != null && isOrderLocked(orderStatus)
}

/**
 * Tahsilat kilidi: teslim edilmiş VE tamamen ödenmiş iş emrine yeni tahsilat
 * eklenemez (yanlışlıkla mükerrer tahsilat → overpaid'i önler). Teslim edilmiş
 * ama borcu kalan iş emri AÇIK kalır (araç gitti, ödeme sonra senaryosu).
 * `cancelled` reddi createCollectionAction'da ayrı mesajla zaten var.
 */
export function isCollectionLockedForOrder(orderStatus: OrderStatus, paymentStatus: PaymentStatus): boolean {
  return orderStatus === "delivered" && (paymentStatus === "paid" || paymentStatus === "overpaid")
}
```

- [ ] **Step 4: Testin PASS ettiğini doğrula**

Run: `bun test src/lib/status-transitions.test.ts`
Expected: PASS (mevcut testler dahil hepsi yeşil).

- [ ] **Step 5: Commit**

```bash
git add src/lib/status-transitions.ts src/lib/status-transitions.test.ts
git commit -m "feat(orders): kapanmış iş emri için intake-yazma ve tahsilat kilit yardımcıları"
```

---

### Task 2: Intake sunucu aksiyonlarına kilit guard'ları

**Files:**
- Modify: `src/app/(app)/intakes/actions.ts` — `updateIntakeDetailsAction` (~135), `addDamageMarkAction` (~220), `addPhotoAction` (~287)

**Interfaces:**
- Consumes: Task 1'den `isIntakeWriteLocked(intakeStatus, orderStatus?)`.
- Produces: üç aksiyon kilitliyken `{ error: string }` döner. `/api/intakes/photos` ve `/api/intakes/damage` rotaları bu aksiyonlara delege ettiği için otomatik kapsanır.

- [ ] **Step 1: Import ekle** — dosyanın import bloğuna:

```ts
import { isIntakeWriteLocked } from "@/lib/status-transitions"
```

- [ ] **Step 2: `updateIntakeDetailsAction` guard'ı** — intake sorgusuna order'ı ekle ve bulunamadı kontrolünden hemen sonra kilidi kontrol et:

Mevcut:
```ts
  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
    include: { vehicle: true },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
```

Yeni:
```ts
  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
    include: { vehicle: true, order: { select: { status: true } } },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
  if (isIntakeWriteLocked(intake.status, intake.order?.status)) {
    return { error: "Teslim edilmiş veya iptal edilmiş iş emrinde bilgiler düzenlenemez" }
  }
```

- [ ] **Step 3: `addDamageMarkAction` guard'ı** —

Mevcut:
```ts
  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: raw.intakeFormId, workshopId: user.workshopId },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
```

Yeni:
```ts
  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: raw.intakeFormId, workshopId: user.workshopId },
    include: { order: { select: { status: true } } },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
  if (isIntakeWriteLocked(intake.status, intake.order?.status)) {
    return { error: "Teslim edilmiş veya iptal edilmiş iş emrine hasar işareti eklenemez" }
  }
```

- [ ] **Step 4: `addPhotoAction` guard'ı** —

Mevcut:
```ts
  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
```

Yeni:
```ts
  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
    include: { order: { select: { status: true } } },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
  if (isIntakeWriteLocked(intake.status, intake.order?.status)) {
    return { error: "Teslim edilmiş veya iptal edilmiş iş emrine fotoğraf eklenemez" }
  }
```

- [ ] **Step 5: Doğrula**

Run: `bunx tsc --noEmit && bunx eslint "src/app/(app)/intakes/actions.ts"`
Expected: çıktısız (temiz). Not: `order` ilişkisinin adı `VehicleIntakeForm` şemasında `order` — tsc hatası çıkarsa `prisma/schema.prisma`'da ilişki adını doğrula.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/intakes/actions.ts"
git commit -m "feat(orders): teslim/iptal edilmiş iş emrinde bilgi düzenleme, foto ve hasar ekleme sunucuda kilitli"
```

---

### Task 3: Tahsilat sunucu guard'ı

**Files:**
- Modify: `src/app/(app)/cashbox/actions.ts` — `createCollectionAction` (~satır 58-64)

**Interfaces:**
- Consumes: Task 1'den `isCollectionLockedForOrder(orderStatus, paymentStatus)`.
- Produces: `createCollectionAction` teslim+ödenmiş iş emri için `{ error }` döner; `/api/cashbox/collections` rotası delege ettiği için otomatik kapsanır.

- [ ] **Step 1: Import ekle** — dosyanın import bloğuna:

```ts
import { isCollectionLockedForOrder } from "@/lib/status-transitions"
```

- [ ] **Step 2: Guard ekle** —

Mevcut:
```ts
  if (data.serviceOrderId) {
    const order = await prisma.serviceOrder.findFirst({
      where: { id: data.serviceOrderId, workshopId: user.workshopId },
    })
    if (!order) return { error: "İş emri bulunamadı" }
    if (order.status === "cancelled") return { error: "İptal edilmiş iş emrine tahsilat eklenemez" }
  }
```

Yeni (cancelled satırının hemen altına):
```ts
    if (isCollectionLockedForOrder(order.status, order.paymentStatus)) {
      return { error: "Bu iş emri teslim edildi ve tamamen ödendi; yeni tahsilat eklenemez" }
    }
```

- [ ] **Step 3: Doğrula**

Run: `bunx tsc --noEmit && bunx eslint "src/app/(app)/cashbox/actions.ts"`
Expected: çıktısız.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/cashbox/actions.ts"
git commit -m "feat(cashbox): teslim edilmiş + tam ödenmiş iş emrine tahsilat sunucuda kilitli"
```

---

### Task 4: UI yüzeylerini gizle

**Files:**
- Modify: `src/components/app/work-order-detail.tsx` — Düzenle butonu (~594), Fotoğraf Ekle butonu+dialog (~860), PhotoAnnotate (~970), PaymentHistoryCard çağrısı (~809)
- Modify: `src/components/app/order-management-panel.tsx` — `PaymentHistoryCard` prop'u (~489-534)

**Interfaces:**
- Consumes: `isOrderLocked` (work-order-detail.tsx'te zaten import'lu, satır 54) ve Task 1'den `isCollectionLockedForOrder`.
- Produces: `PaymentHistoryCard` prop'u `isCancelled: boolean` → `collectionsLocked: boolean` olarak DEĞİŞİR (tek çağıran work-order-detail.tsx).

- [ ] **Step 1: `WorkOrderDetail` içinde kilit değişkeni** — bileşenin state tanımlarının yanına (editingInfo state'inin üstüne, ~satır 186):

```ts
  const orderLocked = isOrderLocked(order.status as OrderStatus)
```

Ayrıca dosyanın import'una `isCollectionLockedForOrder` ekle:
```ts
import { isOrderLocked, isCollectionLockedForOrder } from "@/lib/status-transitions"
```

(Not: satır 756 ve 811'deki inline hesaplar bu değişkeni kullanacak şekilde sadeleştirilebilir; zorunlu değil.)

- [ ] **Step 2: Düzenle butonunu gizle** (~594):

Mevcut: `{!editingInfo && (`
Yeni: `{!editingInfo && !orderLocked && (`

- [ ] **Step 3: Fotoğraf Ekle butonu + dialog'u gizle** (~860): `<Button variant="outline" onClick={() => setAddingPhoto(true)} ...>` ve onu izleyen `<Dialog open={addingPhoto} ...>` bloğunu `{!orderLocked && (<> ... </>)}` içine al.

- [ ] **Step 4: PhotoAnnotate'i gizle** (~970):

Mevcut: `<PhotoAnnotate intakeFormId={intake.id} onUploaded={() => router.refresh()} />`
Yeni: `{!orderLocked && <PhotoAnnotate intakeFormId={intake.id} onUploaded={() => router.refresh()} />}`

- [ ] **Step 5: PaymentHistoryCard prop'unu değiştir** — `order-management-panel.tsx` içinde `isCancelled` prop'unu `collectionsLocked` olarak yeniden adlandır (tanım ~489/498, kullanım 516 ve 532: `{!isCancelled && (` → `{!collectionsLocked && (`). work-order-detail.tsx çağrısında (~811):

Mevcut: `isCancelled={order.status === "cancelled"}`
Yeni: `collectionsLocked={order.status === "cancelled" || isCollectionLockedForOrder(order.status as OrderStatus, order.paymentStatus as PaymentStatus)}`

`PaymentStatus` tipi için import: `import type { OrderStatus, PaymentStatus } from "@prisma/client"` (OrderStatus zaten import'luysa yalnız PaymentStatus ekle).

- [ ] **Step 6: Doğrula**

Run: `bunx tsc --noEmit && bunx eslint "src/components/app/work-order-detail.tsx" "src/components/app/order-management-panel.tsx"`
Expected: çıktısız.

- [ ] **Step 7: Commit**

```bash
git add src/components/app/work-order-detail.tsx src/components/app/order-management-panel.tsx
git commit -m "feat(orders): kilitli iş emrinde düzenle/foto/hasar/tahsilat UI yüzeyleri gizli"
```

---

### Task 5: Doğrulama

- [ ] **Step 1: Tüm kontroller**

Run: `bun test && bunx tsc --noEmit && bun run lint`
Expected: testler yeşil, tsc/lint temiz.

- [ ] **Step 2: Manuel QA** (dev server: `bun run dev`)

1. Teslim edilmiş + tam ödenmiş iş emri aç (`/orders/<id>?tab=ozet`): Düzenle butonu YOK, Fotoğraf Ekle YOK, Foto Çek & İşaretle YOK, Tahsilat sekmesinde "Tahsilat Ekle" YOK.
2. Aynı iş emri için API'yi doğrudan zorla (ör. tarayıcı konsolundan `/api/intakes/photos`'a POST) → 400 + Türkçe kilit mesajı.
3. Teslim edilmiş ama borcu kalan iş emri: "Tahsilat Ekle" GÖRÜNÜR, tahsilat kaydı başarılı.
4. `in_progress` iş emri: her şey eskisi gibi düzenlenebilir.
5. Tahsilat formuna `?orderId=<teslim+ödenmiş>` ile doğrudan gel, kaydet → sunucu hatası mesajı görünür.
