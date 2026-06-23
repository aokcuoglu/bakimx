import { z } from "zod/v4"

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

export const appointmentCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  vehicleId: z.string().optional().or(z.literal("")),
  appointmentAt: z.string().min(1, "Randevu tarihi zorunludur"),
  appointmentTime: z.string().min(1, "Randevu saati zorunludur"),
  estimatedDurationMinutes: z.coerce.number().int("Geçerli bir süre giriniz").min(5, "Süre en az 5 dakika olmalıdır").optional(),
  title: z.string().optional(),
  customerRequest: z.string().optional(),
  internalNote: z.string().optional(),
  reminderEnabled: z.coerce.boolean().optional().default(false),
})

export const appointmentStatusUpdateSchema = z.object({
  status: z.enum(["scheduled", "confirmed", "arrived", "converted", "completed", "cancelled", "no_show"], {
    error: "Geçerli bir durum seçiniz",
  }),
})