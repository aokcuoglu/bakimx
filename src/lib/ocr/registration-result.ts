import { z } from "zod"
import type { OcrFieldConfidence, RegistrationOcrResult } from "./types"

export const RegistrationFieldsSchema = z.object({
  plate: z.string(),
  vin: z.string(),
  ownerName: z.string(),
  ownerSurname: z.string(),
  brand: z.string(),
  model: z.string(),
  vehicleType: z.string(),
  modelYear: z.string(),
  engineNo: z.string(),
  registrationDate: z.string(),
})

export type RegistrationFields = z.infer<typeof RegistrationFieldsSchema>

function field(value: string): OcrFieldConfidence {
  return { value: value.trim() }
}

export function toRegistrationResult(
  data: RegistrationFields,
  rawText: string
): Omit<RegistrationOcrResult, "provider"> {
  return {
    plate: field(data.plate.toUpperCase()),
    vin: field(data.vin.toUpperCase()),
    ownerName: field(data.ownerName),
    ownerSurname: field(data.ownerSurname),
    brand: field(data.brand),
    model: field(data.model),
    vehicleType: field(data.vehicleType),
    modelYear: field(data.modelYear),
    engineNo: field(data.engineNo.toUpperCase()),
    registrationDate: field(data.registrationDate),
    rawText: rawText.trim(),
  }
}

