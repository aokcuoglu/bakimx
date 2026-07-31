# İş Emri Bilgileri: iki kolon + fatura, durum, geliş nedeni — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İş emri detayındaki "İş Emri Bilgileri" kartını iki kolona bölmek; sağ kolona
fatura numarası, fatura tarihi, toplam tutar, durum ve servise geliş nedeni alanlarını
eklemek.

**Architecture:** `ServiceOrder`'a üç nullable kolon (`invoiceNo`, `invoiceDate`,
`arrivalReason`) eklenir. Durum için yeni yazma yolu açılmaz — mevcut, geçiş doğrulaması
yapılmış `updateOrderStatusAction` kullanılır; "Teslim Edildi" seçimi mevcut OTP akışına
köprülenir. Fatura ve neden için iki yeni server action + iki API route eklenir.
`OrderInfoCard` şişkin `order-management-panel.tsx`'ten kendi dosyasına taşınır.

**Tech Stack:** Next.js 16 (App Router, server actions), TypeScript strict, Prisma +
PostgreSQL, Base UI tabanlı shadcn bileşenleri (`src/components/ui/*`), zod v4,
`bun test` (colocated `*.test.ts`), sonner toast.

**Tasarım dokümanı:** `docs/superpowers/specs/2026-07-31-is-emri-bilgileri-iki-kolon-design.md`

## Global Constraints

- **Worktree:** Tüm iş `/Users/void/www/bakimx-order-info` içinde, `feat/order-info-invoice-fields`
  dalında yapılır. Ana checkout'a (`/Users/void/www/bakimx`) dokunulmaz.
- **Kiracı izolasyonu:** Her server action `requireWritableWorkshop()` ile `workshopId`
  türetir; istemciden gelen hiçbir workshop parametresine güvenilmez. Her sorgu ve
  `updateMany` `where` bloğunda `workshopId` taşır.
- **TypeScript strict**, `any` yok.
- **Migration eklemeli olmalı:** üç kolon da nullable, veri taşıma/backfill yok.
- **Yeni fixed/sticky bottom CTA eklenmez** (proje konvansiyonu).
- **Bileşen yüksekliği:** web'de (md+) form bileşenleri `h-9`; `h-10`/`h-11` override yok.
- **Base UI `SelectValue` ham değeri basar** — etiket göstermek için `SelectValue` içinde
  render fonksiyonu kullanılır (`{(value: string | null) => ...}`).
- **Müşteriye açık çıktı yok:** `invoiceNo`, `invoiceDate`, `arrivalReason` public
  pasaport / PDF / timeline'a eklenmez; `src/lib/intake/data-safety.ts` değiştirilmez.
- **Türkçe:** kullanıcıya görünen tüm metinler ve commit mesajları Türkçe.
- **Doğrulama komutları:** `bun test`, `bun run lint`, `bun run typecheck`.
- Her task kendi commit'iyle biter.

---

### Task 1: `ArrivalReason` sabitleri ve tip koruması

Servise geliş nedeninin Türkçe etiketleri tek yerde yaşasın; DB'de İngilizce enum
anahtarı dursun. `ORDER_STATUS` deseniyle birebir aynı.

**Files:**
- Modify: `src/lib/constants.ts` (`ORDER_STATUS_ORDER` bloğunun hemen altına, ~satır 78)
- Test: `src/lib/constants.test.ts` (mevcut dosyaya ekleme)

**Interfaces:**
- Consumes: yok (ilk task)
- Produces:
  - `ARRIVAL_REASONS: Record<ArrivalReasonKey, { label: string }>`
  - `ARRIVAL_REASON_ORDER: readonly ArrivalReasonKey[]`
  - `type ArrivalReasonKey = "fault" | "damage" | "maintenance" | "inspection" | "accessory"`
  - `isArrivalReason(value: string): value is ArrivalReasonKey`
  - `arrivalReasonLabel(value: string | null | undefined): string`

- [ ] **Step 1: Testleri yaz (başarısız olacak)**

`src/lib/constants.test.ts` dosyasının sonuna ekle. Dosyanın en üstündeki mevcut
import satırını da genişlet:

```ts
import { tecdocFuelToFormValue, isArrivalReason, arrivalReasonLabel, ARRIVAL_REASON_ORDER } from "./constants"
```

```ts
test("isArrivalReason yalnız tanımlı nedenleri kabul eder", () => {
  expect(isArrivalReason("fault")).toBe(true)
  expect(isArrivalReason("accessory")).toBe(true)
  expect(isArrivalReason("kaza")).toBe(false)
  expect(isArrivalReason("")).toBe(false)
})

test("isArrivalReason prototip anahtarlarını kabul etmez", () => {
  // `key in obj` kullanılırsa "toString" true döner; guard liste tabanlı olmalı.
  expect(isArrivalReason("toString")).toBe(false)
  expect(isArrivalReason("constructor")).toBe(false)
})

test("arrivalReasonLabel Türkçe etiket döner, boş değerde tire", () => {
  expect(arrivalReasonLabel("fault")).toBe("Arıza")
  expect(arrivalReasonLabel("damage")).toBe("Hasar")
  expect(arrivalReasonLabel("maintenance")).toBe("Bakım")
  expect(arrivalReasonLabel("inspection")).toBe("Kontrol")
  expect(arrivalReasonLabel("accessory")).toBe("Aksesuar")
  expect(arrivalReasonLabel(null)).toBe("—")
  expect(arrivalReasonLabel("")).toBe("—")
})

test("arrivalReasonLabel tanınmayan değeri olduğu gibi döner", () => {
  expect(arrivalReasonLabel("bilinmeyen")).toBe("bilinmeyen")
})

test("ARRIVAL_REASON_ORDER beş nedeni ürün sırasında tutar", () => {
  expect(ARRIVAL_REASON_ORDER).toEqual(["fault", "damage", "maintenance", "inspection", "accessory"])
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `bun test src/lib/constants.test.ts`
Beklenen: FAIL — `isArrivalReason is not a function` / export bulunamadı.

- [ ] **Step 3: Sabitleri ekle**

`src/lib/constants.ts` içinde `ORDER_STATUS_ORDER` tanımının altına:

```ts
/**
 * Servise geliş nedeni. DB'de `ArrivalReason` enum anahtarı (İngilizce) tutulur;
 * Türkçe etiketler yalnız burada yaşar — ORDER_STATUS ile aynı desen.
 */
export const ARRIVAL_REASONS = {
  fault: { label: "Arıza" },
  damage: { label: "Hasar" },
  maintenance: { label: "Bakım" },
  inspection: { label: "Kontrol" },
  accessory: { label: "Aksesuar" },
} as const

export type ArrivalReasonKey = keyof typeof ARRIVAL_REASONS

export const ARRIVAL_REASON_ORDER: readonly ArrivalReasonKey[] = [
  "fault",
  "damage",
  "maintenance",
  "inspection",
  "accessory",
]

// `value in ARRIVAL_REASONS` KULLANILMAZ: prototip anahtarları ("toString") true döner.
export function isArrivalReason(value: string): value is ArrivalReasonKey {
  return (ARRIVAL_REASON_ORDER as readonly string[]).includes(value)
}

export function arrivalReasonLabel(value: string | null | undefined): string {
  if (!value) return "—"
  return ARRIVAL_REASONS[value as ArrivalReasonKey]?.label ?? value
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `bun test src/lib/constants.test.ts`
Beklenen: PASS (tüm testler).

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.ts src/lib/constants.test.ts
git commit -m "feat(orders): servise geliş nedeni sabitleri ve tip koruması"
```

---

### Task 2: Prisma şeması ve migration

**Files:**
- Modify: `prisma/schema.prisma` (`model ServiceOrder`, ~satır 664–705; enum bloğu ~satır 707 civarı)
- Create: `prisma/migrations/<timestamp>_order_invoice_and_arrival_reason/migration.sql` (Prisma üretir)

**Interfaces:**
- Consumes: Task 1'in `ArrivalReasonKey` birleşimi — Prisma enum değerleri birebir aynı
  beş anahtar olmalı (`fault`, `damage`, `maintenance`, `inspection`, `accessory`).
- Produces: `ServiceOrder.invoiceNo: string | null`, `ServiceOrder.invoiceDate: Date | null`,
  `ServiceOrder.arrivalReason: ArrivalReason | null` (Prisma Client tipleri).

- [ ] **Step 1: Şemaya kolonları ekle**

`model ServiceOrder` içinde, `notes String?` satırının hemen altına:

```prisma
  /// Fatura entegrasyonu yok — kullanıcı kendi fatura uygulamasından okuyup elle girer.
  /// Bu iki alan, teslim edilmiş iş emrinde de yazılabilir (bkz. updateOrderInvoiceAction);
  /// iptal edilmiş emirde yazılamaz.
  invoiceNo            String?
  invoiceDate          DateTime?
  /// Aracın servise geliş nedeni. İşin içeriğine dair bilgi olduğu için
  /// teslim/iptal sonrası kilitlenir.
  arrivalReason        ArrivalReason?
```

- [ ] **Step 2: Enum'u ekle**

`enum OrderStatus { ... }` bloğunun hemen altına:

```prisma
enum ArrivalReason {
  fault // Arıza
  damage // Hasar
  maintenance // Bakım
  inspection // Kontrol
  accessory // Aksesuar
}
```

- [ ] **Step 3: Şemayı doğrula**

Çalıştır: `bun run db:validate`
Beklenen: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Migration'ı yerelde üret**

`prisma migrate dev` PAYLAŞILAN AWS dev veritabanına ASLA çalıştırılmaz (sıfırlayabilir).
`db:migrate` script'i yerel OrbStack Postgres'i ayağa kaldırıp orada üretir:

Çalıştır: `bun run db:migrate --name order_invoice_and_arrival_reason`
Beklenen: yeni migration klasörü oluşur, yerelde uygulanır, script "✓ Migration authored
& applied locally" yazar.

Eğer `ECONNREFUSED localhost:5432` alırsan yerel Postgres kapalıdır; kod hatası değildir:
`docker compose -f docker-compose.local.yml up -d db`

- [ ] **Step 5: Üretilen SQL'in eklemeli olduğunu doğrula**

Çalıştır: `cat prisma/migrations/*order_invoice_and_arrival_reason/migration.sql`
Beklenen: yalnızca `CREATE TYPE "ArrivalReason"` + `ALTER TABLE "ServiceOrder" ADD COLUMN`
satırları. `DROP`, `NOT NULL` veya veri taşıyan hiçbir ifade OLMAMALI. Varsa dur ve bildir.

- [ ] **Step 6: Prisma Client'ı üret ve tip kontrolü**

Çalıştır: `bun run db:generate && bun run typecheck`
Beklenen: her ikisi de hatasız.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): iş emrine fatura no/tarih ve geliş nedeni kolonları"
```

---

### Task 3: Durum dropdown hedef listesi

Kartın Durum dropdown'ı kendi listesini uydurmasın; durum makinesinden türesin.

**Files:**
- Modify: `src/lib/status-transitions.ts` (`canTransitionOrder`'ın hemen altı, ~satır 96)
- Test: `src/lib/status-transitions.test.ts` (mevcut dosyaya ekleme)

**Interfaces:**
- Consumes: mevcut `ORDER_TRANSITIONS`, `ORDER_STATUSES`
- Produces: `orderStatusOptions(current: OrderStatus): OrderStatus[]` — mevcut durum ilk
  eleman, ardından o durumdan izin verilen hedefler; tekrar içermez.

- [ ] **Step 1: Testleri yaz (başarısız olacak)**

`src/lib/status-transitions.test.ts` en üstteki import satırını genişlet:

```ts
import { canTransitionIntake, canTransitionOrder, isOrderLocked, isIntakeWriteLocked, isCollectionLockedForOrder, orderStatusOptions, ORDER_STATUSES } from "./status-transitions"
```

Dosyanın sonuna ekle:

```ts
test("orderStatusOptions mevcut durumu ve izinli hedefleri listeler", () => {
  expect(orderStatusOptions("in_progress")).toEqual([
    "in_progress",
    "waiting_parts",
    "ready_for_delivery",
    "cancelled",
  ])
})

test("orderStatusOptions taslakta başlama ve iptali sunar", () => {
  // Emekli onay akışı (waiting_approval) hedef olarak SUNULMAZ.
  expect(orderStatusOptions("draft")).toEqual(["draft", "in_progress", "cancelled"])
})

test("orderStatusOptions emekli onay statülerini hedef olarak sunmaz", () => {
  for (const status of ORDER_STATUSES) {
    const targets = orderStatusOptions(status).slice(1)
    expect(targets).not.toContain("waiting_approval")
    expect(targets).not.toContain("approved")
  }
})

test("orderStatusOptions emir zaten emekli statüdeyse onu listede tutar", () => {
  // Eski kayıtlar doğru görünsün diye mevcut durum her zaman ilk eleman.
  expect(orderStatusOptions("waiting_approval")).toEqual(["waiting_approval", "in_progress", "cancelled"])
  expect(orderStatusOptions("approved")).toEqual(["approved", "in_progress", "waiting_parts", "cancelled"])
})

test("orderStatusOptions teslim edilmiş emirde yalnız mevcut durumu döner", () => {
  expect(orderStatusOptions("delivered")).toEqual(["delivered"])
})

test("orderStatusOptions hiçbir durumda tekrar eden değer üretmez", () => {
  for (const status of ORDER_STATUSES) {
    const options = orderStatusOptions(status)
    expect(new Set(options).size).toBe(options.length)
  }
})

test("orderStatusOptions'ın döndürdüğü her hedefe geçiş gerçekten izinli", () => {
  for (const status of ORDER_STATUSES) {
    for (const target of orderStatusOptions(status)) {
      expect(canTransitionOrder(status, target)).toBe(true)
    }
  }
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `bun test src/lib/status-transitions.test.ts`
Beklenen: FAIL — `orderStatusOptions is not a function`.

- [ ] **Step 3: Fonksiyonu ekle**

`src/lib/status-transitions.ts` içinde `canTransitionOrder`'ın altına:

```ts
/**
 * Onay akışı emekli (bkz. dosya başındaki not): bu iki statü artık hiçbir akıştan
 * üretilmiyor ve başlıktaki NEXT_STATUSES de bunları sunmuyor. Elle diriltilmesin
 * diye hedef listesinden elenirler. ORDER_TRANSITIONS'a dokunulmaz — eski kayıtların
 * o statülerden ileri gidebilmesi gerekiyor.
 */
const RETIRED_ORDER_STATUSES: readonly OrderStatus[] = ["waiting_approval", "approved"]

/**
 * İş emri kartındaki Durum dropdown'ında listelenecek değerler: mevcut durum +
 * durum makinesinin o durumdan izin verdiği, emekli olmayan hedefler. Liste
 * `ORDER_TRANSITIONS`'tan türediği için UI ile sunucu doğrulaması ayrışamaz.
 *
 * Mevcut durum filtreye TABİ DEĞİL: emri zaten emekli bir statüde olan eski
 * kayıtlar dropdown'da kendi durumlarını doğru görsün diye ilk eleman hep `current`.
 *
 * NOT: `delivered` listede DURUR ama seçilince doğrudan yazılmaz — çağıran taraf
 * müşteri onaylı teslim (OTP) akışını tetikler (bkz. order-info-card.tsx).
 */
export function orderStatusOptions(current: OrderStatus): OrderStatus[] {
  const targets = (ORDER_TRANSITIONS[current] ?? []).filter((s) => !RETIRED_ORDER_STATUSES.includes(s))
  return [current, ...targets]
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `bun test src/lib/status-transitions.test.ts`
Beklenen: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/status-transitions.ts src/lib/status-transitions.test.ts
git commit -m "feat(orders): durum dropdown'ı için izinli hedef listesi"
```

---

### Task 4: Fatura doğrulama şeması

**Files:**
- Modify: `src/lib/validations/order.ts`
- Test: `src/lib/validations/order.test.ts` (yeni dosya)

**Interfaces:**
- Consumes: yok
- Produces: `orderInvoiceSchema` — `{ invoiceNo: string; invoiceDate: string }` girdisini
  doğrular ve kırpılmış (`trim`) çıktı verir. `invoiceDate` ya boş string ya da
  `GG.AA.YYYY` biçiminde (DatePicker'ın depolama biçimi).

- [ ] **Step 1: Testi yaz (başarısız olacak)**

`src/lib/validations/order.test.ts` (yeni dosya):

```ts
import { test, expect } from "bun:test"
import { orderInvoiceSchema } from "./order"

test("orderInvoiceSchema boş değerleri kabul eder (alan temizleme)", () => {
  const r = orderInvoiceSchema.safeParse({ invoiceNo: "", invoiceDate: "" })
  expect(r.success).toBe(true)
})

test("orderInvoiceSchema fatura numarasını kırpar", () => {
  const r = orderInvoiceSchema.safeParse({ invoiceNo: "  ABC-2026-001  ", invoiceDate: "" })
  expect(r.success).toBe(true)
  if (r.success) expect(r.data.invoiceNo).toBe("ABC-2026-001")
})

test("orderInvoiceSchema 50 karakteri aşan numarayı reddeder", () => {
  const r = orderInvoiceSchema.safeParse({ invoiceNo: "X".repeat(51), invoiceDate: "" })
  expect(r.success).toBe(false)
})

test("orderInvoiceSchema GG.AA.YYYY biçimini kabul eder", () => {
  const r = orderInvoiceSchema.safeParse({ invoiceNo: "", invoiceDate: "31.07.2026" })
  expect(r.success).toBe(true)
})

test("orderInvoiceSchema ISO ve serbest metin tarihi reddeder", () => {
  expect(orderInvoiceSchema.safeParse({ invoiceNo: "", invoiceDate: "2026-07-31" }).success).toBe(false)
  expect(orderInvoiceSchema.safeParse({ invoiceNo: "", invoiceDate: "dün" }).success).toBe(false)
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Çalıştır: `bun test src/lib/validations/order.test.ts`
Beklenen: FAIL — `orderInvoiceSchema` export edilmemiş.

- [ ] **Step 3: Şemayı ekle**

`src/lib/validations/order.ts` dosyasının sonuna:

```ts
/**
 * Fatura bilgisi elle girilir (fatura entegrasyonu yok). İki alan da boş
 * bırakılabilir — boş değer alanı temizler. Tarih, DatePicker'ın depolama
 * biçiminde (GG.AA.YYYY) gelir; sunucu tarafında `trDateToDate` ile Date'e çevrilir.
 */
export const orderInvoiceSchema = z.object({
  invoiceNo: z.string().trim().max(50, "Fatura numarası en fazla 50 karakter olabilir"),
  invoiceDate: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{2}\.\d{2}\.\d{4}$/.test(v), "Geçerli bir tarih seçiniz"),
})
```

Dosyanın üstünde `z` importu zaten varsa tekrar ekleme.

- [ ] **Step 4: Testin geçtiğini doğrula**

Çalıştır: `bun test src/lib/validations/order.test.ts`
Beklenen: PASS. Eğer zod v4'te `.trim().max()` zincirlemesi hata verirse
`z.string().max(50, "...").transform((s) => s.trim())` biçimine çevir ve testi tekrar çalıştır.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/order.ts src/lib/validations/order.test.ts
git commit -m "feat(orders): fatura bilgisi doğrulama şeması"
```

---

### Task 5: Sunucu aksiyonları ve API route'ları

**Files:**
- Modify: `src/app/(app)/orders/actions.ts` (dosya sonuna iki yeni action; import satırları ~1–20)
- Create: `src/app/api/orders/[id]/invoice/route.ts`
- Create: `src/app/api/orders/[id]/arrival-reason/route.ts`

**Interfaces:**
- Consumes: `orderInvoiceSchema` (Task 4), `isArrivalReason` + `ArrivalReasonKey` (Task 1),
  `ServiceOrder.invoiceNo/invoiceDate/arrivalReason` (Task 2), mevcut `AuditLogAction`,
  `trDateToDate`, `isOrderLocked`.
- Produces:
  - `updateOrderInvoiceAction(orderId: string, formData: FormData): Promise<{ success: true } | { error: string }>`
  - `updateOrderArrivalReasonAction(orderId: string, reason: string): Promise<{ success: true } | { error: string }>`
  - `POST /api/orders/[id]/invoice` — `FormData` gövdesi: `invoiceNo`, `invoiceDate`
  - `POST /api/orders/[id]/arrival-reason` — JSON gövdesi: `{ reason: string }` (boş string = temizle)

- [ ] **Step 1: Import satırlarını genişlet**

`src/app/(app)/orders/actions.ts` başındaki iki satırı güncelle:

```ts
import { serviceOrderItemSchema, serviceOrderItemUpdateSchema, purchaseItemCreateSchema, purchaseItemUpdateSchema, orderInvoiceSchema } from "@/lib/validations/order"
import { isArrivalReason, type ArrivalReasonKey } from "@/lib/constants"
```

`trDateToDate` zaten `@/lib/format`'tan import ediliyor; ekleme gerekmez.

- [ ] **Step 2: `updateOrderInvoiceAction`'ı yaz**

`updateOrderMetaAction`'ın (~satır 899) hemen altına:

```ts
/**
 * Fatura no + tarih elle girilir. `isOrderLocked` BİLEREK uygulanmaz: fatura
 * pratikte araç teslim edildikten sonra kesilir, bu yüzden teslim edilmiş iş
 * emrinde de bu iki alan yazılabilir kalır. Kalem/fiyat/fotoğraf/durum kilidi
 * aynen sürer. İptal edilmiş emir istisnadır — iş hiç yapılmadı.
 */
export async function updateOrderInvoiceAction(orderId: string, formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop()

  const parsed = orderInvoiceSchema.safeParse({
    invoiceNo: (formData.get("invoiceNo") as string) ?? "",
    invoiceDate: (formData.get("invoiceDate") as string) ?? "",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz fatura bilgisi" }
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
    select: { id: true, status: true, invoiceNo: true, invoiceDate: true },
  })
  if (!order) return { error: "Servis emri bulunamadı" }
  if (order.status === "cancelled") {
    return { error: "İptal edilmiş iş emrine fatura bilgisi girilemez" }
  }

  const invoiceDate = parsed.data.invoiceDate ? trDateToDate(parsed.data.invoiceDate) : null
  if (parsed.data.invoiceDate && !invoiceDate) return { error: "Geçerli bir tarih seçiniz" }

  const invoiceNo = parsed.data.invoiceNo || null

  await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: { invoiceNo, invoiceDate },
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrder",
    orderId,
    "order_invoice_updated",
    JSON.stringify({
      from: { invoiceNo: order.invoiceNo, invoiceDate: order.invoiceDate?.toISOString() ?? null },
      to: { invoiceNo, invoiceDate: invoiceDate?.toISOString() ?? null },
    }),
    orderId,
  )

  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}
```

- [ ] **Step 3: `updateOrderArrivalReasonAction`'ı yaz**

Bir önceki fonksiyonun hemen altına:

```ts
/**
 * Servise geliş nedeni, işin İÇERİĞİNE dair bir bilgidir: fatura alanlarının
 * aksine teslim/iptal sonrası kilitlenir. Boş string nedeni temizler.
 */
export async function updateOrderArrivalReasonAction(orderId: string, reason: string) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop()

  // Ayrı `if` bloğu bilinçli: tek satırlık koşulda TS `reason`'ı daraltamıyor.
  let nextReason: ArrivalReasonKey | null = null
  if (reason !== "") {
    if (!isArrivalReason(reason)) return { error: "Geçersiz geliş nedeni" }
    nextReason = reason
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
    select: { id: true, status: true, arrivalReason: true },
  })
  if (!order) return { error: "Servis emri bulunamadı" }
  if (isOrderLocked(order.status)) {
    return { error: "Teslim edilmiş veya iptal edilmiş iş emri düzenlenemez" }
  }

  await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: { arrivalReason: nextReason },
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrder",
    orderId,
    "order_arrival_reason_set",
    JSON.stringify({ from: order.arrivalReason, to: nextReason }),
    orderId,
  )

  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}
```

- [ ] **Step 4: Fatura API route'unu oluştur**

`src/app/api/orders/[id]/invoice/route.ts` (mevcut `meta/route.ts` deseniyle birebir):

```ts
import { updateOrderInvoiceAction } from "@/app/(app)/orders/actions"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const formData = await request.formData()
    const result = await updateOrderInvoiceAction(id, formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
```

- [ ] **Step 5: Geliş nedeni API route'unu oluştur**

`src/app/api/orders/[id]/arrival-reason/route.ts` (mevcut `status/route.ts` deseniyle):

```ts
import { updateOrderArrivalReasonAction } from "@/app/(app)/orders/actions"
import { NextResponse } from "next/server"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const result = await updateOrderArrivalReasonAction(id, typeof body.reason === "string" ? body.reason : "")
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
```

- [ ] **Step 6: Tip ve lint kontrolü**

Çalıştır: `bun run typecheck && bun run lint`
Beklenen: her ikisi de hatasız.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/orders/actions.ts" "src/app/api/orders/[id]/invoice" "src/app/api/orders/[id]/arrival-reason"
git commit -m "feat(orders): fatura bilgisi ve geliş nedeni yazma aksiyonları"
```

---

### Task 6: `OrderInfoCard`'ı kendi dosyasına taşı (saf mekanik)

`order-management-panel.tsx` 599 satır; kart büyüyecek. Bu task'ta HİÇBİR davranış
değişmez — yalnız taşıma. Gözden geçirenin sonraki task'ları okuyabilmesi için ayrı tutuldu.

**Files:**
- Create: `src/components/orders/order-info-card.tsx`
- Modify: `src/components/orders/order-management-panel.tsx` (satır 388–465 silinir + artık kullanılmayan importlar temizlenir)
- Modify: `src/components/orders/work-order-detail.tsx` (satır 74–83 import bloğu)

**Interfaces:**
- Consumes: `OrderDetailData` ve `Totals` tipleri `order-management-panel.tsx`'ten
  (tek yönlü import — panel yeni dosyadan hiçbir şey almaz, döngü oluşmaz).
- Produces: `OrderInfoCard` bileşeni artık `@/components/orders/order-info-card`'tan
  export edilir; props imzası bu task'ta değişmez:
  `{ order: OrderDetailData; technicians?: AssignableTechnician[] }`

- [ ] **Step 1: Yeni dosyayı oluştur**

`src/components/orders/order-info-card.tsx` — `order-management-panel.tsx`'in 388–465
satırlarındaki `OrderInfoCard` ve `InfoRow` gövdeleri AYNEN taşınır, üstüne gereken
importlar yazılır:

```tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PaymentBadge } from "@/components/shared/status-badge"
import { TechnicianAssign, type AssignableTechnician } from "@/components/orders/technician-assign"
import { formatDateTime } from "@/lib/utils-client"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import { cn } from "@/lib/utils"
import { Calendar, Receipt } from "lucide-react"
import type { OrderDetailData } from "@/components/orders/order-management-panel"
```

- [ ] **Step 2: Panelden sil ve artık kullanılmayan importları temizle**

`order-management-panel.tsx`'ten `OrderInfoCard` (388–443) ve `InfoRow` (445–465)
fonksiyonlarını sil. Bu dört import artık kullanılmıyor, kaldır:

- `Receipt` ve `Calendar` (lucide-react import bloğundan; `Plus`, `Wrench`, `Loader2`,
  `Pencil`, `Save`, `Calculator`, `Wallet`, `ChevronRight` KALIR)
- `formatDateTime` (`formatDate` KALIR — satır 538'de kullanılıyor)
- `TechnicianAssign` + `type AssignableTechnician` (satır 33 — tüm satır silinir)
- `isOrderLocked` (satır 31) ve `import type { OrderStatus }` (satır 32)

`PaymentBadge` ve `cn` KALIR (panelin başka yerlerinde kullanılıyor).

- [ ] **Step 3: Tüketiciyi güncelle**

`work-order-detail.tsx` içindeki `@/components/orders/order-management-panel` import
bloğundan `OrderInfoCard,` satırını çıkar ve altına ayrı bir satır ekle:

```ts
import { OrderInfoCard } from "@/components/orders/order-info-card"
```

- [ ] **Step 4: Taşımanın gerçekten saf olduğunu doğrula**

Çalıştır: `bun run typecheck && bun run lint`
Beklenen: her ikisi de hatasız — özellikle "unused import" uyarısı OLMAMALI.

- [ ] **Step 5: Commit**

```bash
git add src/components/orders/order-info-card.tsx src/components/orders/order-management-panel.tsx src/components/orders/work-order-detail.tsx
git commit -m "refactor(orders): OrderInfoCard kendi dosyasına taşındı"
```

---

### Task 7: Veri katmanı + iki kolon düzeni (salt okunur)

Üç yeni alan sayfadan karta akar; kart ikiye bölünür. Bu task'ta hiçbir alan
düzenlenemez — yalnız gösterim.

**Files:**
- Modify: `src/components/orders/order-management-panel.tsx` (`OrderDetailData` tipi, ~satır 79–132)
- Modify: `src/app/(app)/orders/[id]/page.tsx` (`safeOrder` eşlemesi, ~satır 96–123)
- Modify: `src/components/orders/order-info-card.tsx`

**Interfaces:**
- Consumes: `arrivalReasonLabel` (Task 1), `formatTRY`, `formatDate`
- Produces: `OrderDetailData` artık `invoiceNo: string | null`,
  `invoiceDate: string | null` (ISO), `arrivalReason: string | null` taşır.

- [ ] **Step 1: Tipi genişlet**

`order-management-panel.tsx` içindeki `OrderDetailData` tipine, `notes: string | null`
satırının altına:

```ts
  invoiceNo: string | null
  /** ISO string; kartta GG.AA.YYYY olarak gösterilir. */
  invoiceDate: string | null
  /** ArrivalReason enum anahtarı; etiket için arrivalReasonLabel kullanılır. */
  arrivalReason: string | null
```

- [ ] **Step 2: Sayfa eşlemesine ekle**

`src/app/(app)/orders/[id]/page.tsx` içinde `safeOrder`'daki `notes: order.notes,`
satırının altına:

```ts
    invoiceNo: order.invoiceNo,
    invoiceDate: order.invoiceDate ? order.invoiceDate.toISOString() : null,
    arrivalReason: order.arrivalReason,
```

- [ ] **Step 3: Kartı iki kolona böl**

`order-info-card.tsx` içindeki `OrderInfoCard`'ın `CardContent` gövdesini değiştir.
Sol kolon içeriği aynen korunur, sağ kolon yeni:

```tsx
      <CardContent className="text-sm">
        <div className="grid grid-cols-1 gap-y-2.5 md:grid-cols-2 md:gap-x-8">
          {/* SOL: mevcut iş emri kimliği ve atama bilgileri */}
          <div className="space-y-2.5">
            <InfoRow label="İş No" value={order.workOrderNo} mono />
            <InfoRow label="Oluşturulma" value={formatDateTime(order.createdAt)} icon={Calendar} />
            <InfoRow
              label="Tahmini Teslim"
              value={order.estimatedDeliveryAt ? formatDateTime(order.estimatedDeliveryAt) : "—"}
              icon={Calendar}
            />
            {order.completedAt && (
              <InfoRow label="Tamamlanma" value={formatDateTime(order.completedAt)} icon={Calendar} />
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Atanan Usta</span>
              {/* Atama tek bir yerden yürür (technician-assign); burada yalnız tetikleyici durur. */}
              <TechnicianAssign
                orderId={order.id}
                assignedTechnicianId={order.assignedTechnicianId}
                assignedTechnicianName={order.assignedTechnicianName}
                technicians={technicians ?? []}
                locked={locked}
              />
            </div>
            {order.technicianName && order.technicianName !== order.assignedTechnicianName && (
              <InfoRow label="Teknisyen (eski)" value={order.technicianName} />
            )}
            {order.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Notlar</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1.5">Ödeme</p>
              <PaymentBadge status={order.paymentStatus} size="md" />
            </div>
          </div>

          {/* SAĞ: fatura, tutar, durum, geliş nedeni.
              Mobilde dikey çizgi yerine üst kenarlık — kolonlar alt alta düşüyor. */}
          <div className="space-y-2.5 border-t pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <InfoRow label="Fatura Numarası" value={order.invoiceNo || "—"} mono />
            <InfoRow
              label="Fatura Tarihi"
              value={order.invoiceDate ? formatDate(order.invoiceDate) : "—"}
              icon={Calendar}
            />
            <InfoRow
              label="Toplam Tutar"
              value={order.totals.hasAnyPrice ? formatTRY(order.totals.grandTotal) : "—"}
            />
            <InfoRow label="Durum" value={ORDER_STATUS[order.status as OrderStatusKey]?.label ?? order.status} />
            <InfoRow label="Servise Geliş Nedeni" value={arrivalReasonLabel(order.arrivalReason)} />
          </div>
        </div>
      </CardContent>
```

Yeni importları dosyanın üstüne ekle:

```tsx
import { formatDate, formatDateTime } from "@/lib/utils-client"
import { formatTRY } from "@/lib/format"
import { ORDER_STATUS, arrivalReasonLabel, type OrderStatusKey } from "@/lib/constants"
```

(`formatDateTime` importunu tekrar yazma — mevcut satırı yukarıdaki gibi genişlet.)

- [ ] **Step 4: Doğrula**

Çalıştır: `bun run typecheck && bun run lint`
Beklenen: hatasız.

- [ ] **Step 5: Tarayıcıda gör**

Çalıştır: `bun run dev` (AWS dev DB tüneli açık olmalı: ayrı terminalde `bun run db:tunnel`)
Bir iş emri detayına git (`/orders/<id>`), Özet sekmesi.
Beklenen: kart masaüstünde iki kolon, sağ kolonda beş satır; fatura alanları `—`,
Toplam Tutar kalem toplamıyla aynı, Durum rozetteki etiketle aynı.
Tarayıcıyı 375px genişliğe daralt: kolonlar alt alta, sağ kolonun üstünde ince ayraç.

- [ ] **Step 6: Commit**

```bash
git add src/components/orders/order-info-card.tsx src/components/orders/order-management-panel.tsx "src/app/(app)/orders/[id]/page.tsx"
git commit -m "feat(orders): İş Emri Bilgileri kartı iki kolona bölündü"
```

---

### Task 8: Fatura düzenleme formu

**Files:**
- Modify: `src/components/orders/order-info-card.tsx`

**Interfaces:**
- Consumes: `POST /api/orders/[id]/invoice` (Task 5), `DatePicker` (`@/components/ui/date-picker`)
- Produces: kart içi yerel durum — dışarıya yeni prop çıkmaz.

- [ ] **Step 1: Durum ve kaydetme mantığını ekle**

`OrderInfoCard` gövdesinin başına (`const locked = ...` satırının altına):

```tsx
  const router = useRouter()
  const [editingInvoice, setEditingInvoice] = useState(false)
  const [savingInvoice, setSavingInvoice] = useState(false)
  // DatePicker GG.AA.YYYY string ile çalışır; formatDate tam bu biçimi üretir.
  const [invoiceNoDraft, setInvoiceNoDraft] = useState(order.invoiceNo ?? "")
  const [invoiceDateDraft, setInvoiceDateDraft] = useState(
    order.invoiceDate ? formatDate(order.invoiceDate) : "",
  )

  // Fatura araç teslim edildikten SONRA kesilir; bu yüzden teslim kilidinden muaf.
  // İptal edilmiş emirde ise iş hiç yapılmadı — orada kapalı (sunucu da reddeder).
  const invoiceEditable = order.status !== "cancelled"

  function startEditInvoice() {
    setInvoiceNoDraft(order.invoiceNo ?? "")
    setInvoiceDateDraft(order.invoiceDate ? formatDate(order.invoiceDate) : "")
    setEditingInvoice(true)
  }

  async function saveInvoice() {
    setSavingInvoice(true)
    try {
      const formData = new FormData()
      formData.set("invoiceNo", invoiceNoDraft)
      formData.set("invoiceDate", invoiceDateDraft)
      const res = await fetch(`/api/orders/${order.id}/invoice`, { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setEditingInvoice(false)
        router.refresh()
      } else {
        toast.error(data.error || "Fatura bilgisi kaydedilemedi")
      }
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setSavingInvoice(false)
    }
  }
```

Yeni importlar:

```tsx
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Loader2, Pencil } from "lucide-react"
```

(`Loader2`/`Pencil`'ı mevcut lucide-react import bloğuna ekle.)

- [ ] **Step 2: Sağ kolonun fatura bölümünü formla değiştir**

Task 7'de yazdığın sağ kolondaki iki `InfoRow` (`Fatura Numarası`, `Fatura Tarihi`)
yerine:

```tsx
            {editingInvoice ? (
              <div className="space-y-2.5">
                <div>
                  <Label htmlFor="invoice-no">Fatura Numarası</Label>
                  <Input
                    id="invoice-no"
                    value={invoiceNoDraft}
                    onChange={(e) => setInvoiceNoDraft(e.target.value)}
                    placeholder="Örn. ABC2026000000123"
                    maxLength={50}
                  />
                </div>
                <div>
                  <Label htmlFor="invoice-date">Fatura Tarihi</Label>
                  <DatePicker
                    id="invoice-date"
                    value={invoiceDateDraft}
                    onChange={setInvoiceDateDraft}
                    placeholder="Tarih seçin"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={saveInvoice} disabled={savingInvoice} size="sm" className="flex-1">
                    {savingInvoice ? <Loader2 className="size-3.5 animate-spin" /> : "Kaydet"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingInvoice(false)} disabled={savingInvoice} size="sm">
                    İptal
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fatura entegrasyonu yok — bilgileri kendi fatura uygulamanızdan girin.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Fatura Numarası</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-foreground">{order.invoiceNo || "—"}</span>
                    {invoiceEditable && (
                      <button
                        onClick={startEditInvoice}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:bg-primary/5 px-1.5 py-0.5 rounded-lg touch-manipulation"
                      >
                        <Pencil className="size-3" /> Düzenle
                      </button>
                    )}
                  </span>
                </div>
                <InfoRow
                  label="Fatura Tarihi"
                  value={order.invoiceDate ? formatDate(order.invoiceDate) : "—"}
                  icon={Calendar}
                />
              </>
            )}
```

- [ ] **Step 3: Doğrula**

Çalıştır: `bun run typecheck && bun run lint`
Beklenen: hatasız.

- [ ] **Step 4: Elle test et**

`bun run dev` ile bir iş emri detayında:
1. "Düzenle" → fatura no yaz, tarih seç, Kaydet → değerler kartta görünüyor.
2. Sayfayı yenile → değerler duruyor.
3. Tekrar Düzenle → fatura no'yu boşalt, Kaydet → `—` görünüyor.
4. Teslim edilmiş bir iş emrinde Düzenle bağlantısı GÖRÜNÜYOR ve çalışıyor.
5. İptal edilmiş bir iş emrinde Düzenle bağlantısı YOK.

- [ ] **Step 5: Commit**

```bash
git add src/components/orders/order-info-card.tsx
git commit -m "feat(orders): fatura numarası ve tarihi elle girilebilir"
```

---

### Task 9: Durum ve geliş nedeni dropdown'ları

**Files:**
- Modify: `src/components/orders/order-info-card.tsx`
- Modify: `src/components/orders/work-order-detail.tsx` (`<OrderInfoCard ... />` çağrısı, ~satır 676)

**Interfaces:**
- Consumes: `orderStatusOptions` (Task 3), `POST /api/orders/[id]/status` (mevcut),
  `POST /api/orders/[id]/arrival-reason` (Task 5)
- Produces: `OrderInfoCard` props'una iki yeni alan eklenir:
  - `onRequestDelivery?: () => void` — "Teslim Edildi" seçilince çağrılır (OTP akışı)
  - `deliveryBlocked?: boolean` — fiyatsız kalem varsa teslim seçeneği pasif

- [ ] **Step 1: Props'u genişlet ve dropdown mantığını ekle**

`OrderInfoCard` imzası:

```tsx
export function OrderInfoCard({
  order,
  technicians,
  onRequestDelivery,
  deliveryBlocked,
}: {
  order: OrderDetailData
  technicians?: AssignableTechnician[]
  onRequestDelivery?: () => void
  deliveryBlocked?: boolean
}) {
```

Gövdeye (fatura state'lerinin altına):

```tsx
  const [changingStatus, setChangingStatus] = useState(false)
  const [changingReason, setChangingReason] = useState(false)
  const statusOptions = orderStatusOptions(order.status as OrderStatus)

  async function handleStatusSelect(next: string) {
    if (!next || next === order.status) return
    // Teslim müşteri onaylı (OTP) verilir — dropdown'dan doğrudan yazılmaz.
    if (next === "delivered") {
      onRequestDelivery?.()
      return
    }
    setChangingStatus(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (data.success) router.refresh()
      else toast.error(data.error || "Durum güncellenemedi")
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setChangingStatus(false)
    }
  }

  async function handleReasonSelect(next: string) {
    setChangingReason(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/arrival-reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: next }),
      })
      const data = await res.json()
      if (data.success) router.refresh()
      else toast.error(data.error || "Geliş nedeni güncellenemedi")
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setChangingReason(false)
    }
  }
```

Importlar — birincisi yeni satır, diğer ikisi MEVCUT satırların genişletilmesidir
(çift import yazma):

```tsx
// yeni satır
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// mevcut satırı genişlet (orderStatusOptions eklendi)
import { isOrderLocked, orderStatusOptions } from "@/lib/status-transitions"
// mevcut satırı genişlet (ARRIVAL_REASON_ORDER + ARRIVAL_REASONS eklendi)
import { ORDER_STATUS, ARRIVAL_REASON_ORDER, ARRIVAL_REASONS, arrivalReasonLabel, type OrderStatusKey } from "@/lib/constants"
```

- [ ] **Step 2: Durum `InfoRow`'unu dropdown'la değiştir**

Task 7'deki `<InfoRow label="Durum" ... />` yerine:

```tsx
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Durum</span>
              {/* Durum makinesi tek kaynak: liste orderStatusOptions'tan gelir,
                  sunucu da aynı geçiş kuralını uygular. Silme seçeneği yoktur —
                  terminal aksiyon "İptal". */}
              <Select
                value={order.status}
                onValueChange={(v) => handleStatusSelect(v ?? "")}
                disabled={changingStatus || statusOptions.length <= 1}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue>
                    {(value: string | null) =>
                      value ? (ORDER_STATUS[value as OrderStatusKey]?.label ?? value) : null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s} disabled={s === "delivered" && deliveryBlocked}>
                      {ORDER_STATUS[s as OrderStatusKey]?.label ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
```

- [ ] **Step 3: Geliş nedeni `InfoRow`'unu dropdown'la değiştir**

Task 7'deki `<InfoRow label="Servise Geliş Nedeni" ... />` yerine:

```tsx
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Servise Geliş Nedeni</span>
              {locked ? (
                <span className="text-sm text-foreground">{arrivalReasonLabel(order.arrivalReason)}</span>
              ) : (
                <Select
                  value={order.arrivalReason ?? ""}
                  onValueChange={(v) => handleReasonSelect(v ?? "")}
                  disabled={changingReason}
                >
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Seçiniz">
                      {(value: string | null) => (value ? arrivalReasonLabel(value) : null)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Belirtilmedi</SelectItem>
                    {ARRIVAL_REASON_ORDER.map((r) => (
                      <SelectItem key={r} value={r}>{ARRIVAL_REASONS[r].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
```

- [ ] **Step 4: Çağrı yerini güncelle**

`work-order-detail.tsx` (~satır 676):

```tsx
          {/* İş Emri Bilgileri */}
          <OrderInfoCard
            order={order}
            technicians={technicians}
            onRequestDelivery={handleRequestDeliveryOtp}
            deliveryBlocked={deliveryBlocked}
          />
```

- [ ] **Step 5: Doğrula**

Çalıştır: `bun run typecheck && bun run lint && bun test`
Beklenen: hepsi hatasız/geçer.

- [ ] **Step 6: Elle test et**

1. `in_progress` bir iş emri: Durum dropdown'ında yalnız Devam Ediyor, Parça Bekliyor,
   Teslime Hazır, İptal var. "Sil" hiçbir yerde yok.
2. "Parça Bekliyor" seç → durum rozeti başlıkta da değişiyor.
3. `ready_for_delivery` bir iş emri: "Teslim Edildi" seç → durum DEĞİŞMİYOR, OTP paneli açılıyor.
4. Fiyatsız kalemi olan `ready_for_delivery` emir: "Teslim Edildi" seçeneği pasif.
5. Geliş nedeni seç → kart anında güncelleniyor; "Belirtilmedi" seç → `—` oluyor.
6. Teslim edilmiş emirde: Durum dropdown'ı pasif, geliş nedeni düz metin.

- [ ] **Step 7: Commit**

```bash
git add src/components/orders/order-info-card.tsx src/components/orders/work-order-detail.tsx
git commit -m "feat(orders): durum ve geliş nedeni kart içinden seçilebilir"
```

---

### Task 10: Yeni İş Emri sihirbazında geliş nedeni

**Files:**
- Modify: `src/lib/orders/create-service-order.ts`
- Modify: `src/lib/validations/intake.ts` (`intakeCreateSchema`, ~satır 36–49)
- Modify: `src/app/(app)/intakes/actions.ts` (`createIntakeAction`, ~satır 14–70)
- Modify: `src/components/intake/intake-wizard.tsx` (Adım 3 formu ~satır 349; `handleCreateIntake` ~satır 199)

**Interfaces:**
- Consumes: `isArrivalReason` / `ARRIVAL_REASON_ORDER` (Task 1), `arrivalReason` kolonu (Task 2)
- Produces: `createServiceOrderForIntake(tx, workshopId, intakeFormId, arrivalReason?)` —
  dördüncü parametre opsiyonel; verilmezse davranış eskisiyle birebir aynı
  (randevu/teklif dönüşümündeki çağrılar değişmez).

- [ ] **Step 1: Yardımcıya opsiyonel parametre ekle**

`src/lib/orders/create-service-order.ts`:

```ts
export async function createServiceOrderForIntake(
  tx: Prisma.TransactionClient,
  workshopId: string,
  intakeFormId: string,
  // Kabul sihirbazında seçilebilen servise geliş nedeni. Randevu/teklif
  // dönüşümünde toplanmadığı için opsiyonel.
  arrivalReason?: ArrivalReason | null,
): Promise<{ id: string; workOrderNo: string }> {
```

`create` çağrısını güncelle:

```ts
  const order = await tx.serviceOrder.create({
    data: { workshopId, intakeFormId, workOrderNo, status: "draft", arrivalReason: arrivalReason ?? null },
  })
```

Import satırını genişlet:

```ts
import type { Prisma, ArrivalReason } from "@prisma/client"
```

- [ ] **Step 2: İKİ şemaya birden alanı ekle**

`src/lib/validations/intake.ts` içinde **iki ayrı şema** var; ikisine de eklenmeli.

İlki `intakeSchema` (istemci form şeması, ~satır 4–33). `internalNote` satırının altına,
"Step 3: Intake details" bloğunun sonuna:

```ts
  arrivalReason: z.string().optional().default(""),
```

İkincisi `intakeCreateSchema` (sunucu şeması, ~satır 36–49). `internalNote` satırının altına:

```ts
  // Servise geliş nedeni opsiyoneldir — sahada akışı tıkamasın. Boş string
  // "seçilmedi" demektir; asıl doğrulama server action'da isArrivalReason ile yapılır.
  arrivalReason: z.string().optional(),
```

`IntakeFormValues` tipi `intakeSchema`'dan türediği için sihirbaz tarafında ek tip işi gerekmez.

- [ ] **Step 3: Kabul aksiyonunu güncelle**

`src/app/(app)/intakes/actions.ts`:

`raw` nesnesine ekle:

```ts
    arrivalReason: formData.get("arrivalReason") as string,
```

`prisma.$transaction` bloğundan ÖNCE, doğrulama:

```ts
  // Tanınmayan neden sessizce yutulmaz; şema serbest string kabul ettiği için
  // asıl kontrol burada.
  const rawReason = parsed.data.arrivalReason ?? ""
  let arrivalReason: ArrivalReasonKey | null = null
  if (rawReason !== "") {
    if (!isArrivalReason(rawReason)) return { error: "Geçersiz geliş nedeni" }
    arrivalReason = rawReason
  }
```

`createServiceOrderForIntake` çağrısını güncelle:

```ts
    const order = await createServiceOrderForIntake(tx, user.workshopId, intake.id, arrivalReason)
```

Import ekle:

```ts
import { isArrivalReason, type ArrivalReasonKey } from "@/lib/constants"
```

- [ ] **Step 4: Sihirbaz formuna alanı ekle**

`src/components/intake/intake-wizard.tsx`:

`form` varsayılan değerlerine (~satır 97, `customerComplaint: ""` yanına):

```ts
      arrivalReason: "",
```

Adım 3'te `customerComplaint` FormField'ının hemen ALTINA:

```tsx
                <FormField
                  control={form.control}
                  name="arrivalReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Servise Geliş Nedeni</FormLabel>
                      <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v ?? "")}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seçiniz (opsiyonel)">
                            {(value: string | null) => (value ? arrivalReasonLabel(value) : null)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Belirtilmedi</SelectItem>
                          {ARRIVAL_REASON_ORDER.map((r) => (
                            <SelectItem key={r} value={r}>{ARRIVAL_REASONS[r].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
```

`handleCreateIntake` içindeki `formData` bloğuna (~satır 205):

```ts
      formData.set("arrivalReason", values.arrivalReason)
```

Gereken importlar (dosyada yoksa ekle):

```ts
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ARRIVAL_REASON_ORDER, ARRIVAL_REASONS, arrivalReasonLabel } from "@/lib/constants"
```

`FormField`/`FormItem`/`FormLabel` dosyada zaten import ediliyor (satır 11 civarındaki
çok satırlı `@/components/ui/form` bloğu) — tekrar ekleme.

- [ ] **Step 5: Doğrula**

Çalıştır: `bun run typecheck && bun run lint && bun test`
Beklenen: hepsi hatasız/geçer.

- [ ] **Step 6: Elle test et**

1. Yeni İş Emri → Adım 3'te neden seçmeden ilerle → kabul oluşuyor, kartta `—`.
2. Yeni İş Emri → "Bakım" seç, ilerle → iş emri kartında "Bakım" görünüyor.

- [ ] **Step 7: Commit**

```bash
git add src/lib/orders/create-service-order.ts src/lib/validations/intake.ts "src/app/(app)/intakes/actions.ts" src/components/intake/intake-wizard.tsx
git commit -m "feat(intake): yeni iş emri sihirbazında servise geliş nedeni"
```

---

### Task 11: Sızıntı kontrolü ve son doğrulama

Yeni alanların müşteriye açık çıktılara sızmadığını kanıtla ve tam doğrulama zincirini çalıştır.

**Files:**
- Test: `src/lib/intake/data-safety.test.ts` (varsa; yoksa yalnız grep kontrolü)
- Modify: gerek çıkarsa ilgili dosya

**Interfaces:**
- Consumes: tüm önceki task'lar
- Produces: yeşil `bun test` + `lint` + `typecheck` + `build`

- [ ] **Step 1: Public çıktıda sızıntı olmadığını doğrula**

Çalıştır:
```bash
rg -n "invoiceNo|invoiceDate|arrivalReason" src/lib/intake/data-safety.ts src/components/intake/public-share-page.tsx src/components/vehicles/public-vehicle-passport.tsx src/lib/share
```
Beklenen: **hiç sonuç yok**. Sonuç çıkarsa alanı oradan kaldır — bu üç alan v1'de dahilidir.

- [ ] **Step 2: Timeline'a yeni olay eklenmediğini doğrula**

Çalıştır: `git diff dev --stat -- src/lib/intake/timeline.ts`
Beklenen: çıktı boş (dosya hiç değişmemiş). Bu proje kuralı: `addTimelineEvent`'e eklenen
her yeni olay türü varsayılan olarak müşteri PDF'inde görünür.

- [ ] **Step 3: Tam test paketi**

Çalıştır: `bun test`
Beklenen: tüm testler PASS.

- [ ] **Step 4: Lint ve tip kontrolü**

Çalıştır: `bun run lint && bun run typecheck`
Beklenen: hatasız.

- [ ] **Step 5: Üretim derlemesi**

Şema değişikliği içeren bir iş; build önemli.

Çalıştır: `bun run build`
Beklenen: başarılı derleme.

- [ ] **Step 6: AWS dev veritabanına migration'ı uygula**

Ayrı terminalde tüneli aç: `bun run db:tunnel` (açık kalsın)
Sonra: `bun run db:deploy`
Beklenen: yeni migration "applied" olarak listelenir.

- [ ] **Step 7: Commit (değişiklik çıktıysa)**

```bash
git add -A
git commit -m "chore(orders): fatura/geliş nedeni alanları için son doğrulama"
```

Değişiklik yoksa commit atlanır.

---

## Bitirme

Tüm task'lar bitince `superpowers:finishing-a-development-branch` skill'i ile PR'a geçilir.
PR gövdesinde şunlar yer almalı:

- Migration'ın eklemeli olduğu ve prod deploy'un otomatik `migrate deploy` çalıştırdığı
- Fatura alanlarının teslim kilidinden bilinçli muaf tutulduğu
- Manuel QA listesi (tasarım dokümanı §7)
