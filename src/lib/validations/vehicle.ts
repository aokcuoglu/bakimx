import { z } from "zod/v4"

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

// Action-side schemas (server actions). Kept separate from the form
// vehicleSchema to preserve server-action parsing behaviour.
export const vehicleCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  plate: z.string().min(1, "Plaka zorunludur").max(20, "Plaka çok uzun"),
  brand: z.string().min(1, "Marka zorunludur"),
  model: z.string().min(1, "Model zorunludur"),
  vehicleType: z.string().optional(),
  modelYear: z.coerce.number().int("Geçerli bir yıl giriniz").min(1900, "Yıl en az 1900 olmalıdır").max(2030, "Yıl en fazla 2030 olmalıdır").optional(),
  mileage: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(0, "Kilometre negatif olamaz").optional(),
  vin: z.string().optional(),
  vinConfirmed: z.coerce.boolean().optional(),
  color: z.string().optional(),
  engineNo: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  notes: z.string().optional(),
})

export const vehicleUpdateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  plate: z.string().min(1, "Plaka zorunludur").max(20, "Plaka çok uzun"),
  brand: z.string().min(1, "Marka zorunludur"),
  model: z.string().min(1, "Model zorunludur"),
  vehicleType: z.string().optional(),
  modelYear: z.coerce.number().int("Geçerli bir yıl giriniz").min(1900, "Yıl en az 1900 olmalıdır").max(2030, "Yıl en fazla 2030 olmalıdır").optional(),
  mileage: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(0, "Kilometre negatif olamaz").optional(),
  vin: z.string().optional(),
  vinConfirmed: z.coerce.boolean().optional(),
  color: z.string().optional(),
  engineNo: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  notes: z.string().optional(),
})