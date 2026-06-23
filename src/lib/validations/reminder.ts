import { z } from "zod/v4"

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

export const reminderCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  vehicleId: z.string().min(1, "Araç seçimi zorunludur"),
  title: z.string().min(1, "Hatırlatma başlığı zorunludur"),
  type: z.enum(["periodic_maintenance", "oil_change", "inspection", "tire_change", "brake_check", "battery_check", "insurance", "other"], {
    error: "Geçerli bir bakım türü seçiniz",
  }).default("other"),
  dueDate: z.string().optional().or(z.literal("")),
  dueMileage: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(1, "KM pozitif olmalıdır").optional().or(z.literal("")),
  currentMileage: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(0, "KM negatif olamaz").optional().or(z.literal("")),
  lastServiceDate: z.string().optional().or(z.literal("")),
  lastServiceMileage: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(0, "KM negatif olamaz").optional().or(z.literal("")),
  reminderDaysBefore: z.coerce.number().int("Tam sayı giriniz").min(0, "0-365 arası olmalıdır").max(365, "0-365 arası olmalıdır").optional().or(z.literal("")),
  reminderKmBefore: z.coerce.number().int("Tam sayı giriniz").min(0, "0-50000 arası olmalıdır").max(50000, "0-50000 arası olmalıdır").optional().or(z.literal("")),
  preferredChannel: z.enum(["none", "sms", "whatsapp", "phone", "email"], {
    error: "Geçerli bir kanal seçiniz",
  }).default("none"),
  customerNote: z.string().optional(),
  internalNote: z.string().optional(),
}).superRefine((data, ctx) => {
  const hasDueDate = (data.dueDate || "").trim().length > 0
  const hasDueMileage = data.dueMileage != null && data.dueMileage !== "" && Number(data.dueMileage) > 0
  if (!hasDueDate && !hasDueMileage) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Planlanan tarih veya KM'den en az biri zorunludur" })
    ctx.addIssue({ code: "custom", path: ["dueMileage"], message: "Planlanan tarih veya KM'den en az biri zorunludur" })
  }
})