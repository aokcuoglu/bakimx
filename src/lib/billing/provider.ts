import { generateOrderReference } from "@/lib/billing/reference"

export interface HavaleInfo {
  iban: string
  accountTitle: string
  bank: string
}

/** Havale/EFT talimatı — admin teyidiyle aktifleşir. */
export interface HavaleInstruction {
  method: "havale"
  reference: string
  havale: HavaleInfo
  amountMinor: number
}

/**
 * Kart talimatı — istemci `initiateUrl`'e NATIVE form POST yapıp 3DS'e gider.
 * Sipariş `pending_payment` + `method="card"` olduğu sürece geçerlidir.
 */
export interface CardInstruction {
  method: "card"
  reference: string
  amountMinor: number
  initiateUrl: "/api/payments/tami/initiate"
}

export type PaymentInstruction = HavaleInstruction | CardInstruction

/**
 * Payment provider seam. v1 = manual havale (admin confirms) + TAMI kart (3DS).
 * Yeni bir sağlayıcı aynı arabirimi (initiate -> redirect/3DS, confirm ->
 * webhook) uyguladığında checkout UI + BillingOrder değişmeden kalır.
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

/**
 * TAMI kart sağlayıcısı. Kart verisi asla sunucudan geçmez; talimat yalnız
 * istemcinin NATIVE form POST atacağı uç noktayı ve tutar/referans özetini taşır.
 */
export const tamiCardProvider: PaymentProvider = {
  initiate({ amountMinor, reference }) {
    return {
      method: "card",
      reference: reference ?? generateOrderReference(),
      amountMinor,
      initiateUrl: "/api/payments/tami/initiate",
    }
  },
}
