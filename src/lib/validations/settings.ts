import { z } from "zod/v4"

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

// Allowed provider values — single source of truth for both the form and the
// action schemas. Kept in sync with the enum values below. Legacy DB values
// that are no longer supported (iletimerkezi/sendgrid/custom) are normalized
// back to "mock" via `normalizeSmsProvider`/`normalizeWhatsAppProvider`/
// `normalizeEmailProvider`.
export const ALLOWED_SMS_PROVIDERS = ["mock", "netgsm"] as const
export const ALLOWED_WHATSAPP_PROVIDERS = ["mock", "business_api"] as const
export const ALLOWED_EMAIL_PROVIDERS = ["mock", "resend"] as const

export type SmsProvider = (typeof ALLOWED_SMS_PROVIDERS)[number]
export type WhatsAppProvider = (typeof ALLOWED_WHATSAPP_PROVIDERS)[number]
export type EmailProvider = (typeof ALLOWED_EMAIL_PROVIDERS)[number]

export function normalizeSmsProvider(value: string): SmsProvider {
  return (ALLOWED_SMS_PROVIDERS as readonly string[]).includes(value) ? (value as SmsProvider) : "mock"
}

export function normalizeWhatsAppProvider(value: string): WhatsAppProvider {
  return (ALLOWED_WHATSAPP_PROVIDERS as readonly string[]).includes(value) ? (value as WhatsAppProvider) : "mock"
}

export function normalizeEmailProvider(value: string): EmailProvider {
  return (ALLOWED_EMAIL_PROVIDERS as readonly string[]).includes(value) ? (value as EmailProvider) : "mock"
}

export const communicationSettingsFormSchema = z.object({
  smsProvider: z.enum(ALLOWED_SMS_PROVIDERS).default("mock"),
  smsSenderName: z.string().optional().default(""),
  smsApiKey: z.string().optional().default(""),
  whatsappProvider: z.enum(ALLOWED_WHATSAPP_PROVIDERS).default("mock"),
  whatsappPhoneNumber: z.string().optional().default(""),
  whatsappApiKey: z.string().optional().default(""),
  emailProvider: z.enum(ALLOWED_EMAIL_PROVIDERS).default("mock"),
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

// Action-side schemas (server actions). Kept separate from the *FormSchema
// variants to preserve server-action parsing behaviour.
export const businessProfileSchema = z.object({
  name: z.string().min(1, "İş yeri adı zorunludur"),
  phone: z.string().min(1, "Telefon zorunludur"),
  city: z.string().min(1, "Şehir zorunludur"),
  district: z.string().optional().or(z.literal("")),
  address: z.string().min(1, "Adres zorunludur"),
  email: z.email("Geçerli bir e-posta adresi giriniz").optional().or(z.literal("")),
  website: z.url("Geçerli bir URL giriniz").optional().or(z.literal("")),
  taxNumber: z.string().optional().or(z.literal("")),
  taxOffice: z.string().optional().or(z.literal("")),
  invoiceTitle: z.string().optional().or(z.literal("")),
  logoUrl: z.url("Geçerli bir URL giriniz").optional().or(z.literal("")),
})

export const brandingSchema = z.object({
  pdfLogoUrl: z.url("Geçerli bir URL giriniz").optional().or(z.literal("")),
  publicPortalLogoUrl: z.url("Geçerli bir URL giriniz").optional().or(z.literal("")),
  passportLogoUrl: z.url("Geçerli bir URL giriniz").optional().or(z.literal("")),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk kodu giriniz (ör: #3B82F6)").optional().or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk kodu giriniz (ör: #10B981)").optional().or(z.literal("")),
})

export const communicationSettingsSchema = z.object({
  smsProvider: z.enum(ALLOWED_SMS_PROVIDERS).default("mock"),
  smsApiKey: z.string().optional().or(z.literal("")),
  smsSenderName: z.string().optional().or(z.literal("")),
  whatsappProvider: z.enum(ALLOWED_WHATSAPP_PROVIDERS).default("mock"),
  whatsappApiKey: z.string().optional().or(z.literal("")),
  whatsappPhoneNumber: z.string().optional().or(z.literal("")),
  emailProvider: z.enum(ALLOWED_EMAIL_PROVIDERS).default("mock"),
  emailApiKey: z.string().optional().or(z.literal("")),
  emailFromAddress: z.email("Geçerli bir e-posta adresi giriniz").optional().or(z.literal("")),
  emailFromName: z.string().optional().or(z.literal("")),
})

export const workingHoursSchema = z.object({
  weekdayStart: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 09:00)"),
  weekdayEnd: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 18:00)"),
  weekdayWorkingDays: z.string(),
  weekendStart: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 10:00)"),
  weekendEnd: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 14:00)"),
  weekendWorkingDays: z.string(),
  holidayEnabled: z.coerce.boolean().default(false),
  holidayDates: z.string().optional().or(z.literal("")),
})

export const appointmentRulesSchema = z.object({
  defaultAppointmentDuration: z.coerce.number().int("Geçerli bir süre giriniz").min(5, "En az 5 dakika olmalıdır").max(480, "En fazla 480 dakika olabilir"),
  bufferDuration: z.coerce.number().int("Geçerli bir süre giriniz").min(0, "Negatif olamaz").max(120, "En fazla 120 dakika olabilir"),
  reminderTimings: z.string().min(1, "En az bir hatırlatma zamanı giriniz"),
})

export const pdfTemplateSchema = z.object({
  workOrderTemplate: z.string().optional().or(z.literal("")),
  servicePassportTemplate: z.string().optional().or(z.literal("")),
  collectionReceiptTemplate: z.string().optional().or(z.literal("")),
})