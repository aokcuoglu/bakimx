/**
 * Same phone may belong to more than one customer in a workshop.
 * Create/update still warns first; a second submit with
 * {@link ALLOW_DUPLICATE_PHONE_FIELD} is required to proceed.
 */

export type ExistingCustomer = { id: string; label: string }

export const ALLOW_DUPLICATE_PHONE_FIELD = "allowDuplicatePhone"

export function isDuplicatePhoneConfirmed(formData: FormData): boolean {
  const value = formData.get(ALLOW_DUPLICATE_PHONE_FIELD)
  return value === "on" || value === "true" || value === "1"
}

export function duplicatePhoneWarning(existing: ExistingCustomer[]): {
  error: string
  existingCustomers: ExistingCustomer[]
  existingCustomer: ExistingCustomer
} {
  const names = existing.map((c) => c.label).join(", ")
  const error =
    existing.length === 1
      ? `Bu telefon numarası zaten ${names} adlı müşteriye ait.`
      : `Bu telefon numarası zaten şu müşterilere ait: ${names}.`
  return {
    error,
    existingCustomers: existing,
    existingCustomer: existing[0],
  }
}

export function resolveDuplicatePhone(existing: ExistingCustomer[], allowDuplicate: boolean) {
  if (existing.length === 0 || allowDuplicate) return { ok: true as const }
  return { ok: false as const, ...duplicatePhoneWarning(existing) }
}
