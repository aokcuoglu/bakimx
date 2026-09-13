import { describe, expect, test } from "bun:test"
import { createRegisterFormSchema } from "./register-form"

const empty = {
  sector: "", businessFeatures: [], teamSize: "", selectedModules: ["work_orders"],
  setupPreference: "self_service", acquisitionSource: "unknown", referralCode: "",
  workshopName: "", phone: "", city: "", address: "", firstName: "", lastName: "",
  email: "", password: "", confirmPassword: "", kvkkConsent: false,
}
const account = { ...empty, workshopName: "Test Servis", phone: "05550000000", city: "İstanbul",
  address: "Test adresi", firstName: "Test", lastName: "Kullanıcı", email: "test@example.com",
  password: "test-password", confirmPassword: "test-password", kvkkConsent: true }

describe("account registration before onboarding", () => {
  test("accepts account details without sector or team selections", () => {
    expect(createRegisterFormSchema(false).safeParse(account).success).toBe(true)
  })
  test("retains account, password confirmation and consent validation", () => {
    for (const change of [{ email: "invalid" }, { confirmPassword: "different" }, { kvkkConsent: false }, { workshopName: "" }]) {
      expect(createRegisterFormSchema(false).safeParse({ ...account, ...change }).success).toBe(false)
    }
  })
  test("setup requires selections but never asks for account credentials again", () => {
    const schema = createRegisterFormSchema(true)
    expect(schema.safeParse(empty).success).toBe(false)
    expect(schema.safeParse({ ...empty, sector: "auto_service", teamSize: "solo" }).success).toBe(true)
    expect(schema.safeParse({ ...empty, sector: "auto_service", teamSize: "solo", selectedModules: [] }).success).toBe(false)
  })
})
