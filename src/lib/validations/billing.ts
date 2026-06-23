import { z } from "zod/v4"

const tier = z.enum(["starter", "pro", "premium"])
const cycle = z.enum(["monthly", "yearly"])

// In-app: account exists; collect plan + invoice/tax info.
export const checkoutInAppSchema = z.object({
  tier,
  cycle,
  invoiceTitle: z.string().min(2, "Fatura ünvanı zorunludur"),
  taxNumber: z.string().min(10, "Vergi/TC kimlik no zorunludur (en az 10 hane)"),
  taxOffice: z.string().optional().default(""),
})
export type CheckoutInAppValues = z.infer<typeof checkoutInAppSchema>

// Public: also create the workshop + owner (mirrors registerSchema fields).
export const checkoutPublicSchema = z.object({
  tier,
  cycle,
  invoiceTitle: z.string().min(2, "Fatura ünvanı zorunludur"),
  taxNumber: z.string().min(10, "Vergi/TC kimlik no zorunludur (en az 10 hane)"),
  taxOffice: z.string().optional().default(""),
  email: z.email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  firstName: z.string().min(1, "Ad zorunludur"),
  lastName: z.string().min(1, "Soyad zorunludur"),
  workshopName: z.string().min(2, "İş yeri adı zorunludur"),
  phone: z.string().min(10, "Geçerli bir telefon numarası giriniz (en az 10 hane)"),
  city: z.string().min(1, "Şehir zorunludur"),
  address: z.string().min(1, "Adres zorunludur"),
  kvkkConsent: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .refine((v) => v === true || v === "on" || v === "true", {
      message: "Devam etmek için aydınlatma metnini onaylamanız gerekir",
    }),
})
export type CheckoutPublicValues = z.infer<typeof checkoutPublicSchema>
