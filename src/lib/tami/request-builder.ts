import type { TamiCard } from "./types"

export interface TamiPaymentInput {
  orderId: string
  amountMinor: number
  callbackUrl?: string
  card: TamiCard
  contact: {
    name: string
    surName: string
    email: string
    phone: string
    ip: string
    city?: string
    address?: string
    companyName?: string
  }
  basketItemName: string
}

/** Kuruş → TAMI'nin SAYI amount'u (canlı sandbox doğrulaması: string "1.00" DEĞİL, 1). */
export function minorToTamiAmountNumber(amountMinor: number): number {
  return Math.round(amountMinor) / 100
}

/** Canlı sandbox'ta doğrulanmış istek gövdesi (resmi Node.js örneği şekli).
 *  identityNumber/registration* alanları sandbox'ta zorunluydu; sabit güvenli değerler. */
export function buildTamiPaymentBody(input: TamiPaymentInput) {
  const amount = minorToTamiAmountNumber(input.amountMinor)
  const contactName = `${input.contact.name} ${input.contact.surName}`.trim()
  const addr = {
    address: input.contact.address || "Belirtilmedi",
    city: input.contact.city || "İstanbul",
    companyName: input.contact.companyName || contactName,
    country: "Türkiye",
    district: "Merkez",
    contactName,
    phoneNumber: input.contact.phone,
    zipCode: "34000",
  }
  const nowIso = new Date().toISOString().replace(/Z$/, "")
  return {
    ...(input.callbackUrl ? { callbackUrl: input.callbackUrl } : {}),
    currency: "TRY" as const,
    installmentCount: 1,
    motoInd: false,
    paymentGroup: "PRODUCT" as const,
    paymentChannel: "WEB" as const,
    card: input.card,
    billingAddress: addr,
    shippingAddress: addr,
    buyer: {
      ipAddress: input.contact.ip,
      buyerId: input.orderId,
      name: input.contact.name,
      surName: input.contact.surName || input.contact.name,
      identityNumber: 11111111111,
      city: addr.city,
      country: "Türkiye",
      zipCode: addr.zipCode,
      emailAddress: input.contact.email,
      phoneNumber: input.contact.phone,
      registrationAddress: addr.address,
      lastLoginDate: nowIso,
      registrationDate: nowIso,
    },
    basket: {
      basketId: input.orderId,
      basketItems: [
        {
          itemId: input.orderId,
          name: input.basketItemName,
          itemType: "VIRTUAL" as const,
          category: "SaaS",
          subCategory: "Abonelik",
          numberOfProducts: 1,
          unitPrice: amount,
          totalPrice: amount,
        },
      ],
    },
    orderId: input.orderId,
    amount,
  }
}
