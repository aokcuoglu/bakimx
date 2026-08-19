import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  customerOptionLabel,
  findCustomerOptionLabel,
  toCustomerOptions,
  withCustomerOption,
  type CustomerLike,
} from "./customer-options"

function customer(over: Partial<CustomerLike> = {}): CustomerLike {
  return {
    id: "c1",
    firstName: "AHMET",
    lastName: "YILMAZ",
    fullName: null,
    companyName: null,
    type: "individual",
    phone: "0544 515 74 08",
    ...over,
  }
}

test("bireysel müşteri etiketi ad + telefon", () => {
  expect(customerOptionLabel(customer())).toBe("AHMET YILMAZ — 0544 515 74 08")
})

test("kurumsal müşteri etiketi şirket adını kullanır", () => {
  expect(
    customerOptionLabel(customer({ type: "corporate", companyName: "ABC Lojistik A.Ş." }))
  ).toBe("ABC Lojistik A.Ş. — 0544 515 74 08")
})

test("telefon yoksa asılı tire kalmaz", () => {
  expect(customerOptionLabel(customer({ phone: "" }))).toBe("AHMET YILMAZ")
})

test("adı olmayan kayıt için yedek etiket üretilir", () => {
  expect(customerOptionLabel(customer({ firstName: null, lastName: null }))).toBe(
    "Müşteri — 0544 515 74 08"
  )
})

test("liste seçeneklere indirgenir", () => {
  expect(toCustomerOptions([customer(), customer({ id: "c2", firstName: "AYŞE" })])).toEqual([
    { id: "c1", label: "AHMET YILMAZ — 0544 515 74 08" },
    { id: "c2", label: "AYŞE YILMAZ — 0544 515 74 08" },
  ])
})

test("yeni oluşturulan müşteri listenin başına eklenir", () => {
  const options = [{ id: "c1", label: "AHMET YILMAZ" }]
  expect(withCustomerOption(options, { id: "c2", label: "AYŞE DEMİR" })).toEqual([
    { id: "c2", label: "AYŞE DEMİR" },
    { id: "c1", label: "AHMET YILMAZ" },
  ])
})

test("zaten listedeki müşteri tekrar eklenmez", () => {
  const options = [{ id: "c1", label: "AHMET YILMAZ" }]
  expect(withCustomerOption(options, { id: "c1", label: "AHMET YILMAZ" })).toEqual(options)
})

test("seçili etiket listeden çözülür, bilinmeyen değer null döner", () => {
  const options = [{ id: "c1", label: "AHMET YILMAZ" }]
  expect(findCustomerOptionLabel(options, "c1")).toBe("AHMET YILMAZ")
  expect(findCustomerOptionLabel(options, "yok")).toBeNull()
  expect(findCustomerOptionLabel(options, "")).toBeNull()
})

const FORM = readFileSync(
  join(import.meta.dir, "..", "..", "components", "vehicles", "vehicle-create-form.tsx"),
  "utf8"
)
const NEW_PAGE = readFileSync(
  join(import.meta.dir, "..", "..", "app", "(app)", "vehicles", "new", "page.tsx"),
  "utf8"
)

test("araç formu yeni müşteri için sayfadan ayrılmaz (#186)", () => {
  expect(FORM).toContain("<CustomerSearchOrCreate")
  expect(FORM).not.toContain('href="/customers/new"')
})

test("oluşturulan müşteri listeye eklenip araç formunda seçilir", () => {
  expect(FORM).toContain("withCustomerOption(current, { id, label })")
  expect(FORM).toContain('form.setValue("customerId", id')
})

test("müşteri ekleme aksiyonu vurgulu bir buton olarak kalır", () => {
  // Yükseklik ezmesi BAK-150'de kaldırıldı; ölçek artık Button varyantından
  // geliyor (docs/ui-control-sizing.md).
  expect(FORM).toContain('className="text-primary"')
  expect(FORM).toContain("Yeni müşteri ekle")
})

test("hiç müşteri yokken de araç formu açılır", () => {
  expect(NEW_PAGE).toContain("<VehicleCreateForm")
  expect(NEW_PAGE).not.toContain('href="/customers/new"')
})
