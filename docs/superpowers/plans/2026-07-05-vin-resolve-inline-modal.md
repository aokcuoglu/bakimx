# VIN→TecDoc Resolve in InlineCreateModal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing VIN→TecDoc catalog resolve feature (currently only in `vehicle-create-form.tsx`) to `InlineCreateModal` (the "Yeni araç" modal used by `/orders/new`), by extracting the shared resolve/interpret logic into a reusable hook instead of duplicating it.

**Architecture:** Extract a pure, directly-testable `performVinResolve()` function plus a thin `useVinResolve()` React hook into `src/components/app/vin-resolve.tsx`. Both consumers (`vehicle-create-form.tsx`, `inline-create-modal.tsx`) supply `onBrand`/`onModel`/`onCandidate` callbacks that write into their own state shape (react-hook-form vs. plain `useState`); the hook owns only "call `/api/vin/resolve` and interpret the response."

**Tech Stack:** Next.js App Router, React (client components), react-hook-form (only in `vehicle-create-form.tsx`), bun:test, TypeScript strict.

## Global Constraints

- Keep TypeScript strict, no `any` (per project CLAUDE.md).
- No backend/schema changes — `createVehicleAction` already accepts and persists `catalogBrandId`/`catalogModelId`/`catalogVehicleTypeId` from `FormData`.
- Preserve `vehicle-create-form.tsx`'s existing user-visible behavior exactly (this is a refactor there, not a feature change).
- Turkish user-facing copy only (matches existing strings verbatim — do not reword).
- Every step that changes code must run `bun run typecheck` clean and `bun test` green before moving to the next step.

---

## File Structure

- **Modify `src/lib/constants.ts`** — add exported `tecdocFuelToFormValue()` next to `ocrFuelToSlug`/`ocrVehicleTypeToSlug` (same category: external vocabulary → internal select slug).
- **Create `src/lib/constants.test.ts`** — unit test for `tecdocFuelToFormValue` (no test file exists for this module yet).
- **Modify `src/components/app/vin-resolve.tsx`** — add `VinResolveState`, `VIN_RESOLVE_IDLE`, `performVinResolve()`, `useVinResolve()`. Existing `VinResolveButton`/`VinCandidateList` untouched.
- **Create `src/components/app/vin-resolve.test.ts`** — unit tests for `performVinResolve()` (mock `global.fetch`, no React rendering needed since it's a plain async function).
- **Modify `src/components/app/vehicle-create-form.tsx`** — replace local `runVinResolve`/`applyCandidate`/`vinResolve` state with `useVinResolve()`. Remove the now-dead local `tecdocFuelToFormValue`.
- **Modify `src/components/app/inline-create-modal.tsx`** — add `catalogIds` state, wire `useVinResolve()`, add the "VIN'den getir" button + notice/error/candidate-list UI, auto-trigger from `applyOcr()`, clear catalog ids on manual brand/model change, send catalog ids in `handleCreate()`'s `FormData`.

---

### Task 1: Move `tecdocFuelToFormValue` to `src/lib/constants.ts`

**Files:**
- Modify: `src/lib/constants.ts` (insert after line 201, before `export const QUOTE_STATUS`)
- Modify: `src/components/app/vehicle-create-form.tsx:108-118` (delete local function, add import)
- Create: `src/lib/constants.test.ts`

**Interfaces:**
- Produces: `tecdocFuelToFormValue(fuel: string | null): string` — exported from `@/lib/constants`. Maps TecDoc's English `fuelType` string to the project's fixed fuel-select slugs (`"benzin" | "dizel" | "lpg" | "hibrit" | "elektrik" | ""`).

- [ ] **Step 1: Write the failing test**

Create `src/lib/constants.test.ts`:

```ts
import { test, expect } from "bun:test"
import { tecdocFuelToFormValue } from "./constants"

test("tecdocFuelToFormValue maps TecDoc English fuel names to form slugs", () => {
  expect(tecdocFuelToFormValue("Diesel")).toBe("dizel")
  expect(tecdocFuelToFormValue("Petrol")).toBe("benzin")
  expect(tecdocFuelToFormValue("LPG")).toBe("lpg")
  expect(tecdocFuelToFormValue("Hybrid")).toBe("hibrit")
  expect(tecdocFuelToFormValue("Electric")).toBe("elektrik")
  expect(tecdocFuelToFormValue("Diesel/Electro")).toBe("dizel") // mHEV listing: diesel wins
  expect(tecdocFuelToFormValue(null)).toBe("")
  expect(tecdocFuelToFormValue("Unknown")).toBe("")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/constants.test.ts`
Expected: FAIL — `tecdocFuelToFormValue` is not exported from `./constants` (module has no such export).

- [ ] **Step 3: Add the function to constants.ts**

In `src/components/app/vehicle-create-form.tsx`, the current function (lines 108-118) reads:

```ts
/** TecDoc English fuel_type → the form's fixed fuel Select values. */
function tecdocFuelToFormValue(fuel: string | null): string {
  if (!fuel) return ""
  const f = fuel.toLowerCase()
  if (f.includes("lpg")) return "lpg"
  if (f.includes("diesel")) return "dizel"
  if (f.includes("hybrid")) return "hibrit"
  if (f.includes("electric")) return "elektrik"
  if (f.includes("petrol")) return "benzin"
  return ""
}
```

Insert this into `src/lib/constants.ts` immediately after the `ocrFuelToSlug` function (after line 201, before `export const QUOTE_STATUS = {`):

```ts

/** TecDoc English fuel_type (VIN resolve) → the form's fixed fuel Select values. */
export function tecdocFuelToFormValue(fuel: string | null): string {
  if (!fuel) return ""
  const f = fuel.toLowerCase()
  if (f.includes("lpg")) return "lpg"
  if (f.includes("diesel")) return "dizel"
  if (f.includes("hybrid")) return "hibrit"
  if (f.includes("electric")) return "elektrik"
  if (f.includes("petrol")) return "benzin"
  return ""
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/constants.test.ts`
Expected: PASS (8 assertions).

- [ ] **Step 5: Remove the local copy from vehicle-create-form.tsx and import it instead**

In `src/components/app/vehicle-create-form.tsx`:
- Delete lines 108-118 (the local `tecdocFuelToFormValue` function and its doc comment).
- In the import block at the top of the file (around line 24), change:
  ```ts
  import { VEHICLE_TYPES, VEHICLE_FUEL_TYPES, VEHICLE_TRANSMISSIONS, ocrVehicleTypeToSlug, ocrFuelToSlug } from "@/lib/constants"
  ```
  to:
  ```ts
  import { VEHICLE_TYPES, VEHICLE_FUEL_TYPES, VEHICLE_TRANSMISSIONS, ocrVehicleTypeToSlug, ocrFuelToSlug, tecdocFuelToFormValue } from "@/lib/constants"
  ```

- [ ] **Step 6: Typecheck and run full test suite**

Run: `bun run typecheck && bun test`
Expected: both clean/green — `vehicle-create-form.tsx` still calls `tecdocFuelToFormValue(c.fuelType)` at its original call site (now resolved via the import), behavior unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/lib/constants.ts src/lib/constants.test.ts src/components/app/vehicle-create-form.tsx
git commit -m "refactor(vin): move tecdocFuelToFormValue to lib/constants for reuse"
```

---

### Task 2: Add `performVinResolve()` + `useVinResolve()` to `vin-resolve.tsx`

**Files:**
- Modify: `src/components/app/vin-resolve.tsx` (add exports; existing `VinResolveButton`/`VinCandidateList` untouched)
- Create: `src/components/app/vin-resolve.test.ts`

**Interfaces:**
- Consumes: `isValidVin`, `RuhsatHints`, `VinCandidate`, `VinResolution` from `@/lib/vin/types` (already used by `vehicle-create-form.tsx` today — same imports, new home).
- Produces (for Task 3 and Task 4 to consume):
  ```ts
  export type VinResolveState = { loading: boolean; error: string; notice: string; candidates: VinCandidate[] }
  export const VIN_RESOLVE_IDLE: VinResolveState
  export interface VinResolveCallbacks {
    onBrand?: (brand: { id: number; name: string }) => void
    onModel?: (model: { id: number; name: string }) => void
    onCandidate: (candidate: VinCandidate) => void
  }
  export function performVinResolve(vin: string, hints: RuhsatHints, callbacks: VinResolveCallbacks): Promise<VinResolveState>
  export function useVinResolve(callbacks: VinResolveCallbacks): VinResolveState & {
    resolve: (vin: string, hints: RuhsatHints) => Promise<void>
    applyCandidate: (c: VinCandidate) => void
    reset: () => void
  }
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/components/app/vin-resolve.test.ts`:

```ts
import { test, expect, afterEach } from "bun:test"
import { performVinResolve, VIN_RESOLVE_IDLE } from "./vin-resolve"
import type { VinCandidate } from "@/lib/vin/types"

const VIN = "SHSRD88604U201888"

function stubFetch(status: number, body: unknown) {
  global.fetch = (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
}

afterEach(() => {
  // @ts-expect-error test-only cleanup
  delete global.fetch
})

const CANDIDATE: VinCandidate = {
  vehicleTypeId: 16573, modelId: 4880, brandId: 45, brandName: "HONDA", modelName: "CR-V II (RD_)",
  label: "2.0 (RD5) • 110 kW / 150 HP • 2001-09–2007-03", name: "2.0 (RD5)",
  cc: 1998, kwt: 110, hp: 150, fuelType: "Petrol", yearFrom: "2001-09", yearTo: "2007-03", score: 0,
}

test("not_found response returns the notice and calls no callbacks", async () => {
  stubFetch(200, { status: "not_found", brand: null, model: null, autoSelected: null, candidates: [], cached: false })
  let called = false
  const state = await performVinResolve(VIN, {}, { onCandidate: () => { called = true } })
  expect(state.notice).toBe("VIN katalogda bulunamadı — marka ve modeli manuel seçin.")
  expect(called).toBe(false)
})

test("resolved with autoSelected calls onBrand/onModel/onCandidate and returns a recognized notice", async () => {
  stubFetch(200, {
    status: "resolved",
    brand: { id: 45, name: "HONDA" },
    model: { id: 4880, name: "CR-V II (RD_)" },
    autoSelected: 16573,
    candidates: [CANDIDATE],
    cached: false,
  })
  const calls: string[] = []
  const state = await performVinResolve(VIN, {}, {
    onBrand: (b) => calls.push(`brand:${b.name}`),
    onModel: (m) => calls.push(`model:${m.name}`),
    onCandidate: (c) => calls.push(`candidate:${c.vehicleTypeId}`),
  })
  expect(calls).toEqual(["brand:HONDA", "model:CR-V II (RD_)", "candidate:16573"])
  expect(state.notice).toBe("Araç katalogdan tanındı: HONDA CR-V II (RD_) 2.0 (RD5)")
  expect(state.candidates).toEqual([])
})

test("resolved without autoSelected (brand/model-only match) skips onCandidate", async () => {
  stubFetch(200, {
    status: "resolved",
    brand: { id: 45, name: "HONDA" },
    model: { id: 4880, name: "CR-V II (RD_)" },
    autoSelected: null,
    candidates: [],
    cached: false,
  })
  let candidateCalled = false
  const state = await performVinResolve(VIN, {}, { onCandidate: () => { candidateCalled = true } })
  expect(candidateCalled).toBe(false)
  expect(state.notice).toBe("Araç katalogdan tanındı: HONDA CR-V II (RD_)")
})

test("ambiguous response returns the candidate list, calls no onCandidate", async () => {
  const second = { ...CANDIDATE, vehicleTypeId: 99999, score: 0 }
  stubFetch(200, {
    status: "ambiguous",
    brand: { id: 45, name: "HONDA" },
    model: { id: 4880, name: "CR-V II (RD_)" },
    autoSelected: null,
    candidates: [CANDIDATE, second],
    cached: false,
  })
  let candidateCalled = false
  const state = await performVinResolve(VIN, {}, { onCandidate: () => { candidateCalled = true } })
  expect(candidateCalled).toBe(false)
  expect(state.candidates).toHaveLength(2)
  expect(state.notice).toBe("")
})

test("HTTP error response returns the server error message", async () => {
  stubFetch(429, { error: "Çok fazla VIN sorgusu yapıldı. Lütfen biraz bekleyip tekrar deneyin." })
  const state = await performVinResolve(VIN, {}, { onCandidate: () => {} })
  expect(state.error).toBe("Çok fazla VIN sorgusu yapıldı. Lütfen biraz bekleyip tekrar deneyin.")
})

test("network failure falls back to the generic retry message", async () => {
  global.fetch = (async () => { throw new Error("network down") }) as unknown as typeof fetch
  const state = await performVinResolve(VIN, {}, { onCandidate: () => {} })
  expect(state.error).toBe("VIN sorgulama sırasında bir hata oluştu. Lütfen tekrar deneyin.")
})

test("VIN_RESOLVE_IDLE is the zero state", () => {
  expect(VIN_RESOLVE_IDLE).toEqual({ loading: false, error: "", notice: "", candidates: [] })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/components/app/vin-resolve.test.ts`
Expected: FAIL — `performVinResolve`/`VIN_RESOLVE_IDLE` are not exported from `./vin-resolve` yet.

- [ ] **Step 3: Implement `performVinResolve` and `useVinResolve`**

At the top of `src/components/app/vin-resolve.tsx`, change:

```ts
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, ScanLine, Check, BadgeCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VinCandidate } from "@/lib/vin/types"

export type { VinCandidate }
```

to:

```ts
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, ScanLine, Check, BadgeCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { isValidVin, type RuhsatHints, type VinCandidate, type VinResolution } from "@/lib/vin/types"

export type { VinCandidate }

export type VinResolveState = {
  loading: boolean
  error: string
  notice: string
  candidates: VinCandidate[]
}

export const VIN_RESOLVE_IDLE: VinResolveState = { loading: false, error: "", notice: "", candidates: [] }

export interface VinResolveCallbacks {
  /** A brand-only or brand+model TecDoc hit. Always followed by onCandidate when a single engine variant auto-selects. */
  onBrand?: (brand: { id: number; name: string }) => void
  onModel?: (model: { id: number; name: string }) => void
  /** The auto-selected candidate (status "resolved") or a manually-picked one from VinCandidateList. */
  onCandidate: (candidate: VinCandidate) => void
}

/**
 * Calls /api/vin/resolve and interprets the response into UI state, firing the
 * given callbacks as a side effect. Pure aside from fetch + callbacks, so it's
 * directly testable without rendering — the two consumers (react-hook-form vs.
 * plain useState) each supply callbacks that write into their own field state.
 */
export async function performVinResolve(
  vin: string,
  hints: RuhsatHints,
  callbacks: VinResolveCallbacks
): Promise<VinResolveState> {
  try {
    const res = await fetch("/api/vin/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vin, hints }),
    })
    const data = await res.json()
    if (!res.ok) {
      return { ...VIN_RESOLVE_IDLE, error: data.error || "VIN sorgulanamadı." }
    }
    const result = data as VinResolution
    if (result.status === "not_found") {
      return { ...VIN_RESOLVE_IDLE, notice: "VIN katalogda bulunamadı — marka ve modeli manuel seçin." }
    }
    if (result.brand) callbacks.onBrand?.(result.brand)
    if (result.model) callbacks.onModel?.(result.model)
    const autoCandidate =
      result.status === "resolved" && result.autoSelected != null
        ? result.candidates.find((c) => c.vehicleTypeId === result.autoSelected)
        : undefined
    if (autoCandidate) {
      callbacks.onCandidate(autoCandidate)
      return {
        ...VIN_RESOLVE_IDLE,
        notice: `Araç katalogdan tanındı: ${autoCandidate.brandName} ${autoCandidate.modelName} ${autoCandidate.name}`,
      }
    }
    if (result.status === "resolved") {
      return {
        ...VIN_RESOLVE_IDLE,
        notice: `Araç katalogdan tanındı: ${[result.brand?.name, result.model?.name].filter(Boolean).join(" ")}`,
      }
    }
    return { ...VIN_RESOLVE_IDLE, candidates: result.candidates }
  } catch {
    return { ...VIN_RESOLVE_IDLE, error: "VIN sorgulama sırasında bir hata oluştu. Lütfen tekrar deneyin." }
  }
}

/** React state wrapper around performVinResolve — see that function for the interpretation rules. */
export function useVinResolve(callbacks: VinResolveCallbacks) {
  const [state, setState] = useState<VinResolveState>(VIN_RESOLVE_IDLE)

  async function resolve(vin: string, hints: RuhsatHints) {
    if (!isValidVin(vin)) return
    setState({ ...VIN_RESOLVE_IDLE, loading: true })
    const next = await performVinResolve(vin, hints, callbacks)
    setState(next)
  }

  function applyCandidate(c: VinCandidate) {
    callbacks.onCandidate(c)
    setState({ ...VIN_RESOLVE_IDLE, notice: `Araç katalogdan tanındı: ${c.brandName} ${c.modelName} ${c.name}` })
  }

  return { ...state, resolve, applyCandidate, reset: () => setState(VIN_RESOLVE_IDLE) }
}
```

Leave the rest of the file (`VinResolveButton`, `VinCandidateList`) exactly as-is below this.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/components/app/vin-resolve.test.ts`
Expected: PASS (7 tests, matches the 7 `test(...)` blocks above).

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: clean (no consumers changed yet, so no breakage expected).

- [ ] **Step 6: Commit**

```bash
git add src/components/app/vin-resolve.tsx src/components/app/vin-resolve.test.ts
git commit -m "feat(vin): extract performVinResolve/useVinResolve for reuse across forms"
```

---

### Task 3: Refactor `vehicle-create-form.tsx` to use `useVinResolve`

**Files:**
- Modify: `src/components/app/vehicle-create-form.tsx`

**Interfaces:**
- Consumes: `useVinResolve`, `VinResolveButton`, `VinCandidateList` from `./vin-resolve` (Task 2); `tecdocFuelToFormValue` from `@/lib/constants` (Task 1).
- No new exports — this task only changes internals; the component's props and rendered output are unchanged.

- [ ] **Step 1: Replace the import line**

Change (current line 28):
```ts
import { VinResolveButton, VinCandidateList } from "./vin-resolve"
```
to:
```ts
import { VinResolveButton, VinCandidateList, useVinResolve } from "./vin-resolve"
```

- [ ] **Step 2: Remove the old state and local functions, add the hook**

Delete the `VinResolveState`/`VIN_RESOLVE_IDLE` type+const block (current lines 120-127) — these now live in `vin-resolve.tsx`.

Delete the `const [vinResolve, setVinResolve] = useState<VinResolveState>(VIN_RESOLVE_IDLE)` line (current line 133).

Replace the entire `applyCandidate` function and `runVinResolve` function (current lines 155-220) with:

```ts
  /** Bind an engine variant: catalog ids + canonical brand/model + backfill of empty engine fields. */
  function applyCandidateFields(c: VinCandidate) {
    form.setValue("brand", c.brandName, { shouldValidate: true, shouldDirty: true })
    form.setValue("model", c.modelName, { shouldValidate: true, shouldDirty: true })
    form.setValue("catalogBrandId", c.brandId, { shouldDirty: true })
    form.setValue("catalogModelId", c.modelId, { shouldDirty: true })
    form.setValue("catalogVehicleTypeId", c.vehicleTypeId, { shouldDirty: true })
    if (c.cc != null) setIfEmpty("engineDisplacement", String(c.cc))
    if (c.kwt != null) setIfEmpty("enginePower", `${c.kwt} kW`)
    const fuel = tecdocFuelToFormValue(c.fuelType)
    if (fuel) setIfEmpty("fuelType", fuel)
    const year = c.yearFrom ? Number(c.yearFrom.slice(0, 4)) : NaN
    if (!Number.isNaN(year)) setIfEmpty("modelYear", year)
  }

  const vinResolve = useVinResolve({
    onBrand: (b) => {
      form.setValue("brand", b.name, { shouldValidate: true, shouldDirty: true })
      form.setValue("catalogBrandId", b.id, { shouldDirty: true })
    },
    onModel: (m) => {
      form.setValue("model", m.name, { shouldValidate: true, shouldDirty: true })
      form.setValue("catalogModelId", m.id, { shouldDirty: true })
    },
    onCandidate: applyCandidateFields,
  })
```

Note the import of `VinCandidate` type must already be present — confirm the existing import line (current line 29) still reads:
```ts
import { isValidVin, type RuhsatHints, type VinCandidate, type VinResolution } from "@/lib/vin/types"
```
`VinResolution` is no longer used directly in this file after the refactor (it was only used inside the deleted `runVinResolve`) — remove it from this import to avoid an unused-import lint error:
```ts
import { isValidVin, type RuhsatHints, type VinCandidate } from "@/lib/vin/types"
```

- [ ] **Step 3: Update the manual "VIN'den getir" button call site**

Current (around line 456-468):
```tsx
                        <VinResolveButton
                          loading={vinResolve.loading}
                          disabled={!isValidVin(field.value)}
                          onClick={() =>
                            runVinResolve({
                              engineDisplacement: form.getValues("engineDisplacement") || undefined,
                              enginePower: form.getValues("enginePower") || undefined,
                              fuelType: form.getValues("fuelType") || undefined,
                              firstRegistrationDate: form.getValues("firstRegistrationDate") || undefined,
                              modelYear: form.getValues("modelYear") ?? undefined,
                            })
                          }
                        />
```
becomes:
```tsx
                        <VinResolveButton
                          loading={vinResolve.loading}
                          disabled={!isValidVin(field.value)}
                          onClick={() =>
                            vinResolve.resolve(form.getValues("vin") || "", {
                              engineDisplacement: form.getValues("engineDisplacement") || undefined,
                              enginePower: form.getValues("enginePower") || undefined,
                              fuelType: form.getValues("fuelType") || undefined,
                              firstRegistrationDate: form.getValues("firstRegistrationDate") || undefined,
                              modelYear: form.getValues("modelYear") ?? undefined,
                            })
                          }
                        />
```

- [ ] **Step 4: Update the `VinCandidateList` call site**

Current (around lines 486-499):
```tsx
                {vinResolve.candidates.length > 0 && (
                  <VinCandidateList
                    candidates={vinResolve.candidates}
                    selectedId={form.watch("catalogVehicleTypeId") ?? null}
                    onSelect={(c) => {
                      applyCandidate(c)
                      setVinResolve({
                        ...VIN_RESOLVE_IDLE,
                        notice: `Araç katalogdan tanındı: ${c.brandName} ${c.modelName} ${c.name}`,
                      })
                    }}
                    onDismiss={() => setVinResolve(VIN_RESOLVE_IDLE)}
                  />
                )}
```
becomes:
```tsx
                {vinResolve.candidates.length > 0 && (
                  <VinCandidateList
                    candidates={vinResolve.candidates}
                    selectedId={form.watch("catalogVehicleTypeId") ?? null}
                    onSelect={(c) => vinResolve.applyCandidate(c)}
                    onDismiss={() => vinResolve.reset()}
                  />
                )}
```

- [ ] **Step 5: Update the OCR-triggered auto-resolve call site**

Current (around lines 615-625):
```tsx
                    // Valid VIN on the ruhsat → resolve brand/model/engine variant from the
                    // TecDoc catalog. Fire-and-forget: the OCR fill above is never blocked.
                    if (isValidVin(values.vin)) {
                      void runVinResolve({
                        engineDisplacement: values.engineDisplacement || undefined,
                        enginePower: values.enginePower || undefined,
                        fuelType: values.fuelType || undefined,
                        firstRegistrationDate: values.registrationDate || undefined,
                        modelYear: values.modelYear ? Number(values.modelYear) || undefined : undefined,
                      })
                    }
```
becomes:
```tsx
                    // Valid VIN on the ruhsat → resolve brand/model/engine variant from the
                    // TecDoc catalog. Fire-and-forget: the OCR fill above is never blocked.
                    void vinResolve.resolve(values.vin || "", {
                      engineDisplacement: values.engineDisplacement || undefined,
                      enginePower: values.enginePower || undefined,
                      fuelType: values.fuelType || undefined,
                      firstRegistrationDate: values.registrationDate || undefined,
                      modelYear: values.modelYear ? Number(values.modelYear) || undefined : undefined,
                    })
```
(`vinResolve.resolve` already no-ops on an invalid VIN internally, so the outer `isValidVin` guard is redundant and can be dropped — behavior is identical.)

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: clean. If it reports an unused `VinResolution` import or unused `VIN_RESOLVE_IDLE`/`VinResolveState`, confirm Step 2's deletions were applied fully.

- [ ] **Step 7: Run full test suite**

Run: `bun test`
Expected: all existing tests still pass (this file has no dedicated test suite today — `resolve.test.ts` covers the pure scoring functions it doesn't touch).

- [ ] **Step 8: Manual regression QA (no automated UI test exists for this form)**

Start the dev server (`bun run dev` or equivalent already-running instance) and in the browser:
1. Go to `/vehicles/new`, scan a ruhsat with a valid VIN → confirm brand/model/engine auto-fill exactly as before.
2. Type a VIN manually, click "VIN'den getir" → confirm the same not_found / resolved / ambiguous behaviors as before.
3. For an ambiguous VIN, pick a candidate from the list → confirm it fills the fields and shows the "Araç katalogdan tanındı" notice.

- [ ] **Step 9: Commit**

```bash
git add src/components/app/vehicle-create-form.tsx
git commit -m "refactor(vin): vehicle-create-form uses shared useVinResolve hook"
```

---

### Task 4: Wire VIN resolve into `InlineCreateModal`

**Files:**
- Modify: `src/components/app/inline-create-modal.tsx`

**Interfaces:**
- Consumes: `useVinResolve`, `VinResolveButton`, `VinCandidateList` from `./vin-resolve` (Task 2); `isValidVin`, `type VinCandidate` from `@/lib/vin/types` (hint objects are passed as inline literals and checked structurally against `RuhsatHints` — no explicit import of that type needed in this file); `tecdocFuelToFormValue` from `@/lib/constants` (Task 1).
- No new exports — `InlineCreateResult` and the component's public props are unchanged.

- [ ] **Step 1: Add imports**

At the top of `src/components/app/inline-create-modal.tsx`, change:
```ts
import { AlertTriangle, Car, ChevronDown, Loader2, User, X } from "lucide-react"
import { CustomerSearchOrCreate } from "./customer-search-or-create"
import { VehicleBrandModelPicker } from "./vehicle-brand-model-picker"
import { RuhsattanOku, type RuhsattanOkuResult } from "./ruhsattan-oku"
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/ocr/types"
import { normalizePlate } from "@/lib/format"
import { findExactPlateMatch, type ExistingVehicleMatch } from "@/lib/search/exact-plate-match"
import type { UnifiedResult } from "@/lib/search/unified-results"
```
to:
```ts
import { AlertTriangle, Car, ChevronDown, Loader2, User, X } from "lucide-react"
import { CustomerSearchOrCreate } from "./customer-search-or-create"
import { VehicleBrandModelPicker } from "./vehicle-brand-model-picker"
import { RuhsattanOku, type RuhsattanOkuResult } from "./ruhsattan-oku"
import { VinResolveButton, VinCandidateList, useVinResolve } from "./vin-resolve"
import { isValidVin, type VinCandidate } from "@/lib/vin/types"
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/ocr/types"
import { normalizePlate } from "@/lib/format"
import { tecdocFuelToFormValue } from "@/lib/constants"
import { findExactPlateMatch, type ExistingVehicleMatch } from "@/lib/search/exact-plate-match"
import type { UnifiedResult } from "@/lib/search/unified-results"
```
(`@/lib/constants` is not otherwise imported in this file today, so it's added as its own line rather than merged into an existing one.)

- [ ] **Step 2: Add `catalogIds` state and reset it on modal open**

Change (current lines 100-101):
```ts
  // Girilen plaka DB'de zaten kayıtlıysa: mevcut aracı seçime dönüştürmek için tutulur.
  const [existingMatch, setExistingMatch] = useState<ExistingVehicleMatch | null>(null)
```
to:
```ts
  // Girilen plaka DB'de zaten kayıtlıysa: mevcut aracı seçime dönüştürmek için tutulur.
  const [existingMatch, setExistingMatch] = useState<ExistingVehicleMatch | null>(null)
  // VIN çözümlemesinden gelen katalog bağı — marka/model elle değiştirilirse temizlenir.
  const [catalogIds, setCatalogIds] = useState<{ brandId?: number; modelId?: number; vehicleTypeId?: number }>({})
```

Change the reset block (current lines 110-124):
```ts
  const wasOpen = useRef(false)
  useEffect(() => {
    const justOpened = open && !wasOpen.current
    wasOpen.current = open
    if (!justOpened) return
    setTimeout(() => {
      setOwner(fixedCustomer ?? null)
      setFields({ ...EMPTY_FIELDS, plate: (initialPlate || "").toUpperCase() })
      setError("")
      setLoading(false)
      setOwnerSeed(null)
      setConfidence({})
      setShowDetails(false)
      setExistingMatch(null)
    }, 0)
  }, [open, initialPlate, fixedCustomer])
```
to:
```ts
  const wasOpen = useRef(false)
  useEffect(() => {
    const justOpened = open && !wasOpen.current
    wasOpen.current = open
    if (!justOpened) return
    setTimeout(() => {
      setOwner(fixedCustomer ?? null)
      setFields({ ...EMPTY_FIELDS, plate: (initialPlate || "").toUpperCase() })
      setError("")
      setLoading(false)
      setOwnerSeed(null)
      setConfidence({})
      setShowDetails(false)
      setExistingMatch(null)
      setCatalogIds({})
      vinResolve.reset()
    }, 0)
  }, [open, initialPlate, fixedCustomer]) // eslint-disable-line react-hooks/exhaustive-deps -- vinResolve is stable-shaped, re-running on its identity would loop
```

(`vinResolve` is defined in Step 3 below — declare it before this `useEffect` in the component body, i.e. directly after the `catalogIds` state line, so it's in scope here.)

- [ ] **Step 3: Wire `useVinResolve`**

Immediately after the `catalogIds` state declaration from Step 2, add:
```ts
  const vinResolve = useVinResolve({
    onBrand: (b) => { setField("brand", b.name); setCatalogIds((p) => ({ ...p, brandId: b.id })) },
    onModel: (m) => { setField("model", m.name); setCatalogIds((p) => ({ ...p, modelId: m.id })) },
    onCandidate: (c: VinCandidate) => {
      setCatalogIds({ brandId: c.brandId, modelId: c.modelId, vehicleTypeId: c.vehicleTypeId })
      setFields((prev) => ({
        ...prev,
        brand: c.brandName,
        model: c.modelName,
        engineDisplacement: prev.engineDisplacement || (c.cc != null ? String(c.cc) : prev.engineDisplacement),
        enginePower: prev.enginePower || (c.kwt != null ? `${c.kwt} kW` : prev.enginePower),
        fuelType: prev.fuelType || tecdocFuelToFormValue(c.fuelType) || prev.fuelType,
        modelYear: prev.modelYear || (c.yearFrom ? String(Number(c.yearFrom.slice(0, 4))) : prev.modelYear),
      }))
    },
  })
```

Note: `setField` is the existing single-key setter (`function setField(key, value) { ... }`, defined above at current line 103) — it's already declared before this point in the file, so it's in scope.

- [ ] **Step 4: Auto-trigger resolve from `applyOcr`**

Current `applyOcr` function (lines 151-185) ends with:
```ts
    if (owner.label) setOwnerSeed(owner)
    setShowDetails(true)
  }
```
Change the function signature and this ending. Current signature:
```ts
  function applyOcr({ values, confidence: conf, owner }: RuhsattanOkuResult) {
```
stays the same. Add, right before the closing `}` of the function (i.e. after `setShowDetails(true)`):
```ts
    if (owner.label) setOwnerSeed(owner)
    setShowDetails(true)
    if (isValidVin(values.vin)) {
      void vinResolve.resolve(values.vin, {
        engineDisplacement: values.engineDisplacement || undefined,
        enginePower: values.enginePower || undefined,
        fuelType: values.fuelType || undefined,
        firstRegistrationDate: values.registrationDate || undefined,
        modelYear: values.modelYear ? Number(values.modelYear) || undefined : undefined,
      })
    }
  }
```

- [ ] **Step 5: Clear catalog ids on manual brand/model change**

Current (lines 312-318):
```tsx
            <VehicleBrandModelPicker
              brand={fields.brand}
              model={fields.model}
              onBrandChange={(v) => setField("brand", v)}
              onModelChange={(v) => setField("model", v)}
              required
            />
```
becomes:
```tsx
            <VehicleBrandModelPicker
              brand={fields.brand}
              model={fields.model}
              onBrandChange={(v) => { setField("brand", v); setCatalogIds({}) }}
              onModelChange={(v) => { setField("model", v); setCatalogIds((p) => ({ brandId: p.brandId })) }}
              required
            />
```

- [ ] **Step 6: Render the VIN resolve button + status UI**

Current VIN field block (lines 382-385):
```tsx
              <div className="space-y-1 col-span-2">
                <Label className="flex items-center gap-1">Şase No (VIN) {lowConf("vin") && <AlertTriangle className="size-3 text-warning" />}</Label>
                <Input value={fields.vin} onChange={(e) => setField("vin", e.target.value.toUpperCase())} className={fieldClass("vin")} />
              </div>
```
becomes:
```tsx
              <div className="space-y-1 col-span-2">
                <Label className="flex items-center gap-1">Şase No (VIN) {lowConf("vin") && <AlertTriangle className="size-3 text-warning" />}</Label>
                <div className="flex gap-2">
                  <Input value={fields.vin} onChange={(e) => setField("vin", e.target.value.toUpperCase())} className={fieldClass("vin")} />
                  <VinResolveButton
                    loading={vinResolve.loading}
                    disabled={!isValidVin(fields.vin)}
                    onClick={() =>
                      vinResolve.resolve(fields.vin, {
                        engineDisplacement: fields.engineDisplacement || undefined,
                        enginePower: fields.enginePower || undefined,
                        fuelType: fields.fuelType || undefined,
                        firstRegistrationDate: fields.firstRegistrationDate || undefined,
                        modelYear: fields.modelYear ? Number(fields.modelYear) || undefined : undefined,
                      })
                    }
                  />
                </div>
                {vinResolve.loading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="size-3 animate-spin" /> VIN sorgulanıyor…
                  </p>
                )}
                {vinResolve.notice && <p className="text-xs text-muted-foreground">{vinResolve.notice}</p>}
                {vinResolve.error && <p className="text-xs text-destructive">{vinResolve.error}</p>}
                {vinResolve.candidates.length > 0 && (
                  <VinCandidateList
                    candidates={vinResolve.candidates}
                    selectedId={catalogIds.vehicleTypeId ?? null}
                    onSelect={(c) => vinResolve.applyCandidate(c)}
                    onDismiss={() => vinResolve.reset()}
                  />
                )}
              </div>
```

- [ ] **Step 7: Send catalog ids in `handleCreate`**

Current (lines 222-237):
```ts
      const vf = new FormData()
      vf.set("customerId", owner.id)
      vf.set("plate", fields.plate)
      vf.set("brand", fields.brand)
      vf.set("model", fields.model)
      if (fields.modelYear) vf.set("modelYear", fields.modelYear)
      vf.set("vehicleType", fields.vehicleType)
      vf.set("commercialName", fields.commercialName)
      vf.set("vin", fields.vin)
      vf.set("engineNo", fields.engineNo)
      vf.set("fuelType", fields.fuelType)
      vf.set("engineDisplacement", fields.engineDisplacement)
      vf.set("enginePower", fields.enginePower)
      vf.set("firstRegistrationDate", fields.firstRegistrationDate)
      vf.set("inspectionValidUntil", fields.inspectionValidUntil)
```
becomes:
```ts
      const vf = new FormData()
      vf.set("customerId", owner.id)
      vf.set("plate", fields.plate)
      vf.set("brand", fields.brand)
      vf.set("model", fields.model)
      if (fields.modelYear) vf.set("modelYear", fields.modelYear)
      vf.set("vehicleType", fields.vehicleType)
      vf.set("commercialName", fields.commercialName)
      vf.set("vin", fields.vin)
      vf.set("engineNo", fields.engineNo)
      vf.set("fuelType", fields.fuelType)
      vf.set("engineDisplacement", fields.engineDisplacement)
      vf.set("enginePower", fields.enginePower)
      vf.set("firstRegistrationDate", fields.firstRegistrationDate)
      vf.set("inspectionValidUntil", fields.inspectionValidUntil)
      if (catalogIds.brandId) vf.set("catalogBrandId", String(catalogIds.brandId))
      if (catalogIds.modelId) vf.set("catalogModelId", String(catalogIds.modelId))
      if (catalogIds.vehicleTypeId) vf.set("catalogVehicleTypeId", String(catalogIds.vehicleTypeId))
```

- [ ] **Step 8: Typecheck**

Run: `bun run typecheck`
Expected: clean. Common mistakes to check if it fails: the `@/lib/format` vs `@/lib/constants` import split from Step 1, and that `vinResolve` is declared before the `useEffect` that calls `vinResolve.reset()` (Step 2/3 ordering).

- [ ] **Step 9: Run full test suite**

Run: `bun test`
Expected: all pass, including the new `vin-resolve.test.ts` and `constants.test.ts` from Tasks 1-2.

- [ ] **Step 10: Manual QA**

With the dev server running, go to `/orders/new` (or wherever `InlineCreateModal` is opened — the "Yeni araç" flow) and verify, per the spec's manual QA section:
1. Open "Yeni araç" → scan a ruhsat with a valid VIN → TecDoc query fires automatically → brand/model (and engine variant, if a single match) auto-fill.
2. Same modal: type a VIN by hand, click "VIN'den getir" → same resolved/ambiguous/not_found behaviors.
3. Try a VIN with multiple engine variants → candidate list appears; picking one fills brand/model/engine fields.
4. Manually change brand or model after a VIN resolve → create the vehicle → confirm in the DB (`prisma.vehicle.findUnique` or Prisma Studio) that `catalogVehicleTypeId` is `null` (catalog link was cleared).
5. Create a vehicle via a successful VIN resolve → confirm `catalogBrandId`/`catalogModelId`/`catalogVehicleTypeId` are populated in the DB.

- [ ] **Step 11: Commit**

```bash
git add src/components/app/inline-create-modal.tsx
git commit -m "feat(vin): resolve VIN to TecDoc catalog directly in the order-wizard vehicle modal"
```

---

### Task 5: Final full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `bun run typecheck`
Expected: clean, zero errors.

- [ ] **Step 2: Full test suite**

Run: `bun test`
Expected: 126 pass, 0 fail, across 27 files (confirmed baseline on this branch: 118 pass / 25 files before this plan; this plan adds 1 test in `constants.test.ts` + 7 tests in `vin-resolve.test.ts` = 126 / 27).

- [ ] **Step 3: Lint**

Run: `bun run lint`
Expected: clean, zero errors/warnings on changed files.

- [ ] **Step 4: Manual regression sweep**

Re-confirm both entry points side by side in the browser:
- `/vehicles/new` (and `/vehicles/[id]/edit`) — VIN resolve still behaves exactly as before the refactor (Task 3, Step 8 already covered this in detail; do a final quick pass).
- `/orders/new` → "Yeni araç" modal — VIN resolve now works (Task 4, Step 10).

- [ ] **Step 5: Final commit (if any cleanup needed)**

If lint or the manual sweep surfaces small fixes, commit them separately with a description of what was fixed. Otherwise this task produces no commit — Tasks 1-4's commits are the deliverable.
