import { z } from "zod/v4"
import { isEmailIdentifier } from "@/lib/user-identity"
import { ACQUISITION_SOURCES } from "@/lib/acquisition-sources"
import { optionalReferralCodeSchema } from "@/lib/validations/referral-code"
import {
  BUSINESS_FEATURE_IDS,
  REGISTER_MODULE_IDS,
  REGISTER_SECTOR_IDS,
  SETUP_PREFERENCE_IDS,
  TEAM_SIZE_IDS,
} from "@/lib/register-onboarding"

/**
 * Giriş formu tek kimlik alanı taşır (BAK-40): değer `@` içeriyorsa e-posta
 * olarak doğrulanır — mevcut kullanıcılar için davranış birebir aynı. İçermiyorsa
 * kullanıcı adı yoludur ve iş yeri kodu ZORUNLUDUR: kullanıcı adları yalnız
 * tenant içinde benzersiz olduğu için kod olmadan hangi hesap olduğu çözülemez.
 */
export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1, "E-posta adresi veya kullanıcı adı zorunludur"),
    workshopCode: z.string().trim().optional(),
    password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
  })
  .refine((d) => !isEmailIdentifier(d.identifier) || z.email().safeParse(d.identifier).success, {
    message: "Geçerli bir e-posta adresi giriniz",
    path: ["identifier"],
  })
  .refine((d) => isEmailIdentifier(d.identifier) || Boolean(d.workshopCode), {
    message: "Kullanıcı adıyla giriş için iş yeri kodu gereklidir",
    path: ["workshopCode"],
  })

export const registerSchema = z
  .object({
    sector: z.enum(REGISTER_SECTOR_IDS).default("auto_service"),
    businessFeatures: z.array(z.enum(BUSINESS_FEATURE_IDS)).default([]),
    teamSize: z.enum(TEAM_SIZE_IDS).default("solo"),
    selectedModules: z.array(z.enum(REGISTER_MODULE_IDS)).min(1).default([
      "customers_vehicles",
      "work_orders",
      "appointments",
      "reports",
      "digital_intake",
    ]),
    setupPreference: z.enum(SETUP_PREFERENCE_IDS).default("self_service"),
    acquisitionSource: z.enum(ACQUISITION_SOURCES).default("unknown"),
    salesRegistrationToken: z.string().trim().optional().default(""),
    referralCode: optionalReferralCodeSchema,
    email: z.email("Geçerli bir e-posta adresi giriniz"),
    password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
    firstName: z.string().min(1, "Ad zorunludur"),
    lastName: z.string().min(1, "Soyad zorunludur"),
    workshopName: z.string().min(2, "İş yeri adı zorunludur"),
    phone: z.string().min(10, "Geçerli bir telefon numarası giriniz (en az 10 hane)"),
    city: z.string().min(1, "Şehir zorunludur"),
    address: z.string().min(1, "Adres zorunludur"),
    district: z.string().optional().default(""),
    workshopEmail: z
      .string()
      .optional()
      .default("")
      .refine((v) => !v || z.email().safeParse(v).success, {
        message: "Geçerli bir e-posta adresi giriniz",
      }),
    taxOffice: z.string().optional().default(""),
    taxNumber: z
      .string()
      .optional()
      .default("")
      .refine((value) => !value || /^\d{10,11}$/.test(value.replace(/\s/g, "")), {
        message: "Vergi/TC kimlik no 10 veya 11 haneli olmalıdır",
      }),
    invoiceTitle: z.string().optional().default(""),
    weekdayStart: z.string().optional().default("09:00"),
    weekdayEnd: z.string().optional().default("18:00"),
    workingDays: z.string().optional().default("1,2,3,4,5,6"),
    teamMembers: z
      .array(
        z.object({
          fullName: z.string().min(1),
          role: z.enum(["usta", "teknisyen", "servis_danismani"]),
        }),
      )
      .optional()
      .default([]),
    kvkkConsent: z
      .union([z.literal("on"), z.literal("true"), z.boolean()])
      .refine((v) => v === true || v === "on" || v === "true", {
        message: "Devam etmek için aydınlatma metnini onaylamanız gerekir",
      }),
  })
  .superRefine((data, ctx) => {
    if (data.acquisitionSource === "referral" && !data.referralCode) {
      ctx.addIssue({
        code: "custom",
        path: ["referralCode"],
        message: "Referans kaynağı için referans kodu zorunludur",
      })
    }
  })

export const forgotPasswordSchema = z.object({
  email: z.email("Geçerli bir e-posta adresi giriniz"),
})

/**
 * Kullanıcının KENDİ şifresini değiştirmesi (BAK-37). Mevcut şifre bilerek
 * zorunlu: geçici şifre ekranı ortak bir tablette açık kalabilir ve o hâliyle
 * yanından geçen birinin hesabı devralmasına izin vermemeli.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Mevcut şifrenizi giriniz"),
    password: z.string().min(8, "Yeni şifre en az 8 karakter olmalıdır"),
    confirmPassword: z.string().min(8, "Yeni şifre en az 8 karakter olmalıdır"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  })
  .refine((d) => d.password !== d.currentPassword, {
    message: "Yeni şifre mevcut şifrenizden farklı olmalıdır",
    path: ["password"],
  })

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Geçersiz sıfırlama bağlantısı"),
    password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
    confirmPassword: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  })
