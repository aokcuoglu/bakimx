import { z } from "zod"

export const businessProfileFormSchema = z.object({
  name: z.string().min(1, "İş yeri adı zorunludur"),
  phone: z.string().min(1, "Telefon zorunludur"),
  city: z.string().min(1, "Şehir zorunludur"),
  district: z.string().optional().default(""),
  address: z.string().min(1, "Adres zorunludur"),
  email: z.email("Geçerli bir e-posta adresi giriniz").or(z.literal("")).optional().default(""),
  website: z.url("Geçerli bir URL giriniz").or(z.literal("")).optional().default(""),
  logoUrl: z.url("Geçerli bir URL giriniz").or(z.literal("")).optional().default(""),
  taxNumber: z.string().optional().default(""),
  taxOffice: z.string().optional().default(""),
  invoiceTitle: z.string().optional().default(""),
})
export type BusinessProfileFormValues = z.infer<typeof businessProfileFormSchema>

export const brandingFormSchema = z.object({
  pdfLogoUrl: z.url("Geçerli bir URL giriniz").or(z.literal("")).optional().default(""),
  publicPortalLogoUrl: z.url("Geçerli bir URL giriniz").or(z.literal("")).optional().default(""),
  passportLogoUrl: z.url("Geçerli bir URL giriniz").or(z.literal("")).optional().default(""),
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk kodu giriniz (ör: #3B82F6)")
    .or(z.literal(""))
    .optional()
    .default(""),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk kodu giriniz (ör: #10B981)")
    .or(z.literal(""))
    .optional()
    .default(""),
})
export type BrandingFormValues = z.infer<typeof brandingFormSchema>

export const communicationSettingsFormSchema = z.object({
  smsProvider: z.enum(["mock", "netgsm", "iletimerkezi", "custom"]).default("mock"),
  smsSenderName: z.string().optional().default(""),
  smsApiKey: z.string().optional().default(""),
  whatsappProvider: z.enum(["mock", "business_api", "custom"]).default("mock"),
  whatsappPhoneNumber: z.string().optional().default(""),
  whatsappApiKey: z.string().optional().default(""),
  emailProvider: z.enum(["mock", "resend", "sendgrid", "custom"]).default("mock"),
  emailFromName: z.string().optional().default(""),
  emailFromAddress: z.email("Geçerli bir e-posta adresi giriniz").or(z.literal("")).optional().default(""),
  emailApiKey: z.string().optional().default(""),
})
export type CommunicationSettingsFormValues = z.infer<typeof communicationSettingsFormSchema>

export const appointmentRulesFormSchema = z.object({
  defaultAppointmentDuration: z.coerce
    .number()
    .int("Geçerli bir süre giriniz")
    .min(5, "En az 5 dakika olmalıdır")
    .max(480, "En fazla 480 dakika olabilir"),
  bufferDuration: z.coerce
    .number()
    .int("Geçerli bir süre giriniz")
    .min(0, "Negatif olamaz")
    .max(120, "En fazla 120 dakika olabilir"),
  reminderTimings: z.string().min(1, "En az bir hatırlatma zamanı giriniz"),
})
export type AppointmentRulesFormValues = z.infer<typeof appointmentRulesFormSchema>

export const workingHoursFormSchema = z.object({
  weekdayStart: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 09:00)"),
  weekdayEnd: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 18:00)"),
  weekdayWorkingDays: z.string().default(""),
  weekendStart: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 10:00)"),
  weekendEnd: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 14:00)"),
  weekendWorkingDays: z.string().default(""),
  holidayEnabled: z.boolean().default(false),
  holidayDates: z.string().optional().default(""),
})
export type WorkingHoursFormValues = z.infer<typeof workingHoursFormSchema>

export const pdfTemplatesFormSchema = z.object({
  workOrderTemplate: z.string().optional().default(""),
  servicePassportTemplate: z.string().optional().default(""),
  collectionReceiptTemplate: z.string().optional().default(""),
})
export type PdfTemplatesFormValues = z.infer<typeof pdfTemplatesFormSchema>