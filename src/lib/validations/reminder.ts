import { z } from "zod"

export const reminderSchema = z.object({
  customerId: z.string().optional().default(""),
  vehicleId: z.string().optional().default(""),
  title: z.string().min(1, "Başlık zorunludur"),
  type: z.enum([
    "periodic_maintenance",
    "oil_change",
    "inspection",
    "tire_change",
    "brake_check",
    "battery_check",
    "insurance",
    "other",
  ]).default("other"),
  dueDate: z.string().optional().default(""),
  dueMileage: z.string().optional().default(""),
  currentMileage: z.string().optional().default(""),
  lastServiceDate: z.string().optional().default(""),
  lastServiceMileage: z.string().optional().default(""),
  reminderDaysBefore: z.string().optional().default(""),
  reminderKmBefore: z.string().optional().default(""),
  preferredChannel: z.enum(["none", "sms", "whatsapp", "phone", "email"]).default("none"),
  customerNote: z.string().optional().default(""),
  internalNote: z.string().optional().default(""),
})

export type ReminderFormValues = z.infer<typeof reminderSchema>