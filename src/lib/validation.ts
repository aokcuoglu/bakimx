import { z } from "zod/v4"

export const loginSchema = z.object({
  email: z.email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalıdır"),
})

export const registerSchema = z.object({
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

export const workshopUpdateSchema = z.object({
  name: z.string().min(1, "İş yeri adı zorunludur"),
  phone: z.string().min(1, "Telefon zorunludur"),
  city: z.string().min(1, "Şehir zorunludur"),
  address: z.string().min(1, "Adres zorunludur"),
  logoUrl: z.string().url("Geçerli bir URL giriniz").optional().or(z.literal("")),
  taxNumber: z.string().optional(),
  invoiceTitle: z.string().optional(),
})

export const customerCreateSchema = z
  .object({
    type: z.enum(["individual", "corporate"]).default("individual"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    fullName: z.string().optional(),
    companyName: z.string().optional(),
    contactName: z.string().optional(),
    phone: z.string().min(10, "Geçerli bir telefon numarası giriniz (en az 10 hane)"),
    phone2: z.string().optional(),
    email: z.email("Geçerli bir e-posta adresi giriniz").optional().or(z.literal("")),
    city: z.string().optional(),
    district: z.string().optional(),
    address: z.string().optional(),
    identityNumber: z.string().optional(),
    taxNumber: z.string().optional(),
    taxOffice: z.string().optional(),
    notes: z.string().optional(),
    tag: z.enum(["standard", "vip", "risky", "fleet"]).optional(),
    source: z
      .enum(["referral", "google", "social_media", "walk_in", "existing", "other"])
      .optional()
      .or(z.literal("")),
    priceGroup: z.enum(["standard", "discounted", "fleet"]).optional(),
    discountRate: z.coerce
      .number()
      .min(0, "İndirim oranı 0'dan küçük olamaz")
      .max(100, "İndirim oranı 100'den büyük olamaz")
      .optional(),
    riskNote: z.string().optional(),
    whatsappConsent: z.boolean().optional().default(false),
    smsConsent: z.boolean().optional().default(false),
    emailConsent: z.boolean().optional().default(false),
    kvkkApprovedAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "individual") {
      const hasFirst = (data.firstName || "").trim().length > 0
      const hasLast = (data.lastName || "").trim().length > 0
      const hasFull = (data.fullName || "").trim().length > 0
      if (!hasFirst && !hasFull) {
        ctx.addIssue({ code: "custom", path: ["firstName"], message: "Ad alanı zorunludur" })
      }
      if (!hasLast && !hasFull) {
        ctx.addIssue({ code: "custom", path: ["lastName"], message: "Soyad alanı zorunludur" })
      }
    } else {
      if (!(data.companyName || "").trim()) {
        ctx.addIssue({ code: "custom", path: ["companyName"], message: "Şirket adı zorunludur" })
      }
    }
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
  vinConfirmed: z.coerce.boolean().optional(),
  color: z.string().optional(),
  engineNo: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  notes: z.string().optional(),
})

export const vehicleUpdateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  plate: z.string().min(1, "Plaka zorunludur").max(20, "Plaka çok uzun"),
  brand: z.string().min(1, "Marka zorunludur"),
  model: z.string().min(1, "Model zorunludur"),
  vehicleType: z.string().optional(),
  modelYear: z.coerce.number().int("Geçerli bir yıl giriniz").min(1900, "Yıl en az 1900 olmalıdır").max(2030, "Yıl en fazla 2030 olmalıdır").optional(),
  mileage: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(0, "Kilometre negatif olamaz").optional(),
  vin: z.string().optional(),
  vinConfirmed: z.coerce.boolean().optional(),
  color: z.string().optional(),
  engineNo: z.string().optional(),
  fuelType: z.string().optional(),
  transmission: z.string().optional(),
  notes: z.string().optional(),
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

export const quoteCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  vehicleId: z.string().optional().or(z.literal("")),
  title: z.string().optional(),
  customerRequest: z.string().optional(),
  internalNote: z.string().optional(),
  validUntil: z.string().optional(),
  estimatedLaborTotal: z.coerce.number().min(0, "İşçilik toplamı negatif olamaz").optional(),
  estimatedPartsTotal: z.coerce.number().min(0, "Parça toplamı negatif olamaz").optional(),
  discountAmount: z.coerce.number().min(0, "İndirim tutarı negatif olamaz").optional(),
  taxRate: z.coerce.number().min(0, "KDV oranı negatif olamaz").max(100, "KDV oranı en fazla %100 olabilir").optional(),
  grandTotal: z.coerce.number().min(0, "Genel toplam negatif olamaz").optional(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted", "cancelled"]).optional(),
})

export const quoteItemSchema = z.object({
  type: z.enum(["part", "labor"], { error: "Geçerli bir kalem tipi seçiniz (parça/işçilik)" }),
  name: z.string().min(1, "Kalem adı zorunludur"),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır").default(1),
  unitPrice: z.coerce.number().min(0, "Birim fiyat negatif olamaz").optional(),
  totalPrice: z.coerce.number().min(0, "Toplam fiyat negatif olamaz").optional(),
  note: z.string().optional(),
})

export const appointmentCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  vehicleId: z.string().optional().or(z.literal("")),
  appointmentAt: z.string().min(1, "Randevu tarihi zorunludur"),
  appointmentTime: z.string().min(1, "Randevu saati zorunludur"),
  estimatedDurationMinutes: z.coerce.number().int("Geçerli bir süre giriniz").min(5, "Süre en az 5 dakika olmalıdır").optional(),
  title: z.string().optional(),
  customerRequest: z.string().optional(),
  internalNote: z.string().optional(),
  reminderEnabled: z.coerce.boolean().optional().default(false),
})

export const appointmentStatusUpdateSchema = z.object({
  status: z.enum(["scheduled", "confirmed", "arrived", "converted", "completed", "cancelled", "no_show"], {
    error: "Geçerli bir durum seçiniz",
  }),
})

export const quoteStatusUpdateSchema = z.object({
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted", "cancelled"], {
    error: "Geçerli bir durum seçiniz",
  }),
})

export const reminderCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  vehicleId: z.string().min(1, "Araç seçimi zorunludur"),
  title: z.string().min(1, "Hatırlatma başlığı zorunludur"),
  type: z.enum(["periodic_maintenance", "oil_change", "inspection", "tire_change", "brake_check", "battery_check", "insurance", "other"], {
    error: "Geçerli bir bakım türü seçiniz",
  }).default("other"),
  dueDate: z.string().optional().or(z.literal("")),
  dueMileage: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(1, "KM pozitif olmalıdır").optional().or(z.literal("")),
  currentMileage: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(0, "KM negatif olamaz").optional().or(z.literal("")),
  lastServiceDate: z.string().optional().or(z.literal("")),
  lastServiceMileage: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(0, "KM negatif olamaz").optional().or(z.literal("")),
  reminderDaysBefore: z.coerce.number().int("Tam sayı giriniz").min(0, "0-365 arası olmalıdır").max(365, "0-365 arası olmalıdır").optional().or(z.literal("")),
  reminderKmBefore: z.coerce.number().int("Tam sayı giriniz").min(0, "0-50000 arası olmalıdır").max(50000, "0-50000 arası olmalıdır").optional().or(z.literal("")),
  preferredChannel: z.enum(["none", "sms", "whatsapp", "phone", "email"], {
    error: "Geçerli bir kanal seçiniz",
  }).default("none"),
  customerNote: z.string().optional(),
  internalNote: z.string().optional(),
}).superRefine((data, ctx) => {
  const hasDueDate = (data.dueDate || "").trim().length > 0
  const hasDueMileage = data.dueMileage != null && data.dueMileage !== "" && Number(data.dueMileage) > 0
  if (!hasDueDate && !hasDueMileage) {
    ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Planlanan tarih veya KM'den en az biri zorunludur" })
    ctx.addIssue({ code: "custom", path: ["dueMileage"], message: "Planlanan tarih veya KM'den en az biri zorunludur" })
  }
})

export const partCreateSchema = z.object({
  name: z.string().min(1, "Parça adı zorunludur"),
  sku: z.string().optional().or(z.literal("")),
  oemNo: z.string().optional().or(z.literal("")),
  brand: z.string().optional().or(z.literal("")),
  category: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  unit: z.string().default("adet"),
  stockQty: z.coerce.number().int("Stok miktarı tam sayı olmalıdır").min(0, "Stok miktarı negatif olamaz").default(0),
  criticalStockQty: z.coerce.number().int("Kritik stok miktarı tam sayı olmalıdır").min(0, "Kritik stok miktarı negatif olamaz").default(0),
  purchasePrice: z.coerce.number().min(0, "Alış fiyatı negatif olamaz").optional(),
  salePrice: z.coerce.number().min(0, "Satış fiyatı negatif olamaz").optional(),
  currency: z.string().default("TRY"),
  supplierName: z.string().optional().or(z.literal("")),
  supplierPhone: z.string().optional().or(z.literal("")),
  supplierId: z.string().optional().or(z.literal("")),
  shelfLocation: z.string().optional().or(z.literal("")),
  barcode: z.string().optional().or(z.literal("")),
})

export const partUpdateSchema = partCreateSchema

export const stockMovementSchema = z.object({
  partId: z.string().min(1, "Parça seçimi zorunludur"),
  type: z.enum(["in", "out", "adjustment"], { error: "Geçerli bir hareket tipi seçiniz" }),
  quantity: z.coerce.number().int("Miktar tam sayı olmalıdır").min(1, "Miktar en az 1 olmalıdır"),
  reason: z.string().optional().or(z.literal("")),
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

export const technicianCreateSchema = z.object({
  fullName: z.string().min(1, "Ad soyad zorunludur").max(120),
  phone: z.string().min(1, "Telefon zorunludur"),
  role: z.enum(["usta", "teknisyen", "servis_danismani", "yonetici"], {
    error: "Geçerli bir rol seçiniz",
  }).default("usta"),
})

export const checklistItemSchema = z.object({
  serviceOrderId: z.string().min(1, "İş emri zorunludur"),
  category: z.enum(["inspection", "repair", "delivery"], {
    error: "Geçerli bir kategori seçiniz",
  }),
  description: z.string().min(1, "Açıklama zorunludur").max(500),
  sortOrder: z.coerce.number().int().min(0).default(0),
})

export const internalNoteSchema = z.object({
  serviceOrderId: z.string().min(1, "İş emri zorunludur"),
  content: z.string().min(1, "Not içeriği zorunludur").max(2000),
})

export const partsRequestSchema = z.object({
  serviceOrderId: z.string().min(1, "İş emri zorunludur"),
  partName: z.string().min(1, "Parça adı zorunludur").max(200),
  partSku: z.string().optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1, "Miktar en az 1 olmalıdır").default(1),
  note: z.string().optional().or(z.literal("")),
})

export const communicationTemplateSchema = z.object({
  templateKey: z.string().min(1, "Şablon anahtarı zorunludur"),
  channel: z.enum(["sms", "whatsapp", "email"], {
    error: "Geçerli bir kanal seçiniz",
  }),
  content: z.string().min(1, "Şablon içeriği zorunludur").max(2000, "Şablon içeriği en fazla 2000 karakter olmalıdır"),
})

export const customerPreferencesSchema = z.object({
  smsConsent: z.boolean().default(false),
  whatsappConsent: z.boolean().default(false),
  emailConsent: z.boolean().default(false),
})

export const businessProfileSchema = z.object({
  name: z.string().min(1, "İş yeri adı zorunludur"),
  phone: z.string().min(1, "Telefon zorunludur"),
  city: z.string().min(1, "Şehir zorunludur"),
  district: z.string().optional().or(z.literal("")),
  address: z.string().min(1, "Adres zorunludur"),
  email: z.email("Geçerli bir e-posta adresi giriniz").optional().or(z.literal("")),
  website: z.url("Geçerli bir URL giriniz").optional().or(z.literal("")),
  taxNumber: z.string().optional().or(z.literal("")),
  taxOffice: z.string().optional().or(z.literal("")),
  invoiceTitle: z.string().optional().or(z.literal("")),
  logoUrl: z.url("Geçerli bir URL giriniz").optional().or(z.literal("")),
})

export const brandingSchema = z.object({
  pdfLogoUrl: z.url("Geçerli bir URL giriniz").optional().or(z.literal("")),
  publicPortalLogoUrl: z.url("Geçerli bir URL giriniz").optional().or(z.literal("")),
  passportLogoUrl: z.url("Geçerli bir URL giriniz").optional().or(z.literal("")),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk kodu giriniz (ör: #3B82F6)").optional().or(z.literal("")),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Geçerli bir renk kodu giriniz (ör: #10B981)").optional().or(z.literal("")),
})

export const communicationSettingsSchema = z.object({
  smsProvider: z.enum(["mock", "netgsm", "iletimerkezi", "custom"]).default("mock"),
  smsApiKey: z.string().optional().or(z.literal("")),
  smsSenderName: z.string().optional().or(z.literal("")),
  whatsappProvider: z.enum(["mock", "business_api", "custom"]).default("mock"),
  whatsappApiKey: z.string().optional().or(z.literal("")),
  whatsappPhoneNumber: z.string().optional().or(z.literal("")),
  emailProvider: z.enum(["mock", "resend", "sendgrid", "custom"]).default("mock"),
  emailApiKey: z.string().optional().or(z.literal("")),
  emailFromAddress: z.email("Geçerli bir e-posta adresi giriniz").optional().or(z.literal("")),
  emailFromName: z.string().optional().or(z.literal("")),
})

export const workingHoursSchema = z.object({
  weekdayStart: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 09:00)"),
  weekdayEnd: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 18:00)"),
  weekdayWorkingDays: z.string(),
  weekendStart: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 10:00)"),
  weekendEnd: z.string().regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (ör: 14:00)"),
  weekendWorkingDays: z.string(),
  holidayEnabled: z.coerce.boolean().default(false),
  holidayDates: z.string().optional().or(z.literal("")),
})

export const appointmentRulesSchema = z.object({
  defaultAppointmentDuration: z.coerce.number().int("Geçerli bir süre giriniz").min(5, "En az 5 dakika olmalıdır").max(480, "En fazla 480 dakika olabilir"),
  bufferDuration: z.coerce.number().int("Geçerli bir süre giriniz").min(0, "Negatif olamaz").max(120, "En fazla 120 dakika olabilir"),
  reminderTimings: z.string().min(1, "En az bir hatırlatma zamanı giriniz"),
})

export const pdfTemplateSchema = z.object({
  workOrderTemplate: z.string().optional().or(z.literal("")),
  servicePassportTemplate: z.string().optional().or(z.literal("")),
  collectionReceiptTemplate: z.string().optional().or(z.literal("")),
})
