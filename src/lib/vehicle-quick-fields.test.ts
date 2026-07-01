import { expect, test } from "bun:test"
import { buildVehicleQuickFields } from "@/lib/vehicle-quick-fields"

test("buildVehicleQuickFields dolu bir araç için tüm alanları biçimlendirir", () => {
  const fields = buildVehicleQuickFields({
    plate: "34ABC123",
    brand: "Toyota",
    model: "Corolla",
    vehicleType: "Sedan",
    modelYear: 2019,
    mileage: 125000,
    color: "Beyaz",
    fuelType: "Benzin",
    transmission: "Otomatik",
    engineNo: "ENG-123",
    commercialName: "Corolla Hybrid",
    firstRegistrationDate: "12.03.2019",
    engineDisplacement: "1600 cc",
    enginePower: "98 kW",
    inspectionValidUntil: "12.03.2027",
  })

  expect(fields).toEqual([
    { label: "Plaka", value: "34ABC123" },
    { label: "Marka", value: "Toyota" },
    { label: "Model", value: "Corolla" },
    { label: "Araç Tipi", value: "Sedan" },
    { label: "Model Yılı", value: "2019" },
    { label: "Kilometre", value: "125.000 km" },
    { label: "Renk", value: "Beyaz" },
    { label: "Yakıt", value: "Benzin" },
    { label: "Şanzıman", value: "Otomatik" },
    { label: "Motor No", value: "ENG-123" },
    { label: "Ticari Adı", value: "Corolla Hybrid" },
    { label: "İlk Tescil Tarihi", value: "12.03.2019" },
    { label: "Motor Hacmi", value: "1600 cc" },
    { label: "Motor Gücü", value: "98 kW" },
    { label: "Muayene Geçerlilik Tarihi", value: "12.03.2027" },
  ])
})

test("buildVehicleQuickFields boş alanlar için '—' döner", () => {
  const fields = buildVehicleQuickFields({
    plate: "34ABC123",
    brand: "Toyota",
    model: "Corolla",
    vehicleType: null,
    modelYear: null,
    mileage: null,
    color: null,
    fuelType: null,
    transmission: null,
    engineNo: null,
    commercialName: null,
    firstRegistrationDate: null,
    engineDisplacement: null,
    enginePower: null,
    inspectionValidUntil: null,
  })

  expect(fields.filter((f) => f.label !== "Plaka" && f.label !== "Marka" && f.label !== "Model").every((f) => f.value === "—")).toBe(true)
})
