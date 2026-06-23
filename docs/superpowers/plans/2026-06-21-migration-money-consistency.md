# BakımX v0.5.8 — Migration & Money Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a safe Prisma baseline-migration workflow and remove money-consistency risks (float rounding + non-atomic multi-write flows) without adding product features.

**Architecture:** Squash the broken incremental migration history into a single `0_init` baseline generated from the current schema; add epsilon-aware money helpers and apply them at calculation/comparison boundaries; wrap six critical multi-write flows in `prisma.$transaction` interactive callbacks; enforce per-workshop `workOrderNo` uniqueness with a DB unique index plus an in-transaction runtime guard.

**Tech Stack:** Next.js 16, Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`, `pg` Pool), PostgreSQL, TypeScript (strict), `bun` (package manager + built-in test runner).

## Global Constraints

- Package manager / runner: **bun** (`bun run …`, `bunx …`, `bun test`). Never npm/yarn/pnpm.
- Prisma 7 with driver adapter (`@prisma/adapter-pg`) — interactive transactions use the `prisma.$transaction(async (tx) => …)` callback form.
- Money fields stay **`Float`** — no `Decimal` conversion this release.
- **No destructive migrations.** Only `prisma migrate diff` (offline), `prisma validate`, `prisma generate` are run. `migrate deploy`/`resolve`/`reset` are documented, not executed.
- **No Docker** for local development. No local DB is spun up; DB-dependent flows are verified by typecheck/build + documented manual QA.
- Keep **tenant isolation**: every query filters by `workshopId` (and tx-scoped reads keep the same filter).
- User-facing strings remain **Turkish** (match existing copy).
- **Do NOT commit/tag/push** (user instruction). Each task ends at a verified checkpoint with a recorded proposed commit message; no `git commit` is run.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/money.ts` | Pure money helpers: round, sum, add/sub, epsilon compare | Create |
| `src/lib/money.test.ts` | Unit tests for money helpers (`bun test`) | Create |
| `src/lib/cashbox/status.test.ts` | Unit tests for payment-status/remaining logic | Create |
| `src/lib/totals.test.ts` | Unit tests for rounded order totals | Create |
| `tsconfig.json` | Exclude `*.test.ts` from tsc so typecheck/build stay green | Modify |
| `package.json` | Add `"test": "bun test"` script | Modify |
| `src/lib/totals.ts` | Round computed totals via money helpers | Modify |
| `src/lib/cashbox/status.ts` | Epsilon-aware status + rounded remaining | Modify |
| `prisma/schema.prisma` | Add `@@unique([workshopId, workOrderNo])` | Modify |
| `src/lib/work-order-number.ts` | Update deferred-constraint comment | Modify |
| `prisma/migrations/0_init/migration.sql` | Squashed baseline of full schema | Create |
| `prisma/migrations/2026*` (×4) | Partial migrations folded into baseline | Delete |
| `docs/DEPLOYMENT.md` | Deploy + baselining + dedupe procedures | Create |
| `src/app/app/cashbox/actions.ts` | Atomic payment create/cancel + recalc | Modify |
| `src/app/app/quotes/actions.ts` | Atomic quote→order (order + items) | Modify |
| `src/app/app/orders/actions.ts` | Atomic order create + tx-scoped workOrderNo | Modify |
| `src/app/app/appointments/actions.ts` | Atomic appointment→order | Modify |
| `src/app/api/smart-capture/confirm/route.ts` | Atomic OCR confirm (customer/vehicle/log) | Modify |
| `src/app/app/intakes/approval-actions.ts` | Atomic approval request + OTP verify | Modify |

**Testing note:** Pure logic (money helpers, totals, payment status) is covered by `bun test` (zero new dependencies — bun ships a Jest-like runner). DB/transaction flows cannot be unit-tested locally (no DB; Docker forbidden), so they are gated by `bun run typecheck` + `bun run build` and the manual-QA checklist in Task 11.

---

### Task 1: Money helpers (`src/lib/money.ts`)

**Files:**
- Create: `src/lib/money.ts`
- Test: `src/lib/money.test.ts`
- Modify: `tsconfig.json`, `package.json`

**Interfaces:**
- Produces:
  - `MONEY_EPSILON: number` (= `0.005`)
  - `roundMoney(value: number): number` — half-up to 2 decimals, float-error safe
  - `sumMoney(values: number[]): number`
  - `addMoney(a: number, b: number): number`
  - `subMoney(a: number, b: number): number`
  - `moneyEquals(a: number, b: number, epsilon?: number): boolean`
  - `moneyGte(a: number, b: number, epsilon?: number): boolean`

- [ ] **Step 1: Exclude test files from TypeScript build**

In `tsconfig.json`, change the `exclude` line:

```json
  "exclude": ["node_modules", "**/*.test.ts"]
```

(Keeps `bun run typecheck` and `bun run build` green — bun's runtime types for `bun:test` are not installed.)

- [ ] **Step 2: Add the test script**

In `package.json` `scripts`, add (after `"db:studio"`):

```json
    "test": "bun test"
```

- [ ] **Step 3: Write the failing test**

Create `src/lib/money.test.ts`:

```ts
import { expect, test } from "bun:test"
import {
  roundMoney,
  sumMoney,
  addMoney,
  subMoney,
  moneyEquals,
  moneyGte,
} from "@/lib/money"

test("roundMoney fixes float drift to 2 decimals", () => {
  expect(roundMoney(0.1 + 0.2)).toBe(0.3)
  expect(roundMoney(10.004)).toBe(10)
  expect(roundMoney(10.006)).toBe(10.01)
})

test("sumMoney aggregates without drift", () => {
  expect(sumMoney([0.1, 0.2])).toBe(0.3)
  expect(sumMoney([100.1, 200.2, 300.3])).toBe(600.6)
  expect(sumMoney([])).toBe(0)
})

test("addMoney/subMoney round results", () => {
  expect(addMoney(0.1, 0.2)).toBe(0.3)
  expect(subMoney(0.3, 0.1)).toBe(0.2)
})

test("moneyEquals tolerates sub-cent drift", () => {
  expect(moneyEquals(0.1 + 0.2, 0.3)).toBe(true)
  expect(moneyEquals(100, 100.004)).toBe(true)
  expect(moneyEquals(100, 100.01)).toBe(false)
})

test("moneyGte tolerates sub-cent drift", () => {
  expect(moneyGte(100, 100)).toBe(true)
  expect(moneyGte(99.999, 100)).toBe(true)
  expect(moneyGte(99.9, 100)).toBe(false)
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun test src/lib/money.test.ts`
Expected: FAIL — `Cannot find module '@/lib/money'` (or "export not found").

- [ ] **Step 5: Implement the helpers**

Create `src/lib/money.ts`:

```ts
/**
 * Money helpers for BakımX.
 *
 * Money is stored as Float (Postgres double precision). These helpers contain
 * the float drift at calculation and comparison boundaries: round to 2 decimals
 * (Turkish Lira / kuruş) and compare with a half-kuruş epsilon. They do NOT
 * change the database type — that (Decimal) is a separate, later migration.
 */

/** Half a kuruş — the tolerance for money comparisons. */
export const MONEY_EPSILON = 0.005

/** Round to 2 decimals (half-up), guarding against binary float error. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Sum a list and round once at the end. Non-finite entries are ignored. */
export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0))
}

/** Rounded a + b. */
export function addMoney(a: number, b: number): number {
  return roundMoney(a + b)
}

/** Rounded a - b. */
export function subMoney(a: number, b: number): number {
  return roundMoney(a - b)
}

/** True when a and b are equal within epsilon. */
export function moneyEquals(a: number, b: number, epsilon: number = MONEY_EPSILON): boolean {
  return Math.abs(a - b) < epsilon
}

/** True when a >= b within epsilon (a is at least b, allowing sub-cent drift). */
export function moneyGte(a: number, b: number, epsilon: number = MONEY_EPSILON): boolean {
  return a >= b - epsilon
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test src/lib/money.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Confirm typecheck still green**

Run: `bun run typecheck`
Expected: no errors (test file excluded).

- [ ] **Step 8: Checkpoint (do NOT commit)**

Verify Steps 6–7 passed. Record proposed message (for the eventual single commit): `feat(money): add epsilon-aware money helpers`.

---

### Task 2: Apply money helpers to totals & payment status

**Files:**
- Modify: `src/lib/totals.ts`, `src/lib/cashbox/status.ts`
- Test: `src/lib/cashbox/status.test.ts`, `src/lib/totals.test.ts`

**Interfaces:**
- Consumes: `roundMoney`, `sumMoney`, `moneyEquals`, `moneyGte` from `@/lib/money` (Task 1).
- Produces: unchanged public signatures of `calculateOrderTotals`, `calculateOrderTotalsFromMinimal`, `calculateMinimalTotal`, `calculateGroupTotal`, `computePaymentStatus`, `computeRemainingAmount` — values are now rounded/epsilon-correct.

- [ ] **Step 1: Write failing tests**

Create `src/lib/cashbox/status.test.ts`:

```ts
import { expect, test } from "bun:test"
import { computePaymentStatus, computeRemainingAmount } from "@/lib/cashbox/status"

test("exact payment reads as paid despite float drift", () => {
  expect(computePaymentStatus(0.3, 0.1 + 0.2)).toBe("paid")
  expect(computePaymentStatus(100, 100)).toBe("paid")
})

test("underpayment is partial", () => {
  expect(computePaymentStatus(100, 40)).toBe("partial")
})

test("no payment is unpaid", () => {
  expect(computePaymentStatus(100, 0)).toBe("unpaid")
})

test("over a cent is overpaid", () => {
  expect(computePaymentStatus(100, 100.5)).toBe("overpaid")
})

test("remaining clamps and rounds", () => {
  expect(computeRemainingAmount(0.3, 0.1 + 0.2)).toBe(0)
  expect(computeRemainingAmount(100, 40)).toBe(60)
  expect(computeRemainingAmount(100, 150)).toBe(0)
})
```

Create `src/lib/totals.test.ts`:

```ts
import { expect, test } from "bun:test"
import { calculateOrderTotals } from "@/lib/totals"

test("grandTotal rounds to 2 decimals with tax", () => {
  const totals = calculateOrderTotals(
    [{ type: "labor", name: "x", quantity: 3, unitPrice: 33.33, totalPrice: null }],
    { taxRate: 20 }
  )
  expect(totals.subtotal).toBe(99.99)
  expect(totals.taxAmount).toBe(20)
  expect(totals.grandTotal).toBe(119.99)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/lib/cashbox/status.test.ts src/lib/totals.test.ts`
Expected: FAIL — `computePaymentStatus(0.3, 0.1 + 0.2)` returns `"partial"`; `taxAmount`/`grandTotal` are unrounded (`19.998…`, `119.988…`).

- [ ] **Step 3: Update `computePaymentStatus` / `computeRemainingAmount`**

In `src/lib/cashbox/status.ts`, add the import at the top (after the existing `PAYMENT_STATUS` import):

```ts
import { moneyEquals, moneyGte, roundMoney } from "@/lib/money"
```

Replace the two functions at the bottom of the file:

```ts
export function computePaymentStatus(grandTotal: number, paidAmount: number): PaymentStatusKey {
  if (paidAmount <= 0) return "unpaid"
  if (moneyGte(paidAmount, grandTotal) && grandTotal > 0) {
    return moneyEquals(paidAmount, grandTotal) ? "paid" : "overpaid"
  }
  return "partial"
}

export function computeRemainingAmount(grandTotal: number, paidAmount: number): number {
  return Math.max(0, roundMoney(grandTotal - paidAmount))
}
```

- [ ] **Step 4: Round computed totals**

In `src/lib/totals.ts`, add the import at the top (after the `formatTRY` import):

```ts
import { roundMoney, sumMoney } from "@/lib/money"
```

Replace `calculateMinimalTotal`:

```ts
export function calculateMinimalTotal(items: MinimalLineItem[]): number {
  return sumMoney(
    items.map((item) => {
      if (item.totalPrice != null && item.totalPrice > 0) return item.totalPrice
      if (item.unitPrice != null && item.unitPrice > 0) return item.unitPrice * item.quantity
      return 0
    })
  )
}
```

In `calculateOrderTotalsFromMinimal`, replace the math block (keep the `hasAnyPrice` line unchanged):

```ts
  const subtotal = calculateMinimalTotal(items)
  const discountAmount = roundMoney(Math.max(0, options.discountAmount ?? 0))
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const taxRate = options.taxRate ?? 0
  const taxAmount = roundMoney((afterDiscount * taxRate) / 100)
  const grandTotal = roundMoney(afterDiscount + taxAmount)
```

Replace `calculateGroupTotal`:

```ts
export function calculateGroupTotal(items: OrderLineItem[], type?: string): number {
  const filtered = type ? items.filter((i) => i.type === type) : items
  return sumMoney(
    filtered.map((item) => {
      if (item.totalPrice != null && item.totalPrice > 0) return item.totalPrice
      if (item.unitPrice != null && item.unitPrice > 0) return item.unitPrice * item.quantity
      return 0
    })
  )
}
```

In `calculateOrderTotals`, replace the math block (between `laborTotal` and the `return`):

```ts
  const partsTotal = calculateGroupTotal(items, "part")
  const laborTotal = calculateGroupTotal(items, "labor")
  const subtotal = roundMoney(partsTotal + laborTotal)
  const discountAmount = roundMoney(Math.max(0, options.discountAmount ?? 0))
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const taxRate = options.taxRate ?? 0
  const taxAmount = roundMoney((afterDiscount * taxRate) / 100)
  const grandTotal = roundMoney(afterDiscount + taxAmount)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/lib/cashbox/status.test.ts src/lib/totals.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 7: Checkpoint (do NOT commit)**

Proposed message: `fix(money): round totals and use epsilon-aware payment status`.

---

### Task 3: workOrderNo unique constraint (schema)

**Files:**
- Modify: `prisma/schema.prisma` (model `ServiceOrder`), `src/lib/work-order-number.ts`

**Interfaces:**
- Produces: DB unique index `ServiceOrder_workshopId_workOrderNo_key` (consumed by the `0_init` baseline in Task 4 and the runtime guards in Tasks 7–8).

- [ ] **Step 1: Add the composite unique index**

In `prisma/schema.prisma`, in `model ServiceOrder`, add to the index block (after `@@index([workshopId, assignedTechnicianId])`, before the closing `}`):

```prisma
  @@unique([workshopId, workOrderNo])
```

(Postgres treats `NULL` as distinct in unique indexes, so existing rows with `workOrderNo = null` do not conflict.)

- [ ] **Step 2: Update the deferred-constraint comment**

In `src/lib/work-order-number.ts`, replace the `NOTE (deferred migration): …` paragraph inside the `generateUniqueWorkOrderNo` doc comment with:

```ts
 * The durable guarantee is the DB constraint `@@unique([workshopId, workOrderNo])`
 * on ServiceOrder (added in v0.5.8). This runtime check is kept as defense in
 * depth and to surface a friendly error before hitting a P2002. Postgres treats
 * NULL workOrderNo values as distinct, so legacy null rows are unaffected; any
 * pre-existing non-null duplicates must be cleaned before baselining an existing
 * database (see docs/DEPLOYMENT.md).
```

- [ ] **Step 3: Validate the schema**

Run: `bunx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`.

- [ ] **Step 4: Regenerate the client**

Run: `bunx prisma generate`
Expected: success (client reflects the new unique input type).

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 6: Checkpoint (do NOT commit)**

Proposed message: `feat(orders): add per-workshop workOrderNo unique constraint`.

---

### Task 4: Squash to `0_init` baseline migration

**Files:**
- Delete: the 4 directories under `prisma/migrations/` (`20260610120000_add_collection_payment`, `20260612140000_add_vehicle_plate_unique`, `20260612210000_add_photo_phase_and_missing_tables`, `20260613200000_add_technician_workspace`)
- Create: `prisma/migrations/0_init/migration.sql`
- Keep: `prisma/migrations/migration_lock.toml`

**Interfaces:**
- Consumes: schema with the new `@@unique` (Task 3).
- Produces: a single self-contained baseline that builds the full schema on a fresh DB.

- [ ] **Step 1: Remove the partial migrations**

Run:
```bash
rm -rf \
  prisma/migrations/20260610120000_add_collection_payment \
  prisma/migrations/20260612140000_add_vehicle_plate_unique \
  prisma/migrations/20260612210000_add_photo_phase_and_missing_tables \
  prisma/migrations/20260613200000_add_technician_workspace
```

- [ ] **Step 2: Create the baseline directory**

Run: `mkdir -p prisma/migrations/0_init`

- [ ] **Step 3: Generate the baseline SQL (offline)**

Run:
```bash
bunx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
```
Expected: file written, no DB connection attempted (`--from-empty`/`--to-schema-datamodel` are offline sources).

- [ ] **Step 4: Verify the baseline is complete**

Run:
```bash
grep -c 'CREATE TABLE' prisma/migrations/0_init/migration.sql
grep -q 'CREATE TABLE "Workshop"' prisma/migrations/0_init/migration.sql && echo "Workshop OK"
grep -q 'CREATE TABLE "ServiceOrder"' prisma/migrations/0_init/migration.sql && echo "ServiceOrder OK"
grep -q 'ServiceOrder_workshopId_workOrderNo_key' prisma/migrations/0_init/migration.sql && echo "workOrderNo unique OK"
```
Expected: count ≈ 33 (one per model), and all three `OK` lines print. If the unique-index line is missing, Task 3 Step 1 was not applied — fix and regenerate.

- [ ] **Step 5: Confirm only the baseline remains**

Run: `ls prisma/migrations`
Expected: `0_init` and `migration_lock.toml` only.

- [ ] **Step 6: Validate**

Run: `bunx prisma validate`
Expected: valid.

- [ ] **Step 7: Checkpoint (do NOT commit)**

Proposed message: `chore(prisma): squash migrations into 0_init baseline`.

---

### Task 5: Deploy documentation (`docs/DEPLOYMENT.md`)

**Files:**
- Create: `docs/DEPLOYMENT.md`

- [ ] **Step 1: Write the document**

Create `docs/DEPLOYMENT.md`:

````markdown
# BakımX — Database Migration & Deploy Guide

BakımX uses **Prisma migrations** as the single source of truth for the database
schema. The migration history was squashed into one baseline, `0_init`
(v0.5.8), which creates the entire schema from empty.

> ## ⚠️ CRITICAL WARNING — read before deploying
>
> **NEVER run `prisma migrate deploy` against a database that already contains
> BakımX tables.** This includes any database that was previously built with
> `prisma db push` or with the old partial migrations (pre-v0.5.8).
>
> `0_init` issues `CREATE TABLE` for **every** model. Against a database that
> already has those tables it fails with `relation "..." already exists` and
> leaves the `_prisma_migrations` history half-written, which is painful to
> recover. Such databases **must be baselined first** (see below).

## Prerequisites

- `DATABASE_URL` points at the target Postgres database (direct connection, not
  a pooled/transaction-mode URL that forbids DDL).
- Package manager is **bun**.

## Scenario A — Fresh database (production target)

The database is empty (no BakımX tables).

```bash
bunx prisma migrate deploy
```

This applies `0_init` (and any future migrations). Then seed if desired:

```bash
bun run db:seed
```

## Scenario B — Existing database from `db push` or old partial migrations

The database already has BakımX tables but no valid migration history. **Do not**
run `migrate deploy` yet — baseline it first.

1. **Clean duplicate work-order numbers** (required before the
   `@@unique([workshopId, workOrderNo])` index can exist). Detect them:

   ```sql
   SELECT "workshopId", "workOrderNo", COUNT(*)
   FROM "ServiceOrder"
   WHERE "workOrderNo" IS NOT NULL
   GROUP BY "workshopId", "workOrderNo"
   HAVING COUNT(*) > 1;
   ```

   If any rows are returned, regenerate the colliding numbers (e.g. set the
   duplicates' `workOrderNo` to `NULL`, or to a fresh unique `BX…` value) until
   the query returns nothing. Rows with `workOrderNo IS NULL` are fine —
   Postgres treats NULLs as distinct.

2. **Register the baseline as already applied** (does NOT run its SQL):

   ```bash
   bunx prisma migrate resolve --applied 0_init
   ```

3. **Apply schema drift** the resolve did not run — notably the new unique index
   if the existing DB predates it:

   ```bash
   bunx prisma db push
   ```

   `db push` reports if duplicate `workOrderNo`s still block the index; fix them
   (step 1) and re-run. From here on, treat migrations as the source of truth.

   *(Dev-only alternative: `bunx prisma migrate reset` drops all data, re-applies
   `0_init`, and re-seeds — only on a database you can safely wipe.)*

## Adding future schema changes

1. Edit `prisma/schema.prisma`.
2. Create the migration locally:
   ```bash
   bunx prisma migrate dev --name <short_change_name>
   ```
3. Commit the generated `prisma/migrations/<timestamp>_<name>/` folder.
4. On the server: `bunx prisma migrate deploy`.

## Rules

- After baselining, **never** use `prisma db push` as the production change
  mechanism — it bypasses migration history. `0_init` + incremental migrations
  are the source of truth.
- Never edit an already-applied migration; add a new one.
- `prisma migrate deploy` is the only migrate command run automatically in
  production. `reset` is destructive and dev-only.
````

- [ ] **Step 2: Sanity-check the doc**

Run: `grep -q 'CRITICAL WARNING' docs/DEPLOYMENT.md && grep -q 'migrate resolve --applied 0_init' docs/DEPLOYMENT.md && echo OK`
Expected: `OK`.

- [ ] **Step 3: Checkpoint (do NOT commit)**

Proposed message: `docs: add deployment & migration baselining guide`.

---

### Task 6: Atomic payment create/cancel + recalc (cashbox)

**Files:**
- Modify: `src/app/app/cashbox/actions.ts`

**Interfaces:**
- Consumes: `sumMoney` (Task 1), `calculateOrderTotalsFromMinimal` (existing), `computePaymentStatus`/`computeRemainingAmount` (Task 2).
- Produces: private `recalcOrderPayment(tx, serviceOrderId, workshopId)` returning `{ statusChanged: boolean; newStatus: string } | null` — used inside the create/cancel transactions.

- [ ] **Step 1: Add imports**

In `src/app/app/cashbox/actions.ts`, add after the existing `calculateOrderTotalsFromMinimal` import:

```ts
import { sumMoney } from "@/lib/money"
import type { Prisma } from "@prisma/client"
```

- [ ] **Step 2: Replace `updateOrderPaymentStatus` with a tx-aware recalc**

Replace the whole `updateOrderPaymentStatus` function with:

```ts
async function recalcOrderPayment(
  tx: Prisma.TransactionClient,
  serviceOrderId: string,
  workshopId: string
): Promise<{ statusChanged: boolean; newStatus: string } | null> {
  const order = await tx.serviceOrder.findFirst({
    where: { id: serviceOrderId, workshopId },
    include: { items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } } },
  })
  if (!order) return null

  const totals = calculateOrderTotalsFromMinimal(order.items, {
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
  })

  const collections = await tx.collectionPayment.findMany({
    where: { serviceOrderId, workshopId, status: "completed" },
  })

  const paidAmount = sumMoney(collections.map((c) => c.amount))
  const newPaymentStatus = computePaymentStatus(totals.grandTotal, paidAmount)
  const remainingAmount = computeRemainingAmount(totals.grandTotal, paidAmount)
  const lastPaymentAt =
    collections.length > 0
      ? collections.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())[0].paymentDate
      : null

  await tx.serviceOrder.updateMany({
    where: { id: serviceOrderId, workshopId },
    data: {
      paymentStatus: newPaymentStatus as import("@prisma/client").PaymentStatus,
      paidAmount,
      remainingAmount,
      lastPaymentAt,
    },
  })

  return { statusChanged: order.paymentStatus !== newPaymentStatus, newStatus: newPaymentStatus }
}
```

- [ ] **Step 3: Make payment creation atomic**

In `createCollectionAction`, replace the block from `const collection = await prisma.collectionPayment.create({…})` through the `if (data.serviceOrderId) { await updateOrderPaymentStatus(...) }` call with:

```ts
  const { collection, recalc } = await prisma.$transaction(async (tx) => {
    const created = await tx.collectionPayment.create({
      data: {
        workshopId: user.workshopId,
        customerId: data.customerId,
        serviceOrderId: data.serviceOrderId || null,
        quoteId: data.quoteId || null,
        amount: data.amount,
        method: data.method as import("@prisma/client").PaymentMethod,
        status: "completed",
        paymentDate,
        referenceNo: data.referenceNo || null,
        note: data.note || null,
        createdByUserId: user.id,
      },
    })

    const recalcResult = data.serviceOrderId
      ? await recalcOrderPayment(tx, data.serviceOrderId, user.workshopId)
      : null

    return { collection: created, recalc: recalcResult }
  })

  if (recalc?.statusChanged) {
    await AuditLogAction(
      user.workshopId,
      undefined,
      "ServiceOrder",
      data.serviceOrderId,
      `payment_status_changed_to_${recalc.newStatus}`
    )
  }
```

(The existing `AuditLogAction(... "collection_created")` call and all `revalidatePath` calls below stay unchanged.)

- [ ] **Step 4: Make payment cancel atomic**

In `cancelCollectionAction`, replace the block from `await prisma.collectionPayment.updateMany({…})` through the `if (collection.serviceOrderId) { await updateOrderPaymentStatus(...) }` call with:

```ts
  const recalc = await prisma.$transaction(async (tx) => {
    await tx.collectionPayment.updateMany({
      where: { id: collectionId, workshopId: user.workshopId },
      data: {
        status: "cancelled",
        cancellationReason,
      },
    })

    return collection.serviceOrderId
      ? await recalcOrderPayment(tx, collection.serviceOrderId, user.workshopId)
      : null
  })

  if (recalc?.statusChanged && collection.serviceOrderId) {
    await AuditLogAction(
      user.workshopId,
      undefined,
      "ServiceOrder",
      collection.serviceOrderId,
      `payment_status_changed_to_${recalc.newStatus}`
    )
  }
```

(The existing `AuditLogAction(... "collection_cancelled")` and `revalidatePath` calls below stay unchanged.)

- [ ] **Step 5: Update the `getCustomerOrdersForPayment` paid-sum (consistency)**

In `getCustomerOrdersForPayment`, the paid map sums `c.amount` with `+`. Leave the per-order map building as-is, but for the displayed `paid`, round it:

```ts
      const paid = roundMoney(paidByOrder.get(order.id) || order.paidAmount || 0)
      const remaining = Math.max(0, roundMoney(totals.grandTotal - paid))
```

Add `roundMoney` to the money import at the top:

```ts
import { roundMoney, sumMoney } from "@/lib/money"
```

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 7: Checkpoint (do NOT commit)**

Proposed message: `fix(cashbox): make payment create/cancel + recalc atomic`.

---

### Task 7: Atomic quote → order (order + items)

**Files:**
- Modify: `src/app/app/quotes/actions.ts`

**Interfaces:**
- Consumes: `generateUniqueWorkOrderNo` (existing) with a tx-scoped `isTaken`.

- [ ] **Step 1: Wrap intake/order/items/quote writes in a transaction**

In `convertQuoteToWorkOrderAction`, replace the block that starts at `const intake = await prisma.vehicleIntakeForm.create({…})` and runs through the `for (const item of quote.items) {…}` loop and the trailing `await prisma.quote.update({…})` — i.e. everything from intake creation to the quote update — with:

```ts
  const order = await prisma.$transaction(async (tx) => {
    const intake = await tx.vehicleIntakeForm.create({
      data: {
        workshopId,
        customerId: quote.customerId,
        vehicleId: resolvedVehicleId,
        customerComplaint: quote.customerRequest || "Tekliften dönüştürüldü",
        internalNote: quote.internalNote || undefined,
        status: "draft",
      },
    })

    const workOrderNo = await generateUniqueWorkOrderNo((candidate) =>
      tx.serviceOrder
        .findFirst({ where: { workshopId, workOrderNo: candidate }, select: { id: true } })
        .then((clash) => clash !== null)
    )

    const createdOrder = await tx.serviceOrder.create({
      data: {
        workshopId,
        intakeFormId: intake.id,
        workOrderNo,
        status: "draft",
        discountAmount: quote.discountAmount,
        taxRate: quote.taxRate,
        notes: `${quote.customerRequest || ""}\n\nTeklif No: ${formatQuoteNo(quote)}`.trim(),
      },
    })

    for (const item of quote.items) {
      await tx.serviceOrderItem.create({
        data: {
          workshopId,
          serviceOrderId: createdOrder.id,
          type: item.type === "part" ? "part" : "labor",
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          note: item.note,
        },
      })
    }

    await tx.quote.update({
      where: { id: quoteId },
      data: { status: "converted", convertedServiceOrderId: createdOrder.id },
    })

    return createdOrder
  })
```

Then update the two audit calls and the return to use `order.id` (they already reference `order.id` / `order.id`). Verify the lines below read:

```ts
  await AuditLogAction(workshopId, user.id, "Quote", quoteId, "quote_converted_to_work_order")
  await AuditLogAction(workshopId, user.id, "ServiceOrder", order.id, "service_order_created_from_quote")
  revalidatePath(`/app/quotes/${quoteId}`)
  revalidatePath("/app/quotes")
  revalidatePath("/app/orders")
  return { success: true, orderId: order.id }
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Checkpoint (do NOT commit)**

Proposed message: `fix(quotes): atomic quote→order conversion with items`.

---

### Task 8: Atomic order creation + tx-scoped workOrderNo (orders, appointments)

**Files:**
- Modify: `src/app/app/orders/actions.ts`, `src/app/app/appointments/actions.ts`

- [ ] **Step 1: Orders — wrap workOrderNo + create in a transaction**

In `src/app/app/orders/actions.ts` `createServiceOrderAction`, replace the block:

```ts
  const workOrderNo = await generateUniqueWorkOrderNo((candidate) =>
    prisma.serviceOrder
      .findFirst({
        where: { workshopId: user.workshopId, workOrderNo: candidate },
        select: { id: true },
      })
      .then((clash) => clash !== null)
  )

  const order = await prisma.serviceOrder.create({
    data: {
      workshopId: user.workshopId,
      intakeFormId,
      workOrderNo,
      status: "draft",
    },
  })
```

with:

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

- [ ] **Step 2: Appointments — wrap intake/workOrderNo/order/appointment in a transaction**

In `src/app/app/appointments/actions.ts`, replace the block from `const intake = await prisma.vehicleIntakeForm.create({…})` (the conversion intake, around line 139) through `await prisma.appointment.update({…})` with:

```ts
  const order = await prisma.$transaction(async (tx) => {
    const intake = await tx.vehicleIntakeForm.create({
      data: {
        workshopId,
        customerId: appointment.customerId,
        vehicleId: resolvedVehicleId,
        customerComplaint: appointment.customerRequest || "Randevudan dönüştürüldü",
        internalNote: appointment.internalNote || undefined,
        status: "draft",
      },
    })

    const workOrderNo = await generateUniqueWorkOrderNo((candidate) =>
      tx.serviceOrder
        .findFirst({ where: { workshopId, workOrderNo: candidate }, select: { id: true } })
        .then((clash) => clash !== null)
    )

    const createdOrder = await tx.serviceOrder.create({
      data: {
        workshopId,
        intakeFormId: intake.id,
        workOrderNo,
        status: "draft",
        notes: appointment.customerRequest || "Randevudan dönüştürüldü",
      },
    })

    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "converted", convertedServiceOrderId: createdOrder.id },
    })

    return createdOrder
  })
```

(The `AuditLogAction` / `revalidatePath` / `return { success: true, orderId: order.id }` lines below stay unchanged — they already reference `order.id`.)

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Checkpoint (do NOT commit)**

Proposed message: `fix(orders): atomic order creation with tx-scoped workOrderNo`.

---

### Task 9: Atomic OCR confirm (customer + vehicle + ocrLog)

**Files:**
- Modify: `src/app/api/smart-capture/confirm/route.ts`

**Interfaces:**
- Consumes: existing reads (plate/VIN conflict detection) stay before the transaction; only writes move inside.

- [ ] **Step 1: Add the Prisma type import**

At the top of `src/app/api/smart-capture/confirm/route.ts`, change the type import line:

```ts
import type { Customer, Prisma, Vehicle } from "@prisma/client"
```

- [ ] **Step 2: Wrap the customer/vehicle/ocrLog writes in a transaction**

Replace the section from `let customer: Customer | null = …` through the `await prisma.ocrLog.update({…})` call (i.e. the customer resolve/create, vehicle update/create with its P2002 catch, and the ocrLog update) with the following. Audit logging moves out of the transaction and runs after commit.

```ts
    const seedCustomer: Customer | null =
      existingVehicle && normalizePhone(existingVehicle.customer.phone) === phone
        ? existingVehicle.customer
        : null

    let result: {
      customer: Customer
      vehicle: Vehicle
      customerCreated: boolean
      vehicleCreated: boolean
      vehicleCustomerChanged: boolean
    }

    try {
      result = await prisma.$transaction(async (tx) => {
        let customer = seedCustomer
        let customerCreated = false
        let vehicleCreated = false
        let vehicleCustomerChanged = false

        if (!customer) {
          customer = await tx.customer.findFirst({
            where: { workshopId: user.workshopId, phone },
          })

          if (!customer) {
            customer = await tx.customer.create({
              data: {
                workshopId: user.workshopId,
                type: "individual",
                firstName: ownerName,
                lastName: ownerSurname,
                fullName: `${ownerName} ${ownerSurname}`.trim(),
                phone,
                source: "walk_in",
                notes: "Ruhsat okuma ile oluşturuldu.",
              },
            })
            customerCreated = true
          }
        }

        let vehicle: Vehicle
        if (existingVehicle) {
          const updateData: Prisma.VehicleUpdateInput = { brand, model, plate }
          if (existingVehicle.customerId !== customer.id) {
            updateData.customer = { connect: { id: customer.id } }
            vehicleCustomerChanged = true
          }
          if (vin) updateData.vin = vin
          if (vehicleType) updateData.vehicleType = vehicleType
          if (modelYear) updateData.modelYear = modelYear
          if (engineNo) updateData.engineNo = engineNo
          if (vin && vin.length === 17) updateData.vinConfirmed = true

          vehicle = await tx.vehicle.update({
            where: { id: existingVehicle.id },
            data: updateData,
          })
        } else {
          vehicle = await tx.vehicle.create({
            data: {
              workshopId: user.workshopId,
              customerId: customer.id,
              plate,
              brand,
              model,
              vehicleType: vehicleType || null,
              modelYear,
              vin: vin || null,
              vinConfirmed: vin.length === 17,
              engineNo: engineNo || null,
            },
          })
          vehicleCreated = true
        }

        await tx.ocrLog.update({
          where: { id: ocrLogId },
          data: {
            confirmedJson: JSON.stringify(confirmedFields),
            confirmedAt: new Date(),
            customerId: customer.id,
            vehicleId: vehicle.id,
            userId: user.id,
          },
        })

        return { customer, vehicle, customerCreated, vehicleCreated, vehicleCustomerChanged }
      })
    } catch (createError: unknown) {
      if (
        createError instanceof Error &&
        (createError.message.includes("Unique constraint") ||
          createError.message.includes("UniqueConstraint"))
      ) {
        return NextResponse.json(
          {
            error:
              "Bu plaka ile kayıtlı bir araç zaten var. " +
              "Lütfen sayfayı yenileyip tekrar deneyin veya Araçlar bölümünden düzenleyin.",
          },
          { status: 409 }
        )
      }
      throw createError
    }

    const { customer, vehicle, customerCreated, vehicleCreated, vehicleCustomerChanged } = result

    if (customerCreated) {
      await AuditLogAction(user.workshopId, user.id, "Customer", customer.id, "customer_created_via_ocr")
    }
    await AuditLogAction(
      user.workshopId,
      user.id,
      "Vehicle",
      vehicle.id,
      vehicleCreated ? "vehicle_created_via_ocr" : "vehicle_updated_via_ocr"
    )
    await AuditLogAction(
      user.workshopId,
      user.id,
      "OcrLog",
      ocrLogId,
      "ocr_confirmed",
      JSON.stringify({ vehicleId: vehicle.id, customerId: customer.id })
    )
```

Notes for the implementer:
- The old code used `include: { customer: true }` on the vehicle create/update; that include is removed (the transaction returns the plain `Vehicle`, and the response below uses `customer`/`vehicle` directly). The subsequent response-building code (`customerName`, `vehicleLabel`, the `NextResponse.json({...})`) is unchanged and already references `customer` and `vehicle`.
- The standalone `await AuditLogAction(... "ocr_confirmed")` that previously sat after the `ocrLog.update` is now the one added above — make sure there is no duplicate left behind.

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors. (If `Vehicle`/`Customer`/`Prisma` are reported unused or missing, confirm Step 1's import.)

- [ ] **Step 4: Checkpoint (do NOT commit)**

Proposed message: `fix(ocr): make smart-capture confirm atomic`.

---

### Task 10: Atomic intake approval request + OTP verify

**Files:**
- Modify: `src/app/app/intakes/approval-actions.ts`

- [ ] **Step 1: Make approval request atomic**

In `requestApprovalAction`, replace the block:

```ts
  const approval = await prisma.approvalRequest.create({
    data: {
      workshopId: user.workshopId,
      intakeFormId,
      phone: intake.customer.phone,
      otpCode,
      approvalTextVersion,
      status: "pending",
    },
  })

  await prisma.vehicleIntakeForm.updateMany({
    where: { id: intakeFormId, workshopId: user.workshopId },
    data: { status: "waiting_approval", approvalTextVersion },
  })
```

with:

```ts
  const approval = await prisma.$transaction(async (tx) => {
    const created = await tx.approvalRequest.create({
      data: {
        workshopId: user.workshopId,
        intakeFormId,
        phone: intake.customer.phone,
        otpCode,
        approvalTextVersion,
        status: "pending",
      },
    })

    await tx.vehicleIntakeForm.updateMany({
      where: { id: intakeFormId, workshopId: user.workshopId },
      data: { status: "waiting_approval", approvalTextVersion },
    })

    return created
  })
```

(Audit, `notifyIntakeApproval`, timeline, and `revalidatePath` below stay outside the transaction, unchanged.)

- [ ] **Step 2: Make OTP verify atomic**

In `verifyOtpAction`, replace the block:

```ts
  await prisma.approvalRequest.updateMany({
    where: { id: approval.id, workshopId: user.workshopId },
    data: {
      status: "verified",
      approvedAt: new Date(),
    },
  })

  await prisma.vehicleIntakeForm.updateMany({
    where: { id: intakeFormId, workshopId: user.workshopId },
    data: { status: "approved", approvedAt: new Date() },
  })
```

with:

```ts
  await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.updateMany({
      where: { id: approval.id, workshopId: user.workshopId },
      data: {
        status: "verified",
        approvedAt: new Date(),
      },
    })

    await tx.vehicleIntakeForm.updateMany({
      where: { id: intakeFormId, workshopId: user.workshopId },
      data: { status: "approved", approvedAt: new Date() },
    })
  })
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Checkpoint (do NOT commit)**

Proposed message: `fix(intake): atomic approval request and OTP verify`.

---

### Task 11: Full validation & manual QA

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated gate**

Run each and confirm success:
```bash
bun test
bun run lint
bun run typecheck
bun run build
bunx prisma validate
bunx prisma generate
```
Expected: all pass; `build` completes; `validate` reports valid. If `lint` flags the new `*.test.ts` files, confirm they are not part of the lint glob or fix lint findings.

- [ ] **Step 2: Manual QA checklist (record results)**

Against a dev database (built per `docs/DEPLOYMENT.md` Scenario B, or a fresh one via Scenario A), verify:
- Quote → order conversion creates the order **and** all items; `workOrderNo` is present and unique. Simulate a mid-loop failure (temporarily) → no partial order remains (atomic).
- Pay exactly the order remaining → status `paid`, `remainingAmount = 0`. Overpay by 0.01 → `overpaid`. Underpay → `partial`. Cancel a payment → status/remaining recalculated.
- OCR confirm with a new customer+vehicle is all-or-nothing; a duplicate plate still returns the 409 message and creates no orphan customer.
- Intake approval request sets the intake to `waiting_approval` and creates the approval together; OTP verify flips both approval → `verified` and intake → `approved`.
- Fresh DB: `bunx prisma migrate deploy` builds the full schema with no error.

- [ ] **Step 3: Final checkpoint (do NOT commit)**

All gates pass and QA recorded. **Do not commit/tag/push** — leave the working tree staged-but-uncommitted for the user. Proposed single squash commit message for when the user approves committing:

```
feat: v0.5.8 migration baseline & money consistency

- squash Prisma migrations into 0_init baseline + deploy guide
- add epsilon-aware money helpers; round totals & payment status
- wrap order/payment/OCR/approval multi-write flows in transactions
- enforce per-workshop workOrderNo uniqueness (DB constraint + runtime guard)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

---

## Self-Review

**1. Spec coverage:**
- Baseline strategy → Task 4 (+ Task 3 for the constraint folded in). ✓
- Deploy docs → Task 5. ✓
- Money helpers + epsilon → Task 1; applied → Task 2 + Task 6 Step 5. ✓
- Transactions: order+items → Task 7; payment create+recalc → Task 6 Step 3; payment cancel+recalc → Task 6 Step 4; OCR confirm → Task 9; intake approval/OTP → Task 10. ✓
- workOrderNo uniqueness → Task 3 (DB) + Tasks 7/8 (runtime, tx-scoped). ✓
- No destructive migrations → only `migrate diff`/`validate`/`generate` run (Tasks 3–4). ✓
- No Float→Decimal → money stays Float (Global Constraints; Task 1 doc). ✓
- Validation commands → Task 11. ✓
- No Docker / no commit → Global Constraints + every checkpoint. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. ✓

**3. Type consistency:** `recalcOrderPayment(tx, serviceOrderId, workshopId) => { statusChanged, newStatus } | null` defined in Task 6 Step 2 and consumed in Steps 3–4 with matching destructuring. `Prisma.TransactionClient` used consistently. Money helper names (`roundMoney`, `sumMoney`, `moneyEquals`, `moneyGte`) match between Task 1 definitions and Task 2/6 consumers. OCR transaction returns `{ customer, vehicle, customerCreated, vehicleCreated, vehicleCustomerChanged }` and is destructured identically. ✓
