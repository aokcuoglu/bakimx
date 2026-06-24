export type CustomerLite = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string // "individual" | "corporate"
  phone: string
}

export type VehicleLite = {
  id: string
  plate: string
  brand: string
  model: string
  customerId: string
  customer: CustomerLite | null
}

export type UnifiedResult =
  | { kind: "vehicle"; vehicleId: string; customerId: string; plate: string; label: string; sublabel: string }
  | { kind: "customer"; customerId: string; label: string; sublabel: string }

/** Görünen ad: kurumsal → companyName; bireysel → fullName ya da "ad soyad". */
export function displayCustomerName(c: CustomerLite | null | undefined): string {
  if (!c) return "—"
  if (c.type === "corporate") return (c.companyName || "").trim() || "Kurumsal müşteri"
  const full = (c.fullName || "").trim()
  if (full) return full
  const fl = `${(c.firstName || "").trim()} ${(c.lastName || "").trim()}`.trim()
  return fl || "İsimsiz müşteri"
}

/**
 * Müşteri + araç DB satırlarını tek, etiketli sonuç listesine birleştirir.
 * Önce araçlar (plaka araması birincil senaryo), sonra müşteriler.
 */
export function buildUnifiedResults(input: {
  customers: CustomerLite[]
  vehicles: VehicleLite[]
}): UnifiedResult[] {
  const vehicleResults: UnifiedResult[] = input.vehicles.map((v) => ({
    kind: "vehicle",
    vehicleId: v.id,
    customerId: v.customerId,
    plate: v.plate,
    label: `${v.plate} — ${v.brand} ${v.model}`.trim(),
    sublabel: `Sahip: ${displayCustomerName(v.customer)}`,
  }))

  const customerResults: UnifiedResult[] = input.customers.map((c) => ({
    kind: "customer",
    customerId: c.id,
    label: displayCustomerName(c),
    sublabel: c.phone,
  }))

  return [...vehicleResults, ...customerResults]
}
