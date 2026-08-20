import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const FORM = readFileSync(
  join(import.meta.dir, "..", "..", "components", "quotes", "quote-create-form.tsx"),
  "utf8"
)

test("teklif formu yeni araç için sayfadan ayrılmaz", () => {
  expect(FORM).toContain("<InlineCreateModal")
  expect(FORM).toContain("fixedCustomer={{ id: customerId, label: customerLabel }}")
  expect(FORM).not.toContain("/vehicles/new?customerId=")
})

test("oluşturulan araç listeye eklenip teklifte seçilir", () => {
  expect(FORM).toContain("[created, ...current]")
  expect(FORM).toContain('form.setValue("vehicleId", created.id')
})

test("araç ekleme aksiyonu vurgulu bir buton olarak kalır", () => {
  // Yükseklik ezmesi BAK-150'de kaldırıldı; ölçek artık Button varyantından
  // geliyor (docs/ui-control-sizing.md). Burada korunan şey aksiyonun
  // görünürlüğü: vurgulu, ikonlu ve ayrı bir kontrol olması.
  expect(FORM).toContain('className="text-primary"')
  expect(FORM).toContain("Bu müşteriye yeni araç ekle")
})
