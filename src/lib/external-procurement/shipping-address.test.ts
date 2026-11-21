import { describe, expect, test } from "bun:test"
import { normalizeTurkishPhone, requireWorkshopShippingAddress, workshopShippingAddress } from "./shipping-address"
import { ProcurementProviderError } from "./types"

const workshop = {
  name: "Usta Oto Servis", phone: "0532 000 00 00", city: "istanbul", district: "kadıköy",
  address: "Test Mahallesi 1. Sokak No 2", email: "servis@example.com",
}

describe("workshop shipping address (contract v2.0)", () => {
  test("builds the contract address from the workshop profile with canonical names", () => {
    expect(workshopShippingAddress(workshop)).toEqual({ ok: true, address: {
      recipientName: "Usta Oto Servis", phone: "+905320000000", email: "servis@example.com",
      province: "İstanbul", district: "Kadıköy", addressLine: "Test Mahallesi 1. Sokak No 2",
    } })
  })

  test("drops a malformed optional e-mail instead of failing the order", () => {
    const result = workshopShippingAddress({ ...workshop, email: "not-an-email" })
    expect(result.ok && result.address).not.toHaveProperty("email")
  })

  test("names every missing or invalid field at once", () => {
    expect(workshopShippingAddress({ ...workshop, name: " ", phone: "123", city: "Atlantis", district: null, address: "kısa" }))
      .toEqual({ ok: false, problems: ["name", "phone", "province", "district", "addressLine"] })
    expect(workshopShippingAddress({ ...workshop, district: "Çankaya" })).toEqual({ ok: false, problems: ["district"] })
  })

  test("raises a Turkish 422 that points to the settings page", () => {
    const error = (() => { try { requireWorkshopShippingAddress({ ...workshop, district: "" }) } catch (caught) { return caught } })()
    expect(error).toBeInstanceOf(ProcurementProviderError)
    expect(error).toMatchObject({ code: "SHIPPING_ADDRESS_INCOMPLETE", status: 422, retryable: false, details: { fields: ["district"] } })
    expect((error as Error).message).toContain("Ayarlar › Genel")
  })

  test("accepts Turkish numbers the way GetirBakım normalises them", () => {
    for (const phone of ["0532 000 00 00", "+90 532 000 00 00", "5320000000", "0090 532 000 0000", "(0216) 555 44 33", "0850 222 33 44"]) {
      expect(normalizeTurkishPhone(phone)).toMatch(/^\+90\d{10}$/)
    }
    for (const phone of ["", "12345", "0132 000 00 00", "+1 415 555 0100"]) expect(normalizeTurkishPhone(phone)).toBeNull()
  })
})
