import { z } from "zod/v4"
import { SALE_PLAN_TIERS } from "@/lib/plan"
import { isValidWorkshopCode } from "@/lib/workshop-code"
import { ACQUISITION_SOURCES } from "@/lib/acquisition-sources"

const tier = z.enum(SALE_PLAN_TIERS)
const cycle = z.enum(["monthly", "yearly"])
// Ödeme yöntemi — eski istemciler alanı göndermezse `havale` (geriye uyumlu).
const method = z.enum(["card", "havale"]).default("havale")

// In-app: account exists; collect plan + invoice/tax info.
export const checkoutInAppSchema = z.object({
  tier,
  cycle,
  method,
  invoiceTitle: z.string().min(2, "Fatura ünvanı zorunludur"),
  taxNumber: z.string().min(10, "Vergi/TC kimlik no zorunludur (en az 10 hane)"),
  taxOffice: z.string().optional().default(""),
})
export type CheckoutInAppValues = z.infer<typeof checkoutInAppSchema>

// Public: also create the workshop + owner (mirrors registerSchema fields).
export const checkoutPublicSchema = z.object({
  acquisitionSource: z.enum(ACQUISITION_SOURCES).default("unknown"),
  acquisitionAdvisorId: z.string().optional().default(""),
  tier,
  cycle,
  method,
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
  district: z.string().optional().default(""),
  address: z.string().min(1, "Adres zorunludur"),
  workshopEmail: z.string().optional().default(""),
  workingDays: z.string().optional().default("1,2,3,4,5"),
  weekdayStart: z.string().optional().default("09:00"),
  weekdayEnd: z.string().optional().default("18:00"),
  loginCode: z
    .string()
    .min(1, "İş yeri giriş kodu zorunludur")
    .refine(isValidWorkshopCode, "İş yeri kodu geçersiz: 3-20 karakter, a-z, 0-9 ve tire (-) içermelidir"),
  kvkkConsent: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .refine((v) => v === true || v === "on" || v === "true", {
      message: "Devam etmek için aydınlatma metnini onaylamanız gerekir",
    }),
})
export type CheckoutPublicValues = z.infer<typeof checkoutPublicSchema>
