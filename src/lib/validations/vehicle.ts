import { z } from "zod"

export const vehicleSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  plate: z.string().min(1, "Plaka zorunludur").max(20, "Plaka çok uzun"),
  brand: z.string().min(1, "Marka zorunludur"),
  model: z.string().min(1, "Model zorunludur"),
  vehicleType: z.string().optional().default(""),
  modelYear: z.coerce
    .number()
    .int("Geçerli bir yıl giriniz")
    .min(1900, "Yıl en az 1900 olmalıdır")
    .max(2030, "Yıl en fazla 2030 olmalıdır")
    .optional(),
  mileage: z.coerce
    .number()
    .int("Geçerli bir kilometre değeri giriniz")
    .min(0, "Kilometre negatif olamaz")
    .optional(),
  vin: z.string().optional().default(""),
  vinConfirmed: z.boolean().optional().default(false),
  color: z.string().optional().default(""),
  engineNo: z.string().optional().default(""),
  fuelType: z.string().optional().default(""),
  transmission: z.string().optional().default(""),
  notes: z.string().optional().default(""),
})

export type VehicleFormValues = z.infer<typeof vehicleSchema>