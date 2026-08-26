import { z } from "zod"

export const salesLeadSchema = z.object({
  businessName: z.string().trim().min(2, "Servis adı en az 2 karakter olmalıdır").max(160),
  contactName: z.string().trim().min(2, "Yetkili adı en az 2 karakter olmalıdır").max(120),
  phone: z.string().trim().min(7, "Geçerli bir telefon numarası girin").max(30),
  email: z.string().trim().email("Geçerli bir e-posta girin").or(z.literal("")),
  city: z.string().trim().max(80),
  notes: z.string().trim().max(2000),
})

export const salesActivitySchema = z.object({
  type: z.enum(["visit", "phone", "whatsapp", "email", "demo", "note"]),
  summary: z.string().trim().min(2, "Görüşme özeti zorunludur").max(2000),
  nextActionAt: z.string().trim().optional(),
})

export const salesLeadStatusSchema = z.enum([
  "new", "contacted", "demo_scheduled", "demo_completed", "proposal", "won", "lost",
])

export const salesCommissionSchema = z.object({
  amountMinor: z.coerce.number().int().min(0, "Tutar negatif olamaz").max(100_000_000),
  note: z.string().trim().max(1000),
})

export const salesDiscountCodeSchema = z.object({
  discountPercent: z.coerce.number().int().min(1, "İndirim en az %1 olmalıdır").max(99, "İndirim %99'u aşamaz"),
  leadId: z.string().trim().optional(),
})

export const salesDiscountCodeUpdateSchema = z.object({
  expiresAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Geçerli bir tarih seçin"),
})

export const salesReferralSchema = z.object({
  referrerName: z.string().trim().min(2, "Referans veren müşterinin adı zorunludur").max(120),
  referrerPhone: z.string().trim().min(7, "Referans veren müşterinin telefonu geçersiz").max(30),
  referredBusinessName: z.string().trim().min(2, "Yeni müşteri/servis adı en az 2 karakter olmalıdır").max(160),
  referredContactName: z.string().trim().min(2, "Yetkili adı en az 2 karakter olmalıdır").max(120),
  referredPhone: z.string().trim().min(7, "Yeni müşterinin telefonu geçersiz").max(30),
  referredEmail: z.string().trim().email("Geçerli bir e-posta girin").or(z.literal("")),
  notes: z.string().trim().max(2000),
})

export const salesReferralStatusSchema = z.enum(["new", "contacted", "won", "lost"])
