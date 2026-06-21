import { z } from "zod"

export const appointmentCreateFormSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  vehicleId: z.string().optional().default(""),
  appointmentAt: z.string().min(1, "Randevu tarihi zorunludur"),
  appointmentTime: z.string().min(1, "Randevu saati zorunludur"),
  estimatedDurationMinutes: z.string().optional().default(""),
  title: z.string().optional().default(""),
  customerRequest: z.string().optional().default(""),
  internalNote: z.string().optional().default(""),
  reminderEnabled: z.boolean().optional().default(false),
})

export type AppointmentCreateFormValues = z.infer<typeof appointmentCreateFormSchema>