import { z } from "zod/v4"
import { isFuelLevel } from "@/lib/fuel-level"

export const intakeSchema = z.object({
  // Step 1: Customer selection
  selectedCustomerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  newFirstName: z.string().min(1, "Ad zorunludur"),
  newLastName: z.string().min(1, "Soyad zorunludur"),
  newPhone: z.string().min(1, "Telefon zorunludur"),

  // Step 2: Vehicle selection
  selectedVehicleId: z.string().min(1, "Araç seçimi zorunludur"),
  newPlate: z.string().min(1, "Plaka zorunludur"),
  newBrand: z.string().min(1, "Marka zorunludur"),
  newModel: z.string().min(1, "Model zorunludur"),
  newMileage: z.string().optional().default(""),

  // Step 3: Intake details
  mileageAtIntake: z.string().optional().default(""),
  fuelLevelAtIntake: z.string().optional().default(""),
  customerComplaint: z.string().min(1, "Müşteri şikayeti zorunludur"),
  internalNote: z.string().optional().default(""),
  arrivalReason: z.string().optional().default(""),
  // #196 — aracı getiren kişi müşteri değilse. Boş = müşteri kendi getirdi.
  droppedOffByName: z.string().optional().default(""),
  droppedOffByPhone: z.string().optional().default(""),

  // Step 6: Approval consents
  termsAccepted: z.boolean().refine((v) => v === true, "Araç kabul formunu onaylamanız zorunludur"),
  privacyAccepted: z.boolean().refine((v) => v === true, "Aydınlatma metnini onaylamanız zorunludur"),
  serviceInfoAccepted: z.boolean().optional().default(false),
  promoAccepted: z.boolean().optional().default(false),

  // Step 6: OTP
  otpCode: z.string().optional().default(""),
})

export type IntakeFormValues = z.infer<typeof intakeSchema>

export const intakeCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  vehicleId: z.string().min(1, "Araç seçimi zorunludur"),
  mileageAtIntake: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(0, "Kilometre negatif olamaz").optional(),
  // DİKKAT: 0 ("E") geçerli bir seviye — km'de kullanılan `|| null` kalıbı burada
  // kullanılamaz. Boş string coerce edilmeden önce undefined'a çevrilir, aksi
  // halde Number("") === 0 olur ve "boş" ile "E" birbirine karışır.
  fuelLevelAtIntake: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().refine(isFuelLevel, "Geçersiz yakıt seviyesi").optional(),
  ),
  customerComplaint: z.string().min(1, "Müşteri şikayeti zorunludur"),
  internalNote: z.string().optional(),
  // Servise geliş nedeni opsiyoneldir — sahada akışı tıkamasın. Boş string
  // "seçilmedi" demektir; asıl doğrulama server action'da isArrivalReason ile yapılır.
  arrivalReason: z.string().optional(),
  droppedOffByName: z.string().optional(),
  droppedOffByPhone: z.string().optional(),
})

export const intakeUpdateSchema = z.object({
  customerComplaint: z.string().min(1, "Müşteri şikayeti zorunludur"),
  internalNote: z.string().optional(),
  mileageAtIntake: z.coerce.number().int("Geçerli bir kilometre değeri giriniz").min(0, "Kilometre negatif olamaz").optional(),
  // null = kullanıcı seçimi kaldırdı; alan hiç gönderilmemişse (undefined)
  // mevcut değer korunur (bkz. updateIntakeDetailsAction).
  fuelLevelAtIntake: z
    .union([z.null(), z.coerce.number().refine(isFuelLevel, "Geçersiz yakıt seviyesi")])
    .optional(),
  // #196 / #149 — aracı getiren ve teslim alacak kişi. Boş string = "temizle"
  // (müşteri kendi getirdi/alacak), undefined = alan gönderilmedi, değer korunur.
  droppedOffByName: z.string().optional(),
  droppedOffByPhone: z.string().optional(),
  pickedUpByName: z.string().optional(),
  pickedUpByPhone: z.string().optional(),
})

export const damageMarkSchema = z.object({
  intakeFormId: z.string().min(1, "Kabul kaydı bulunamadı"),
  requestId: z.string().min(1).max(100).optional(),
  photoIds: z.array(z.string().min(1)).max(30).optional(),
  zone: z.enum([
    "front_bumper", "rear_bumper", "hood", "trunk", "roof", "windshield", "rear_window",
    "left_front_door", "left_rear_door", "right_front_door", "right_rear_door",
    "left_front_fender", "right_front_fender", "left_rear_fender", "right_rear_fender",
    "left_headlight", "right_headlight", "left_taillight", "right_taillight", "wheels",
  ], "Araç bölgesi seçin"),
  damageType: z.enum(["scratch", "dent", "broken", "cracked", "paint_damage", "missing_part", "other"], "Hasar türü seçin"),
  severity: z.enum(["light", "medium", "heavy"], "Hasar derecesi seçin"),
  note: z.string().trim().max(500, "Not en fazla 500 karakter olabilir").optional(),
})

export const damageMarkUpdateSchema = damageMarkSchema.extend({ id: z.string().min(1) })

export type DamageMarkValues = z.infer<typeof damageMarkSchema>

export const otpVerifySchema = z.object({
  otpCode: z.string().min(4, "Doğrulama kodu gerekli").max(6, "Doğrulama kodu en fazla 6 haneli olmalıdır"),
})

export const damageInspectionSchema = z.object({
  intakeFormId: z.string().min(1),
  bodyType: z.enum(["sedan", "suv", "van", "unsupported"]).optional(),
  inspectionStatus: z.enum(["not_recorded", "no_visible_damage"]).optional(),
})

export const photoUploadMetadataSchema = z.object({
  intakeFormId: z.string().min(1),
  requestId: z.string().min(1).max(100).optional(),
  type: z.enum(["front", "rear", "left_side", "right_side", "dashboard_mileage", "fuel_gauge", "registration_front", "registration_back", "vin_area", "damage_detail", "other"]),
  phase: z.enum(["intake", "repair_progress", "delivery"]).nullable(),
  label: z.string().max(200).nullable(),
  note: z.string().max(1000).nullable(),
})
