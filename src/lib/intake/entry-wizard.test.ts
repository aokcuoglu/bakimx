import { describe, expect, test } from "bun:test"
import {
  entryBackTarget,
  resolveInitialCustomer,
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
  isForeignPlate,
  photoPlateStatus,
  splitPersonName,
  previousEntryStep,
  vehicleFieldError,
} from "@/lib/intake/entry-wizard"

test("ENTRY_METHODS: yalnız plaka ve müşteri — yöntem seçim ekranı yok (#822)", () => {
  expect(ENTRY_METHODS.map((m) => m.value)).toEqual(["plate", "customer"])
})

test("entryStepLabels: ray yakalama adımıyla başlar, yöntem adımı yok (#822)", () => {
  expect(entryStepLabels("plate").map((s) => s.label)).toEqual([
    "Plaka", "Araç bilgileri", "Müşteri", "Onay",
  ])
})

test("entryStepLabels: yakalama adımı yöntemin etiketini alır", () => {
  expect(entryStepLabels("plate")[0].label).toBe("Plaka")
  expect(entryStepLabels("customer")[0].label).toBe("Müşteri")
})

test("entryStepLabels: kayıtlı araç bulunduysa araç/sahip adımları düşer", () => {
  expect(entryStepLabels("plate", { knownVehicle: true }).map((s) => s.id)).toEqual([
    "capture", "confirm",
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
  expect(previousEntryStep("owner", "customer")).toBe("vehicle")
  expect(previousEntryStep("vehicle", "customer")).toBe("capture")
})

test("previousEntryStep: ilk adımdan (yakalama) geri gidilmez", () => {
  expect(previousEntryStep("capture", "plate")).toBe("capture")
})

test("previousEntryStep: kayıtlı araçta onaydan yakalama adımına döner", () => {
  expect(previousEntryStep("confirm", "plate", { knownVehicle: true })).toBe("capture")
  expect(previousEntryStep("confirm", "plate")).toBe("owner")
})

test("parseEntryMethod: yalnız bilinen yöntemleri kabul eder", () => {
  expect(parseEntryMethod("plate")).toBe("plate")
  expect(parseEntryMethod(["customer", "plate"])).toBe("customer")
  // Yöntem ekranıyla kalkan eski yöntemler (#822) artık odaklı akış açmaz.
  expect(parseEntryMethod("vin")).toBeNull()
  expect(parseEntryMethod("registration")).toBeNull()
  expect(parseEntryMethod(undefined)).toBeNull()
  expect(parseEntryMethod("")).toBeNull()
  expect(parseEntryMethod("PLATE")).toBeNull()
  expect(parseEntryMethod("__proto__")).toBeNull()
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

/**
 * Yabancı plakanın "tam" olduğunu bilemeyiz (biçimi ülkeye göre değişir); tanınan
 * bir yabancı plaka (#818 `detectPlate`) tam sayılır, yoksa yabancı araç bu
 * ekranda "Plakayı eksiksiz girin" engelinde sonsuza dek kalıyordu (#840).
 */
test("photoPlateStatus: fotoğraftakinden farklı, tanınan yabancı plaka onay ister", () => {
  expect(photoPlateStatus("34KCK628", "KL-123-F")).toBe("mismatch")
  expect(photoPlateStatus("34KCK628", "MAB 1234")).toBe("mismatch")
  // Yarım TR plakası hâlâ yazılıyor sayılır.
  expect(photoPlateStatus("34KCK628", "12-ABC-3")).toBe("typing")
})

test("isForeignPlate: yalnız tanınan yabancı plaka", () => {
  expect(isForeignPlate("KL-123-F")).toBe(true)
  expect(isForeignPlate("MAB1234")).toBe(true)
  expect(isForeignPlate("CA 1234 AB")).toBe(true)
  expect(isForeignPlate("34ABC123")).toBe(false)
  expect(isForeignPlate("")).toBe(false)
  // Tanınmayan (Avusturya) plaka TR yedeğine düşer — yabancı sayılmaz.
  expect(isForeignPlate("W12345A")).toBe(false)
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

test("entryBackTarget: müşterinin araç listesinden Geri başlangıç aramasına döner (#817, #822)", () => {
  expect(entryBackTarget("capture", "customer", { startMethod: "plate" })).toEqual({ step: "capture", method: "plate" })
})

test("entryBackTarget: başlangıç ekranında Geri yerinde kalır — yöntem ekranı yok (#822)", () => {
  expect(entryBackTarget("capture", "plate", { startMethod: "plate" })).toEqual({ step: "capture", method: "plate" })
})

test("entryBackTarget: ara adımlar ray sırasıyla geri gider, yöntem korunur", () => {
  expect(entryBackTarget("vehicle", "customer", { startMethod: "plate" })).toEqual({ step: "capture", method: "customer" })
  expect(entryBackTarget("owner", "customer", { startMethod: "plate" })).toEqual({ step: "vehicle", method: "customer" })
  expect(entryBackTarget("confirm", "plate", { startMethod: "plate", knownVehicle: true })).toEqual({ step: "capture", method: "plate" })
})

describe("resolveInitialCustomer (#822)", () => {
  const list = [{ id: "c1", name: "MERVE" }, { id: "c2", name: "ALİ" }]

  test("araçsız customerId listede varsa o müşteri", () => {
    expect(resolveInitialCustomer(list, { customerId: "c2" })).toEqual({ id: "c2", name: "ALİ" })
  })

  test("listede olmayan (başka atölye / bilinmeyen) id null", () => {
    expect(resolveInitialCustomer(list, { customerId: "baska-atolye" })).toBeNull()
  })

  test("araç da verildiyse araç akışı geçerli: null", () => {
    expect(resolveInitialCustomer(list, { customerId: "c1", vehicleId: "v1" })).toBeNull()
  })

  test("Kaydet & Yeni sonrası tüketildiyse null", () => {
    expect(resolveInitialCustomer(list, { customerId: "c1", consumed: true })).toBeNull()
  })

  test("customerId yoksa null", () => {
    expect(resolveInitialCustomer(list, {})).toBeNull()
  })
})
