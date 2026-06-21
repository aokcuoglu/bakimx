import { z } from "zod"

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
