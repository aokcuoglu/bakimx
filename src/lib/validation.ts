import { z } from "zod/v4"

export const loginSchema = z.object({
  email: z.email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
})

export const registerSchema = z.object({
  email: z.email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
  firstName: z.string().min(1, "Ad zorunludur"),
  lastName: z.string().min(1, "Soyad zorunludur"),
  workshopName: z.string().min(1, "İş yeri adı zorunludur"),
  phone: z.string().min(1, "Telefon zorunludur"),
  city: z.string().min(1, "Şehir zorunludur"),
  address: z.string().min(1, "Adres zorunludur"),
})

export const workshopUpdateSchema = z.object({
  name: z.string().min(1, "İş yeri adı zorunludur"),
  phone: z.string().min(1, "Telefon zorunludur"),
  city: z.string().min(1, "Şehir zorunludur"),
  address: z.string().min(1, "Adres zorunludur"),
  logoUrl: z.string().url("Geçerli bir URL giriniz").optional().or(z.literal("")),
  taxNumber: z.string().optional(),
  invoiceTitle: z.string().optional(),
})

export const customerCreateSchema = z.object({
  firstName: z.string().min(1, "Ad alanı zorunludur"),
  lastName: z.string().min(1, "Soyad alanı zorunludur"),
  phone: z.string().min(10, "Geçerli bir telefon numarası giriniz (en az 10 hane)"),
  email: z.email("Geçerli bir e-posta adresi giriniz").optional().or(z.literal("")),
})

export const vehicleCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  plate: z.string().min(1, "Plaka zorunludur").max(20, "Plaka çok uzun"),
  brand: z.string().min(1, "Marka zorunludur"),
  model: z.string().min(1, "Model zorunludur"),
  vehicleType: z.string().optional(),
  modelYear: z.coerce.number().int("Geçerli bir yıl giriniz").min(1900, "Yıl en az 1900 olmalıdır").max(2030, "Yıl en fazla 2030 olmalıdır").optional(),
  mileage: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(0, "Kilometre negatif olamaz").optional(),
  vin: z.string().optional(),
})

export const intakeCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  vehicleId: z.string().min(1, "Araç seçimi zorunludur"),
  mileageAtIntake: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(0, "Kilometre negatif olamaz").optional(),
  customerComplaint: z.string().min(1, "Müşteri şikayeti zorunludur"),
  internalNote: z.string().optional(),
})

export const damageMarkSchema = z.object({
  zone: z.string().min(1, "Bölge seçimi zorunludur"),
  damageType: z.enum(["scratch", "dent", "broken", "cracked", "paint_damage", "missing_part", "other"], {
    error: "Geçerli bir hasar tipi seçiniz",
  }),
  severity: z.enum(["light", "medium", "heavy"], {
    error: "Geçerli bir şiddet seviyesi seçiniz",
  }),
  note: z.string().optional(),
  photoUrl: z.string().optional(),
})

export const otpVerifySchema = z.object({
  otpCode: z.string().min(4, "Doğrulama kodu gerekli").max(6, "Doğrulama kodu en fazla 6 haneli olmalıdır"),
})

export const serviceOrderItemSchema = z.object({
  type: z.enum(["part", "labor"], {
    error: "Geçerli bir kalem tipi seçiniz (parça/işçilik)",
  }),
  name: z.string().min(1, "Kalem adı zorunludur"),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır").default(1),
  unitPrice: z.coerce.number().min(0, "Birim fiyat negatif olamaz").optional(),
  totalPrice: z.coerce.number().min(0, "Toplam fiyat negatif olamaz").optional(),
  note: z.string().optional(),
})

/**
 * Safely parse form data and return the first Turkish error message.
 */
export function getValidationError(result: { success: boolean; error?: { issues?: { message?: string }[] } }): string | null {
  if (!result.success && result.error?.issues?.[0]?.message) {
    return result.error.issues[0].message
  }
  return null
}
