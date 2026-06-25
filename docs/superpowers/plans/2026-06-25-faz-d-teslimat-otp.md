# Faz D — Teslimat (Delivery) + OTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ready_for_delivery → delivered` geçişini müşteri OTP'siyle kapıya bağlamak: personel "Teslim Et (OTP)" → kod müşteriye gerçek SMS → personel girer → doğrulanınca intake **ve** order `delivered`.

**Architecture:** Intake'in `approved` emsalini birebir kur — `canTransitionIntake` `delivered`'a manuel geçişi reddeder; `delivered`'a yalnız yeni `verifyDeliveryOtpAction` doğrudan Prisma update ile ulaşır. OTP, mevcut `ApprovalRequest` (`approvalType="vehicle_delivery"`) + `sendSMSDirect` + in-memory rate-limit ile; expiry `createdAt + 10dk`'dan türetilir. Sıfır migration.

**Tech Stack:** Next.js (App Router server actions + route handlers), TypeScript strict, Prisma (mevcut model), mevcut communications (`sendSMSDirect`) + `rate-limit` util, `bun test`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-25-faz-d-teslimat-otp-design.md` (D1–D5 bağlayıcı).
- **Sıfır Prisma migrasyonu.** Yeni model/alan YOK; mevcut `ApprovalRequest` (`approvalType="vehicle_delivery"`).
- **Gate (D2):** `canTransitionIntake` `to==="delivered"`'ı manuel reddeder; `delivered`'a yalnız `verifyDeliveryOtpAction` (doğrudan `updateMany`) ulaşır.
- **OTP gönderimi (D3):** `sendSMSDirect(phone, "...<OTP>...")`. Demo (`NODE_ENV!=="production"` veya `SMS_PROVIDER` mock) ise `otpCode` yanıtla döner (personel ekranda görür).
- **Sertleştirme (D4):** expiry = `createdAt + 10*60*1000` (`isOtpExpired`); gönderim+doğrulama denemesi `checkRateLimit`/`recordAttempt` (in-memory). OTP düz metin (mevcut desen).
- **D5:** doğrulanınca intake `delivered` (doğrudan update) + order `delivered` (`updateOrderStatusAction` ile, yan etkiler tetiklensin). Ödeme borcu = UI uyarısı (engellemez).
- TypeScript strict; `any` yok. Türkçe UI/mesaj. `requireAuth()` + workshop-scoped her aksiyon/sorgu. `bun install`/`add`/`update` YOK; package.json/lockfile/.env*/patches DOKUNMA.

---

### Task 1: `isOtpExpired` saf yardımcı (TDD)

**Files:**
- Create: `src/lib/intake/otp.ts`
- Test: `src/lib/intake/otp.test.ts`

**Interfaces:**
- Produces: `isOtpExpired(createdAt: Date, now: Date, ttlMs: number): boolean` — `now - createdAt > ttlMs`. Eşit ve negatif farkta `false` (süre dolmamış).

- [ ] **Step 1: Failing test yaz**

`src/lib/intake/otp.test.ts`:

```ts
import { test, expect } from "bun:test"
import { isOtpExpired } from "./otp"

const TTL = 10 * 60 * 1000

test("TTL içinde → dolmamış", () => {
  const created = new Date("2026-06-25T10:00:00Z")
  const now = new Date("2026-06-25T10:05:00Z") // 5 dk
  expect(isOtpExpired(created, now, TTL)).toBe(false)
})

test("TTL aşıldı → dolmuş", () => {
  const created = new Date("2026-06-25T10:00:00Z")
  const now = new Date("2026-06-25T10:11:00Z") // 11 dk
  expect(isOtpExpired(created, now, TTL)).toBe(true)
})

test("tam sınır (10dk) → dolmamış", () => {
  const created = new Date("2026-06-25T10:00:00Z")
  const now = new Date("2026-06-25T10:10:00Z")
  expect(isOtpExpired(created, now, TTL)).toBe(false)
})
```

- [ ] **Step 2: Testi çalıştır, FAIL gör**

Run: `bun test src/lib/intake/otp.test.ts`
Expected: FAIL ("Cannot find module './otp'").

- [ ] **Step 3: Minimal implementasyon**

`src/lib/intake/otp.ts`:

```ts
/** OTP süresi dolmuş mu: now - createdAt > ttlMs. Eşitte/negatifte dolmamış. */
export function isOtpExpired(createdAt: Date, now: Date, ttlMs: number): boolean {
  return now.getTime() - createdAt.getTime() > ttlMs
}
```

- [ ] **Step 4: Testi çalıştır, PASS gör**

Run: `bun test src/lib/intake/otp.test.ts`
Expected: PASS (3 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/intake/otp.ts src/lib/intake/otp.test.ts
git commit -m "feat: add isOtpExpired helper (Faz D)"
```

---

### Task 2: `canTransitionIntake` — `delivered` manuel reddi (TDD)

**Files:**
- Modify: `src/lib/status-transitions.ts` (sadece `canTransitionIntake` gövdesi)
- Test: `src/lib/status-transitions.test.ts` (yoksa oluştur, varsa ekle)

**Interfaces:**
- Consumes/Produces: `canTransitionIntake(from: IntakeStatus, to: IntakeStatus): boolean` — artık `to==="approved"` VE `to==="delivered"` için `false` (her ikisi yalnız OTP doğrulama aksiyonlarıyla set edilir).

Mevcut gövde (referans):
```ts
export function canTransitionIntake(from: IntakeStatus, to: IntakeStatus): boolean {
  if (to === "approved") return false
  if (from === to) return true
  return INTAKE_TRANSITIONS[from]?.includes(to) ?? false
}
```

- [ ] **Step 1: Failing test yaz/ekle**

`src/lib/status-transitions.test.ts` (yoksa bu içerikle oluştur; varsa bu test'leri ekle):

```ts
import { test, expect } from "bun:test"
import { canTransitionIntake } from "./status-transitions"

test("delivered'a manuel geçiş reddedilir (yalnız OTP ile)", () => {
  expect(canTransitionIntake("ready_for_delivery", "delivered")).toBe(false)
})

test("approved'a manuel geçiş reddedilir (mevcut davranış korunur)", () => {
  expect(canTransitionIntake("waiting_approval", "approved")).toBe(false)
})

test("izinli geçiş hâlâ çalışır (in_progress → ready_for_delivery)", () => {
  expect(canTransitionIntake("in_progress", "ready_for_delivery")).toBe(true)
})
```

- [ ] **Step 2: Testi çalıştır, FAIL gör**

Run: `bun test src/lib/status-transitions.test.ts`
Expected: "delivered'a manuel geçiş reddedilir" FAIL (şu an `true` dönüyor); diğer ikisi PASS.

- [ ] **Step 3: `canTransitionIntake`'i güncelle**

`src/lib/status-transitions.ts` — `canTransitionIntake` gövdesinde `approved` reddinin hemen ardına `delivered` reddini ekle:

```ts
export function canTransitionIntake(from: IntakeStatus, to: IntakeStatus): boolean {
  // approved + delivered yalnızca müşteri OTP doğrulamasıyla set edilir (generic/manuel geçiş yasak)
  if (to === "approved") return false
  if (to === "delivered") return false
  if (from === to) return true
  return INTAKE_TRANSITIONS[from]?.includes(to) ?? false
}
```

> Not: `canTransitionOrder`'a DOKUNMA — order'ın `ready_for_delivery → delivered` geçişi (Task 3'te `updateOrderStatusAction` ile çağrılacak) açık kalmalı.

- [ ] **Step 4: Testi çalıştır, PASS gör**

Run: `bun test src/lib/status-transitions.test.ts`
Expected: 3 test PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/status-transitions.ts src/lib/status-transitions.test.ts
git commit -m "feat: gate intake delivered behind OTP (block manual transition) (Faz D)"
```

---

### Task 3: `delivery-actions.ts` (request + verify)

**Files:**
- Create: `src/app/(app)/intakes/delivery-actions.ts`

**Interfaces:**
- Consumes: `isOtpExpired` (Task 1); `checkRateLimit`/`recordAttempt` (`@/lib/communications/rate-limit`); `sendSMSDirect` (`@/lib/communications/sender`); `updateOrderStatusAction` (`@/app/(app)/orders/actions`); `prisma`, `requireAuth`, `AuditLogAction`, `addTimelineEvent`.
- Produces:
  - `requestDeliveryOtpAction(intakeFormId: string): Promise<{ success: true; otpCode?: string } | { error: string }>`
  - `verifyDeliveryOtpAction(intakeFormId: string, code: string): Promise<{ success: true } | { error: string }>`

- [ ] **Step 1: Dosyayı oluştur (tam içerik)**

`src/app/(app)/intakes/delivery-actions.ts`:

```ts
"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { AuditLogAction } from "@/lib/audit"
import { addTimelineEvent } from "@/lib/intake/timeline"
import { isOtpExpired } from "@/lib/intake/otp"
import { checkRateLimit, recordAttempt } from "@/lib/communications/rate-limit"
import { sendSMSDirect } from "@/lib/communications/sender"
import { updateOrderStatusAction } from "@/app/(app)/orders/actions"

const OTP_TTL_MS = 10 * 60 * 1000
const DELIVERY_TYPE = "vehicle_delivery"

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function isDemoSms(): boolean {
  return process.env.NODE_ENV !== "production" || (process.env.SMS_PROVIDER ?? "mock") === "mock"
}

export async function requestDeliveryOtpAction(intakeFormId: string) {
  const user = await requireAuth()

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
    include: { customer: true, vehicle: true },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
  if (intake.status !== "ready_for_delivery") return { error: "Araç teslimata hazır değil" }

  const sendKey = `delivery-otp-send:${intakeFormId}`
  if (!checkRateLimit(sendKey).allowed) return { error: "Çok sık kod istendi, lütfen biraz sonra tekrar deneyin" }
  recordAttempt(sendKey)

  const otpCode = generateOtp()
  const customerName =
    intake.customer.type === "corporate"
      ? intake.customer.companyName || "Kurumsal Müşteri"
      : intake.customer.fullName || `${intake.customer.firstName ?? ""} ${intake.customer.lastName ?? ""}`.trim() || "Müşteri"
  const approvalTextVersion = `Araç Teslim Onayı\n\nMüşteri: ${customerName}\nPlaka: ${intake.vehicle.plate}\n\nAracımı teslim aldım.`

  const approval = await prisma.approvalRequest.create({
    data: {
      workshopId: user.workshopId,
      intakeFormId,
      phone: intake.customer.phone,
      otpCode,
      approvalTextVersion,
      approvalType: DELIVERY_TYPE,
      status: "pending",
    },
  })

  let smsSent = false
  try {
    await sendSMSDirect(intake.customer.phone, `BakimX teslim onay kodunuz: ${otpCode}. Aracınızın teslimini onaylamak için bu kodu servise iletin.`)
    smsSent = true
  } catch (e) {
    console.error("[requestDeliveryOtp] SMS gönderilemedi:", e)
  }
  if (!smsSent && !isDemoSms()) {
    return { error: "Onay SMS'i gönderilemedi, lütfen tekrar deneyin" }
  }

  await AuditLogAction(user.workshopId, user.id, "ApprovalRequest", approval.id, "delivery_otp_requested")
  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId,
    eventType: "delivery_otp_requested",
    description: "Teslim onay kodu gönderildi",
  })

  revalidatePath(`/intakes/${intakeFormId}`)
  return { success: true as const, otpCode: isDemoSms() ? otpCode : undefined }
}

export async function verifyDeliveryOtpAction(intakeFormId: string, code: string) {
  const user = await requireAuth()

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
  if (intake.status !== "ready_for_delivery") return { error: "Araç teslimata hazır değil" }

  const verifyKey = `delivery-otp-verify:${intakeFormId}`
  if (!checkRateLimit(verifyKey).allowed) return { error: "Çok fazla deneme, lütfen biraz sonra tekrar deneyin" }
  recordAttempt(verifyKey)

  const approval = await prisma.approvalRequest.findFirst({
    where: { intakeFormId, workshopId: user.workshopId, approvalType: DELIVERY_TYPE, status: "pending" },
    orderBy: { createdAt: "desc" },
  })
  if (!approval) return { error: "Bekleyen teslim onayı bulunamadı, yeni kod isteyin" }

  if (isOtpExpired(approval.createdAt, new Date(), OTP_TTL_MS)) {
    await prisma.approvalRequest.updateMany({
      where: { id: approval.id, workshopId: user.workshopId },
      data: { status: "expired" },
    })
    return { error: "Kodun süresi doldu, lütfen yeni kod isteyin" }
  }

  if (approval.otpCode !== code) return { error: "Geçersiz doğrulama kodu" }

  await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.updateMany({
      where: { id: approval.id, workshopId: user.workshopId },
      data: { status: "verified", approvedAt: new Date() },
    })
    await tx.vehicleIntakeForm.updateMany({
      where: { id: intakeFormId, workshopId: user.workshopId },
      data: { status: "delivered" },
    })
  })

  // Order'ı da delivered yap (yan etkiler: tamamlama/ödeme-hatırlatma). Order yoksa/uygun değilse sessiz geç.
  const order = await prisma.serviceOrder.findFirst({
    where: { intakeFormId, workshopId: user.workshopId },
  })
  if (order && order.status === "ready_for_delivery") {
    await updateOrderStatusAction(order.id, "delivered")
  }

  await AuditLogAction(user.workshopId, user.id, "ApprovalRequest", approval.id, "delivery_otp_verified")
  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId,
    eventType: "delivered_otp_verified",
    description: "Müşteri OTP ile aracı teslim aldı",
  })

  revalidatePath(`/intakes/${intakeFormId}`)
  return { success: true as const }
}
```

- [ ] **Step 2: typecheck + lint**

Run: `bun run typecheck && bun run lint`
Expected: typecheck 0; lint yeni hata yok. (Not: `updateOrderStatusAction` imzası `(orderId, status)`; `sendSMSDirect(to, message)`.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/intakes/delivery-actions.ts"
git commit -m "feat: add delivery OTP request/verify server actions (Faz D)"
```

---

### Task 4: API route'ları (delivery-otp + verify)

**Files:**
- Create: `src/app/api/intakes/[id]/delivery-otp/route.ts`
- Create: `src/app/api/intakes/[id]/delivery-otp/verify/route.ts`

**Interfaces:**
- Consumes: `requestDeliveryOtpAction`, `verifyDeliveryOtpAction` (Task 3).
- Produces: `POST /api/intakes/[id]/delivery-otp` → `{ success, otpCode? } | { error }`; `POST /api/intakes/[id]/delivery-otp/verify` (body `{ code }`) → `{ success } | { error }`.

- [ ] **Step 1: Request route'unu oluştur**

`src/app/api/intakes/[id]/delivery-otp/route.ts`:

```ts
import { NextResponse } from "next/server"
import { requestDeliveryOtpAction } from "@/app/(app)/intakes/delivery-actions"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await requestDeliveryOtpAction(id)
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify route'unu oluştur**

`src/app/api/intakes/[id]/delivery-otp/verify/route.ts`:

```ts
import { NextResponse } from "next/server"
import { verifyDeliveryOtpAction } from "@/app/(app)/intakes/delivery-actions"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = (await request.json()) as { code?: string }
    const result = await verifyDeliveryOtpAction(id, (body.code ?? "").trim())
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
```

- [ ] **Step 3: typecheck + build**

Run: `bun run typecheck && bun run build`
Expected: typecheck 0; build exit 0 (yeni route'lar derlenir).

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/intakes/[id]/delivery-otp"
git commit -m "feat: add delivery OTP request/verify API routes (Faz D)"
```

---

### Task 5: Teslim OTP UI (`intake-detail.tsx`)

**Files:**
- Modify: `src/components/app/intake-detail.tsx`

**Interfaces:**
- Consumes: `POST /api/intakes/[id]/delivery-otp` + `.../verify` (Task 4). Mevcut: `intake.id`, `intake.order?.paymentStatus`, `router`, `loading`/`setLoading`, `error`/`setError`, `Input`, `Button`, `Loader2`.

- [ ] **Step 1: Order prop tipini genişlet + teslim OTP state ekle**

**(a)** `IntakeDetailProps` içindeki `order` alanı tipine `paymentStatus: string` ekle. Runtime'da `getIntakeAction` order'ı tam `include` ile getiriyor (paymentStatus mevcut); yalnız prop TİPİ eksik. Mevcut (≈satır 88):
```tsx
  order: { id: string; status: string; items: { id: string; type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null; note: string | null }[] } | null
```
→ `status: string;`'in hemen ardına `paymentStatus: string;` ekle:
```tsx
  order: { id: string; status: string; paymentStatus: string; items: { id: string; type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null; note: string | null }[] } | null
```

**(b)** Diğer `useState`'lerin yanına (ör. `uploadingPhotoId` civarı) ekle:

```tsx
  const [deliveryOtpMode, setDeliveryOtpMode] = useState(false)
  const [deliveryOtpCode, setDeliveryOtpCode] = useState("")
  const [deliverySentCode, setDeliverySentCode] = useState<string | null>(null)
```

- [ ] **Step 2: Handler'ları ekle**

`handleStatusChange`'in yanına (aynı bileşen içinde):

```tsx
  async function handleRequestDeliveryOtp() {
    setLoading(true); setError(""); setDeliverySentCode(null)
    try {
      const res = await fetch(`/api/intakes/${intake.id}/delivery-otp`, { method: "POST" })
      const data = await res.json() as { success?: boolean; otpCode?: string; error?: string }
      if (data.success) {
        setDeliveryOtpMode(true)
        setDeliverySentCode(data.otpCode ?? null)
      } else {
        setError(data.error || "Kod gönderilemedi")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyDeliveryOtp() {
    setLoading(true); setError("")
    try {
      const res = await fetch(`/api/intakes/${intake.id}/delivery-otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: deliveryOtpCode }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) {
        router.refresh()
      } else {
        setError(data.error || "Doğrulama başarısız")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }
```

- [ ] **Step 3: "Teslim Edildi" butonunu OTP akışıyla değiştir**

`src/components/app/intake-detail.tsx` — status actions bloğunda mevcut:

```tsx
        {intake.status === "ready_for_delivery" && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange("delivered")} disabled={loading}>
            Teslim Edildi
          </Button>
        )}
```

yerine:

```tsx
        {intake.status === "ready_for_delivery" && !deliveryOtpMode && (
          <Button size="sm" onClick={handleRequestDeliveryOtp} disabled={loading}>
            Teslim Et (OTP)
          </Button>
        )}
```

- [ ] **Step 4: OTP panelini status-actions `</div>`'inden hemen sonra ekle**

Status actions kapanış `</div>` (mevcut satır 403 civarı) ile `<Tabs ...>` arasına:

```tsx
      {intake.status === "ready_for_delivery" && deliveryOtpMode && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-sm font-medium">Teslim Onayı (OTP)</p>
          {intake.order && intake.order.paymentStatus !== "paid" && (
            <p className="text-xs text-warning">Uyarı: Bu iş emrinde ödeme tamamlanmadı ({intake.order.paymentStatus}).</p>
          )}
          {deliverySentCode && (
            <p className="text-xs text-muted-foreground">Demo kodu (SMS kapalı): <span className="font-mono font-bold">{deliverySentCode}</span></p>
          )}
          <Input
            value={deliveryOtpCode}
            onChange={(e) => setDeliveryOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 haneli teslim kodu"
            inputMode="numeric"
            className="h-12 text-center text-xl tracking-widest"
          />
          <div className="flex gap-2">
            <Button onClick={handleVerifyDeliveryOtp} disabled={loading || deliveryOtpCode.length < 4} className="flex-1 h-11">
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Doğrula ve Teslim Et"}
            </Button>
            <Button variant="outline" onClick={handleRequestDeliveryOtp} disabled={loading} className="h-11">Kodu Tekrar Gönder</Button>
            <Button variant="ghost" onClick={() => { setDeliveryOtpMode(false); setDeliveryOtpCode(""); setDeliverySentCode(null) }} disabled={loading} className="h-11">Vazgeç</Button>
          </div>
        </div>
      )}
```

> Not: `paymentStatus` erişimi Step 1(a)'daki tip genişletmesine dayanır. `Loader2` ve `Input` zaten import'lu (foto/diğer akışlarda kullanılıyor) — değilse `lucide-react`/ui'den ekle. `text-warning` tema rengi mevcut (wizard onay adımında kullanılıyordu).

- [ ] **Step 5: typecheck + lint + build**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: typecheck 0; lint yeni hata yok; build exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/intake-detail.tsx
git commit -m "feat: delivery OTP handover UI in intake detail (Faz D)"
```

> **Manuel/görsel QA (ertelendi → `:3000`):** iş emrini `ready_for_delivery`'ye getir → "Teslim Et (OTP)" → mock'ta kod ekranda → gir → "Doğrula ve Teslim Et" → `delivered`; yanlış kod/expired/çok deneme; ödeme borcu uyarısı; generic status ile `delivered` reddi.

---

## Sonraki / kapsam dışı
- OTP hash + kalıcı/distributed deneme sayacı (v0.6.0 OTP hardening + Redis rate-limit).
- Müşteri self-servis (uzaktan) teslim onayı.
- Faz D tamamlanınca: authoritative gate + final whole-branch review (opus) → PR (base main).
