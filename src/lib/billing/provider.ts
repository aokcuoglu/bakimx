import { generateOrderReference } from "@/lib/billing/reference"

export interface HavaleInfo {
  iban: string
  accountTitle: string
  bank: string
}

export interface PaymentInstruction {
  method: "havale"
  reference: string
  havale: HavaleInfo
  amountMinor: number
}

/**
 * Payment provider seam. v1 = manual havale (admin confirms). A future
 * IyzicoProvider implements the same interface (initiate -> redirect/3DS,
 * confirm -> webhook), so the checkout UI + BillingOrder stay unchanged.
 */
export interface PaymentProvider {
  initiate(input: { amountMinor: number; reference?: string }): PaymentInstruction
}

/** Centralized havale instructions (single env read; used by checkout pages). */
export function getHavaleInstructions(): HavaleInfo {
  return {
    iban: process.env.BILLING_HAVALE_IBAN || "—",
    accountTitle: process.env.BILLING_HAVALE_ACCOUNT_TITLE || "BakımX",
    bank: process.env.BILLING_HAVALE_BANK || "—",
  }
}

export const manualHavaleProvider: PaymentProvider = {
  initiate({ amountMinor, reference }) {
    return {
      method: "havale",
      reference: reference ?? generateOrderReference(),
      havale: getHavaleInstructions(),
      amountMinor,
    }
  },
}
