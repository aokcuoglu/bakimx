export type VehicleQuickFieldsInput = {
  plate: string
  brand: string
  model: string
  vehicleType: string | null
  modelYear: number | null
  mileage: number | null
  color: string | null
  fuelType: string | null
  transmission: string | null
  engineNo: string | null
  commercialName: string | null
  firstRegistrationDate: string | null
  engineDisplacement: string | null
  enginePower: string | null
  inspectionValidUntil: string | null
}

export type VehicleQuickField = { label: string; value: string }

export function buildVehicleQuickFields(v: VehicleQuickFieldsInput): VehicleQuickField[] {
  return [
    { label: "Plaka", value: v.plate },
    { label: "Marka", value: v.brand },
    { label: "Model", value: v.model },
    { label: "Araç Tipi", value: v.vehicleType || "—" },
    { label: "Model Yılı", value: v.modelYear ? String(v.modelYear) : "—" },
    { label: "Kilometre", value: v.mileage ? `${v.mileage.toLocaleString("tr-TR")} km` : "—" },
    { label: "Renk", value: v.color || "—" },
    { label: "Yakıt", value: v.fuelType || "—" },
    { label: "Şanzıman", value: v.transmission || "—" },
    { label: "Motor No", value: v.engineNo || "—" },
    { label: "Ticari Adı", value: v.commercialName || "—" },
    { label: "İlk Tescil Tarihi", value: v.firstRegistrationDate || "—" },
    { label: "Motor Hacmi", value: v.engineDisplacement || "—" },
    { label: "Motor Gücü", value: v.enginePower || "—" },
    { label: "Muayene Geçerlilik Tarihi", value: v.inspectionValidUntil || "—" },
  ]
}
