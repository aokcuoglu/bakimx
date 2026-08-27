import { z } from "zod"

export const salesLeadSchema = z.object({
  businessName: z.string().trim().min(2, "Servis adı en az 2 karakter olmalıdır").max(160),
  contactName: z.string().trim().min(2, "Yetkili adı en az 2 karakter olmalıdır").max(120),
  phone: z.string().trim().min(7, "Geçerli bir telefon numarası girin").max(30),
  email: z.string().trim().email("Geçerli bir e-posta girin").or(z.literal("")),
  city: z.string().trim().max(80),
  district: z.string().trim().max(80),
  address: z.string().trim().max(500),
  monthlyVehicles: z.string().trim().max(80),
  notes: z.string().trim().max(2000),
  allowDuplicate: z.boolean().optional(),
})

const optionalDateTime = z.string().trim().optional().refine(
  (value) => !value || !Number.isNaN(new Date(value).getTime()),
  "Geçerli bir tarih ve saat girin",
)

export const salesActivityResultSchema = z.enum([
  "reached",
  "no_answer",
  "follow_up_required",
  "demo_scheduled",
  "proposal_sent",
  "won",
  "lost",
])

export const salesTaskTypeSchema = z.enum(["call", "visit", "online_demo", "follow_up"])

export const salesActivitySchema = z.object({
  type: z.enum(["visit", "phone", "whatsapp", "email", "demo", "note"]),
  result: salesActivityResultSchema.optional(),
  summary: z.string().trim().min(2, "Görüşme özeti zorunludur").max(2000),
  occurredAt: optionalDateTime,
  nextActionAt: optionalDateTime,
  nextTaskType: salesTaskTypeSchema.optional(),
  nextTaskDurationMinutes: z.number().int().min(5).max(480).optional(),
  lostReason: z.string().trim().max(500).optional(),
  taskId: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (value.type !== "note" && !value.result) {
    ctx.addIssue({ code: "custom", path: ["result"], message: "Görüşme sonucu zorunludur" })
  }
  if (value.type === "note" && value.result) {
    ctx.addIssue({ code: "custom", path: ["result"], message: "Not kaydına görüşme sonucu eklenemez" })
  }
  if (["follow_up_required", "demo_scheduled"].includes(value.result ?? "") && !value.nextActionAt) {
    ctx.addIssue({ code: "custom", path: ["nextActionAt"], message: "Sonraki aksiyon tarihi zorunludur" })
  }
  if (["won", "lost"].includes(value.result ?? "") && value.nextActionAt) {
    ctx.addIssue({ code: "custom", path: ["nextActionAt"], message: "Kazanım veya kayıp sonucunda takip tarihi girilemez" })
  }
  if (value.result === "lost" && (!value.lostReason || value.lostReason.length < 2)) {
    ctx.addIssue({ code: "custom", path: ["lostReason"], message: "Kaybetme nedeni zorunludur" })
  }
})

export const salesTaskSchema = z.object({
  type: salesTaskTypeSchema,
  startsAt: z.string().trim().refine((value) => !Number.isNaN(new Date(value).getTime()), "Geçerli bir başlangıç girin"),
  durationMinutes: z.number().int().min(5, "Süre en az 5 dakika olmalıdır").max(480, "Süre 8 saati aşamaz"),
  note: z.string().trim().max(1000),
})

export const salesTaskResolutionSchema = z.enum(["cancelled", "no_show"])

export const salesLeadAssignmentSchema = z.object({
  advisorId: z.string().trim().nullable(),
})

export const salesLeadFilterSchema = z.object({
  q: z.string().trim().max(120),
  status: z.enum(["all", "new", "contacted", "demo_scheduled", "demo_completed", "proposal", "won", "lost"]),
  follow: z.enum(["all", "overdue", "today", "upcoming", "none"]),
  advisorId: z.string().trim(),
  createdFrom: z.string().trim().regex(/^$|^\d{4}-\d{2}-\d{2}$/, "Geçerli bir başlangıç tarihi girin"),
  createdTo: z.string().trim().regex(/^$|^\d{4}-\d{2}-\d{2}$/, "Geçerli bir bitiş tarihi girin"),
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
