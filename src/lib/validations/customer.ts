import { z } from "zod/v4"

export const customerSchema = z.object({
  type: z.enum(["individual", "corporate"]).default("individual"),
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  fullName: z.string().optional().default(""),
  companyName: z.string().optional().default(""),
  contactName: z.string().optional().default(""),
  phone: z.string().min(1, "Telefon zorunludur"),
  phone2: z.string().optional().default(""),
  email: z.string().email("Geçersiz e-posta").or(z.literal("")).optional().default(""),
  city: z.string().optional().default(""),
  district: z.string().optional().default(""),
  address: z.string().optional().default(""),
  identityNumber: z.string().optional().default(""),
  taxNumber: z.string().optional().default(""),
  taxOffice: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  riskNote: z.string().optional().default(""),
  tag: z.string().default("standard"),
  source: z.string().optional().default(""),
  priceGroup: z.string().default("standard"),
  discountRate: z.coerce.number().int().min(0).max(10000).optional().default(0), // bps (2000 = %20)
  whatsappConsent: z.boolean().default(false),
  smsConsent: z.boolean().default(false),
  emailConsent: z.boolean().default(false),
  kvkkApprovedAt: z.string().optional().default(""),
})

export type CustomerFormValues = z.infer<typeof customerSchema>

// Action-side create schema (server actions). Kept separate from the form
// customerSchema to preserve server-action parsing behaviour (enum tags,
// error messages, superRefine rules).
export const customerCreateSchema = z
  .object({
    type: z.enum(["individual", "corporate"]).default("individual"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    fullName: z.string().optional(),
    companyName: z.string().optional(),
    contactName: z.string().optional(),
    phone: z.string().min(10, "Geçerli bir telefon numarası giriniz (en az 10 hane)"),
    phone2: z.string().optional(),
    email: z.email("Geçerli bir e-posta adresi giriniz").optional().or(z.literal("")),
    city: z.string().optional(),
    district: z.string().optional(),
    address: z.string().optional(),
    identityNumber: z.string().optional(),
    taxNumber: z.string().optional(),
    taxOffice: z.string().optional(),
    notes: z.string().optional(),
    tag: z.enum(["standard", "vip", "risky", "fleet"]).optional(),
    source: z
      .enum(["referral", "google", "social_media", "walk_in", "existing", "other"])
      .optional()
      .or(z.literal("")),
    priceGroup: z.enum(["standard", "discounted", "fleet"]).optional(),
    discountRate: z.coerce
      .number()
      .int("İndirim oranı bps (tam sayı) olmalıdır")
      .min(0, "İndirim oranı 0'dan küçük olamaz")
      .max(10000, "İndirim oranı %100'den büyük olamaz") // bps (2000 = %20)
      .optional(),
    riskNote: z.string().optional(),
    whatsappConsent: z.boolean().optional().default(false),
    smsConsent: z.boolean().optional().default(false),
    emailConsent: z.boolean().optional().default(false),
    kvkkApprovedAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "individual") {
      const hasFirst = (data.firstName || "").trim().length > 0
      const hasLast = (data.lastName || "").trim().length > 0
      const hasFull = (data.fullName || "").trim().length > 0
      if (!hasFirst && !hasFull) {
        ctx.addIssue({ code: "custom", path: ["firstName"], message: "Ad alanı zorunludur" })
      }
      if (!hasLast && !hasFull) {
        ctx.addIssue({ code: "custom", path: ["lastName"], message: "Soyad alanı zorunludur" })
      }
    } else {
      if (!(data.companyName || "").trim()) {
        ctx.addIssue({ code: "custom", path: ["companyName"], message: "Şirket adı zorunludur" })
      }
    }
  })