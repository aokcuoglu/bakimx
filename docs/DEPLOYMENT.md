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
