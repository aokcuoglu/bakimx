import { expect, test } from "bun:test"
import {
  ENTRY_METHODS,
  entryMethodOption,
  entryStepLabels,
  identityConflicts,
  previousEntryStep,
  vehicleFieldError,
} from "@/lib/intake/entry-wizard"

test("ENTRY_METHODS: dört yöntem, tekil değerler", () => {
  expect(ENTRY_METHODS).toHaveLength(4)
  expect(new Set(ENTRY_METHODS.map((m) => m.value)).size).toBe(4)
})

test("entryStepLabels: yöntem seçilmeden yakalama adımı genel etiketli", () => {
  expect(entryStepLabels(null).map((s) => s.label)).toEqual([
    "Yöntem", "Araç", "Araç bilgileri", "Müşteri", "Onay",
  ])
})

test("entryStepLabels: yakalama adımı yöntemin etiketini alır", () => {
  expect(entryStepLabels("registration")[1].label).toBe("Ruhsat")
  expect(entryStepLabels("vin")[1].label).toBe("Şase")
  expect(entryStepLabels("plate")[1].label).toBe("Plaka")
  expect(entryStepLabels("customer")[1].label).toBe("Müşteri")
})

test("entryStepLabels: kayıtlı araç bulunduysa araç/sahip adımları düşer", () => {
  expect(entryStepLabels("plate", { knownVehicle: true }).map((s) => s.id)).toEqual([
    "method", "capture", "confirm",
  ])
})

test("entryMethodOption: bilinmeyen yöntem hata verir", () => {
  expect(() => entryMethodOption("yok" as never)).toThrow()
})

test("vehicleFieldError: eksik alanları sırayla listeler", () => {
  expect(vehicleFieldError({ plate: "", brand: "", model: "" })).toBe("Plaka, Marka, Model zorunludur.")
  expect(vehicleFieldError({ plate: "34ABC12", brand: "", model: "Clio" })).toBe("Marka zorunludur.")
})

test("vehicleFieldError: boşluk dolu değer boş sayılır", () => {
  expect(vehicleFieldError({ plate: "  ", brand: "Renault", model: "Clio" })).toBe("Plaka zorunludur.")
})

test("vehicleFieldError: tüm alanlar doluysa null", () => {
  expect(vehicleFieldError({ plate: "34ABC12", brand: "Renault", model: "Clio" })).toBeNull()
})

test("identityConflicts: boş alanlarda çakışma yok — ruhsat değeri uygulanır", () => {
  expect(identityConflicts({ plate: "", vin: "" }, { plate: "34ERK34", vin: "WF0MXXGCHMRT73173" })).toEqual([])
})

test("identityConflicts: ruhsat okunamayan alanı çakışma saymaz", () => {
  expect(identityConflicts({ plate: "34ERK34", vin: "" }, { plate: "", vin: "" })).toEqual([])
})

test("identityConflicts: aynı plaka farklı yazımda çakışmaz", () => {
  expect(identityConflicts({ plate: "34 erk 34", vin: "" }, { plate: "34ERK34", vin: "" })).toEqual([])
})

test("identityConflicts: farklı plaka bildirilir, kullanıcının değeri korunur", () => {
  expect(identityConflicts({ plate: "34ERK34", vin: "" }, { plate: "34ERK84", vin: "" })).toEqual([
    { key: "plate", label: "Plaka", current: "34ERK34", scanned: "34ERK84" },
  ])
})

test("identityConflicts: farklı şase bildirilir", () => {
  const conflicts = identityConflicts(
    { plate: "", vin: "wf0mxxgchmrt73173" },
    { plate: "", vin: "WF0MXXGCHMRT73174" }
  )
  expect(conflicts).toEqual([
    { key: "vin", label: "Şase no", current: "WF0MXXGCHMRT73173", scanned: "WF0MXXGCHMRT73174" },
  ])
})

test("identityConflicts: iki alan da çakışırsa ikisi de listelenir", () => {
  const conflicts = identityConflicts(
    { plate: "34ERK34", vin: "WF0MXXGCHMRT73173" },
    { plate: "06ABC12", vin: "WF0MXXGCHMRT73174" }
  )
  expect(conflicts.map((c) => c.key)).toEqual(["plate", "vin"])
})

test("previousEntryStep: ray sırasına göre bir geri gider", () => {
  expect(previousEntryStep("owner", "registration")).toBe("vehicle")
  expect(previousEntryStep("vehicle", "registration")).toBe("capture")
  expect(previousEntryStep("capture", "registration")).toBe("method")
})

test("previousEntryStep: ilk adımdan geri gidilmez", () => {
  expect(previousEntryStep("method", null)).toBe("method")
})

test("previousEntryStep: kayıtlı araçta onaydan yakalama adımına döner", () => {
  expect(previousEntryStep("confirm", "plate", { knownVehicle: true })).toBe("capture")
  expect(previousEntryStep("confirm", "plate")).toBe("owner")
})
