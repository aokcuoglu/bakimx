import { z } from "zod"

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
  discountRate: z.coerce.number().min(0).max(100).optional().default(0),
  whatsappConsent: z.boolean().default(false),
  smsConsent: z.boolean().default(false),
  emailConsent: z.boolean().default(false),
  kvkkApprovedAt: z.string().optional().default(""),
})

export type CustomerFormValues = z.infer<typeof customerSchema>