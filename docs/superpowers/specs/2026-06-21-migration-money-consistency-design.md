# BakımX v0.5.8 — Migration & Money Consistency

**Date:** 2026-06-21
**Status:** Approved (design) — pending spec review → implementation plan
**Scope owner:** v0.5.8 maintenance release (no new product features)

## 1. Goal

Fix the database migration strategy and money-consistency risks without adding
product features. Two themes:

- **Migrations:** the Prisma migration history has no table-creating baseline, so
  `prisma migrate deploy` against a fresh database fails. Establish a safe,
  documented baseline + deploy workflow.
- **Money:** `Float` money fields are compared/aggregated without rounding or
  epsilon tolerance, and several critical multi-write flows are not atomic.
  Add money helpers and wrap the flows in transactions.

## 2. Context (current state)

- **Stack:** Next.js 16, Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`,
  `pg` Pool), PostgreSQL. Package manager: `bun`.
- **Prisma client:** `src/lib/db.ts` builds `PrismaClient({ adapter })`. Driver
  adapters in Prisma 7 support interactive transactions (`prisma.$transaction`
  with a callback).
- **Schema:** `prisma/schema.prisma` defines 33 models. Money fields are `Float`
  (`@db.DoublePrecision`) — e.g. `ServiceOrder.discountAmount/taxRate/paidAmount/
  remainingAmount`, `ServiceOrderItem.unitPrice/totalPrice`, `CollectionPayment.
  amount`, `Quote*` totals, `PartStockItem.purchasePrice/salePrice`.
- **Migrations (`prisma/migrations/`):** 4 directories, all *incremental* —
  `20260610120000_add_collection_payment`,
  `20260612140000_add_vehicle_plate_unique`,
  `20260612210000_add_photo_phase_and_missing_tables`,
  `20260613200000_add_technician_workspace`. Across all of them there are only 8
  `CREATE TABLE` statements and **no migration creates the core tables**
  (`Workshop`, `User`, `Customer`, `Vehicle`, `ServiceOrder`, …). The first
  migration immediately runs `ALTER TABLE "ServiceOrder"`. Conclusion: the DB was
  bootstrapped with `prisma db push`; the migration set is not self-contained and
  `migrate deploy` on an empty DB would fail.
- **Money math:** `src/lib/totals.ts` sums/derives totals with no rounding.
  `src/lib/cashbox/status.ts#computePaymentStatus` uses raw `paidAmount >=
  grandTotal` — paying the exact remaining can read as `partial`, and a sub-cent
  float drift can read as `overpaid`.
- **Non-atomic multi-write flows:**
  - `src/app/app/quotes/actions.ts` (quote → order): creates intake, generates
    `workOrderNo`, creates order, loops creating items, updates quote — all
    separate awaits.
  - `src/app/app/cashbox/actions.ts`: `createCollectionAction` (create payment +
    `updateOrderPaymentStatus`), `cancelCollectionAction` (cancel + recalc).
  - `src/app/api/smart-capture/confirm/route.ts` (OCR confirm): create/find
    customer, create/update vehicle, update `ocrLog`.
  - `src/app/app/intakes/approval-actions.ts`: `requestApprovalAction` (create
    approval + update intake), `verifyOtpAction` (verify approval + update intake).
- **workOrderNo:** `src/lib/work-order-number.ts#generateUniqueWorkOrderNo`
  retries against a workshop-scoped lookup, but check and insert are separate
  statements (race window). The file comment notes the DB constraint was
  deliberately deferred. `workOrderNo` is `String?` (nullable).

## 3. Decisions (locked)

| Topic | Decision |
|---|---|
| DB state | Pre-first-deploy, no production data. |
| Baseline | Squash to a single `0_init` migration from the current schema; remove the 4 partial migrations. |
| workOrderNo | Add `@@unique([workshopId, workOrderNo])` to schema (baked into `0_init`) **and** keep an in-transaction runtime guard; document a duplicate-cleanup guard. |
| Money | Add `src/lib/money.ts` helpers; round computed values at write boundaries and use epsilon-aware comparisons. Keep `Float` (no Decimal this release). |
| Transactions | Wrap the 6 flows above in `prisma.$transaction` (interactive callback). Keep audit/notify/`revalidatePath` outside the tx. |

## 4. Design

### 4.1 Prisma baseline migration (squash)

1. Generate the baseline SQL offline (no DB / no Docker needed):
   ```
   bunx prisma migrate diff \
     --from-empty \
     --to-schema-datamodel prisma/schema.prisma \
     --script > prisma/migrations/0_init/migration.sql
   ```
   This emits the full current schema — all tables, enums, indexes, and
   constraints, **including** the new `@@unique([workshopId, workOrderNo])`.
2. Remove the 4 existing partial migration directories. They are already folded
   into the schema and break a from-empty deploy. Git history preserves them.
3. Keep `prisma/migrations/migration_lock.toml` (`provider = "postgresql"`).
4. Verify with `bunx prisma validate` and confirm `0_init/migration.sql` contains
   `CREATE TABLE "Workshop"`, `CREATE TABLE "ServiceOrder"`, and the
   `ServiceOrder_workshopId_workOrderNo_key` unique index.

`migrate diff` is read-only (computes SQL from the schema datamodel only); it
performs no destructive DB operation and needs no live database.

### 4.2 Deploy documentation — `docs/DEPLOYMENT.md`

Must include a **loud, explicit warning** (condition 2):

> ⚠️ **Never run `prisma migrate deploy` against a database that already contains
> BakımX tables** — i.e. any database previously built with `prisma db push` or
> with the old partial migrations. `0_init` issues `CREATE TABLE` for every model;
> against a populated schema it fails with "relation already exists" and leaves
> migration history half-written. Such databases MUST be baselined first.

Documented procedures:

- **Fresh database (production target):**
  `prisma migrate deploy` — applies `0_init` and any future migrations.
- **Existing database built via `db push` / old partial migrations (baselining):**
  1. Clean duplicate work-order numbers (see §4.5 guard) — required before the
     new unique index can exist on that DB.
  2. `prisma migrate resolve --applied 0_init` — registers the baseline as
     already applied **without** re-running its SQL.
  3. `prisma db push` once — applies any drift the resolve didn't run
     (e.g. the new `@@unique` index), or recreate via `prisma migrate reset`
     (dev only — drops data, re-applies `0_init`, re-seeds).
- **Adding future migrations:** `prisma migrate dev --name <change>` locally →
  commit the generated folder → `prisma migrate deploy` on the server.
- **Rule:** never use `prisma db push` as the production change mechanism after
  baselining; `0_init` + incremental migrations are the source of truth.

### 4.3 Money helpers — new `src/lib/money.ts`

```ts
export const MONEY_EPSILON = 0.005 // half a cent

export function roundMoney(n: number): number
  // half-up to 2 decimals, float-error safe:
  // Math.round((n + Number.EPSILON) * 100) / 100

export function sumMoney(values: number[]): number  // sum then roundMoney
export function addMoney(a: number, b: number): number
export function subMoney(a: number, b: number): number // roundMoney(a - b)

export function moneyEquals(a: number, b: number, eps?: number): boolean
export function moneyGte(a: number, b: number, eps?: number): boolean
  // a >= b - eps
```

Consumers:

- `src/lib/totals.ts`: round `subtotal`, `taxAmount`, `grandTotal` (in both
  `calculateOrderTotals` and `calculateOrderTotalsFromMinimal`); use `sumMoney`
  for the reductions in `calculateMinimalTotal` / `calculateGroupTotal`.
- `src/lib/cashbox/status.ts`:
  - `computePaymentStatus`: use `moneyGte`/`moneyEquals` so exact payment →
    `paid` (not `partial`), and sub-cent overpay → `paid` (not `overpaid`).
  - `computeRemainingAmount`: `Math.max(0, roundMoney(grandTotal - paidAmount))`.
- Recompute sites that sum `collection.amount` (cashbox) use `sumMoney`.

No schema change; `Float` retained.

### 4.4 Transactions

Pattern: only the consistency-critical writes go inside
`prisma.$transaction(async (tx) => { … })`. Audit logging, notifications, and
`revalidatePath` stay **outside** so a logging/notify failure never rolls back a
valid business write. `updateOrderPaymentStatus` is refactored to accept a
`Prisma.TransactionClient` and to *return* the status-change info; the caller
emits the audit entry after commit.

| Flow | File | Inside tx |
|---|---|---|
| Quote → order (order + items) | `quotes/actions.ts` | intake.create + workOrderNo gen (tx-scoped isTaken) + order.create + items create + quote.update |
| Payment create + recalc | `cashbox/actions.ts` | collection.create + order recalc/update |
| Payment cancel + recalc | `cashbox/actions.ts` | collection cancel (updateMany) + order recalc/update |
| OCR confirm | `api/smart-capture/confirm/route.ts` | customer create/find + vehicle create/update + ocrLog.update |
| Intake approval request | `intakes/approval-actions.ts` | approvalRequest.create + intake.updateMany |
| Intake OTP verify | `intakes/approval-actions.ts` | approval.updateMany + intake.updateMany |

Notes:
- OCR confirm: pre-tx reads (plate/VIN conflict detection) stay before the tx;
  only the writes move inside. The existing P2002 catch on vehicle create is
  preserved (now surfacing from the tx).
- `orders/actions.ts#createServiceOrderAction` and
  `appointments/actions.ts` order creation get the same tx-scoped
  workOrderNo-generate-then-create treatment for consistency, even though they
  don't create items.

### 4.5 workOrderNo uniqueness

- **Schema:** add `@@unique([workshopId, workOrderNo])` to `ServiceOrder`. Postgres
  treats `NULL` as distinct in unique indexes, so existing/legacy `null`
  `workOrderNo` rows do not conflict.
- **Runtime guard:** generation moves inside the order-creation tx so the
  `isTaken` lookup and the `order.create` are atomic per workshop. The unique
  index is the durable safety net behind it (optionally retry once on P2002).
- **Cleanup guard (documented in `docs/DEPLOYMENT.md`):** before baselining an
  existing DB, detect duplicates:
  ```sql
  SELECT "workshopId", "workOrderNo", COUNT(*)
  FROM "ServiceOrder"
  WHERE "workOrderNo" IS NOT NULL
  GROUP BY "workshopId", "workOrderNo"
  HAVING COUNT(*) > 1;
  ```
  Any rows returned must be resolved (regenerate the colliding `workOrderNo`s)
  before the unique index can be created. Fresh DBs are unaffected.
- **Code comment:** update the deferred-migration note in
  `src/lib/work-order-number.ts` to reflect that the constraint now exists.

## 5. Non-goals / guardrails

- No `Float` → `Decimal` conversion this release.
- No destructive migrations; `migrate diff`/`validate`/`generate` only.
- No new product features.
- No Docker for local development.
- **Do not commit/tag/push** (overrides the brainstorming skill's "commit the
  design doc" step — user instruction takes precedence).

## 6. Validation

```
bun run lint
bun run typecheck
bun run build
bunx prisma validate
bunx prisma generate
```

Plus targeted manual QA (see §8).

## 7. Risk areas

- **Baselining hazard:** any DB at the old 4-migration / db-push state must run
  `migrate resolve --applied 0_init` (and the duplicate cleanup) before deploy,
  or `migrate deploy` fails on "relation already exists." Mitigated by the loud
  doc warning.
- **Interactive transactions over `@prisma/adapter-pg`:** supported in Prisma 7;
  watch `pg` Pool sizing under concurrency. Keep tx callbacks short (no network
  I/O / notifications inside).
- **Audit/notify now post-commit:** ordering shift only, not a correctness change.
- **`roundMoney` normalizes totals to 2 decimals:** intended for TRY; verify the
  payment-status transitions in QA.
- **`@@unique` on legacy data:** safe for nulls; non-null duplicates blocked by
  the documented cleanup guard.

## 8. Manual QA

- Quote → order conversion creates order + all items, or none on failure;
  `workOrderNo` present and unique.
- Create a collection equal to the order remaining → status `paid`,
  `remainingAmount = 0`. Overpay by 1 kuruş → `overpaid`. Cancel → recalculated.
- OCR confirm with a new customer+vehicle is all-or-nothing; duplicate plate
  still returns the 409 message.
- Intake approval request + OTP verify update both the approval and the intake
  atomically.
- `bunx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
  --exit-code` style check (or inspect `0_init`) shows no drift vs schema.

## 9. Files touched (anticipated)

- `prisma/schema.prisma` (add `@@unique`)
- `prisma/migrations/0_init/migration.sql` (new); remove 4 old migration dirs
- `docs/DEPLOYMENT.md` (new)
- `src/lib/money.ts` (new)
- `src/lib/totals.ts`, `src/lib/cashbox/status.ts`
- `src/lib/work-order-number.ts` (comment + tx-scoped usage signature if needed)
- `src/app/app/quotes/actions.ts`, `src/app/app/orders/actions.ts`,
  `src/app/app/appointments/actions.ts`, `src/app/app/cashbox/actions.ts`
- `src/app/app/intakes/approval-actions.ts`
- `src/app/api/smart-capture/confirm/route.ts`
