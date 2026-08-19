import { z } from "zod/v4"

/**
 * Tarayıcının ürettiği Web Push aboneliği (BAK-129).
 *
 * `endpoint` bir push servisi URL'idir; gövdeden gelen değere güvenilmez, bu
 * yüzden şema hem şeklini hem de https olduğunu doğrular. `workshopId`/`userId`
 * ASLA gövdeden okunmaz — oturumdan gelir (bkz. route).
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ error: "Geçersiz abonelik adresi" }).max(2000).refine((value) => value.startsWith("https://"), {
    error: "Abonelik adresi https olmalıdır",
  }),
  keys: z.object({
    p256dh: z.string().min(1, "Eksik şifreleme anahtarı").max(255),
    auth: z.string().min(1, "Eksik şifreleme anahtarı").max(255),
  }),
})

export const pushUnsubscribeSchema = z.object({
  endpoint: z.url({ error: "Geçersiz abonelik adresi" }).max(2000),
})

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>
