import { describe, expect, test } from "bun:test"
import { intakeCreateInputFromFormData, intakeCreateSchema } from "./intake"

describe("intakeCreateInputFromFormData", () => {
  test("plaka akışının 'Onayla'sı: yalnız customerId + vehicleId gönderilince geçer", () => {
    const fd = new FormData()
    fd.set("customerId", "c1")
    fd.set("vehicleId", "v1")
    const parsed = intakeCreateSchema.safeParse(intakeCreateInputFromFormData(fd))
    // Eskiden eksik alanlar null okunuyordu → "expected string, received null".
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.customerComplaint).toBe("")
    expect(parsed.data.internalNote).toBeUndefined()
    expect(parsed.data.mileageAtIntake).toBeUndefined()
    expect(parsed.data.fuelLevelAtIntake).toBeUndefined()
  })

  test("ofis sihirbazının tam formu aynen okunur", () => {
    const fd = new FormData()
    fd.set("customerId", "c1")
    fd.set("vehicleId", "v1")
    fd.set("mileageAtIntake", "120000")
    fd.set("fuelLevelAtIntake", "0")
    fd.set("customerComplaint", "  Fren sesi ")
    fd.set("internalNote", "not")
    const parsed = intakeCreateSchema.safeParse(intakeCreateInputFromFormData(fd))
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.mileageAtIntake).toBe(120000)
    expect(parsed.data.fuelLevelAtIntake).toBe(0)
    expect(parsed.data.customerComplaint).toBe("Fren sesi")
    expect(parsed.data.internalNote).toBe("not")
  })

  test("müşteri/araç eksikse yine reddedilir", () => {
    const parsed = intakeCreateSchema.safeParse(intakeCreateInputFromFormData(new FormData()))
    expect(parsed.success).toBe(false)
  })
})
