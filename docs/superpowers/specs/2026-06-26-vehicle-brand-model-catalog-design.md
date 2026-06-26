# Vehicle Brand/Model Catalog — Design

**Date:** 2026-06-26
**Branch context:** authored on `feat/back-office-ops-panel` (catalog feature is independent of ops-panel work)
**Status:** approved design, pending spec review

## Problem

On `/intakes/new` (the "Yeni araç" inline-create modal) and the full vehicle
create/edit form, **Marka** and **Model** are free-text `<Input>` fields. Users
type brand/model names by hand — inconsistent data, typos, no guidance. They
should be **selected from a real brand/model catalog** sourced from the
getirbakim project's database.

## Source data

The getirbakim Postgres (OrbStack container `getirbakim-postgres-local`,
`127.0.0.1:54322`, database `getirbakim`, schema `v0`) holds:

| Table             | Rows    | Shape                                                                 | Role          |
|-------------------|---------|----------------------------------------------------------------------|---------------|
| `v0.vbrands`      | 251     | `id int`, `name text` (unique)                                        | **Marka**     |
| `v0.vmodels`      | 5,767   | `id`, `name`, `date_from`, `date_to`, `brand_id` → vbrands            | **Model**     |
| `v0.vtypes`       | 37,937  | `id`, `name`, `cc`, `fuel_type`, `hp`, `kwt`, year range, `model_id`  | Trim/engine   |
| `v0.vtype_details`| 37,937  | full technical specs + `raw_payload` JSON, `vehicle_type_id`          | Specs         |

## Decisions (locked)

1. **Migrate all four tables** into BakımX now (vbrands, vmodels, vtypes,
   vtype_details). `vtypes`/`vtype_details` are migrated for future
   spec/VIN features but **not surfaced in the UI** this iteration.
2. **Entry mode: catalog + free-text fallback.** Searchable dropdown from the
   catalog, but the user can still type a custom brand/model. The typed-or-
   selected **name string** is what gets submitted/stored. Never blocks intake.
3. **Surface only Marka + Model** dependent comboboxes now (no trim selector).
4. **Names only — no FK on `Vehicle`.** `Vehicle.brand`/`Vehicle.model` stay
   free-text `String`. The catalog only powers the picker. Zero change to the
   `Vehicle` table; fully backward-compatible with existing records.
5. **Apply to both forms:** the intake inline-create modal AND the full vehicle
   create/edit form.

## Architecture

### New Prisma models — global catalog (NOT tenant-scoped)

These are **read-only static reference data shared by every workshop**. The
CLAUDE.md tenant-isolation rule governs *tenant* data; a global lookup catalog
has no `workshopId` and is intentionally cross-tenant. Original integer IDs are
preserved so foreign keys transfer cleanly.

```prisma
model VehicleBrand {
  id     Int            @id            // preserve source id, no autoincrement
  name   String         @unique
  models VehicleModel[]
  @@map("vehicle_brands")
}

model VehicleModel {
  id       Int           @id
  name     String
  dateFrom String?       @map("date_from")
  dateTo   String?       @map("date_to")
  brandId  Int           @map("brand_id")
  brand    VehicleBrand  @relation(fields: [brandId], references: [id])
  types    VehicleType[]
  @@index([brandId])
  @@index([brandId, name])
  @@map("vehicle_models")
}

model VehicleType {
  id        Int                 @id
  name      String
  cc        Int?
  fuelType  String?             @map("fuel_type")
  hp        Int?
  kwt       Int?
  yearFrom  String?             @map("year_of_constr_from")
  yearTo    String?             @map("year_of_constr_to")
  modelId   Int                 @map("model_id")
  model     VehicleModel        @relation(fields: [modelId], references: [id])
  details   VehicleTypeDetail[]
  @@index([modelId])
  @@map("vehicle_types")
}

model VehicleTypeDetail {
  id            BigInt      @id
  vehicleTypeId Int         @map("vehicle_type_id")
  type          VehicleType @relation(fields: [vehicleTypeId], references: [id])
  // remaining spec columns mapped 1:1 from v0.vtype_details (snake_case @map)
  // rawPayload  Json?  @map("raw_payload")
  // createdAt / updatedAt carried over
  @@index([vehicleTypeId])
  @@map("vehicle_type_details")
}
```

> The exact `VehicleTypeDetail` column list is transcribed 1:1 from
> `v0.vtype_details` during implementation (brake_system, car_id, ccm_tech,
> construction_type, cylinder, …, motor_codes, raw_payload, created_at,
> updated_at). It is storage-only this iteration.

### Schema migration

A Prisma migration (`prisma migrate dev`) adds the four tables. Per project
convention (memory: schema-via-migrate-deploy), this is a forward migration on
top of the committed baseline; it only **adds** tables, so it is non-breaking
and requires no data backfill on existing tables.

### Data import

`scripts/migrate-vehicle-catalog.ts`, run via `bunx tsx` (new npm script
`db:seed-catalog`). Mechanics:

- Connects to the **source** getirbakim DB with the existing `pg` dependency
  (`^8.21.0`). Source URL comes from env `CATALOG_SOURCE_URL`
  (default `postgresql://postgres@localhost:54322/getirbakim`) — **not hardcoded**.
- Reads `v0.vbrands → vmodels → vtypes → vtype_details` in batches and writes to
  the new Prisma tables via `createMany({ skipDuplicates: true })`, in FK order.
- **Idempotent** — safe to re-run; existing rows skipped by id.
- Preserves source integer ids so `brand_id`/`model_id`/`vehicle_type_id`
  references stay valid.

### Production portability

getirbakim's DB is local-only, so prod/staging cannot reach it. The import
script **also emits a committed compressed seed file** (gzipped NDJSON under
`prisma/data/vehicle-catalog/`). Staging/prod seed the catalog from that file
instead of the live getirbakim DB. The script therefore has two modes:

- `--from-db`  → read getirbakim, populate local DB, and (re)write the seed file.
- `--from-file` → read the committed seed file, populate the target DB (used by
  prod/staging and CI).

⚠️ **Size flag:** `vtype_details` is 37,937 rows with heavy JSON `raw_payload`.
The committed gzipped dump is expected to be a few MB. This is acceptable but
called out explicitly. If it proves too large for the repo, the fallback is to
store the dump as a release artifact / object-storage file fetched at seed time
(decided during implementation if size exceeds ~10 MB compressed).

### Read API (auth-gated, no tenant filter — global catalog)

- `GET /api/vehicle-catalog/brands`
  → `[{ id, name }]` for all 251 brands. Cacheable (long `s-maxage`).
- `GET /api/vehicle-catalog/models?brandId=<int>&q=<search>`
  → models for one brand, optional case-insensitive `name` filter, capped at ~50
    results. `brandId` required and validated as int.

Both call `requireAuth()` (any logged-in workshop user). No `workshopId` filter —
the catalog is global. Inputs validated server-side (CLAUDE.md rule).

### UI: `<VehicleBrandModelPicker>`

New client component wrapping the existing base-ui `Combobox`
(`src/components/ui/combobox.tsx`), which natively supports free-text input
alongside a filtered list — exactly the catalog-with-fallback requirement.

Behaviour:

- **Marka combobox** — loads the 251 brands once on mount. Selecting a brand sets
  the brand name string and records its `brandId` in local component state
  (used only to fetch models — not persisted).
- **Model combobox** — disabled until a brand is chosen; on brand change it
  clears and fetches `/api/vehicle-catalog/models?brandId=…`. Typing filters via
  the `q` param (debounced) and the local list.
- **Free-text fallback** — in both comboboxes, a typed value that matches no
  catalog entry is still accepted; the typed string is what the form submits.
- **Edit prefill** — existing `Vehicle.brand`/`model` text prefills the inputs
  even when the value isn't in the catalog (e.g. legacy free-text). If the brand
  name matches a catalog brand, its models are loaded so the user can switch.
- **Props** — controlled: `brand`, `model`, `onBrandChange`, `onModelChange`,
  plus `disabled`/error props to fit both hosts. One component, two hosts.
- **Mobile-first** — comboboxes are touch-friendly; model results are capped/
  filtered server-side so no list virtualization is required.

### Integration points

- `src/components/app/inline-create-modal.tsx` — replace the two brand/model
  `<Input>`s (lines ~111–112) with `<VehicleBrandModelPicker>`, wired to the
  existing `brand`/`model` `useState`.
- `src/components/app/vehicle-create-form.tsx` — replace the two brand/model
  `FormField` inputs (lines ~200–227) with the picker, wired through
  `react-hook-form` (`setValue`/`watch` for `brand` and `model`).

### Validation & Vehicle table

**No change.** `vehicleSchema` / `vehicleCreateSchema` / `vehicleUpdateSchema`
keep `brand`/`model` as `z.string().min(1)`. The `/api/vehicles` POST/PUT path is
untouched. Because the picker submits a plain name string, all existing
server-side logic and stored data remain valid.

## Components & boundaries

| Unit                         | Purpose                                   | Depends on                        |
|------------------------------|-------------------------------------------|-----------------------------------|
| Prisma catalog models        | typed read access to the catalog          | Prisma, migration                 |
| `migrate-vehicle-catalog.ts` | one-time/idempotent import + seed export  | `pg`, Prisma, getirbakim / file   |
| `vehicle-catalog` API routes | brand list + per-brand model search       | Prisma, `requireAuth`             |
| `VehicleBrandModelPicker`    | dependent brand/model selection + fallback| catalog API, `ui/combobox`        |
| modal + vehicle form (hosts) | embed the picker, submit name strings     | `VehicleBrandModelPicker`         |

Each unit is independently testable: the import script against a throwaway DB,
the API routes via request tests, the picker via component interaction, the
hosts via existing form flows.

## Error handling

- Import script: fail fast with a clear message if `CATALOG_SOURCE_URL` is
  unreachable or the seed file is missing/corrupt; partial batches are safe to
  re-run (skipDuplicates).
- API: invalid/missing `brandId` → 400; not-authenticated → handled by
  `requireAuth`. Empty model list returns `[]` (not an error).
- Picker: if the brands/models fetch fails, the combobox degrades to a plain
  free-text input (typed value still submits) and shows a subtle error hint —
  the form is never blocked.

## Testing

- **Import script:** run against local getirbakim → assert row counts match
  source (251 / 5,767 / 37,937 / 37,937) and a spot-checked FK chain resolves
  (brand → its models → a type). Re-run → no duplicates, no errors.
- **API:** `brands` returns 251; `models?brandId=` returns only that brand's
  models; `q` filters; missing `brandId` → 400; unauthenticated → blocked.
- **Picker:** selecting a brand enables + populates the model list; typing a
  custom brand/model submits the typed string; edit prefill shows legacy values.
- **Regression:** create a vehicle via the modal and via the full form; confirm
  `Vehicle.brand`/`model` persist as before; existing vehicles still display.

## Risks

- **Committed dump size** — gzipped `vtype_details` is a few MB; mitigation noted
  above (object-storage fallback if >~10 MB).
- **Model names carry chassis codes** ("CORSA D (S07)") — slightly technical but
  acceptable; left as-is to preserve source fidelity.
- **Free-text wiring** — must ensure base-ui Combobox submits a typed-but-
  unlisted value; covered by the picker tests.
- **Brand prefill matching on edit** — legacy free-text brand may not match a
  catalog brand exactly (casing/spelling); handled by showing the raw value and
  only loading models when an exact brand match exists.

## Out of scope (this iteration)

- Trim/engine ("Donanım/Motor") selector in the UI.
- Linking catalog IDs onto the `Vehicle` record.
- VIN-based spec lookup using `vtype_details`.
- Backfilling/normalizing existing free-text `Vehicle.brand`/`model` values.
