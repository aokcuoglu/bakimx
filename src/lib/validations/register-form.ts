import { z } from "zod/v4"
import { ACQUISITION_SOURCES } from "@/lib/acquisition-sources"
import { optionalReferralCodeSchema } from "./referral-code"
import { BUSINESS_FEATURE_IDS, REGISTER_MODULE_IDS, REGISTER_SECTOR_IDS, SETUP_PREFERENCE_IDS, TEAM_SIZE_IDS } from "@/lib/register-onboarding"

export const createRegisterFormSchema = (onboarding: boolean) => z
  .object({
    sector: z.union([z.literal(""), z.enum(REGISTER_SECTOR_IDS)]).refine((value) => !onboarding || Boolean(value), "Sektör seçimi zorunludur"),
    businessFeatures: z.array(z.enum(BUSINESS_FEATURE_IDS)).default([]),
    teamSize: z.union([z.literal(""), z.enum(TEAM_SIZE_IDS)]).refine((value) => !onboarding || Boolean(value), "Ekip büyüklüğü seçimi zorunludur"),
    selectedModules: z.array(z.enum(REGISTER_MODULE_IDS)).min(onboarding ? 1 : 0, "En az bir modül seçin"),
    setupPreference: z.enum(SETUP_PREFERENCE_IDS),
    acquisitionSource: z.enum(ACQUISITION_SOURCES).default("unknown"),
    referralCode: optionalReferralCodeSchema,
    workshopName: z.string().min(onboarding ? 0 : 2, "Firma / servis adı zorunludur"),
    phone: z.string().min(onboarding ? 0 : 10, "Geçerli bir telefon numarası girin"),
    city: z.string().min(onboarding ? 0 : 1, "İl seçimi zorunludur"),
    district: z.string().optional().default(""),
    address: z.string().min(onboarding ? 0 : 3, "Açık adres zorunludur"),
    taxOffice: z.string().optional().default(""),
    taxNumber: z
      .string()
      .optional()
      .default("")
      .refine((value) => !value || /^\d{10,11}$/.test(value), "Vergi / TC kimlik no 10 veya 11 haneli olmalıdır"),
    firstName: z.string().min(onboarding ? 0 : 1, "Ad zorunludur"),
    lastName: z.string().min(onboarding ? 0 : 1, "Soyad zorunludur"),
    email: z.string().refine((value) => onboarding || z.email().safeParse(value).success, "Geçerli bir e-posta adresi girin"),
    password: z.string().min(onboarding ? 0 : 8, "Şifre en az 8 karakter olmalıdır"),
    confirmPassword: z.string().min(onboarding ? 0 : 8, "Şifrenizi tekrar girin"),
    kvkkConsent: z.boolean().refine((value) => onboarding || Boolean(value), "Devam etmek için aydınlatma metnini onaylayın"),
  })
  .superRefine((data, ctx) => {
    if (!onboarding && data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Şifreler eşleşmiyor" })
    }
    if (!onboarding && data.acquisitionSource === "referral" && !data.referralCode) {
      ctx.addIssue({ code: "custom", path: ["referralCode"], message: "Referans kodu zorunludur" })
    }
  })

