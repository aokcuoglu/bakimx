import { expect, test } from "bun:test"
import {
  entryBackTarget,
  EMPTY_OWNER_FIELDS,
  ENTRY_METHODS,
  confirmedVehicleParts,
  entryMethodOption,
  entryStepLabels,
  hasOwnerInput,
  identityConflicts,
  ownerFieldError,
  ownerFieldsChanged,
  ownerFieldsFromCustomer,
  ownerLabel,
  parseEntryMethod,
  photoPlateStatus,
  splitPersonName,
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

test("vehicleFieldError: odaklı plaka akışında model zorunlu değil, marka zorunlu", () => {
  expect(vehicleFieldError({ plate: "34ABC12", brand: "Renault", model: "" }, { modelOptional: true })).toBeNull()
  expect(vehicleFieldError({ plate: "34ABC12", brand: "", model: "" }, { modelOptional: true })).toBe("Marka zorunludur.")
  expect(vehicleFieldError({ plate: "34ABC12", brand: "Renault", model: "" })).toBe("Model zorunludur.")
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

test("parseEntryMethod: yalnız bilinen yöntemleri kabul eder", () => {
  expect(parseEntryMethod("plate")).toBe("plate")
  expect(parseEntryMethod(["vin", "plate"])).toBe("vin")
  expect(parseEntryMethod(undefined)).toBeNull()
  expect(parseEntryMethod("")).toBeNull()
  expect(parseEntryMethod("PLATE")).toBeNull()
  expect(parseEntryMethod("__proto__")).toBeNull()
})

test("previousEntryStep: doğrudan açılan plaka aramasından Geri yöntem seçimine döner", () => {
  expect(previousEntryStep("capture", "plate", { knownVehicle: false })).toBe("method")
})

test("splitPersonName: son kelime soyad, öncesi ad", () => {
  expect(splitPersonName("AYŞE NUR KAYA")).toEqual({ firstName: "AYŞE NUR", lastName: "KAYA" })
  expect(splitPersonName("  ALİ   VELİ ")).toEqual({ firstName: "ALİ", lastName: "VELİ" })
  expect(splitPersonName("ALİ")).toEqual({ firstName: "ALİ", lastName: "" })
  expect(splitPersonName("")).toEqual({ firstName: "", lastName: "" })
})

test("ownerFieldsFromCustomer: bireyselde tam ad, yoksa ad + soyad", () => {
  expect(ownerFieldsFromCustomer({ type: "individual", firstName: "ALİ", lastName: "VELİ", fullName: null, companyName: null, phone: "5445157408" }))
    .toEqual({ type: "individual", name: "ALİ VELİ", companyName: "", phone: "5445157408" })
  expect(ownerFieldsFromCustomer({ type: "individual", firstName: "AYŞE", lastName: "KAYA", fullName: "AYŞE NUR KAYA", companyName: null, phone: "5" }))
    .toMatchObject({ name: "AYŞE NUR KAYA" })
})

test("ownerFieldsFromCustomer: kurumsalda firma adı + yetkili Ad Soyad", () => {
  expect(ownerFieldsFromCustomer({ type: "corporate", firstName: "X", lastName: null, fullName: null, companyName: "ACME LTD", phone: "5" }))
    .toEqual({ type: "corporate", name: "X", companyName: "ACME LTD", phone: "5" })
})

test("ownerFieldError: bireyselde ad soyad ve telefon zorunlu", () => {
  expect(ownerFieldError(EMPTY_OWNER_FIELDS)).toBe("Ad Soyad, Telefon zorunludur.")
  expect(ownerFieldError({ ...EMPTY_OWNER_FIELDS, name: "ALİ", phone: "0544 515 74 08" })).toBeNull()
  expect(ownerFieldError({ ...EMPTY_OWNER_FIELDS, name: "ALİ", phone: "0544 51" })).toContain("Geçerli bir telefon")
})

test("ownerFieldError: kurumsalda firma adı zorunlu", () => {
  expect(ownerFieldError({ ...EMPTY_OWNER_FIELDS, type: "corporate", phone: "5445157408" })).toBe("Firma adı zorunludur.")
})

test("ownerFieldsChanged: boşluk ve telefon biçimi farkı değişiklik sayılmaz", () => {
  const a = { ...EMPTY_OWNER_FIELDS, name: "ALİ VELİ", phone: "5445157408" }
  expect(ownerFieldsChanged(a, { ...a, name: " ALİ  VELİ ", phone: "0544 515 74 08" })).toBe(false)
  expect(ownerFieldsChanged(a, { ...a, phone: "+90 544 515 74 08" })).toBe(false)
  expect(ownerFieldsChanged(a, { ...a, name: "ALİ YILMAZ" })).toBe(true)
  expect(ownerFieldsChanged(a, { ...a, phone: "5445157409" })).toBe(true)
})

test("ownerFieldsChanged: bireysel ↔ kurumsal geçiş değişiklik sayılır", () => {
  const a = { ...EMPTY_OWNER_FIELDS, name: "ALİ VELİ", companyName: "ACME", phone: "5445157408" }
  expect(ownerFieldsChanged(a, { ...a, type: "corporate" })).toBe(true)
})

test("ownerLabel: bireyselde ad soyad, kurumsalda firma", () => {
  expect(ownerLabel({ ...EMPTY_OWNER_FIELDS, name: " ALİ  VELİ " })).toBe("ALİ VELİ")
  expect(ownerLabel({ ...EMPTY_OWNER_FIELDS, type: "corporate", companyName: "ACME" })).toBe("ACME")
})

test("photoPlateStatus: fotoğraf yoksa ya da plaka aynıysa uyuşur", () => {
  expect(photoPlateStatus(null, "34ABC123")).toBe("match")
  expect(photoPlateStatus("34KCK628", "34 kck 628")).toBe("match")
})

test("photoPlateStatus: tam ve farklı plaka uyuşmaz, yarım plaka 'typing'", () => {
  expect(photoPlateStatus("34KCK628", "34KCK629")).toBe("mismatch")
  expect(photoPlateStatus("34KCK628", "06 AB 1234")).toBe("mismatch")
  expect(photoPlateStatus("34KCK628", "34KC")).toBe("typing")
  expect(photoPlateStatus("34KCK628", "")).toBe("typing")
  // Geçersiz il kodu tam plaka sayılmaz.
  expect(photoPlateStatus("34KCK628", "99KCK628")).toBe("typing")
})

test("hasOwnerInput: herhangi bir alan doluysa true", () => {
  expect(hasOwnerInput(EMPTY_OWNER_FIELDS)).toBe(false)
  expect(hasOwnerInput({ ...EMPTY_OWNER_FIELDS, name: "  " })).toBe(false)
  expect(hasOwnerInput({ ...EMPTY_OWNER_FIELDS, phone: "0544" })).toBe(true)
  expect(hasOwnerInput({ ...EMPTY_OWNER_FIELDS, type: "corporate", companyName: "ACME" })).toBe(true)
})

test("confirmedVehicleParts: etiketi plaka / araç / sahip satırlarına ayırır", () => {
  expect(confirmedVehicleParts("34KCK628 — BMW 5 (F10)", "Sahip: MERVE ZİREK")).toEqual({
    plate: "34KCK628",
    vehicleName: "BMW 5 (F10)",
    ownerName: "MERVE ZİREK",
  })
})

test("confirmedVehicleParts: marka/model boşsa araç satırı boş, plaka korunur", () => {
  // Etiket `${plate} — ${brand} ${model}`.trim() ile kurulur → "34ABC123 —".
  expect(confirmedVehicleParts("34ABC123 —", "Sahip: —")).toEqual({
    plate: "34ABC123",
    vehicleName: "",
    ownerName: "—",
  })
})

test("confirmedVehicleParts: ayraçsız etiket tümüyle plakadır", () => {
  expect(confirmedVehicleParts("06XYZ789", "")).toEqual({ plate: "06XYZ789", vehicleName: "", ownerName: "" })
})

test("ownerFieldsFromCustomer: kurumsalda Ad Soyad yetkili kişiden dolar", () => {
  const base = { type: "corporate", firstName: null, lastName: null, fullName: "ACME", companyName: "ACME", phone: "5445157408" }
  expect(ownerFieldsFromCustomer({ ...base, contactName: "AYŞE KAYA" })).toMatchObject({ name: "AYŞE KAYA", companyName: "ACME" })
  expect(ownerFieldsFromCustomer({ ...base, firstName: "ALİ", lastName: "VELİ" }).name).toBe("ALİ VELİ")
  expect(ownerFieldsFromCustomer(base).name).toBe("")
})

test("ownerFieldError: kurumsalda Firma adı zorunlu, Ad Soyad isteğe bağlı", () => {
  const corp = { ...EMPTY_OWNER_FIELDS, type: "corporate" as const, phone: "5445157408" }
  expect(ownerFieldError({ ...corp, companyName: "ACME" })).toBeNull()
  expect(ownerFieldError({ ...corp, name: "ALİ VELİ" })).toContain("Firma adı")
})

test("entryBackTarget: odaklı olmayan akışta previousEntryStep ile aynı (#817)", () => {
  expect(entryBackTarget("capture", "customer")).toEqual({ step: "method", method: "customer" })
  expect(entryBackTarget("owner", "registration")).toEqual({ step: "vehicle", method: "registration" })
})

test("entryBackTarget: odaklı akışta yöntem ekranına hiç dönülmez (#817)", () => {
  // Aramadan müşteri seçildi (yöntem customer oldu) → Geri: plaka araması.
  expect(entryBackTarget("capture", "customer", { startMethod: "plate" })).toEqual({ step: "capture", method: "plate" })
  // Başlangıç ekranında Geri de başlangıçta kalır.
  expect(entryBackTarget("capture", "plate", { startMethod: "plate" })).toEqual({ step: "capture", method: "plate" })
  // Ara adımlar ray sırasıyla geri gider, yöntem korunur.
  expect(entryBackTarget("vehicle", "customer", { startMethod: "plate" })).toEqual({ step: "capture", method: "customer" })
  expect(entryBackTarget("confirm", "plate", { startMethod: "plate", knownVehicle: true })).toEqual({ step: "capture", method: "plate" })
})
