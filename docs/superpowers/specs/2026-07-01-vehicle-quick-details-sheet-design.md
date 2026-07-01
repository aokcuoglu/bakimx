# Vehicle Quick Details Sheet — Design

Date: 2026-07-01

## Problem

In the work order wizard's step 1 ("Müşteri & Araç"), once a vehicle is selected, the card at `customer-vehicle-picker.tsx:169-194` shows only plate, brand/model, and owner. There is no way to check the vehicle's other properties (VIN, engine info, ruhsat fields, mileage, etc.) without leaving the wizard — losing in-progress form state — to visit `/vehicles/[id]`.

## Goal

Let the user peek at a vehicle's key properties directly from the selected-vehicle card, without leaving the wizard.

## Scope

- Only the selected-vehicle card in `customer-vehicle-picker.tsx` (used exclusively by `intake-wizard.tsx` — no other call sites).
- Basic vehicle properties only (no work order history, damage, or photos — those stay on the full detail page).
- One outbound link to the full `/vehicles/[id]` page for users who want the complete history.

## Design

### Trigger

Add a second ghost button next to the existing "Sahip Değiştir" button on the selected-vehicle card:

```
[Sahip Değiştir]  [Detay]
```

"Detay" uses an info icon, matching the existing button style (`variant="ghost" size="sm" className="text-muted-foreground"`).

### Presentation

Reuses the existing `BottomSheet` component (`src/components/shared/bottom-sheet.tsx`) — the same mobile-first bottom-drawer pattern already used elsewhere in the app. This keeps the wizard's step/progress state fully intact; nothing is unmounted or navigated away from.

### Data fetching

- On first open, fetch `GET /api/vehicles/{vehicleId}` (existing endpoint, already tenant-isolated via `requireAuth`/`getAppData`, already returns the full `Vehicle` record + `customer`).
- Cache the result in local component state so re-opening the sheet doesn't refetch.
- While loading: show `BrandSpinner` (per established loading-state convention — no skeleton loaders).
- On fetch error: show inline text "Araç bilgileri yüklenemedi." inside the sheet body. The wizard itself is unaffected.

### Content

A grid of label/value boxes, styled like the existing `SummaryItem` pattern in `vehicle-detail.tsx` (`dt`/`dd`, rounded box, muted label + bold value) — but implemented as a small **local** component in the new file, not extracted/shared, to keep this change isolated from the working detail page.

Fields shown, with existing formatting conventions (`formatDate`/`formatDateTime` from `@/lib/utils-client`, km via `toLocaleString("tr-TR")`, "—" fallback for empty values):

| Field | Label |
|---|---|
| plate | Plaka |
| brand | Marka |
| model | Model |
| vehicleType | Araç Tipi |
| modelYear | Model Yılı |
| mileage | Kilometre |
| color | Renk |
| fuelType | Yakıt |
| transmission | Şanzıman |
| vin (+ vinConfirmed) | Şase No (+ teyit rozeti) |
| engineNo | Motor No |
| commercialName | Ticari Adı |
| firstRegistrationDate | İlk Tescil Tarihi |
| engineDisplacement | Motor Hacmi |
| enginePower | Motor Gücü |
| inspectionValidUntil | Muayene Geçerlilik Tarihi |

The last five (ruhsat fields) exist in the DB and in `vehicle-create-form.tsx` but are not currently shown on `/vehicles/[id]` either — this sheet is their first surfaced display.

Owner is intentionally omitted from the sheet body since it's already visible on the card itself (`sublabel`).

### Footer link

Below the field grid, a small link: "Tüm geçmişi görüntüle →" opening `/vehicles/{vehicleId}` in a new tab (`target="_blank"`), for users who want work order history, damage records, or photos.

## Files touched

- New: `src/components/app/vehicle-quick-details-sheet.tsx` — the sheet component, fetch logic, and field-box rendering.
- Edit: `src/components/app/customer-vehicle-picker.tsx` — add the "Detay" trigger button to the selected-vehicle card block (~line 180-190).

## Error handling

- Fetch failure (network, 404, tenant mismatch) → inline error message, sheet stays open, no crash.
- No vehicleId available → button not rendered (shouldn't happen since the card only renders when a vehicle is selected).

## Out of scope / explicitly not doing

- Not adding work order history, damage, or photo data to the sheet (full page already covers this, deliberately excluded per user's scope answer).
- Not extracting `SummaryItem` into a shared component across `vehicle-detail.tsx` and the new sheet — duplication of a ~8-line presentational component is preferred over touching working code in an unrelated file for this change.
- Not adding this pattern to any other picker/flow — `customer-vehicle-picker.tsx` has a single call site today.
