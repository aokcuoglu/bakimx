import { expect, test } from "bun:test"
import { addonOrderSchema } from "@/lib/validations/addon-order"

const base = { invoiceTitle: "Servis Ltd", taxNumber: "1234567890" }

test("geçerli sipariş; varsayılanlar", () => {
  const r = addonOrderSchema.parse({ ...base, items: [{ key: "vinLookup", quantity: 1 }] })
  expect(r.method).toBe("havale")
  expect(r.taxOffice).toBe("")
})

test("geçersiz girdiler reddedilir", () => {
  const bad = (x: object) => addonOrderSchema.safeParse({ ...base, ...x }).success
  expect(bad({ items: [] })).toBe(false)
  expect(bad({ items: [{ key: "eInvoice", quantity: 1 }] })).toBe(false)
  expect(bad({ items: [{ key: "vinLookup", quantity: 0 }] })).toBe(false)
  expect(bad({ items: [{ key: "vinLookup", quantity: 21 }] })).toBe(false)
  expect(bad({ items: [{ key: "vinLookup", quantity: 1.5 }] })).toBe(false)
  expect(bad({ items: [{ key: "vinLookup", quantity: 1 }, { key: "vinLookup", quantity: 2 }] })).toBe(false)
  expect(bad({ items: [{ key: "vinLookup", quantity: 1 }], taxNumber: "123" })).toBe(false)
})
