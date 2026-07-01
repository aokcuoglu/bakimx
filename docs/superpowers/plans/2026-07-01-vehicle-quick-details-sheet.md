# Vehicle Quick Details Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users peek at a selected vehicle's properties (plate, brand/model, VIN, ruhsat fields, etc.) directly from the work order wizard's vehicle-selection card, without losing wizard progress.

**Architecture:** A pure field-formatting function (`buildVehicleQuickFields`) turns a fetched Vehicle record into label/value pairs. A new client component (`VehicleQuickDetailsSheet`) fetches `/api/vehicles/{id}` lazily on open, renders the fields inside the existing `BottomSheet` component, and shows `BrandSpinner` while loading. The trigger button is wired into the existing selected-vehicle card in `customer-vehicle-picker.tsx`.

**Tech Stack:** Next.js App Router, React client components, existing `BottomSheet`/`BrandSpinner`/`Button` UI primitives, `bun test` for the pure-function unit test.

## Global Constraints

- Vehicle data must be read via the existing tenant-isolated `/api/vehicles/{id}` endpoint — do not add a new endpoint or bypass `getAppData()`'s workshop scoping.
- `firstRegistrationDate` and `inspectionValidUntil` are stored as raw ruhsat strings (e.g. `"12.03.2019"`), not ISO dates — display them as-is, do NOT pass them through `formatDate()`.
- No skeleton loaders — use `BrandSpinner` for the loading state (project convention).
- Keep the new box/grid styling local to the new file — do not extract or modify `SummaryItem` in `vehicle-detail.tsx`.
- Mobile-first: reuse `BottomSheet` (bottom-drawer), do not build a new modal/dialog pattern.
- No comments in new code beyond what's already shown in this plan.

---

### Task 1: Pure vehicle-field formatter + unit test

**Files:**
- Create: `src/lib/vehicle-quick-fields.ts`
- Test: `src/lib/vehicle-quick-fields.test.ts`

**Interfaces:**
- Produces: `export type VehicleQuickFieldsInput` (plate, brand, model, vehicleType, modelYear, mileage, color, fuelType, transmission, engineNo, commercialName, firstRegistrationDate, engineDisplacement, enginePower, inspectionValidUntil — all `string`/`number` except the three required ones, `null` allowed elsewhere). `export type VehicleQuickField = { label: string; value: string }`. `export function buildVehicleQuickFields(v: VehicleQuickFieldsInput): VehicleQuickField[]` — consumed by Task 2's component.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/vehicle-quick-fields.test.ts
import { expect, test } from "bun:test"
import { buildVehicleQuickFields } from "@/lib/vehicle-quick-fields"

test("buildVehicleQuickFields dolu bir araç için tüm alanları biçimlendirir", () => {
  const fields = buildVehicleQuickFields({
    plate: "34ABC123",
    brand: "Toyota",
    model: "Corolla",
    vehicleType: "Sedan",
    modelYear: 2019,
    mileage: 125000,
    color: "Beyaz",
    fuelType: "Benzin",
    transmission: "Otomatik",
    engineNo: "ENG-123",
    commercialName: "Corolla Hybrid",
    firstRegistrationDate: "12.03.2019",
    engineDisplacement: "1600 cc",
    enginePower: "98 kW",
    inspectionValidUntil: "12.03.2027",
  })

  expect(fields).toEqual([
    { label: "Plaka", value: "34ABC123" },
    { label: "Marka", value: "Toyota" },
    { label: "Model", value: "Corolla" },
    { label: "Araç Tipi", value: "Sedan" },
    { label: "Model Yılı", value: "2019" },
    { label: "Kilometre", value: "125.000 km" },
    { label: "Renk", value: "Beyaz" },
    { label: "Yakıt", value: "Benzin" },
    { label: "Şanzıman", value: "Otomatik" },
    { label: "Motor No", value: "ENG-123" },
    { label: "Ticari Adı", value: "Corolla Hybrid" },
    { label: "İlk Tescil Tarihi", value: "12.03.2019" },
    { label: "Motor Hacmi", value: "1600 cc" },
    { label: "Motor Gücü", value: "98 kW" },
    { label: "Muayene Geçerlilik Tarihi", value: "12.03.2027" },
  ])
})

test("buildVehicleQuickFields boş alanlar için '—' döner", () => {
  const fields = buildVehicleQuickFields({
    plate: "34ABC123",
    brand: "Toyota",
    model: "Corolla",
    vehicleType: null,
    modelYear: null,
    mileage: null,
    color: null,
    fuelType: null,
    transmission: null,
    engineNo: null,
    commercialName: null,
    firstRegistrationDate: null,
    engineDisplacement: null,
    enginePower: null,
    inspectionValidUntil: null,
  })

  expect(fields.filter((f) => f.label !== "Plaka" && f.label !== "Marka" && f.label !== "Model").every((f) => f.value === "—")).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/vehicle-quick-fields.test.ts`
Expected: FAIL with a module-not-found error for `@/lib/vehicle-quick-fields`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/vehicle-quick-fields.ts
export type VehicleQuickFieldsInput = {
  plate: string
  brand: string
  model: string
  vehicleType: string | null
  modelYear: number | null
  mileage: number | null
  color: string | null
  fuelType: string | null
  transmission: string | null
  engineNo: string | null
  commercialName: string | null
  firstRegistrationDate: string | null
  engineDisplacement: string | null
  enginePower: string | null
  inspectionValidUntil: string | null
}

export type VehicleQuickField = { label: string; value: string }

export function buildVehicleQuickFields(v: VehicleQuickFieldsInput): VehicleQuickField[] {
  return [
    { label: "Plaka", value: v.plate },
    { label: "Marka", value: v.brand },
    { label: "Model", value: v.model },
    { label: "Araç Tipi", value: v.vehicleType || "—" },
    { label: "Model Yılı", value: v.modelYear ? String(v.modelYear) : "—" },
    { label: "Kilometre", value: v.mileage ? `${v.mileage.toLocaleString("tr-TR")} km` : "—" },
    { label: "Renk", value: v.color || "—" },
    { label: "Yakıt", value: v.fuelType || "—" },
    { label: "Şanzıman", value: v.transmission || "—" },
    { label: "Motor No", value: v.engineNo || "—" },
    { label: "Ticari Adı", value: v.commercialName || "—" },
    { label: "İlk Tescil Tarihi", value: v.firstRegistrationDate || "—" },
    { label: "Motor Hacmi", value: v.engineDisplacement || "—" },
    { label: "Motor Gücü", value: v.enginePower || "—" },
    { label: "Muayene Geçerlilik Tarihi", value: v.inspectionValidUntil || "—" },
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/vehicle-quick-fields.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/vehicle-quick-fields.ts src/lib/vehicle-quick-fields.test.ts
git commit -m "feat(vehicles): add pure vehicle quick-field formatter"
```

---

### Task 2: VehicleQuickDetailsSheet component

**Files:**
- Create: `src/components/app/vehicle-quick-details-sheet.tsx`

**Interfaces:**
- Consumes: `buildVehicleQuickFields(v: VehicleQuickFieldsInput): VehicleQuickField[]` and `type VehicleQuickFieldsInput` from `@/lib/vehicle-quick-fields` (Task 1). `BottomSheet` from `@/components/shared/bottom-sheet` (props: `open`, `onOpenChange`, `trigger`, `title`, `children`). `BrandSpinner` from `@/components/shared/brand-spinner` (`size` prop). `Button` from `@/components/ui/button`.
- Produces: `export function VehicleQuickDetailsSheet({ vehicleId }: { vehicleId: string })` — a fully self-contained trigger button + sheet, consumed by Task 3.

- [ ] **Step 1: Write the component**

```tsx
// src/components/app/vehicle-quick-details-sheet.tsx
"use client"

import { useState, type ReactNode } from "react"
import { Info, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/shared/bottom-sheet"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { buildVehicleQuickFields, type VehicleQuickFieldsInput } from "@/lib/vehicle-quick-fields"

type VehicleQuickDetails = VehicleQuickFieldsInput & {
  vin: string | null
  vinConfirmed: boolean
}

function QuickFieldBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground font-medium">{label}</dt>
      <dd className="text-sm font-semibold text-foreground mt-0.5">{value}</dd>
    </div>
  )
}

export function VehicleQuickDetailsSheet({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false)
  const [vehicle, setVehicle] = useState<VehicleQuickDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && !vehicle && !loading) {
      setLoading(true)
      setError(false)
      fetch(`/api/vehicles/${vehicleId}`)
        .then((r) => r.json())
        .then((data: unknown) => {
          if (!data || typeof data !== "object" || "error" in data) {
            setError(true)
            return
          }
          setVehicle(data as VehicleQuickDetails)
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false))
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Araç Detayları"
      trigger={
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
          <Info className="size-4 mr-1" /> Detay
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <BrandSpinner size={40} />
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground py-4">Araç bilgileri yüklenemedi.</p>
      ) : vehicle ? (
        <div className="space-y-3 pb-2">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {buildVehicleQuickFields(vehicle).map((f) => (
              <QuickFieldBox key={f.label} label={f.label} value={f.value} />
            ))}
            <QuickFieldBox
              label="Şase No"
              value={<span className="font-mono text-xs">{vehicle.vin || "—"}</span>}
            />
            <QuickFieldBox
              label="Şase Teyit"
              value={
                vehicle.vinConfirmed ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <ShieldCheck className="size-3" /> Teyit Edildi
                  </span>
                ) : (
                  <span className="text-warning">Teyit Bekliyor</span>
                )
              }
            />
          </dl>
          <a
            href={`/vehicles/${vehicleId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-block"
          >
            Tüm geçmişi görüntüle →
          </a>
        </div>
      ) : null}
    </BottomSheet>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: no new errors referencing `vehicle-quick-details-sheet.tsx`.

- [ ] **Step 3: Lint**

Run: `bun run lint`
Expected: no new errors/warnings referencing `vehicle-quick-details-sheet.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/vehicle-quick-details-sheet.tsx
git commit -m "feat(vehicles): add VehicleQuickDetailsSheet component"
```

---

### Task 3: Wire the trigger into the wizard's vehicle card

**Files:**
- Modify: `src/components/app/customer-vehicle-picker.tsx:1-20` (imports), `:187-191` (selected-vehicle non-owner-mode button block)

**Interfaces:**
- Consumes: `VehicleQuickDetailsSheet` from `./vehicle-quick-details-sheet` (Task 2), rendered with `vehicleId={selected.vehicleId}` where `selected` is the existing `Selected` union already narrowed to `{ kind: "vehicle"; vehicleId: string; ... }` at this point in the file (`customer-vehicle-picker.tsx:169`).

- [ ] **Step 1: Add the import**

In `src/components/app/customer-vehicle-picker.tsx`, add this import alongside the other local component imports (near line 17):

```tsx
import { VehicleQuickDetailsSheet } from "./vehicle-quick-details-sheet"
```

- [ ] **Step 2: Add the trigger next to "Sahip Değiştir"**

Replace this block (currently lines 187-191):

```tsx
        ) : (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOwnerMode(true)}>
            <UserCog className="size-4 mr-1" /> Sahip Değiştir
          </Button>
        )}
```

with:

```tsx
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOwnerMode(true)}>
              <UserCog className="size-4 mr-1" /> Sahip Değiştir
            </Button>
            <VehicleQuickDetailsSheet vehicleId={selected.vehicleId} />
          </div>
        )}
```

- [ ] **Step 3: Typecheck and lint**

Run: `bun run typecheck && bun run lint`
Expected: no new errors.

- [ ] **Step 4: Manual QA in the browser**

1. Start the dev server: `bun dev` (skip if already running).
2. Navigate to `/intakes/new`.
3. Search and select any existing vehicle in step 1 ("Müşteri & Araç").
4. Confirm the selected-vehicle card now shows both "Sahip Değiştir" and "Detay" buttons.
5. Click "Detay" — confirm a bottom sheet opens over the wizard (wizard step/progress must remain visible/unchanged underneath once closed).
6. Confirm a brief spinner (`BrandSpinner`) appears, then the field grid renders with plate/brand/model/VIN/ruhsat fields (or "—" for empty ones).
7. Click "Tüm geçmişi görüntüle →" — confirm it opens `/vehicles/{id}` in a new tab, and the wizard tab is untouched.
8. Close the sheet, reopen it — confirm it does not re-fetch (no spinner flash the second time) since the vehicle is now cached in state.
9. Test the mobile viewport (resize browser or device toolbar) — confirm the sheet behaves as a bottom drawer, not a centered modal.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/customer-vehicle-picker.tsx
git commit -m "feat(vehicles): surface quick vehicle details from wizard vehicle card"
```

---

## Post-plan checks

- [ ] `bun run build` — confirm the app still builds cleanly.
- [ ] Re-read `docs/superpowers/specs/2026-07-01-vehicle-quick-details-sheet-design.md` and confirm every listed field appears in the shipped sheet.
