import "server-only"

import { prisma } from "@/lib/db"
import {
  DEFAULT_SCHEDULE,
  evaluateAvailability,
  parseWeeklySchedule,
  type Availability,
  type WeeklySchedule,
} from "./schedule"

export const DEFAULT_GREETING =
  "Merhaba! 👋 BakımX destek ekibindeyiz. Sorunuzu yazın, hemen yanıtlayalım."

/**
 * DİKKAT — burada tutamayacağımız bir söz verme. Sistem ziyaretçiye e-posta
 * GÖNDERMİYOR: yanıt yalnız widget'ta görünür (ziyaretçi tarayıcısında saklanan
 * anahtarla sohbete geri döner). Metnin eski hâli "size buradan ve e-posta ile
 * dönüş yapalım" diyordu; bunun karşılığı kodda hiç olmadı. Ziyaretçiye e-posta
 * eklenirse söz geri konabilir.
 */
export const DEFAULT_OFFLINE_MESSAGE =
  "Şu an çevrimdışıyız. Mesajınızı bırakın — mesai başlar başlamaz buradan dönüş yapalım."

export const DEFAULT_RESPONSE_NOTE = "Genelde birkaç dakika içinde yanıtlıyoruz"

export interface LiveChatConfig {
  enabled: boolean
  timezone: string
  schedule: WeeklySchedule
  holidays: string[]
  greeting: string
  offlineMessage: string
  responseNote: string
  updatedAt: Date | null
  updatedByEmail: string | null
}

/**
 * Tek satırlık yapılandırmayı okur; yoksa varsayılanlarla oluşturur.
 *
 * `upsert` bilerek: iki eşzamanlı ilk istek yarışırsa ikincisi benzersiz anahtar
 * hatası almak yerine mevcut satırı okur. `update: {}` boş — var olan ayarları
 * okuma yolu ASLA ezmez.
 */
export async function getLiveChatConfig(): Promise<LiveChatConfig> {
  const row = await prisma.liveChatSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      schedule: DEFAULT_SCHEDULE,
      greeting: DEFAULT_GREETING,
      offlineMessage: DEFAULT_OFFLINE_MESSAGE,
      responseNote: DEFAULT_RESPONSE_NOTE,
    },
  })

  return {
    enabled: row.enabled,
    timezone: row.timezone,
    schedule: parseWeeklySchedule(row.schedule),
    holidays: row.holidays,
    greeting: row.greeting,
    offlineMessage: row.offlineMessage,
    responseNote: row.responseNote,
    updatedAt: row.updatedAt,
    updatedByEmail: row.updatedByEmail,
  }
}

export function availabilityOf(config: LiveChatConfig, now: Date = new Date()): Availability {
  return evaluateAvailability(
    {
      enabled: config.enabled,
      timezone: config.timezone,
      schedule: config.schedule,
      holidays: config.holidays,
    },
    now,
  )
}
