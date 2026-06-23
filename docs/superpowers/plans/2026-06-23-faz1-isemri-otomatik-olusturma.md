# Faz 1: Kabulle Birlikte İş Emrini Otomatik Oluştur — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bir araç kabulü (`VehicleIntakeForm`) oluşturulduğu anda, aynı transaction içinde ona bağlı bir `ServiceOrder` (İş Emri) otomatik oluşsun; manuel "kabulü iş emrine çevir" adımı artık gerekmesin.

**Architecture:** `ServiceOrder` zaten kabule 1:1 bağlı (`intakeFormId @unique`). İş emri oluşturma mantığını `"use server"` dışı saf bir lib helper'ına (`createServiceOrderForIntake`) çıkarıyoruz; hem mevcut `createServiceOrderAction` hem de `createIntakeAction` bu helper'ı tek bir `prisma.$transaction` içinde çağırıyor. Şema değişmiyor; manuel dönüşüm seçicisi (`NewOrderSelector`) legacy (order'sız eski) kabuller için köprü olarak yerinde bırakılıyor.

**Tech Stack:** Next.js 16 (App Router, server actions), Prisma 7 (PostgreSQL), TypeScript (strict), Bun (paket yöneticisi + test runner: `bun test`), Zod.

## Global Constraints

- **Tenant izolasyonu:** her sorgu/aksiyon `workshopId`'yi `requireAuth()`'tan türetir; client parametresine asla güvenilmez.
- **Şema değişikliği YOK:** Faz 1 hiçbir Prisma migrasyonu içermez (tüm alanlar mevcut).
- **`"use server"` kuralı:** server action modüllerinden yalnızca serialize edilebilir argümanlı async fonksiyonlar export edilir; `Prisma.TransactionClient` alan helper'lar `"use server"` İÇERMEYEN ayrı bir lib dosyasında durur.
- **TypeScript strict; `any` kullanma** (gerekçesiz).
- **UI metinleri Türkçe.**
- **Dokunma:** `.env`, prod config, `patches/next@16.2.6.patch`.
- **Paket yöneticisi bun.** Komutlar: `bun run lint`, `bun run typecheck`, `bun run build`, `bun test`.
- **Commit'ler küçük; branch `feat/unified-work-order-flow`;** her commit mesajı şu satırla biter:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

> **Test stratejisi (bu kod tabanı):** Saf fonksiyonlar `bun test` ile `src/lib/*.test.ts` olarak test edilir (mevcut konvansiyon). Server action / DB / UI değişiklikleri için entegrasyon test harness'i YOK; bunlar `bun run typecheck` + `bun run build` + açık **manuel QA** ile doğrulanır. Bu planda gerçek otomatik test yalnızca saf `work-order-number` mantığı için yazılır (Task 1); Task 2/3 typecheck/build/QA ile doğrulanır.

---

### Task 1: `work-order-number` minting için regresyon testleri

Faz 1 sonrası iş emri numarası **her kabul** için otomatik üretilecek (önceden yalnızca manuel dönüşümde). Bu sözleşmeyi kilitlemek için saf mantığa karakterizasyon testleri ekliyoruz. (Fonksiyonlar zaten var → testler ilk çalıştırmada PASS olur; bu kasıtlı bir regresyon ağıdır, red-green değil.)

**Files:**
- Create/Test: `src/lib/work-order-number.test.ts`

**Interfaces:**
- Consumes: `formatWorkOrderNo({ workOrderNo, id })`, `generateUniqueWorkOrderNo(isTaken, maxAttempts?)` from `src/lib/work-order-number.ts` (mevcut).
- Produces: yok (yalnızca test).

- [ ] **Step 1: Testi yaz**

`src/lib/work-order-number.test.ts`:

```ts
import { expect, test } from "bun:test"
import { formatWorkOrderNo, generateUniqueWorkOrderNo } from "@/lib/work-order-number"

test("formatWorkOrderNo açık workOrderNo varsa onu döner", () => {
  expect(formatWorkOrderNo({ workOrderNo: "BXABC123", id: "ckxyz" })).toBe("BXABC123")
})

test("formatWorkOrderNo null ise id'nin son 6 karakterinden BX- üretir", () => {
  // "clxxxxabcdef" -> son 6 -> "abcdef" -> "ABCDEF"
  expect(formatWorkOrderNo({ workOrderNo: null, id: "clxxxxabcdef" })).toBe("BX-ABCDEF")
})

test("generateUniqueWorkOrderNo dolu adayları atlayıp ilk boş olanı döner", async () => {
  let calls = 0
  const isTaken = async () => {
    calls++
    return calls < 3 // ilk iki aday dolu, üçüncü boş
  }
  const no = await generateUniqueWorkOrderNo(isTaken)
  expect(calls).toBe(3)
  expect(no.startsWith("BX")).toBe(true)
})
```

- [ ] **Step 2: Testi çalıştır, geçtiğini doğrula**

Run: `bun test src/lib/work-order-number.test.ts`
Expected: 3 pass, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add src/lib/work-order-number.test.ts
git commit -m "test: characterize work order number minting" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `createServiceOrderForIntake` helper'ını çıkar + `createServiceOrderAction`'ı ona bağla

Davranış değişmez (saf refactor). İş emri oluşturma mantığını `"use server"` dışı bir lib dosyasına taşıyoruz ki hem mevcut action hem de Task 3'teki `createIntakeAction` aynı kodu paylaşsın.

**Files:**
- Create: `src/lib/orders/create-service-order.ts`
- Modify: `src/app/(app)/orders/actions.ts` (`createServiceOrderAction`, satır 8–47 civarı)

**Interfaces:**
- Consumes: `generateUniqueWorkOrderNo` from `src/lib/work-order-number.ts`; `Prisma.TransactionClient` from `@prisma/client`.
- Produces: `createServiceOrderForIntake(tx: Prisma.TransactionClient, workshopId: string, intakeFormId: string): Promise<{ id: string; workOrderNo: string }>` — Task 3 bunu tüketir.

- [ ] **Step 1: Helper dosyasını oluştur**

`src/lib/orders/create-service-order.ts`:

```ts
import type { Prisma } from "@prisma/client"
import { generateUniqueWorkOrderNo } from "@/lib/work-order-number"

/**
 * Bir kabul (intake) için ServiceOrder'ı, VAR OLAN bir transaction içinde oluşturur.
 * Workshop'a özgü benzersiz iş emri numarası üretir.
 * Audit / timeline / revalidate sorumluluğu ÇAĞIRANA aittir.
 */
export async function createServiceOrderForIntake(
  tx: Prisma.TransactionClient,
  workshopId: string,
  intakeFormId: string,
): Promise<{ id: string; workOrderNo: string }> {
  const workOrderNo = await generateUniqueWorkOrderNo((candidate) =>
    tx.serviceOrder
      .findFirst({
        where: { workshopId, workOrderNo: candidate },
        select: { id: true },
      })
      .then((clash) => clash !== null),
  )

  const order = await tx.serviceOrder.create({
    data: { workshopId, intakeFormId, workOrderNo, status: "draft" },
  })

  return { id: order.id, workOrderNo }
}
```

- [ ] **Step 2: `createServiceOrderAction`'ı helper'ı kullanacak şekilde düzenle**

`src/app/(app)/orders/actions.ts` — import bloğuna ekle (mevcut `import { generateUniqueWorkOrderNo } ...` satırının hemen altına):

```ts
import { createServiceOrderForIntake } from "@/lib/orders/create-service-order"
```

Ardından mevcut transaction bloğunu (şu an satır 29–47):

```ts
  const order = await prisma.$transaction(async (tx) => {
    const workOrderNo = await generateUniqueWorkOrderNo((candidate) =>
      tx.serviceOrder
        .findFirst({
          where: { workshopId: user.workshopId, workOrderNo: candidate },
          select: { id: true },
        })
        .then((clash) => clash !== null)
    )

    return tx.serviceOrder.create({
      data: {
        workshopId: user.workshopId,
        intakeFormId,
        workOrderNo,
        status: "draft",
      },
    })
  })
```

şununla değiştir:

```ts
  const order = await prisma.$transaction((tx) =>
    createServiceOrderForIntake(tx, user.workshopId, intakeFormId),
  )
```

> Not: Geri kalan kod (`AuditLogAction(... order.id ...)`, `addTimelineEvent`, `revalidatePath`, `return { success: true, id: order.id }`) DEĞİŞMEZ — helper `{ id, workOrderNo }` döndüğü için `order.id` aynen çalışır. `generateUniqueWorkOrderNo` artık bu dosyada doğrudan kullanılmıyorsa, kullanılmayan import'u kaldır (typecheck/lint uyarısını gözle).

- [ ] **Step 3: Typecheck + lint + test**

Run: `bun run typecheck && bun run lint && bun test`
Expected: typecheck hatasız; lint temiz (kullanılmayan import kalmamış); tüm testler PASS.

- [ ] **Step 4: Manuel smoke (refactor regresyon yok)**

Run: `bun run dev` → giriş yap → bir kabulü manuel dönüşümle iş emrine çevir (`/orders/new` → "Kabullerden İş Emri Oluştur").
Expected: İş emri eskisi gibi oluşuyor, `/orders/[id]` açılıyor, `workOrderNo` görünüyor. (Davranış değişmedi.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/orders/create-service-order.ts src/app/\(app\)/orders/actions.ts
git commit -m "refactor: extract createServiceOrderForIntake helper" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `createIntakeAction` kabul + iş emrini tek transaction'da oluştursun

Faz 1'in özü. Kabul oluşturulurken aynı transaction içinde iş emri de oluşur; ikisi için de audit + timeline yazılır; `/orders` revalidate edilir.

**Files:**
- Modify: `src/app/(app)/intakes/actions.ts` (`createIntakeAction`, satır 14–62)

**Interfaces:**
- Consumes: `createServiceOrderForIntake` (Task 2).
- Produces: `createIntakeAction(formData)` artık `{ success: true, id: string, orderId: string }` döner (eski `id` korunur; `orderId` eklemeli/non-breaking).

- [ ] **Step 1: Import ekle**

`src/app/(app)/intakes/actions.ts` — mevcut import'ların sonuna:

```ts
import { createServiceOrderForIntake } from "@/lib/orders/create-service-order"
```

- [ ] **Step 2: Intake create'i transaction + otomatik order ile değiştir**

Mevcut blok (satır 40–61):

```ts
  const intake = await prisma.vehicleIntakeForm.create({
    data: {
      workshopId: user.workshopId,
      customerId: parsed.data.customerId,
      vehicleId: parsed.data.vehicleId,
      mileageAtIntake: parsed.data.mileageAtIntake || null,
      customerComplaint: parsed.data.customerComplaint,
      internalNote: parsed.data.internalNote || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "VehicleIntakeForm", intake.id, "intake_created")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: intake.id,
    eventType: "intake_created",
    description: "Araç kabul formu oluşturuldu",
  })

  revalidatePath("/intakes")
  return { success: true, id: intake.id }
```

şununla değiştir:

```ts
  const { intake, order } = await prisma.$transaction(async (tx) => {
    const intake = await tx.vehicleIntakeForm.create({
      data: {
        workshopId: user.workshopId,
        customerId: parsed.data.customerId,
        vehicleId: parsed.data.vehicleId,
        mileageAtIntake: parsed.data.mileageAtIntake || null,
        customerComplaint: parsed.data.customerComplaint,
        internalNote: parsed.data.internalNote || null,
      },
    })
    const order = await createServiceOrderForIntake(tx, user.workshopId, intake.id)
    return { intake, order }
  })

  await AuditLogAction(user.workshopId, user.id, "VehicleIntakeForm", intake.id, "intake_created")
  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", order.id, "service_order_created")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: intake.id,
    eventType: "intake_created",
    description: "Araç kabul formu oluşturuldu",
  })
  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: intake.id,
    eventType: "work_order_created",
    description: "İş emri oluşturuldu",
  })

  revalidatePath("/intakes")
  revalidatePath("/orders")
  return { success: true, id: intake.id, orderId: order.id }
```

- [ ] **Step 3: Typecheck + lint + test**

Run: `bun run typecheck && bun run lint && bun test`
Expected: hepsi PASS/temiz.

- [ ] **Step 4: Build**

Run: `bun run build`
Expected: build başarılı (anlamlı değişim olduğu için build doğrulaması).

- [ ] **Step 5: Manuel QA — kabul iş emrini doğuruyor mu?**

Run: `bun run dev` → yeni bir araç kabulü oluştur (`/intakes/new`, müşteri+araç+şikayet gir, kaydet).
Expected:
1. Kabul oluşuyor (`/intakes/[id]` açılıyor) ve detayda iş emri/`workOrderNo` görünür (intake-detail order-aware).
2. `/orders` listesinde bu kayda ait yeni bir **draft** iş emri görünüyor.
3. Aynı kabul için ikinci bir order OLUŞMUYOR (1:1 korunuyor — tekrar oluşturma denemesinde `createServiceOrderAction` mevcut order'ı döner).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/intakes/actions.ts
git commit -m "feat: auto-create work order when an intake is created" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Faz 1 kapsam dışı / sonraki fazlara devredilen

- **`changeVehicleOwnerAction` (#3):** spec'te Faz 1'deydi; çağıracak UI'ı (picker) Faz 2'de olduğu için **Faz 2'ye taşındı** (action + UI birlikte sevk edilsin, sahipsiz dead-code olmasın).
- **Manuel `NewOrderSelector`'ın resmen kaldırılması:** legacy order'sız kabuller için köprü olarak kalır; tüm eski kabuller order'a kavuşunca (veya backfill sonrası) ileride kaldırılır.
- **`/orders/new` prefill (`?vehicleId=&customerId=`) ve birleşik akışa yönlendirme:** Faz 2/3.

## Sonraki fazların sırası (özet)

- **Faz 2:** Tek searchable müşteri+araç input + inline oluşturma modalı (#1, #2) + `changeVehicleOwnerAction` (#3). En çok saf mantık burada (arama birleştirme/sıralama) → gerçek TDD mümkün.
- **Faz 3:** Dikey kaydırmalı akış (#4); wizard'ı 3 panele indir; OTP adımını akıştan çıkar.
- **Faz 5 ↔ Faz 3 sıralama uyarısı:** İntake OTP'sini akıştan çıkarmak (Faz 3) ile teslim OTP'sini eklemek (Faz 5) arasında **OTP boşluğu** oluşmasın diye **Faz 5'i Faz 3 ile birlikte veya hemen öncesinde** sevk et; aksi halde geçiş penceresinde hiçbir yerde OTP olmaz.
- **Faz 4:** Fotoğraf üzeri kalem + hasar haritasının akıştan çıkarılması (#5).
