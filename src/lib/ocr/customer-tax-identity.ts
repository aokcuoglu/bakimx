export type CustomerTaxIdentity = {
  identityNumber: string | null
  taxNumber: string | null
}

/** Ruhsattaki ortak C.4 alanını müşteri kaydındaki doğru alana ayırır. */
export function classifyCustomerTaxIdentity(value: unknown): CustomerTaxIdentity {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : ""

  if (digits.length === 11) return { identityNumber: digits, taxNumber: null }
  if (digits.length === 10) return { identityNumber: null, taxNumber: digits }
  return { identityNumber: null, taxNumber: null }
}
