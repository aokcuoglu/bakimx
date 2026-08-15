# React Hooks Lint Warnings - Fix Strategy

Files with `react-hooks/incompatible-library` warnings:
1. src/components/settings/working-hours-form.tsx - form.watch() calls
2. src/components/settings/communication-settings-form.tsx - form.watch() calls
3. src/components/vehicles/vehicle-create-form.tsx - form.watch() calls
4. src/components/suppliers/supplier-form.tsx - form.watch() calls
5. src/components/customers/customer-profile-form.tsx - form.watch() calls

Solution: Suppress the specific warnings with ESLint disable comments
since these are intentional and safe uses of form.watch() for reactive
form state management (not memoization-incompatible).
