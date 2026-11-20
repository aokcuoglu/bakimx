import { canonicalizeTurkishCity, TR_CITIES } from "@/lib/tr-cities"
import { canonicalizeTurkishDistrict, getDistricts } from "@/lib/tr-districts"
import { ProcurementProviderError, type ProcurementShippingAddress } from "./types"

/** The workshop profile fields a GetirBakım delivery address is built from (Ayarlar › Genel). */
export interface WorkshopAddressSource {
  name: string
  phone: string
  city: string
  district: string | null
  address: string
  email: string | null
}

export type ShippingAddressProblem = "name" | "phone" | "province" | "district" | "addressLine"

const PROBLEM_LABELS: Record<ShippingAddressProblem, string> = {
  name: "atölye adı (en az 2 karakter)",
  phone: "geçerli bir Türkiye telefon numarası",
  province: "il",
  district: "ilin ilçelerinden biri",
  addressLine: "açık adres (en az 10 karakter)",
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * GetirBakım's rule (partner contract v2.0, carrier label): a Turkish landline or
 * mobile number with or without 0 / +90, i.e. 10 national digits starting 2–5 or 8.
 */
export function normalizeTurkishPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "")
  if (digits.startsWith("0090")) digits = digits.slice(4)
  else if (digits.length === 12 && digits.startsWith("90")) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1)
  return /^[2-58]\d{9}$/.test(digits) ? `+90${digits}` : null
}

/**
 * Builds the contract's `shippingAddress` from the workshop profile, the only
 * address BakımX keeps for a workshop. Never taken from a request body. Returns
 * every missing/invalid field so the user can fix them in one go instead of
 * GetirBakım refusing the order with a VALIDATION_ERROR.
 */
export function workshopShippingAddress(workshop: WorkshopAddressSource):
  | { ok: true; address: ProcurementShippingAddress }
  | { ok: false; problems: ShippingAddressProblem[] } {
  const problems: ShippingAddressProblem[] = []
  const recipientName = workshop.name.trim().slice(0, 150)
  if (recipientName.length < 2) problems.push("name")
  const phone = normalizeTurkishPhone(workshop.phone ?? "")
  if (!phone) problems.push("phone")
  const province = canonicalizeTurkishCity(workshop.city ?? "")
  const knownProvince = (TR_CITIES as readonly string[]).includes(province)
  if (!knownProvince) problems.push("province")
  const district = knownProvince ? canonicalizeTurkishDistrict(province, workshop.district ?? "") : ""
  if (!knownProvince || !getDistricts(province).includes(district)) problems.push("district")
  const addressLine = workshop.address.trim().replace(/\s+/g, " ").slice(0, 500)
  if (addressLine.length < 10) problems.push("addressLine")
  if (problems.length > 0 || !phone) return { ok: false, problems }
  const email = workshop.email?.trim()
  return {
    ok: true,
    address: {
      recipientName, phone, province, district, addressLine,
      ...(email && email.length <= 200 && EMAIL.test(email) ? { email } : {}),
    },
  }
}

export function shippingAddressProblemMessage(problems: ShippingAddressProblem[]): string {
  const fields = problems.map((problem) => PROBLEM_LABELS[problem]).join(", ")
  return `GetirBakım siparişi için atölye teslimat adresi eksik veya hatalı: ${fields}. Ayarlar › Genel sayfasındaki işletme bilgilerini tamamlayıp yeniden deneyin.`
}

/** The validated address, or a Turkish 422 error naming what to fix. */
export function requireWorkshopShippingAddress(workshop: WorkshopAddressSource): ProcurementShippingAddress {
  const result = workshopShippingAddress(workshop)
  if (result.ok) return result.address
  throw new ProcurementProviderError(
    "SHIPPING_ADDRESS_INCOMPLETE", shippingAddressProblemMessage(result.problems), false, 422,
    { fields: result.problems },
  )
}
