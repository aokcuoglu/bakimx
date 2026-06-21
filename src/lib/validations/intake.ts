import { z } from "zod"

export const intakeSchema = z.object({
  // Step 1: Customer selection
  selectedCustomerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  newFirstName: z.string().min(1, "Ad zorunludur"),
  newLastName: z.string().min(1, "Soyad zorunludur"),
  newPhone: z.string().min(1, "Telefon zorunludur"),

  // Step 2: Vehicle selection
  selectedVehicleId: z.string().min(1, "Araç seçimi zorunludur"),
  newPlate: z.string().min(1, "Plaka zorunludur"),
  newBrand: z.string().min(1, "Marka zorunludur"),
  newModel: z.string().min(1, "Model zorunludur"),
  newMileage: z.string().optional().default(""),

  // Step 3: Intake details
  mileageAtIntake: z.string().optional().default(""),
  customerComplaint: z.string().min(1, "Müşteri şikayeti zorunludur"),
  internalNote: z.string().optional().default(""),

  // Step 6: Approval consents
  termsAccepted: z.boolean().refine((v) => v === true, "Araç kabul formunu onaylamanız zorunludur"),
  privacyAccepted: z.boolean().refine((v) => v === true, "Aydınlatma metnini onaylamanız zorunludur"),
  serviceInfoAccepted: z.boolean().optional().default(false),
  promoAccepted: z.boolean().optional().default(false),

  // Step 6: OTP
  otpCode: z.string().optional().default(""),
})

export type IntakeFormValues = z.infer<typeof intakeSchema>