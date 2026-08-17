import { z } from "zod"
import { DAY_KEYS, isValidTime, toMinutes } from "@/lib/live-chat/schedule"

export const MAX_MESSAGE_LENGTH = 2000

/** Widget'ın sohbet öncesi formu. Ziyaretçiye dönüş yapabilmek için e-posta zorunlu. */
export const startConversationSchema = z.object({
  name: z.string().trim().min(2, "Ad Soyad en az 2 karakter olmalıdır").max(80),
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(160),
  phone: z
    .string()
    .trim()
    .max(20)
    .refine((v) => v === "" || /^[0-9+\-\s()]{7,20}$/.test(v), "Geçerli bir telefon numarası girin")
    .optional()
    .default(""),
  message: z
    .string()
    .trim()
    .min(2, "Mesajınızı yazın")
    .max(MAX_MESSAGE_LENGTH, `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir`),
  pageUrl: z.string().trim().max(500).optional().default(""),
})

export type StartConversationInput = z.infer<typeof startConversationSchema>

export const sendMessageSchema = z.object({
  token: z.string().trim().min(16).max(128),
  body: z
    .string()
    .trim()
    .min(1, "Mesaj boş olamaz")
    .max(MAX_MESSAGE_LENGTH, `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir`),
})

const timeField = z.string().refine(isValidTime, "Saat SS:DD biçiminde olmalıdır")

const dayWindowSchema = z
  .object({
    enabled: z.boolean(),
    start: timeField,
    end: timeField,
  })
  .refine((d) => !d.enabled || (toMinutes(d.start) ?? 0) < (toMinutes(d.end) ?? 0), {
    message: "Bitiş saati başlangıçtan sonra olmalıdır",
    path: ["end"],
  })

/** Ayarlar formunun tamamı. Admin konsolundaki tek kaydetme çağrısını doğrular. */
export const liveChatSettingsSchema = z.object({
  enabled: z.boolean(),
  timezone: z.string().trim().min(1).max(64),
  greeting: z.string().trim().min(5, "Karşılama mesajı en az 5 karakter olmalıdır").max(500),
  offlineMessage: z.string().trim().min(5, "Çevrimdışı mesajı en az 5 karakter olmalıdır").max(500),
  responseNote: z.string().trim().min(3, "Dönüş süresi notu en az 3 karakter olmalıdır").max(120),
  /** Virgül/satır ile ayrılmış YYYY-MM-DD listesi; sunucu ayrıştırır. */
  holidays: z.string().max(2000).optional().default(""),
  schedule: z.object(Object.fromEntries(DAY_KEYS.map((k) => [k, dayWindowSchema])) as Record<
    (typeof DAY_KEYS)[number],
    typeof dayWindowSchema
  >),
})

export type LiveChatSettingsFormValues = z.input<typeof liveChatSettingsSchema>
export type LiveChatSettingsValues = z.infer<typeof liveChatSettingsSchema>

export const agentReplySchema = z.object({
  conversationId: z.string().trim().min(1).max(64),
  body: z
    .string()
    .trim()
    .min(1, "Mesaj boş olamaz")
    .max(MAX_MESSAGE_LENGTH, `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir`),
})
