import { z } from "zod/v4"

export const loginSchema = z.object({
  email: z.email("Geçerli bir e-posta girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
})

export const registerSchema = z.object({
  email: z.email("Geçerli bir e-posta girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
  firstName: z.string().min(1, "Ad gerekli"),
  lastName: z.string().min(1, "Soyad gerekli"),
  workshopName: z.string().min(1, "İş yeri adı gerekli"),
  phone: z.string().min(10, "Geçerli bir telefon girin"),
  city: z.string().min(1, "Şehir gerekli"),
  address: z.string().min(1, "Adres gerekli"),
})

export const workshopUpdateSchema = z.object({
  name: z.string().min(1, "İş yeri adı gerekli"),
  phone: z.string().min(1, "Telefon gerekli"),
  city: z.string().min(1, "Şehir gerekli"),
  address: z.string().min(1, "Adres gerekli"),
  logoUrl: z.string().url().optional().or(z.literal("")),
  taxNumber: z.string().optional(),
  invoiceTitle: z.string().optional(),
})

export const customerCreateSchema = z.object({
  firstName: z.string().min(1, "Ad gerekli"),
  lastName: z.string().min(1, "Soyad gerekli"),
  phone: z.string().min(10, "Geçerli bir telefon girin"),
  email: z.email().optional().or(z.literal("")),
})

export const vehicleCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi gerekli"),
  plate: z.string().min(1, "Plaka gerekli"),
  brand: z.string().min(1, "Marka gerekli"),
  model: z.string().min(1, "Model gerekli"),
  vehicleType: z.string().optional(),
  modelYear: z.coerce.number().int().min(1900).max(2030).optional(),
  mileage: z.coerce.number().int().min(0).optional(),
  vin: z.string().optional(),
})

export const intakeCreateSchema = z.object({
  customerId: z.string().min(1),
  vehicleId: z.string().min(1),
  mileageAtIntake: z.coerce.number().int().min(0).optional(),
  customerComplaint: z.string().min(1, "Müşteri şikayeti gerekli"),
  internalNote: z.string().optional(),
})

export const damageMarkSchema = z.object({
  zone: z.string().min(1),
  damageType: z.enum(["scratch", "dent", "broken", "cracked", "paint_damage", "missing_part", "other"]),
  severity: z.enum(["light", "medium", "heavy"]),
  note: z.string().optional(),
  photoUrl: z.string().optional(),
})

export const otpVerifySchema = z.object({
  otpCode: z.string().min(4, "OTP kodu gerekli"),
})

export const serviceOrderItemSchema = z.object({
  type: z.enum(["part", "labor"]),
  name: z.string().min(1, "Ad gerekli"),
  quantity: z.coerce.number().int().min(1).default(1),
  unitPrice: z.coerce.number().min(0).optional(),
  totalPrice: z.coerce.number().min(0).optional(),
  note: z.string().optional(),
})