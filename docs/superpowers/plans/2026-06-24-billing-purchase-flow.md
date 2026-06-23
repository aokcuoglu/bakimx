# Faturalandırma & Satın Alma Akışı (v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Müşterilerin paketi (public siteden veya uygulama içinden) wizard ile satın alabilmesi ve BakımX'in bu satın alma/abonelik süreçlerini manuel/havale teyidiyle yönettiği, gelir görünürlüğü olan bir panel.

**Architecture:** Tek `BillingOrder` tablosu tüm satın alma/yükseltme/yenileme yaşam döngüsünü taşır. Public satın alma "ödeme bekliyor" workshop'u yaratır (mevcut `approvalStatus=pending` onay-kapısı yeniden kullanılır); BakımX admin havaleyi teyit edip planı aktive eder. Ödeme bir `PaymentProvider` soyutlaması arkasında (şimdilik manuel/havale; iyzico sonra drop-in). Tutarlar Int kuruş.

**Tech Stack:** Next.js (App Router, RSC + server actions), Prisma + PostgreSQL, iron-session, Zod (`zod/v4`), react-hook-form, shadcn/ui, Bun (paket yöneticisi + test runner), bcryptjs.

## Global Constraints

- **Paket yöneticisi: Bun.** Komutlar: `bun install`, `bun run lint` (eslint), `bun run typecheck` (`tsc --noEmit`), `bun test`, `bun run build`. DB: `bunx prisma migrate dev --name <ad>`, `bunx prisma generate`, `bunx prisma validate`. Tek test dosyası: `bun test <path>`.
- **Para:** Yeni faturalama tutarları **Int kuruş** (`amountMinor`). Katalog fiyatları **KDV dahil / nihai** (müşteri gördüğü sayıyı öder). Mevcut Float para (`src/lib/money.ts`) ve para kolonları **DEĞİŞTİRİLMEZ**.
- **Vergi/fatura bilgisi:** Workshop'taki mevcut alanlar yeniden kullanılır — `invoiceTitle`, `taxNumber`, `taxOffice`, `email`, `name`, `address`, `phone`. **Yeni vergi kolonu EKLENMEZ.**
- **Tenant izolasyonu:** Uygulama içi aksiyonlar `workshopId`'yi `requireAuth()` / `getCurrentUserWithWorkshop()`'tan türetir — client'tan ASLA. Admin aksiyonları `requireAdmin()` çağırır (non-admin'e 404).
- **TS strict; `any` yok.** Zod import yolu `zod/v4`. Resolver: `typedResolver(schema)` (`@/lib/validations/resolver`).
- **Enum değerleri** Prisma ile birebir küçük-harf: `pending_payment`, `new_purchase`, `monthly`, `havale` vb.
- **Migration additive only; backfill yok.** Prod deploy DB'yi otomatik migrate ETMEZ — tag öncesi prod şema senkronu.
- **UI:** shadcn/ui primitive'leri `src/components/ui/`; BrandSpinner `src/components/shared/brand-spinner.tsx`; loading'de `Loader2`/BrandSpinner mevcut desen; mobil-öncelikli.
- **Commit:** Her görev sonunda conventional commit (`feat:`/`refactor:`/`docs:`...). Commit mesajının sonuna şu trailer eklenir:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Branch:** `feat/billing-purchase-flow` (zaten açık; spec burada commit'li).

## File Structure

**Yeni:**
- `src/lib/billing/pricing.ts` — `getPlanPriceMinor`, `formatMinor` (+ katalog'a `yearlyPrice`).
- `src/lib/billing/period.ts` — `addPeriod`, `periodStartFrom`.
- `src/lib/billing/reference.ts` — `generateOrderReference`.
- `src/lib/billing/receipt.ts` — `generateReceiptHtml`.
- `src/lib/validations/billing.ts` — checkout Zod şemaları.
- `src/components/billing/purchase-wizard.tsx` — paylaşımlı sihirbaz (public + inapp).
- `src/app/(app)/billing/checkout/page.tsx` — uygulama içi checkout girişi.
- `src/app/fiyatlar/page.tsx` — public fiyat sayfası.
- `src/app/satin-al/page.tsx` — public checkout sayfası.
- `src/app/api/checkout/route.ts` — public checkout (workshop+user+order).
- `src/app/api/billing/orders/[id]/receipt/route.ts` — makbuz (HTML).
- `src/app/admin/admin-billing.tsx` — admin ödeme inbox + abonelik + gelir.
- Testler: `src/lib/billing/pricing.test.ts`, `period.test.ts`, `reference.test.ts`; `src/lib/plan.test.ts`'e ekler.

**Değişen:**
- `prisma/schema.prisma` — Workshop alanları + `BillingOrder` + enum'lar + relation.
- `src/lib/plan.ts` — `currentPeriodEnd`, `subscription_expired`, `subscriptionDaysLeft`.
- `src/components/app/plan-locked.tsx` — `subscription_expired` COPY.
- `src/app/(app)/layout.tsx` — `currentPeriodEnd` select + yenileme banner.
- `src/components/app/plan-packages.tsx` — CTA → checkout'a yönlendir; KDV-dahil.
- `src/app/(app)/billing/page.tsx` — bekleyen sipariş durumu.
- `src/app/(app)/billing/actions.ts` — `createBillingOrder` (eski `requestPlanActivation` süperseed).
- `src/app/admin/actions.ts` — `confirmBillingOrder`, `cancelBillingOrder`.
- `src/app/admin/page.tsx` — order/abonelik/gelir verisi + render.
- `middleware.ts` — public route'lar + public/protected API.
- `.env.example` — `BILLING_HAVALE_*`.

---

# FAZ 1 — Veri modeli & saf alan mantığı

### Task 1: Prisma şeması — BillingOrder + Workshop alanları + migration

**Files:**
- Modify: `prisma/schema.prisma` (Workshop modeli ~satır 39 civarı relation listesi + ~satır 73 sonrası; enum bloğu ~satır 97 sonrası)

**Interfaces:**
- Produces: `BillingOrder` modeli; enum'lar `BillingCycle`, `BillingOrderType`, `BillingOrderStatus`, `BillingMethod`; Workshop alanları `billingCycle`, `currentPeriodEnd`, relation `billingOrders`. (Bunlar `@prisma/client`'tan import edilecek.)

- [ ] **Step 1: Workshop modeline alan + relation ekle.** `extraSeats Int @default(0)` satırından hemen sonra şu iki alanı ekle:

```prisma
  // --- Paid subscription period (manual/havale billing v1) ---
  // Set on the first confirmed paid order. Null = legacy/admin-provisioned or
  // never-paid workshop (no period gate). currentPeriodEnd < now => locked.
  billingCycle       BillingCycle?
  currentPeriodEnd   DateTime?
```

Ardından Workshop'un relation listesine (örn. `invites Invite[]` satırının altına) ekle:

```prisma
  billingOrders      BillingOrder[]
```

- [ ] **Step 2: BillingOrder modeli + enum'ları ekle.** `enum WorkshopApprovalStatus { ... }` bloğundan sonra ekle:

```prisma
model BillingOrder {
  id               String             @id @default(cuid())
  workshopId       String
  workshop         Workshop           @relation(fields: [workshopId], references: [id])
  type             BillingOrderType
  planTier         PlanTier
  billingCycle     BillingCycle
  amountMinor      Int                // kuruş — satın alma anındaki KDV-dahil fiyat snapshot'ı
  currency         String             @default("TRY")
  status           BillingOrderStatus @default(pending_payment)
  method           BillingMethod      @default(havale)
  reference        String             @unique // havale eşleştirme kodu, ör. "BX-7K3Q9"
  billingSnapshot  Json?              // o anki ünvan/vergi no/adres → makbuz için
  note             String?
  createdAt        DateTime           @default(now())
  confirmedAt      DateTime?
  confirmedByEmail String?
  periodStart      DateTime?
  periodEnd        DateTime?

  @@index([workshopId])
  @@index([status])
}

enum BillingCycle {
  monthly
  yearly
}

enum BillingOrderType {
  new_purchase
  upgrade
  renewal
}

enum BillingOrderStatus {
  pending_payment
  confirmed
  cancelled
}

enum BillingMethod {
  havale
  manual
  card
}
```

- [ ] **Step 3: Şemayı doğrula.**

Run: `bunx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Migration üret + uygula + client generate.**

Run: `bunx prisma migrate dev --name billing_orders`
Expected: `migrations/<timestamp>_billing_orders/migration.sql` oluşur, "Your database is now in sync", ardından client otomatik generate olur. (Yeni tablo + 2 nullable kolon + 4 enum; mevcut veriye dokunmaz.)

- [ ] **Step 5: Typecheck (client tipleri geldi mi).**

Run: `bun run typecheck`
Expected: hata yok (PASS).

- [ ] **Step 6: Commit.**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(billing): add BillingOrder model + workshop period fields (additive migration)"
```

---

### Task 2: `lib/billing/pricing.ts` — kuruş fiyat + format (TDD)

**Files:**
- Modify: `src/lib/plans-catalog.ts` (interface + 3 entry'ye `yearlyPrice`)
- Create: `src/lib/billing/pricing.ts`
- Test: `src/lib/billing/pricing.test.ts`

**Interfaces:**
- Consumes: `getPlanPackage` (`@/lib/plans-catalog`), `PlanTier` (`@/lib/plan`), `BillingCycle` (`@prisma/client`).
- Produces: `getPlanPriceMinor(tier: PlanTier, cycle: BillingCycle): number` (KDV-dahil kuruş); `formatMinor(minor: number): string`.

- [ ] **Step 1: Katalog'a `yearlyPrice` ekle.** `src/lib/plans-catalog.ts`'te `PlanPackage` interface'ine, `monthlyPrice` satırının altına:

```typescript
  /** Monthly price in TRY (VAT-included — the customer pays the displayed amount). */
  monthlyPrice: number
  /** Yearly price in TRY (VAT-included). 10× monthly = "2 ay bedava". */
  yearlyPrice: number
```

Ayrıca `monthlyPrice` yorumundaki "(excl. VAT)" ifadesini yukarıdaki "(VAT-included …)" ile değiştir (KDV-dahil kararı). Sonra her üç entry'ye `yearlyPrice` ekle: starter `yearlyPrice: 7490`, pro `yearlyPrice: 12990`, premium `yearlyPrice: 21990` (mevcut `monthlyPrice` satırlarının hemen altına).

- [ ] **Step 2: Failing test yaz.** `src/lib/billing/pricing.test.ts`:

```typescript
import { expect, test } from "bun:test"
import { getPlanPriceMinor, formatMinor } from "@/lib/billing/pricing"

test("getPlanPriceMinor returns VAT-included kuruş for monthly", () => {
  expect(getPlanPriceMinor("starter", "monthly")).toBe(74900)
  expect(getPlanPriceMinor("pro", "monthly")).toBe(129900)
  expect(getPlanPriceMinor("premium", "monthly")).toBe(219900)
})

test("getPlanPriceMinor returns VAT-included kuruş for yearly", () => {
  expect(getPlanPriceMinor("pro", "yearly")).toBe(1299000)
  expect(getPlanPriceMinor("premium", "yearly")).toBe(2199000)
})

test("formatMinor renders Turkish Lira", () => {
  expect(formatMinor(129900)).toContain("1.299")
})
```

- [ ] **Step 3: Testi çalıştır — fail.**

Run: `bun test src/lib/billing/pricing.test.ts`
Expected: FAIL (Cannot find module `@/lib/billing/pricing`).

- [ ] **Step 4: Implementasyon.** `src/lib/billing/pricing.ts`:

```typescript
import { getPlanPackage } from "@/lib/plans-catalog"
import type { PlanTier } from "@/lib/plan"
import type { BillingCycle } from "@prisma/client"

/**
 * Charged amount in kuruş (Int) for a tier/cycle. Catalog prices are
 * VAT-included and final — the customer pays the displayed amount.
 */
export function getPlanPriceMinor(tier: PlanTier, cycle: BillingCycle): number {
  const pkg = getPlanPackage(tier)
  if (!pkg) throw new Error(`Bilinmeyen paket: ${tier}`)
  const lira = cycle === "yearly" ? pkg.yearlyPrice : pkg.monthlyPrice
  return Math.round(lira * 100)
}

/** Format a kuruş amount as Turkish Lira, e.g. 129900 -> "₺1.299,00". */
export function formatMinor(minor: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(minor / 100)
}
```

- [ ] **Step 5: Testi çalıştır — pass.**

Run: `bun test src/lib/billing/pricing.test.ts`
Expected: PASS (3 test).

- [ ] **Step 6: Commit.**

```bash
git add src/lib/plans-catalog.ts src/lib/billing/pricing.ts src/lib/billing/pricing.test.ts
git commit -m "feat(billing): VAT-included kuruş pricing helper + catalog yearlyPrice"
```

---

### Task 3: `lib/billing/period.ts` — dönem hesabı (TDD)

**Files:**
- Create: `src/lib/billing/period.ts`
- Test: `src/lib/billing/period.test.ts`

**Interfaces:**
- Consumes: `BillingCycle` (`@prisma/client`).
- Produces: `addPeriod(start: Date, cycle: BillingCycle): Date`; `periodStartFrom(currentPeriodEnd: Date | null, now: Date): Date`.

- [ ] **Step 1: Failing test yaz.** `src/lib/billing/period.test.ts`:

```typescript
import { expect, test } from "bun:test"
import { addPeriod, periodStartFrom } from "@/lib/billing/period"

test("addPeriod adds one calendar month", () => {
  expect(addPeriod(new Date("2026-01-15T00:00:00Z"), "monthly").toISOString()).toBe(
    new Date("2026-02-15T00:00:00Z").toISOString()
  )
})

test("addPeriod adds one calendar year", () => {
  expect(addPeriod(new Date("2026-01-15T00:00:00Z"), "yearly").getUTCFullYear()).toBe(2027)
})

test("periodStartFrom extends from a future period end (early renewal)", () => {
  const now = new Date("2026-01-10T00:00:00Z")
  const end = new Date("2026-02-01T00:00:00Z")
  expect(periodStartFrom(end, now).toISOString()).toBe(end.toISOString())
})

test("periodStartFrom uses now when no/expired period", () => {
  const now = new Date("2026-03-10T00:00:00Z")
  expect(periodStartFrom(null, now).toISOString()).toBe(now.toISOString())
  expect(periodStartFrom(new Date("2026-01-01T00:00:00Z"), now).toISOString()).toBe(now.toISOString())
})
```

- [ ] **Step 2: Testi çalıştır — fail.**

Run: `bun test src/lib/billing/period.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implementasyon.** `src/lib/billing/period.ts`:

```typescript
import type { BillingCycle } from "@prisma/client"

/** Period end = start + 1 calendar month (monthly) or + 1 calendar year (yearly). */
export function addPeriod(start: Date, cycle: BillingCycle): Date {
  const d = new Date(start)
  if (cycle === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

/**
 * New period start: extend from the current period end if it's still in the
 * future (early renewal must not shorten the paid window); otherwise start now.
 */
export function periodStartFrom(currentPeriodEnd: Date | null, now: Date): Date {
  return currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime() ? currentPeriodEnd : now
}
```

- [ ] **Step 4: Testi çalıştır — pass.**

Run: `bun test src/lib/billing/period.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/billing/period.ts src/lib/billing/period.test.ts
git commit -m "feat(billing): period math (addPeriod, periodStartFrom)"
```

---

### Task 4: `lib/billing/reference.ts` + `provider.ts` — referans + ödeme-sağlayıcı seam (TDD)

**Files:**
- Create: `src/lib/billing/reference.ts`
- Create: `src/lib/billing/provider.ts`
- Test: `src/lib/billing/reference.test.ts`

**Interfaces:**
- Produces: `generateOrderReference(): string` — `BX-` + 6 belirsiz-olmayan karakter; `getHavaleInstructions(): HavaleInfo`; `PaymentProvider` arabirimi + `manualHavaleProvider`; `HavaleInfo` tipi.

- [ ] **Step 1: Failing test yaz.** `src/lib/billing/reference.test.ts`:

```typescript
import { expect, test } from "bun:test"
import { generateOrderReference } from "@/lib/billing/reference"

test("generateOrderReference matches BX-XXXXXX format", () => {
  for (let i = 0; i < 50; i++) {
    expect(generateOrderReference()).toMatch(/^BX-[ACDEFGHJKLMNPQRSTUVWXYZ2345679]{6}$/)
  }
})
```

- [ ] **Step 2: Testi çalıştır — fail.**

Run: `bun test src/lib/billing/reference.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implementasyon.** `src/lib/billing/reference.ts`:

```typescript
// Unambiguous alphabet (no O/0, I/1, B/8 confusion) for human-typed havale refs.
const ALPHABET = "ACDEFGHJKLMNPQRSTUVWXYZ2345679"

/** Short, unique-ish reference shown on the havale instruction. DB enforces
 *  uniqueness; callers retry on collision. */
export function generateOrderReference(): string {
  let s = ""
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return `BX-${s}`
}
```

- [ ] **Step 4: Testi çalıştır — pass.**

Run: `bun test src/lib/billing/reference.test.ts`
Expected: PASS.

- [ ] **Step 5: Ödeme-sağlayıcı seam'ini yaz.** `src/lib/billing/provider.ts`:

```typescript
import { generateOrderReference } from "@/lib/billing/reference"

export interface HavaleInfo {
  iban: string
  accountTitle: string
  bank: string
}

export interface PaymentInstruction {
  method: "havale"
  reference: string
  havale: HavaleInfo
  amountMinor: number
}

/**
 * Payment provider seam. v1 = manual havale (admin confirms). A future
 * IyzicoProvider implements the same interface (initiate -> redirect/3DS,
 * confirm -> webhook), so the checkout UI + BillingOrder stay unchanged.
 */
export interface PaymentProvider {
  initiate(input: { amountMinor: number; reference?: string }): PaymentInstruction
}

/** Centralized havale instructions (single env read; used by checkout pages). */
export function getHavaleInstructions(): HavaleInfo {
  return {
    iban: process.env.BILLING_HAVALE_IBAN || "—",
    accountTitle: process.env.BILLING_HAVALE_ACCOUNT_TITLE || "BakımX",
    bank: process.env.BILLING_HAVALE_BANK || "—",
  }
}

export const manualHavaleProvider: PaymentProvider = {
  initiate({ amountMinor, reference }) {
    return {
      method: "havale",
      reference: reference ?? generateOrderReference(),
      havale: getHavaleInstructions(),
      amountMinor,
    }
  },
}
```

- [ ] **Step 6: Typecheck.**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/billing/reference.ts src/lib/billing/reference.test.ts src/lib/billing/provider.ts
git commit -m "feat(billing): order reference + payment-provider seam (manual havale)"
```

---

### Task 5: `plan.ts` — dönem-sonu kilidi + `subscription_expired` (TDD)

**Files:**
- Modify: `src/lib/plan.ts` (`WorkshopPlanFields`, `LockReason`, `PlanState`, `getPlanState`)
- Modify: `src/components/app/plan-locked.tsx` (COPY)
- Test: `src/lib/plan.test.ts` (ekler)

**Interfaces:**
- Produces: `LockReason` artık `"subscription_expired"` da içerir; `PlanState`'e `currentPeriodEnd: Date | null` ve `subscriptionDaysLeft: number | null` eklenir; `getPlanState` artık `currentPeriodEnd`'i de okur.

- [ ] **Step 1: Failing test ekle.** `src/lib/plan.test.ts` sonuna:

```typescript
import { getPlanState } from "@/lib/plan"

function wsFields(over: Partial<Parameters<typeof getPlanState>[0]> = {}) {
  return {
    planTier: "pro" as const,
    subscriptionStatus: "active" as const,
    approvalStatus: "approved" as const,
    trialEndsAt: null,
    currentPeriodEnd: null,
    ...over,
  }
}

test("active subscription past currentPeriodEnd locks as subscription_expired", () => {
  const past = new Date(Date.now() - 86_400_000)
  const s = getPlanState(wsFields({ currentPeriodEnd: past }))
  expect(s.hasAccess).toBe(false)
  expect(s.lockReason).toBe("subscription_expired")
})

test("active subscription within period has access and reports days left", () => {
  const future = new Date(Date.now() + 5 * 86_400_000)
  const s = getPlanState(wsFields({ currentPeriodEnd: future }))
  expect(s.hasAccess).toBe(true)
  expect(s.subscriptionDaysLeft).toBe(5)
})

test("active subscription with null period keeps access (legacy/admin-provisioned)", () => {
  const s = getPlanState(wsFields({ currentPeriodEnd: null }))
  expect(s.hasAccess).toBe(true)
  expect(s.lockReason).toBe(null)
  expect(s.subscriptionDaysLeft).toBe(null)
})
```

- [ ] **Step 2: Testi çalıştır — fail.**

Run: `bun test src/lib/plan.test.ts`
Expected: FAIL (`subscriptionDaysLeft` yok / type error veya assertion fail).

- [ ] **Step 3: `WorkshopPlanFields`'e `currentPeriodEnd` ekle.** `src/lib/plan.ts`:

```typescript
type WorkshopPlanFields = Pick<
  Workshop,
  "planTier" | "subscriptionStatus" | "approvalStatus" | "trialEndsAt" | "currentPeriodEnd"
>
```

- [ ] **Step 4: `LockReason`'a yeni değer ekle.**

```typescript
export type LockReason =
  | "pending"
  | "rejected"
  | "trial_expired"
  | "subscription_inactive"
  | "subscription_expired"
  | null
```

- [ ] **Step 5: `PlanState`'e iki alan ekle.** Interface'e (`hasAccess`/`lockReason`'dan önce uygun yere):

```typescript
  /** Paid period end (active subs only), or null. */
  currentPeriodEnd: Date | null
  /** Whole days left in the paid period (ceil) when active+period set, else null. */
  subscriptionDaysLeft: number | null
```

- [ ] **Step 6: `getPlanState` gövdesini güncelle.** `const trialEndsAt = ...` satırından sonra `currentPeriodEnd` oku ve `subscriptionDaysLeft` hesapla; `active` dalını dönem kontrolüyle değiştir; return objesine iki yeni alanı ekle. Tam güncel fonksiyon:

```typescript
export function getPlanState(workshop: WorkshopPlanFields): PlanState {
  const tier = workshop.planTier as PlanTier
  const status = workshop.subscriptionStatus
  const approval = workshop.approvalStatus
  const trialEndsAt = workshop.trialEndsAt ?? null
  const currentPeriodEnd = workshop.currentPeriodEnd ?? null

  const isApproved = approval === "approved"
  const isTrialing = status === "trialing"
  const now = Date.now()
  const isTrialExpired =
    isTrialing && trialEndsAt != null && now > trialEndsAt.getTime()

  const trialDaysLeft =
    isTrialing && trialEndsAt != null
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / DAY_MS))
      : null

  const subscriptionDaysLeft =
    status === "active" && currentPeriodEnd != null
      ? Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now) / DAY_MS))
      : null

  let hasAccess = false
  let lockReason: LockReason = null

  if (!isApproved) {
    lockReason = approval === "rejected" ? "rejected" : "pending"
  } else if (status === "active") {
    if (currentPeriodEnd != null && now > currentPeriodEnd.getTime()) {
      lockReason = "subscription_expired"
    } else {
      hasAccess = true
    }
  } else if (status === "trialing") {
    if (isTrialExpired) lockReason = "trial_expired"
    else hasAccess = true
  } else {
    // past_due | canceled
    lockReason = "subscription_inactive"
  }

  return {
    tier,
    isApproved,
    isTrialing,
    trialEndsAt,
    trialDaysLeft,
    isTrialExpired,
    currentPeriodEnd,
    subscriptionDaysLeft,
    hasAccess,
    lockReason,
  }
}
```

- [ ] **Step 7: `PlanLocked` COPY'ye `subscription_expired` ekle.** `src/components/app/plan-locked.tsx`, `COPY` objesinde `subscription_inactive` entry'sinden sonra:

```typescript
  subscription_expired: {
    title: "Aboneliğiniz sona erdi",
    description:
      "Ödenmiş dönem sona erdi. Kaldığınız yerden devam etmek için paketinizi yenileyin — verileriniz güvende.",
    icon: Clock,
    showPackages: true,
  },
```

- [ ] **Step 8: Layout select'ine `currentPeriodEnd` ekle (tip uyumu).** `getPlanState`'in girdi tipi artık `currentPeriodEnd` içeriyor; `src/app/(app)/layout.tsx`'teki `prisma.workshop.findUnique`'in `select`'ine `currentPeriodEnd: true,` ekle (aksi halde tip hatası). Ayrıca `getAppData` (`src/app/(app)/data.ts`) workshop'u tam kayıt döndürüyorsa değişiklik gerekmez; `select` kullanıyorsa oraya da `currentPeriodEnd: true` ekle.

- [ ] **Step 9: Testi çalıştır — pass.**

Run: `bun test src/lib/plan.test.ts`
Expected: PASS (mevcut + 3 yeni test).

- [ ] **Step 10: Typecheck.**

Run: `bun run typecheck`
Expected: PASS (getPlanState tüketicileri — layout + billing/page — artık `currentPeriodEnd` içeriyor).

- [ ] **Step 11: Commit.**

```bash
git add src/lib/plan.ts src/lib/plan.test.ts src/components/app/plan-locked.tsx src/app/\(app\)/layout.tsx
git commit -m "feat(billing): subscription period-end lock (subscription_expired) in getPlanState"
```

---

# FAZ 2 — Uygulama içi checkout (sipariş oluşturma)

### Task 6: `lib/validations/billing.ts` — checkout şemaları

**Files:**
- Create: `src/lib/validations/billing.ts`

**Interfaces:**
- Produces: `checkoutInAppSchema`, `checkoutPublicSchema`, tipler `CheckoutInAppValues`, `CheckoutPublicValues`.

- [ ] **Step 1: Şemaları yaz.** `src/lib/validations/billing.ts`:

```typescript
import { z } from "zod/v4"

const tier = z.enum(["starter", "pro", "premium"])
const cycle = z.enum(["monthly", "yearly"])

// In-app: account exists; collect plan + invoice/tax info.
export const checkoutInAppSchema = z.object({
  tier,
  cycle,
  invoiceTitle: z.string().min(2, "Fatura ünvanı zorunludur"),
  taxNumber: z.string().min(10, "Vergi/TC kimlik no zorunludur (en az 10 hane)"),
  taxOffice: z.string().optional().default(""),
})
export type CheckoutInAppValues = z.infer<typeof checkoutInAppSchema>

// Public: also create the workshop + owner (mirrors registerSchema fields).
export const checkoutPublicSchema = z.object({
  tier,
  cycle,
  invoiceTitle: z.string().min(2, "Fatura ünvanı zorunludur"),
  taxNumber: z.string().min(10, "Vergi/TC kimlik no zorunludur (en az 10 hane)"),
  taxOffice: z.string().optional().default(""),
  email: z.email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  firstName: z.string().min(1, "Ad zorunludur"),
  lastName: z.string().min(1, "Soyad zorunludur"),
  workshopName: z.string().min(2, "İş yeri adı zorunludur"),
  phone: z.string().min(10, "Geçerli bir telefon numarası giriniz (en az 10 hane)"),
  city: z.string().min(1, "Şehir zorunludur"),
  address: z.string().min(1, "Adres zorunludur"),
  kvkkConsent: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .refine((v) => v === true || v === "on" || v === "true", {
      message: "Devam etmek için aydınlatma metnini onaylamanız gerekir",
    }),
})
export type CheckoutPublicValues = z.infer<typeof checkoutPublicSchema>
```

- [ ] **Step 2: Typecheck.**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/lib/validations/billing.ts
git commit -m "feat(billing): checkout zod schemas (in-app + public)"
```

---

### Task 7: `createBillingOrder` server action (in-app)

**Files:**
- Modify: `src/app/(app)/billing/actions.ts` (replace `requestPlanActivation` with `createBillingOrder`)

**Interfaces:**
- Consumes: `getCurrentUserWithWorkshop` (`@/lib/auth`), `checkoutInAppSchema`, `getPlanPriceMinor`, `generateOrderReference`, prisma.
- Produces: `createBillingOrder(input): Promise<{ ok: true; reference: string } | { ok: false; error: string }>`.

- [ ] **Step 1: `actions.ts`'i yeniden yaz.** `src/app/(app)/billing/actions.ts` tamamı:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { checkoutInAppSchema } from "@/lib/validations/billing"
import { getPlanPriceMinor } from "@/lib/billing/pricing"
import { generateOrderReference } from "@/lib/billing/reference"
import type { BillingCycle, BillingOrderType } from "@prisma/client"
import type { PlanTier } from "@/lib/plan"

/**
 * Creates a pending-payment BillingOrder for the current workshop (upgrade /
 * renewal / first paid purchase). An admin later confirms the havale in /admin,
 * which activates the plan. workshopId is derived from the session — never the
 * client — to preserve tenant isolation.
 */
export async function createBillingOrder(input: {
  tier: string
  cycle: string
  invoiceTitle: string
  taxNumber: string
  taxOffice?: string
}): Promise<{ ok: true; reference: string } | { ok: false; error: string }> {
  const { user, workshop } = await getCurrentUserWithWorkshop()

  const parsed = checkoutInAppSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }
  const data = parsed.data
  const tier = data.tier as PlanTier
  const cycle = data.cycle as BillingCycle
  const amountMinor = getPlanPriceMinor(tier, cycle)

  const type: BillingOrderType =
    workshop.currentPeriodEnd == null
      ? "new_purchase"
      : workshop.subscriptionStatus === "active" && workshop.planTier === tier
        ? "renewal"
        : "upgrade"

  const billingSnapshot = {
    invoiceTitle: data.invoiceTitle,
    taxNumber: data.taxNumber,
    taxOffice: data.taxOffice ?? "",
    name: workshop.name,
    address: workshop.address,
    email: workshop.email,
    phone: workshop.phone,
  }

  // Persist invoice/tax info on the workshop, keep the legacy admin "talep"
  // badge working (requestedPlanTier), and create the order. Retry on the rare
  // reference collision (unique constraint).
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = generateOrderReference()
    try {
      await prisma.$transaction(async (tx) => {
        await tx.workshop.update({
          where: { id: workshop.id },
          data: {
            invoiceTitle: data.invoiceTitle,
            taxNumber: data.taxNumber,
            taxOffice: data.taxOffice || null,
            requestedPlanTier: tier,
            planRequestedAt: new Date(),
          },
        })
        await tx.billingOrder.create({
          data: {
            workshopId: workshop.id,
            type,
            planTier: tier,
            billingCycle: cycle,
            amountMinor,
            status: "pending_payment",
            method: "havale",
            reference,
            billingSnapshot,
          },
        })
      })

      await AuditLogAction(
        workshop.id,
        user.id,
        "BillingOrder",
        reference,
        "billing_order_created",
        JSON.stringify({ tier, cycle, amountMinor, type })
      )
      revalidatePath("/billing")
      revalidatePath("/admin")
      return { ok: true, reference }
    } catch (err) {
      if ((err as { code?: string })?.code === "P2002") continue // reference collision → retry
      console.error("[createBillingOrder] failed:", err)
      return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar deneyin." }
    }
  }
  return { ok: false, error: "Sipariş oluşturulamadı. Lütfen tekrar deneyin." }
}
```

- [ ] **Step 2: Eski import'u temizle.** `requestPlanActivation`'ı başka tüketen var mı doğrula:

Run: `grep -rn "requestPlanActivation" src`
Expected: yalnızca silinen tanım kalıntısı yok; eğer `plan-packages.tsx` hâlâ import ediyorsa Task 8'de düzeltilecek (şimdilik typecheck bozuksa Task 8'e geç, sonra birlikte commit et). Not: bu görevin commit'i typecheck PASS gerektirir; bu yüzden Task 8 ile birlikte commit edilebilir — aşağıdaki Step 3'e bak.

- [ ] **Step 3: Typecheck.**

Run: `bun run typecheck`
Expected: `plan-packages.tsx`'te `requestPlanActivation` import hatası **bekleniyor** (Task 8'de düzeltilecek). Bu görevi Task 8 ile aynı commit'te kapatmak için commit'i Task 8 Step sonuna ertele. (Saf action kodu bu adımda yazıldı.)

---

### Task 8: `PurchaseWizard` + in-app checkout sayfası + `PlanPackages` yönlendirme

**Files:**
- Create: `src/components/billing/purchase-wizard.tsx`
- Create: `src/app/(app)/billing/checkout/page.tsx`
- Modify: `src/components/app/plan-packages.tsx` (CTA navigasyon + KDV-dahil)

**Interfaces:**
- Consumes: `createBillingOrder` (in-app submit), `/api/checkout` (public submit — Task 10), `formatMinor`, `getPlanPriceMinor`.
- Produces: `<PurchaseWizard mode initialTier initialCycle havale ownedTier? defaultInvoice? />`; `<PlanPackages ... checkoutBasePath />`.

- [ ] **Step 1: `PurchaseWizard` bileşenini yaz.** `src/components/billing/purchase-wizard.tsx`:

```typescript
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2, Landmark, Copy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { typedResolver } from "@/lib/validations/resolver"
import {
  checkoutInAppSchema,
  checkoutPublicSchema,
  type CheckoutInAppValues,
  type CheckoutPublicValues,
} from "@/lib/validations/billing"
import { PLAN_PACKAGES } from "@/lib/plans-catalog"
import { getPlanPriceMinor, formatMinor } from "@/lib/billing/pricing"
import { createBillingOrder } from "@/app/(app)/billing/actions"
import type { PlanTier } from "@/lib/plan"
import type { HavaleInfo } from "@/lib/billing/provider"

type Mode = "public" | "inapp"
type Cycle = "monthly" | "yearly"

export function PurchaseWizard({
  mode,
  initialTier = "pro",
  initialCycle = "monthly",
  havale,
  defaultInvoiceTitle = "",
}: {
  mode: Mode
  initialTier?: PlanTier
  initialCycle?: Cycle
  havale: HavaleInfo
  defaultInvoiceTitle?: string
}) {
  const STEPS =
    mode === "public"
      ? ["Paket", "Hesap & Fatura", "Özet"]
      : ["Paket", "Fatura Bilgisi", "Özet"]
  const [step, setStep] = useState(0)
  const [tier, setTier] = useState<PlanTier>(initialTier)
  const [cycle, setCycle] = useState<Cycle>(initialCycle)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{ reference: string; amountMinor: number } | null>(null)

  const schema = mode === "public" ? checkoutPublicSchema : checkoutInAppSchema
  const form = useForm<CheckoutPublicValues | CheckoutInAppValues>({
    resolver: typedResolver(schema as never) as never,
    defaultValues: {
      tier: initialTier,
      cycle: initialCycle,
      invoiceTitle: defaultInvoiceTitle,
      taxNumber: "",
      taxOffice: "",
      ...(mode === "public"
        ? {
            email: "",
            password: "",
            firstName: "",
            lastName: "",
            workshopName: "",
            phone: "",
            city: "",
            address: "",
            kvkkConsent: false,
          }
        : {}),
    } as never,
    mode: "onChange",
  })
  const { register, trigger, getValues, formState } = form
  const amountMinor = getPlanPriceMinor(tier, cycle)

  async function next(fields: string[]) {
    setError("")
    // keep tier/cycle in the form payload
    form.setValue("tier" as never, tier as never)
    form.setValue("cycle" as never, cycle as never)
    const valid = fields.length === 0 ? true : await trigger(fields as never)
    if (valid) setStep((s) => s + 1)
  }

  async function submit() {
    setError("")
    setLoading(true)
    try {
      const values = getValues() as Record<string, unknown>
      values.tier = tier
      values.cycle = cycle
      if (mode === "public") {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        })
        const data = await res.json()
        if (data.success) setDone({ reference: data.reference, amountMinor: data.amountMinor })
        else setError(data.error || "Satın alma başarısız")
      } else {
        const res = await createBillingOrder({
          tier,
          cycle,
          invoiceTitle: String(values.invoiceTitle ?? ""),
          taxNumber: String(values.taxNumber ?? ""),
          taxOffice: String(values.taxOffice ?? ""),
        })
        if (res.ok) setDone({ reference: res.reference, amountMinor })
        else setError(res.error)
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="size-7 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Talebiniz alındı</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "public"
                ? "Hesabınız oluşturuldu. Ödemeniz teyit edilince giriş yapabilirsiniz."
                : "Havale teyidinden sonra paketiniz aktifleşecek."}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-4 text-left text-sm space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <Landmark className="size-4 text-primary" /> Havale / EFT ile ödeme
            </div>
            <p className="text-muted-foreground">Tutar: <span className="font-semibold text-foreground">{formatMinor(done.amountMinor)}</span></p>
            <p className="text-muted-foreground">Alıcı: <span className="text-foreground">{havale.accountTitle}</span></p>
            <p className="text-muted-foreground">IBAN: <span className="text-foreground font-mono">{havale.iban}</span></p>
            <p className="text-muted-foreground">Banka: <span className="text-foreground">{havale.bank}</span></p>
            <p className="text-muted-foreground">
              Açıklama: <span className="font-semibold text-foreground inline-flex items-center gap-1">{done.reference} <Copy className="size-3" /></span>
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Lütfen açıklama kısmına <span className="font-semibold">{done.reference}</span> referansını yazın.
            </p>
          </div>
          {mode === "public" ? (
            <Link href="/login" className="text-sm text-primary hover:underline">Giriş sayfasına git</Link>
          ) : (
            <Link href="/billing" className="text-sm text-primary hover:underline">Paket sayfasına dön</Link>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* progress */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Adım {step + 1} / {STEPS.length}</span>
          <span className="text-xs text-muted-foreground">{STEPS[step]}</span>
        </div>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className={cn("flex-1 h-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3">{error}</div>}

      {/* Step 0: plan + cycle */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Paket seçin</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="inline-flex w-full rounded-lg border bg-card p-1 gap-1">
              {(["monthly", "yearly"] as const).map((c) => (
                <button key={c} type="button" onClick={() => setCycle(c)}
                  className={cn("flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors", cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {c === "monthly" ? "Aylık" : "Yıllık (2 ay bedava)"}
                </button>
              ))}
            </div>
            <div className="grid gap-3">
              {PLAN_PACKAGES.map((pkg) => {
                const selected = tier === pkg.tier
                const minor = getPlanPriceMinor(pkg.tier, cycle)
                return (
                  <button key={pkg.tier} type="button" onClick={() => setTier(pkg.tier)}
                    className={cn("flex items-center justify-between rounded-xl border p-4 text-left transition-colors", selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                    <div>
                      <p className="font-semibold text-foreground">{pkg.name}</p>
                      <p className="text-xs text-muted-foreground">{pkg.tagline} · {pkg.seats} kullanıcı</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatMinor(minor)}</p>
                      <p className="text-[11px] text-muted-foreground">{cycle === "monthly" ? "/ay" : "/yıl"} · KDV dahil</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="pt-2 flex justify-end">
              <Button type="button" size="lg" className="h-12 gap-2" onClick={() => next([])}>Devam <ChevronRight className="size-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: account (public) + invoice info */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>{mode === "public" ? "Hesap & fatura bilgisi" : "Fatura bilgisi"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {mode === "public" && (
              <>
                <Field label="İş yeri adı" error={fieldError(formState, "workshopName")}><Input {...register("workshopName" as never)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ad" error={fieldError(formState, "firstName")}><Input {...register("firstName" as never)} /></Field>
                  <Field label="Soyad" error={fieldError(formState, "lastName")}><Input {...register("lastName" as never)} /></Field>
                </div>
                <Field label="E-posta" error={fieldError(formState, "email")}><Input type="email" {...register("email" as never)} /></Field>
                <Field label="Şifre" error={fieldError(formState, "password")}><Input type="password" {...register("password" as never)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefon" error={fieldError(formState, "phone")}><Input {...register("phone" as never)} /></Field>
                  <Field label="Şehir" error={fieldError(formState, "city")}><Input {...register("city" as never)} /></Field>
                </div>
                <Field label="Adres" error={fieldError(formState, "address")}><Input {...register("address" as never)} /></Field>
              </>
            )}
            <Field label="Fatura ünvanı" error={fieldError(formState, "invoiceTitle")}><Input {...register("invoiceTitle" as never)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vergi / TC no" error={fieldError(formState, "taxNumber")}><Input {...register("taxNumber" as never)} /></Field>
              <Field label="Vergi dairesi (ops.)" error={fieldError(formState, "taxOffice")}><Input {...register("taxOffice" as never)} /></Field>
            </div>
            {mode === "public" && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
                <input type="checkbox" {...register("kvkkConsent" as never)} className="mt-0.5" />
                <span><Link href="/privacy" className="text-primary hover:underline" target="_blank">Aydınlatma metnini</Link> okudum, onaylıyorum.</span>
              </label>
            )}
            <div className="pt-2 flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(0)} className="gap-1"><ChevronLeft className="size-4" /> Geri</Button>
              <Button type="button" size="lg" className="h-12 gap-2"
                onClick={() => next(mode === "public"
                  ? ["workshopName", "firstName", "lastName", "email", "password", "phone", "city", "address", "invoiceTitle", "taxNumber", "kvkkConsent"]
                  : ["invoiceTitle", "taxNumber"])}>
                Devam <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: summary */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Özet</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1.5">
              <p className="flex justify-between"><span className="text-muted-foreground">Paket</span><span className="font-medium text-foreground">{PLAN_PACKAGES.find((p) => p.tier === tier)?.name}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Dönem</span><span className="font-medium text-foreground">{cycle === "monthly" ? "Aylık" : "Yıllık"}</span></p>
              <p className="flex justify-between text-base"><span className="text-muted-foreground">Tutar (KDV dahil)</span><span className="font-bold text-foreground">{formatMinor(amountMinor)}</span></p>
            </div>
            <p className="text-xs text-muted-foreground">Onayladığınızda size havale/EFT talimatı ve referans kodu verilir. Ödeme ekibimizce teyit edilince {mode === "public" ? "hesabınız aktifleşir" : "paketiniz güncellenir"}.</p>
            <div className="pt-1 flex justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1"><ChevronLeft className="size-4" /> Geri</Button>
              <Button type="button" size="lg" disabled={loading} className="h-12 gap-2" onClick={submit}>
                {loading ? <><Loader2 className="size-4 animate-spin" /> Gönderiliyor…</> : "Siparişi oluştur"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function fieldError(formState: { errors: Record<string, { message?: string } | undefined> }, name: string): string | undefined {
  return formState.errors?.[name]?.message
}
```

- [ ] **Step 2: In-app checkout sayfasını yaz.** `src/app/(app)/billing/checkout/page.tsx`:

```typescript
import { AppShell } from "@/components/app/app-shell"
import { getAppData } from "@/app/(app)/data"
import { PurchaseWizard } from "@/components/billing/purchase-wizard"
import { getHavaleInstructions } from "@/lib/billing/provider"
import type { PlanTier } from "@/lib/plan"

export const metadata = { title: "Satın Al" }

const HAVALE = getHavaleInstructions()

export default async function BillingCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; cycle?: string }>
}) {
  const { workshop } = await getAppData()
  const sp = await searchParams
  const tier = (["starter", "pro", "premium"].includes(sp.tier ?? "") ? sp.tier : "pro") as PlanTier
  const cycle = (sp.cycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Satın Al">
      <PurchaseWizard
        mode="inapp"
        initialTier={tier}
        initialCycle={cycle}
        havale={HAVALE}
        defaultInvoiceTitle={workshop?.invoiceTitle || workshop?.name || ""}
      />
    </AppShell>
  )
}
```

- [ ] **Step 3: `PlanPackages` CTA'sını navigasyona çevir + KDV-dahil yap.** `src/components/app/plan-packages.tsx`'i şu şekilde değiştir:
  1. Üstte `import { useRouter } from "next/navigation"` ekle; `requestPlanActivation` import'unu **kaldır**.
  2. `PlanPackages` prop'larına `checkoutBasePath?: string` ekle (default `"/billing/checkout"`).
  3. `handleSelect`/`pending`/`pendingTier`/`requested`/`error` state mantığını şu sade navigasyonla değiştir:

```typescript
  const router = useRouter()
  function handleSelect(tier: PlanTier) {
    router.push(`${checkoutBasePath}?tier=${tier}&cycle=${billing}`)
  }
```
  4. `+ KDV` etiketini (mevcut `<span ...>+ KDV</span>`) **`KDV dahil`** ile değiştir.
  5. CTA butonundaki `isBusy`/`isRequested` durumlarını kaldır; buton metni her zaman `"Bu paketi seç"` (owned değilse). `disabled={pending}` kaldır.
  6. Alt bilgi paragrafını (`Ödeme altyapısı yakında…`) şununla değiştir: `"Havale/EFT ile ödeyin; ödemeniz teyit edilince paketiniz aktifleşir."` (WhatsApp linki kalabilir.)
  7. Üstteki `requested && requestedPkg` "talep alındı" bloğunu **kaldır** (artık akış checkout'a gidiyor).
  8. Kullanılmayan import'ları temizle: `useState` yalnız `billing` (döngü toggle) için kalır; `useTransition`, `Loader2`, `getPlanPackage` (artık kullanılmıyor) kaldırılır; footer'ı sadeleştirdiysen `MessageCircle` de. `bun run lint` temiz olmalı.

Fonksiyon imzası:
```typescript
export function PlanPackages({
  ownedTier = null,
  workshopName,
  checkoutBasePath = "/billing/checkout",
}: {
  ownedTier?: PlanTier | null
  workshopName?: string
  checkoutBasePath?: string
}) {
```
Not: `requestedTier` prop'u kaldırıldı; çağıranlar (`billing/page.tsx`, `plan-locked.tsx`) Task 9 / aşağıda güncellenecek.

- [ ] **Step 4: `PlanLocked`'taki `PlanPackages` çağrısını güncelle.** `src/components/app/plan-locked.tsx`'te `<PlanPackages ownedTier={null} requestedTier={requestedTier} workshopName={workshopName} />` → `<PlanPackages ownedTier={null} workshopName={workshopName} />`. Ayrıca artık kullanılmayan `requestedTier` prop'unu `PlanLocked`'tan kaldır (imzadan ve `(app)/layout.tsx` çağrısından — layout'ta `requestedTier={...}` satırını sil).

- [ ] **Step 5: Typecheck (Task 7 ile birlikte).**

Run: `bun run typecheck`
Expected: PASS. (Eğer `billing/page.tsx` hâlâ `requestedTier` geçiyorsa Task 9'da düzeltilecek — ama daha temiz olması için burada da düzelt: `billing/page.tsx`'teki `<PlanPackages ... requestedTier={...} />`'dan `requestedTier`'ı kaldır.)

- [ ] **Step 6: Build (UI sanity).**

Run: `bun run build`
Expected: derleme başarılı.

- [ ] **Step 7: Manuel QA.** `bun dev` → giriş yap → `/billing` → bir paket "Bu paketi seç" → `/billing/checkout?tier=...&cycle=...` açılır → 3 adımı doldur → "Siparişi oluştur" → onay ekranında IBAN + referans + tutar (KDV dahil) görünür.

- [ ] **Step 8: Commit (Task 7 + 8 birlikte).**

```bash
git add src/app/\(app\)/billing/actions.ts src/components/billing/purchase-wizard.tsx src/app/\(app\)/billing/checkout/page.tsx src/components/app/plan-packages.tsx src/components/app/plan-locked.tsx src/app/\(app\)/layout.tsx
git commit -m "feat(billing): in-app purchase wizard + createBillingOrder; route plan CTAs to checkout"
```

---

### Task 9: `/billing` sayfasında bekleyen sipariş durumu

**Files:**
- Modify: `src/app/(app)/billing/page.tsx`

**Interfaces:**
- Consumes: prisma `billingOrder.findFirst`, `formatMinor`.

- [ ] **Step 1: Bekleyen siparişi sorgula + banner göster.** `billing/page.tsx`'te `const plan = getPlanState(workshop)` satırından sonra:

```typescript
  const pendingOrder = await prisma.billingOrder.findFirst({
    where: { workshopId: workshop.id, status: "pending_payment" },
    orderBy: { createdAt: "desc" },
  })
```
Gerekli import'lar dosya başına: `import { prisma } from "@/lib/db"` ve `import { formatMinor } from "@/lib/billing/pricing"` ve `import { getPlanPackage } from "@/lib/plans-catalog"` (zaten var). Sonra "Current status" bloğundan **önce** şu banner'ı ekle:

```tsx
        {pendingOrder && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <Clock className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                Bekleyen ödeme · {getPlanPackage(pendingOrder.planTier)?.name} ({pendingOrder.billingCycle === "monthly" ? "Aylık" : "Yıllık"}) · {formatMinor(pendingOrder.amountMinor)}
              </p>
              <p className="text-muted-foreground mt-0.5">
                Havale açıklamasına <span className="font-semibold">{pendingOrder.reference}</span> yazın. Ödemeniz teyit edilince paketiniz aktifleşecek.
              </p>
            </div>
          </div>
        )}
```

- [ ] **Step 2: Typecheck + build.**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 3: Manuel QA.** Sipariş oluşturduktan sonra `/billing`'de sarı "Bekleyen ödeme" banner'ı referansla görünür.

- [ ] **Step 4: Commit.**

```bash
git add src/app/\(app\)/billing/page.tsx
git commit -m "feat(billing): show pending payment banner on /billing"
```

---

# FAZ 3 — Public doğrudan satın alma

### Task 10: `POST /api/checkout` — public checkout (workshop+user+order)

**Files:**
- Create: `src/app/api/checkout/route.ts`

**Interfaces:**
- Consumes: `checkoutPublicSchema`, `rateLimit`, `clientIpFromHeaders`, `getPlanPriceMinor`, `generateOrderReference`, bcryptjs, prisma.
- Produces: JSON `{ success: true, reference, amountMinor }` veya `{ error }`.

- [ ] **Step 1: Route'u yaz.** `src/app/api/checkout/route.ts`:

```typescript
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { checkoutPublicSchema } from "@/lib/validations/billing"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { getPlanPriceMinor } from "@/lib/billing/pricing"
import { generateOrderReference } from "@/lib/billing/reference"
import type { BillingCycle } from "@prisma/client"
import type { PlanTier } from "@/lib/plan"

const MAX_ATTEMPTS = 5
const WINDOW_MS = 10 * 60_000

const GENERIC_ERROR = "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin."

/**
 * Public direct purchase. Creates an isolated Workshop + owner User in `pending`
 * approval (no access) plus a pending-payment BillingOrder. BakımX confirms the
 * havale in /admin, which doubles as approval and activates the plan. No session
 * is created here.
 */
export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers)
  const limit = rateLimit(`checkout:${ip}`, MAX_ATTEMPTS, WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json({ error: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin." }, { status: 429 })
  }

  let raw: Record<string, unknown>
  try {
    raw = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 })
  }

  const normalized = {
    ...raw,
    email: typeof raw.email === "string" ? raw.email.trim().toLowerCase() : raw.email,
  }
  const parsed = checkoutPublicSchema.safeParse(normalized)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }, { status: 400 })
  }
  const data = parsed.data

  const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } })
  if (existing) {
    return NextResponse.json({ error: "Bu e-posta adresi ile zaten bir hesap mevcut. Giriş yapmayı deneyin." }, { status: 409 })
  }

  const tier = data.tier as PlanTier
  const cycle = data.cycle as BillingCycle
  const amountMinor = getPlanPriceMinor(tier, cycle)
  const billingSnapshot = {
    invoiceTitle: data.invoiceTitle,
    taxNumber: data.taxNumber,
    taxOffice: data.taxOffice ?? "",
    name: data.workshopName,
    address: data.address,
    email: data.email,
    phone: data.phone,
  }

  try {
    const passwordHash = await bcrypt.hash(data.password, 12)

    for (let attempt = 0; attempt < 5; attempt++) {
      const reference = generateOrderReference()
      try {
        await prisma.$transaction(async (tx) => {
          const workshop = await tx.workshop.create({
            data: {
              name: data.workshopName,
              phone: data.phone,
              city: data.city,
              address: data.address,
              email: data.email,
              invoiceTitle: data.invoiceTitle,
              taxNumber: data.taxNumber,
              taxOffice: data.taxOffice || null,
              // No access until BakımX confirms the havale (which approves it).
              approvalStatus: "pending",
              subscriptionStatus: "trialing",
              planTier: "pro",
              requestedPlanTier: tier,
              planRequestedAt: new Date(),
              settings: { create: {} },
            },
          })
          await tx.user.create({
            data: {
              email: data.email,
              password: passwordHash,
              firstName: data.firstName,
              lastName: data.lastName,
              workshopId: workshop.id,
              role: "owner",
            },
          })
          await tx.billingOrder.create({
            data: {
              workshopId: workshop.id,
              type: "new_purchase",
              planTier: tier,
              billingCycle: cycle,
              amountMinor,
              status: "pending_payment",
              method: "havale",
              reference,
              billingSnapshot,
            },
          })
        })
        return NextResponse.json({ success: true, reference, amountMinor })
      } catch (err) {
        const code = (err as { code?: string })?.code
        if (code === "P2002") {
          // Could be reference collision (retry) or duplicate email (stop).
          // findUnique above already covers email; treat remaining P2002 as ref → retry.
          continue
        }
        throw err
      }
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === "P2002") {
      return NextResponse.json({ error: "Bu e-posta adresi ile zaten bir hesap mevcut. Giriş yapmayı deneyin." }, { status: 409 })
    }
    console.error("[checkout] failed:", err)
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck.**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/app/api/checkout/route.ts
git commit -m "feat(billing): public POST /api/checkout creates pending-payment workshop + order"
```

---

### Task 11: Public fiyat + satın alma sayfaları

**Files:**
- Create: `src/app/fiyatlar/page.tsx`
- Create: `src/app/satin-al/page.tsx`

**Interfaces:**
- Consumes: `PlanPackages` (`checkoutBasePath="/satin-al"`), `PurchaseWizard` (`mode="public"`).

- [ ] **Step 1: Fiyat sayfasını yaz.** `src/app/fiyatlar/page.tsx`:

```typescript
import Link from "next/link"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { PlanPackages } from "@/components/app/plan-packages"

export const metadata = { title: "Fiyatlar" }

export default function FiyatlarPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12 space-y-8">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Paketler</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            İş yerinize uygun paketi seçin. 15 gün ücretsiz denemek için{" "}
            <Link href="/register" className="text-primary hover:underline">kayıt olun</Link>, ya da doğrudan satın alın.
          </p>
        </div>
        <PlanPackages checkoutBasePath="/satin-al" />
      </main>
      <Footer />
    </>
  )
}
```
Not: `Header`/`Footer` import yollarını `src/app/page.tsx`'teki ile birebir doğrula (`@/components/sections/Header`, `@/components/sections/Footer`). Ayrıca keşfedilebilirlik için landing `Header` bileşenine (`src/components/sections/Header.tsx`) `/fiyatlar`'a giden bir "Fiyatlar" nav linki ekle (mevcut nav linkleriyle aynı stilde).

- [ ] **Step 2: Public checkout sayfasını yaz.** `src/app/satin-al/page.tsx`:

```typescript
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { PurchaseWizard } from "@/components/billing/purchase-wizard"
import { getHavaleInstructions } from "@/lib/billing/provider"
import type { PlanTier } from "@/lib/plan"

export const metadata = { title: "Satın Al" }

const HAVALE = getHavaleInstructions()

export default async function SatinAlPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; cycle?: string }>
}) {
  const sp = await searchParams
  const tier = (["starter", "pro", "premium"].includes(sp.tier ?? "") ? sp.tier : "pro") as PlanTier
  const cycle = (sp.cycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        <PurchaseWizard mode="public" initialTier={tier} initialCycle={cycle} havale={HAVALE} />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 3: Typecheck + build.**

Run: `bun run typecheck && bun run build`
Expected: PASS (yeni route'lar derlenir).

- [ ] **Step 4: Commit.**

```bash
git add src/app/fiyatlar/page.tsx src/app/satin-al/page.tsx src/components/sections/Header.tsx
git commit -m "feat(billing): public /fiyatlar pricing + /satin-al checkout pages + header link"
```

---

### Task 12: Middleware — public/protected route kayıtları

**Files:**
- Modify: `middleware.ts`

**Interfaces:**
- Produces: `/fiyatlar` ve `/satin-al` public sayfa; `/api/checkout` public API; `/api/billing` protected API.

- [ ] **Step 1: Public sayfa listelerine ekle.** `middleware.ts`'te:

```typescript
const PUBLIC_EXACT = new Set(["/", "/login", "/forgot-password", "/register", "/privacy", "/terms", "/fiyatlar"])
const PUBLIC_PREFIX = ["/s/", "/p/", "/invite/", "/demo", "/satin-al"]
```

- [ ] **Step 2: API listelerine ekle.**

```typescript
const PUBLIC_API_PREFIX = ["/api/auth", "/api/checkout", "/api/demo-request", "/api/support-request", "/api/cron"]
```
ve `PROTECTED_API_PREFIX` dizisine `"/api/billing"` ekle (örn. `"/api/advisor"` satırının yanına):
```typescript
  "/api/advisor", "/api/billing", "/api/communications", "/api/calendar",
```

- [ ] **Step 3: Build (middleware derlenir).**

Run: `bun run build`
Expected: PASS.

- [ ] **Step 4: Manuel QA.** `bun dev` → çıkış yap → `/fiyatlar` açılır (auth yok) → paket seç → `/satin-al?tier=...` açılır → formu doldur → "Siparişi oluştur" → onay ekranı (referans + IBAN). Veritabanında workshop `approvalStatus=pending` + bir `BillingOrder pending_payment` oluşur. Bu hesapla `/login` denenince "Başvurunuz alındı…" mesajı gelir (giriş engelli).

- [ ] **Step 5: Commit.**

```bash
git add middleware.ts
git commit -m "feat(billing): route /fiyatlar /satin-al /api/checkout (public) + /api/billing (protected)"
```

---

# FAZ 4 — BakımX yönetim paneli

### Task 13: `confirmBillingOrder` + `cancelBillingOrder` (admin)

**Files:**
- Modify: `src/app/admin/actions.ts`

**Interfaces:**
- Consumes: `requireAdmin`, `addPeriod`, `periodStartFrom`, prisma, `AuditLogAction`.
- Produces: `confirmBillingOrder(orderId): Promise<Result>`; `cancelBillingOrder(orderId): Promise<Result>` (`Result` mevcut tipi).

- [ ] **Step 1: İki aksiyonu ekle.** `src/app/admin/actions.ts` sonuna (import'lara `import { addPeriod, periodStartFrom } from "@/lib/billing/period"` ekle):

```typescript
/** Confirm a pending havale: activate the plan + set the paid period. Doubles
 *  as approval for public direct-purchase workshops. */
export async function confirmBillingOrder(orderId: string): Promise<Result> {
  const admin = await requireAdmin()
  if (!orderId) return { ok: false, error: "Sipariş seçilmedi." }

  const order = await prisma.billingOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: "Sipariş bulunamadı." }
  if (order.status !== "pending_payment") return { ok: false, error: "Bu sipariş zaten işlenmiş." }

  const workshop = await prisma.workshop.findUnique({
    where: { id: order.workshopId },
    select: { currentPeriodEnd: true },
  })
  const now = new Date()
  const periodStart = periodStartFrom(workshop?.currentPeriodEnd ?? null, now)
  const periodEnd = addPeriod(periodStart, order.billingCycle)

  await prisma.$transaction(async (tx) => {
    await tx.workshop.update({
      where: { id: order.workshopId },
      data: {
        planTier: order.planTier,
        billingCycle: order.billingCycle,
        subscriptionStatus: "active",
        approvalStatus: "approved",
        currentPeriodEnd: periodEnd,
        requestedPlanTier: null,
        planRequestedAt: null,
      },
    })
    await tx.billingOrder.update({
      where: { id: order.id },
      data: { status: "confirmed", confirmedAt: now, confirmedByEmail: admin.email, periodStart, periodEnd },
    })
  })

  await AuditLogAction(order.workshopId, admin.id, "BillingOrder", order.id, "billing_order_confirmed",
    JSON.stringify({ tier: order.planTier, cycle: order.billingCycle, amountMinor: order.amountMinor }))
  revalidatePath("/admin")
  return { ok: true }
}

/** Cancel a pending order (e.g. havale never arrived). */
export async function cancelBillingOrder(orderId: string): Promise<Result> {
  const admin = await requireAdmin()
  if (!orderId) return { ok: false, error: "Sipariş seçilmedi." }
  const order = await prisma.billingOrder.findUnique({ where: { id: orderId }, select: { id: true, status: true, workshopId: true } })
  if (!order) return { ok: false, error: "Sipariş bulunamadı." }
  if (order.status !== "pending_payment") return { ok: false, error: "Yalnızca bekleyen sipariş iptal edilebilir." }

  await prisma.billingOrder.update({ where: { id: orderId }, data: { status: "cancelled" } })
  await AuditLogAction(order.workshopId, admin.id, "BillingOrder", orderId, "billing_order_cancelled")
  revalidatePath("/admin")
  return { ok: true }
}
```

- [ ] **Step 2: Typecheck.**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/app/admin/actions.ts
git commit -m "feat(admin): confirm/cancel billing orders (activate plan + set period)"
```

---

### Task 14: Admin ödeme inbox + abonelik + gelir

**Files:**
- Create: `src/app/admin/admin-billing.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `confirmBillingOrder`, `cancelBillingOrder`, `formatMinor`.
- Produces: `<AdminBilling orders subscriptions revenue />`.

- [ ] **Step 1: `admin-billing.tsx` istemci bileşenini yaz.** `src/app/admin/admin-billing.tsx`:

```typescript
"use client"

import { useState, useTransition } from "react"
import { Check, X, Loader2, Landmark } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { confirmBillingOrder, cancelBillingOrder } from "@/app/admin/actions"

export interface AdminOrderRow {
  id: string
  workshopName: string
  type: string
  planTier: string
  billingCycle: string
  amountLabel: string
  reference: string
  invoiceTitle: string | null
  taxNumber: string | null
  createdAt: string
}
export interface AdminSubRow {
  id: string
  name: string
  planTier: string
  billingCycle: string | null
  periodEnd: string | null
  daysLeft: number | null
}

const TIER_LABELS: Record<string, string> = { starter: "Başlangıç", pro: "Profesyonel", premium: "Premium" }
const CYCLE_LABELS: Record<string, string> = { monthly: "Aylık", yearly: "Yıllık" }

export function AdminBilling({
  orders,
  subscriptions,
  revenue,
}: {
  orders: AdminOrderRow[]
  subscriptions: AdminSubRow[]
  revenue: { activeCount: number; mrrLabel: string; monthLabel: string }
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Aktif abonelik" value={String(revenue.activeCount)} />
        <Stat label="MRR (aylık)" value={revenue.mrrLabel} />
        <Stat label="Bu ay tahsil" value={revenue.monthLabel} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Bekleyen Ödemeler</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bekleyen ödeme yok.</p>
        ) : (
          orders.map((o) => <OrderRow key={o.id} o={o} />)
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Abonelikler</h2>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aktif abonelik yok.</p>
        ) : (
          <div className="space-y-2">
            {subscriptions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm">
                <span className="font-medium text-foreground">{s.name}</span>
                <span className="text-muted-foreground">
                  {TIER_LABELS[s.planTier] ?? s.planTier}
                  {s.billingCycle && ` · ${CYCLE_LABELS[s.billingCycle] ?? s.billingCycle}`}
                  {s.periodEnd && ` · bitiş ${s.periodEnd}`}
                  {s.daysLeft != null && (
                    <span className={cn("ml-2 font-medium", s.daysLeft <= 7 ? "text-amber-600" : "text-foreground")}>{s.daysLeft} gün</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
    </div>
  )
}

function OrderRow({ o }: { o: AdminOrderRow }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("")
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error || "İşlem başarısız")
    })
  }
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{o.workshopName}</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px]">{TIER_LABELS[o.planTier] ?? o.planTier} · {CYCLE_LABELS[o.billingCycle] ?? o.billingCycle}</span>
            <span className="font-semibold text-foreground">{o.amountLabel}</span>
          </div>
          <p className="text-muted-foreground mt-1 inline-flex items-center gap-1">
            <Landmark className="size-3.5" /> Referans: <span className="font-mono text-foreground">{o.reference}</span>
          </p>
          <p className="text-muted-foreground">{o.invoiceTitle ?? "—"}{o.taxNumber ? ` · VKN ${o.taxNumber}` : ""}</p>
          {error && <p className="text-destructive mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <button disabled={pending} onClick={() => run(() => confirmBillingOrder(o.id))} className={cn(buttonVariants({ size: "sm" }), "gap-1")}>
            <Check className="size-3.5" /> Havale alındı
          </button>
          <button disabled={pending} onClick={() => run(() => cancelBillingOrder(o.id))} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}>
            <X className="size-3.5" /> İptal
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `admin/page.tsx`'te veri çek + render et.** `Promise.all` dizisine 2 sorgu daha ekle (`billingOrder.findMany` pending + `billingOrder.findMany` confirmed-this-month) ve abonelik için workshops select'ine alanlar ekle. `admin/page.tsx` değişiklikleri:

1. Import ekle (üst kısma):
```typescript
import { AdminBilling, type AdminOrderRow, type AdminSubRow } from "@/app/admin/admin-billing"
import { formatMinor } from "@/lib/billing/pricing"
```
2. `workshops` sorgusunun `select`'ine `billingCycle: true, currentPeriodEnd: true,` ekle.
3. `Promise.all([...])`'a iki sorgu ekle (yeni değişkenler `pendingOrders`, `monthOrders`):
```typescript
    prisma.billingOrder.findMany({
      where: { status: "pending_payment" },
      orderBy: { createdAt: "desc" },
      include: { workshop: { select: { name: true } } },
    }),
    prisma.billingOrder.findMany({
      where: { status: "confirmed", confirmedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      select: { amountMinor: true },
    }),
```
ve destructuring'i güncelle: `const [workshops, demoRequests, supportRequests, pendingOrders, monthOrders] = await Promise.all([...])`.
4. Satır map'lerinden sonra billing satırlarını + gelir hesabını ekle:
```typescript
  const orderRows: AdminOrderRow[] = pendingOrders.map((o) => {
    const snap = (o.billingSnapshot ?? {}) as { invoiceTitle?: string; taxNumber?: string }
    return {
      id: o.id,
      workshopName: o.workshop.name,
      type: o.type,
      planTier: o.planTier,
      billingCycle: o.billingCycle,
      amountLabel: formatMinor(o.amountMinor),
      reference: o.reference,
      invoiceTitle: snap.invoiceTitle ?? null,
      taxNumber: snap.taxNumber ?? null,
      createdAt: o.createdAt.toISOString(),
    }
  })

  const now = Date.now()
  const subscriptions: AdminSubRow[] = workshops
    .filter((w) => w.subscriptionStatus === "active" && w.currentPeriodEnd)
    .map((w) => {
      const end = w.currentPeriodEnd as Date
      return {
        id: w.id,
        name: w.name,
        planTier: w.planTier,
        billingCycle: w.billingCycle ?? null,
        periodEnd: end.toLocaleDateString("tr-TR"),
        daysLeft: Math.max(0, Math.ceil((end.getTime() - now) / 86_400_000)),
      }
    })

  // MRR: active subs normalized to monthly (yearly /12). Uses live catalog price.
  const monthRevenueMinor = monthOrders.reduce((sum, o) => sum + o.amountMinor, 0)
  const revenue = {
    activeCount: subscriptions.length,
    mrrLabel: formatMinor(
      workshops
        .filter((w) => w.subscriptionStatus === "active" && w.currentPeriodEnd)
        .reduce((sum, w) => {
          const minor = getPlanPriceMinor(w.planTier as PlanTier, (w.billingCycle ?? "monthly") as BillingCycle)
          return sum + (w.billingCycle === "yearly" ? Math.round(minor / 12) : minor)
        }, 0)
    ),
    monthLabel: formatMinor(monthRevenueMinor),
  }
```
Import'lara `getPlanPriceMinor` (`@/lib/billing/pricing`), `PlanTier` (`@/lib/plan`) ve `BillingCycle` (`@prisma/client`) ekle.
5. JSX'te "İş Yerleri" başlığından önce (veya `<AdminWorkshops>`'tan sonra uygun yere) bir bölüm ekle:
```tsx
        <div className="space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Faturalandırma</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Havaleleri teyit edin, abonelikleri ve geliri görün.</p>
          </div>
          <AdminBilling orders={orderRows} subscriptions={subscriptions} revenue={revenue} />
        </div>
```

- [ ] **Step 3: Typecheck + build.**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 4: Manuel QA.** `ADMIN_EMAILS`'e kendi e-postanı ekle (`.env`). `/admin` → "Faturalandırma" bölümünde public test siparişin "Bekleyen Ödemeler"de görünür → "Havale alındı" → workshop `active`+period; sipariş listeden düşer; Abonelikler'de görünür; gelir kartları güncellenir. Public hesapla `/login` artık çalışır.

- [ ] **Step 5: Commit.**

```bash
git add src/app/admin/admin-billing.tsx src/app/admin/page.tsx
git commit -m "feat(admin): billing inbox + subscriptions + revenue panel"
```

---

# FAZ 5 — Yaşam döngüsü & makbuz

### Task 15: Yenileme banner'ı (uygulama içi)

**Files:**
- Modify: `src/app/(app)/layout.tsx`

- [ ] **Step 1: `currentPeriodEnd` select'ini doğrula.** `layout.tsx`'teki `prisma.workshop.findUnique`'in `select`'inde `currentPeriodEnd: true,` zaten olmalı (Task 5 Step 8'de eklendi). Yoksa ekle.

- [ ] **Step 2: Banner ekle.** Trial banner bloğunun hemen altına:

```tsx
      {!plan.isTrialing && plan.subscriptionDaysLeft != null && plan.subscriptionDaysLeft <= 7 && (
        <div className="bg-amber-100 text-amber-800 text-xs sm:text-sm px-4 py-2 text-center">
          Aboneliğinizin bitmesine{" "}
          <span className="font-semibold">{plan.subscriptionDaysLeft} gün</span> kaldı.{" "}
          <Link href="/billing" className="font-semibold underline underline-offset-2">Yenile</Link>
        </div>
      )}
```

- [ ] **Step 3: Typecheck + build.**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/app/\(app\)/layout.tsx
git commit -m "feat(billing): renewal countdown banner for expiring subscriptions"
```

---

### Task 16: Abonelik makbuzu (HTML)

**Files:**
- Create: `src/lib/billing/receipt.ts`
- Create: `src/app/api/billing/orders/[id]/receipt/route.ts`

**Interfaces:**
- Consumes: `formatTRY` (`@/lib/format`), `escapeHtml` (`@/lib/html-escape`), `bakimxPdfFooterBar` (`@/lib/pdf/brand-footer`).
- Produces: `generateReceiptHtml(order, workshop): string`; auth'lu GET route → `text/html`.

- [ ] **Step 1: Makbuz HTML üreticisini yaz.** `src/lib/billing/receipt.ts`:

```typescript
import { formatTRY } from "@/lib/format"
import { escapeHtml } from "@/lib/html-escape"
import { bakimxPdfFooterBar } from "@/lib/pdf/brand-footer"

interface ReceiptData {
  reference: string
  planName: string
  cycleLabel: string
  amountMinor: number
  confirmedAt: Date | null
  workshopName: string
  invoiceTitle: string | null
  taxNumber: string | null
  taxOffice: string | null
  address: string | null
}

/** Simple, self-contained HTML receipt (makbuz). NOT a legal e-invoice — that
 *  is issued offline. VAT-included amount. */
export function generateReceiptHtml(d: ReceiptData): string {
  const tl = formatTRY(d.amountMinor / 100)
  const date = (d.confirmedAt ?? new Date()).toLocaleDateString("tr-TR")
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Makbuz ${escapeHtml(d.reference)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:640px;margin:24px auto;padding:0 16px}
  h1{font-size:20px;margin:0 0 4px} .muted{color:#64748b;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  td{padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px}
  td.r{text-align:right;font-weight:600}
  .total td{border-bottom:none;font-size:16px;font-weight:700;padding-top:12px}
</style></head><body>
  <h1>Ödeme Makbuzu</h1>
  <p class="muted">Referans: ${escapeHtml(d.reference)} · ${escapeHtml(date)}</p>
  <p class="muted">${escapeHtml(d.invoiceTitle || d.workshopName)}${d.taxNumber ? " · VKN/TCKN: " + escapeHtml(d.taxNumber) : ""}${d.taxOffice ? " · " + escapeHtml(d.taxOffice) : ""}</p>
  ${d.address ? `<p class="muted">${escapeHtml(d.address)}</p>` : ""}
  <table>
    <tr><td>${escapeHtml(d.planName)} paketi (${escapeHtml(d.cycleLabel)})</td><td class="r">${escapeHtml(tl)}</td></tr>
    <tr class="total"><td>Toplam (KDV dahil)</td><td class="r">${escapeHtml(tl)}</td></tr>
  </table>
  <p class="muted">Bu bir bilgilendirme makbuzudur; yasal fatura ayrıca düzenlenir.</p>
  ${bakimxPdfFooterBar(d.confirmedAt ?? new Date())}
</body></html>`
}
```
Not: `formatTRY`/`escapeHtml`/`bakimxPdfFooterBar` imzalarını ilgili dosyalardan doğrula (`formatTRY(amount: number)`, `escapeHtml(value: unknown)`, `bakimxPdfFooterBar(createdAt: Date | string)`).

- [ ] **Step 2: Auth'lu route'u yaz.** `src/app/api/billing/orders/[id]/receipt/route.ts`:

```typescript
import { notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { isAdminEmail } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { generateReceiptHtml } from "@/lib/billing/receipt"
import { getPlanPackage } from "@/lib/plans-catalog"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session?.userId) return new Response("Unauthorized", { status: 401 })

  const order = await prisma.billingOrder.findUnique({
    where: { id },
    include: { workshop: { select: { id: true, name: true, invoiceTitle: true, taxNumber: true, taxOffice: true, address: true } } },
  })
  if (!order || order.status !== "confirmed") notFound()

  // Ownership: the order's workshop, or a platform admin.
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, workshopId: true } })
  const isOwner = me?.workshopId === order.workshopId
  if (!isOwner && !isAdminEmail(me?.email)) notFound()

  const snap = (order.billingSnapshot ?? {}) as { invoiceTitle?: string; taxNumber?: string; taxOffice?: string; address?: string }
  const html = generateReceiptHtml({
    reference: order.reference,
    planName: getPlanPackage(order.planTier)?.name ?? order.planTier,
    cycleLabel: order.billingCycle === "monthly" ? "Aylık" : "Yıllık",
    amountMinor: order.amountMinor,
    confirmedAt: order.confirmedAt,
    workshopName: order.workshop.name,
    invoiceTitle: snap.invoiceTitle ?? order.workshop.invoiceTitle,
    taxNumber: snap.taxNumber ?? order.workshop.taxNumber,
    taxOffice: snap.taxOffice ?? order.workshop.taxOffice,
    address: snap.address ?? order.workshop.address,
  })
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}
```

- [ ] **Step 3: Typecheck + build.**

Run: `bun run typecheck && bun run build`
Expected: PASS.

- [ ] **Step 4: Manuel QA.** Onaylı bir siparişin id'siyle giriş yapmış owner olarak `/api/billing/orders/<id>/receipt` → makbuz HTML'i görünür; başka workshop kullanıcısı → 404.

- [ ] **Step 5: Commit.**

```bash
git add src/lib/billing/receipt.ts "src/app/api/billing/orders/[id]/receipt/route.ts"
git commit -m "feat(billing): HTML subscription receipt (makbuz) route"
```

---

### Task 17: `.env.example` dokümantasyonu + son doğrulama

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Havale değişkenlerini dokümante et.** `.env.example` sonuna ekle (gerçek `.env`'e DOKUNMA):

```bash
# --- Billing (manual/havale checkout v1) ---
# Shown on the checkout confirmation screen. No real card gateway yet.
BILLING_HAVALE_IBAN="TR00 0000 0000 0000 0000 0000 00"
BILLING_HAVALE_ACCOUNT_TITLE="BakımX Yazılım"
BILLING_HAVALE_BANK="Banka adı"
```

- [ ] **Step 2: Tüm test + lint + typecheck + build.**

Run: `bun test && bun run lint && bun run typecheck && bun run build`
Expected: hepsi PASS (billing testleri + plan testleri dahil).

- [ ] **Step 3: Commit.**

```bash
git add .env.example
git commit -m "docs(billing): document BILLING_HAVALE_* env vars"
```

---

## Kabul kriterleri (uçtan uca manuel QA)

1. **Public satın alma:** `/fiyatlar` → paket → `/satin-al` → form → "Siparişi oluştur" → onay (IBAN+referans+KDV-dahil tutar). DB'de workshop `pending` + `BillingOrder pending_payment`. `/login` → "Başvurunuz alındı" (giriş engelli).
2. **Admin teyit:** `/admin` → Faturalandırma → "Havale alındı" → workshop `active`, `currentPeriodEnd ≈ now+dönem`, sipariş `confirmed`. Public hesapla giriş artık başarılı. Makbuz route çalışır.
3. **Uygulama içi yükseltme:** trial workshop `/billing` → "Bu paketi seç" → `/billing/checkout` → sipariş; `/billing`'de bekleyen-ödeme banner'ı. Admin onaylar → plan güncellenir.
4. **Deneme bitişi:** trial süresi dolunca `<PlanLocked trial_expired>` → paketler → checkout → onay → erişim açılır.
5. **Abonelik bitişi:** `currentPeriodEnd` ≤ 7 gün → uygulama içi yenileme banner'ı; geçince `<PlanLocked subscription_expired>`; renewal order onayı → period uzar (erken yenilemede `periodStartFrom` ile kesilmez).
6. **İzolasyon:** uygulama içi sipariş client'tan `workshopId` ile değiştirilemez; başka workshop'un makbuzu 404; admin route'ları non-admin'e 404.
7. **Gelir:** `/admin` gelir kartları onaylı order'ları/aktif abonelikleri doğru yansıtır.
