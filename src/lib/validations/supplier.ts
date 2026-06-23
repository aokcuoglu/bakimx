import { z } from "zod/v4"

export const supplierSchema = z.object({
  name: z.string().min(1, "Tedarikçi adı zorunludur"),
  contactPerson: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  phone2: z.string().optional().default(""),
  email: z.string().email("Geçersiz e-posta").or(z.literal("")).optional().default(""),
  website: z.string().optional().default(""),
  city: z.string().optional().default(""),
  address: z.string().optional().default(""),
  taxNumber: z.string().optional().default(""),
  taxOffice: z.string().optional().default(""),
  category: z.string().optional().default(""),
  paymentTermDays: z.coerce.number().min(0).optional().default(0),
  averageDeliveryDays: z.coerce.number().min(0).optional().default(0),
  performanceNote: z.string().optional().default(""),
  internalNote: z.string().optional().default(""),
  isActive: z.enum(["true", "false"]).default("true"),
})

export type SupplierFormValues = z.infer<typeof supplierSchema>

export const supplierCreateSchema = z.object({
  name: z.string().min(1, "Tedarikçi adı zorunludur"),
  contactPerson: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  phone2: z.string().optional().or(z.literal("")),
  email: z.email("Geçerli bir e-posta adresi giriniz").optional().or(z.literal("")),
  website: z.url("Geçerli bir URL giriniz").optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  taxNumber: z.string().optional().or(z.literal("")),
  taxOffice: z.string().optional().or(z.literal("")),
  category: z.string().optional().or(z.literal("")),
  paymentTermDays: z.coerce.number().int("Ödeme vadesi tam sayı olmalıdır").min(0, "Ödeme vadesi negatif olamaz").optional().or(z.literal("")),
  averageDeliveryDays: z.coerce.number().int("Teslimat süresi tam sayı olmalıdır").min(0, "Teslimat süresi negatif olamaz").optional().or(z.literal("")),
  performanceNote: z.string().optional().or(z.literal("")),
  internalNote: z.string().optional().or(z.literal("")),
  isActive: z.coerce.boolean().optional().default(true),
})

export const supplierUpdateSchema = supplierCreateSchema
