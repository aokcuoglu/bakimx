import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  ALLOW_DUPLICATE_PHONE_FIELD,
  isDuplicatePhoneConfirmed,
  resolveDuplicatePhone,
} from "@/lib/customers/duplicate-phone"

const ROOT = join(import.meta.dir, "..", "..", "..")

function formDataWith(value: string | null) {
  const fd = new FormData()
  if (value !== null) fd.set(ALLOW_DUPLICATE_PHONE_FIELD, value)
  return fd
}

test("confirmation is opt-in: missing or unknown values do not proceed", () => {
  expect(isDuplicatePhoneConfirmed(formDataWith(null))).toBe(false)
  expect(isDuplicatePhoneConfirmed(formDataWith("yes"))).toBe(false)
  expect(isDuplicatePhoneConfirmed(formDataWith(""))).toBe(false)
})

test("confirmation accepts the form/API truthy values", () => {
  expect(isDuplicatePhoneConfirmed(formDataWith("on"))).toBe(true)
  expect(isDuplicatePhoneConfirmed(formDataWith("true"))).toBe(true)
  expect(isDuplicatePhoneConfirmed(formDataWith("1"))).toBe(true)
})

test("no existing owners → proceed without confirmation", () => {
  expect(resolveDuplicatePhone([], false)).toEqual({ ok: true })
})

test("existing owner without confirmation → warning, not a hard block payload", () => {
  const result = resolveDuplicatePhone([{ id: "c1", label: "AHMET YILMAZ" }], false)
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error("expected warning")
  expect(result.error).toBe("Bu telefon numarası zaten AHMET YILMAZ adlı müşteriye ait.")
  expect(result.existingCustomers).toEqual([{ id: "c1", label: "AHMET YILMAZ" }])
  expect(result.existingCustomer).toEqual({ id: "c1", label: "AHMET YILMAZ" })
})

test("multiple owners are listed so the advisor can pick the right record", () => {
  const result = resolveDuplicatePhone(
    [
      { id: "c1", label: "AHMET YILMAZ" },
      { id: "c2", label: "ABC Lojistik" },
    ],
    false,
  )
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error("expected warning")
  expect(result.error).toBe("Bu telefon numarası zaten şu müşterilere ait: AHMET YILMAZ, ABC Lojistik.")
})

test("confirmed duplicate proceeds", () => {
  expect(resolveDuplicatePhone([{ id: "c1", label: "AHMET YILMAZ" }], true)).toEqual({ ok: true })
})

test("Customer phone is indexed but not unique — duplicates are a warned choice", () => {
  const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8")
  const customer = schema.match(/model Customer \{[\s\S]*?\n\}/)?.[0] ?? ""
  expect(customer).not.toContain("@@unique([workshopId, phone])")
  expect(customer).toContain("@@index([workshopId, phone])")
})

test("create surfaces keep the warn-then-confirm contract", () => {
  const actions = readFileSync(join(ROOT, "src", "app", "(app)", "customers", "actions.ts"), "utf8")
  const search = readFileSync(join(ROOT, "src", "components", "customers", "customer-search-or-create.tsx"), "utf8")
  const form = readFileSync(join(ROOT, "src", "components", "customers", "customer-create-form.tsx"), "utf8")
  expect(actions).toContain("resolveDuplicatePhone")
  expect(actions).toContain("isDuplicatePhoneConfirmed")
  expect(search).toContain("ALLOW_DUPLICATE_PHONE_FIELD")
  expect(search).toContain("Yine de yeni müşteri oluştur")
  expect(form).toContain("ALLOW_DUPLICATE_PHONE_FIELD")
  expect(form).toContain("Yine de kaydet")
})
