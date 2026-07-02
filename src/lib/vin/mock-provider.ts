import type { VinProvider, VinProviderResult } from "./provider"

/** Real FOCUS IV example — ids exist in the seeded local catalog
 *  (brand 36 / model 39142 / types 134068…158634), so dev QA works end-to-end. */
export const MOCK_FOUND_VIN = "WF0MXXGCHMRT73173"

const MOCK_PAYLOAD = {
  // Mirrors the real RapidAPI shape, including the `{ array: [...] }` wrappers,
  // so the mock exercises the exact same parse path as production.
  matchingManufacturers: { array: [{ manuId: 36, manuName: "FORD" }] },
  matchingModels: { array: [{ manuId: 36, modelId: 39142, modelName: "FOCUS IV Saloon (HM)" }] },
  matchingVehicles: {
    array: [
      { manuId: 36, carName: "FORD FOCUS IV Saloon (HM) 1.5 EcoBlue", modelId: 39142, vehicleId: 134068, linkageTargetType: "P", subLinkageTargetType: "V", vehicleTypeDescription: "1.5 EcoBlue" },
      { manuId: 36, carName: "FORD FOCUS IV Saloon (HM) 1.5 Ti-VCT", modelId: 39142, vehicleId: 134069, linkageTargetType: "P", subLinkageTargetType: "V", vehicleTypeDescription: "1.5 Ti-VCT" },
      { manuId: 36, carName: "FORD FOCUS IV Saloon (HM) 1.0 EcoBoost", modelId: 39142, vehicleId: 135550, linkageTargetType: "P", subLinkageTargetType: "V", vehicleTypeDescription: "1.0 EcoBoost" },
      { manuId: 36, carName: "FORD FOCUS IV Saloon (HM) 1.0 EcoBoost", modelId: 39142, vehicleId: 135552, linkageTargetType: "P", subLinkageTargetType: "V", vehicleTypeDescription: "1.0 EcoBoost" },
      { manuId: 36, carName: "FORD FOCUS IV Saloon (HM) 1.5 EcoBoost", modelId: 39142, vehicleId: 135557, linkageTargetType: "P", subLinkageTargetType: "V", vehicleTypeDescription: "1.5 EcoBoost" },
      { manuId: 36, carName: "FORD FOCUS IV Saloon (HM) 1.5 EcoBlue", modelId: 39142, vehicleId: 135558, linkageTargetType: "P", subLinkageTargetType: "V", vehicleTypeDescription: "1.5 EcoBlue" },
      { manuId: 36, carName: "FORD FOCUS IV Saloon (HM) 1.5 EcoBlue", modelId: 39142, vehicleId: 158634, linkageTargetType: "P", subLinkageTargetType: "V", vehicleTypeDescription: "1.5 EcoBlue" },
    ],
  },
}

export class MockVinProvider implements VinProvider {
  readonly name = "mock"

  async lookup(vin: string): Promise<VinProviderResult> {
    if (vin === MOCK_FOUND_VIN) return { status: "found", raw: MOCK_PAYLOAD }
    return { status: "not_found", raw: null }
  }
}
