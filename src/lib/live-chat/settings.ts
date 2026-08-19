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
 * DİKKAT — burada tutamayacağımız bir söz verme. Metin bir dönem "size buradan
 * ve e-posta ile dönüş yapalım" diyordu ve kodda karşılığı yoktu; o yüzden v0.14.1'de
 * e-posta sözü kaldırılmıştı. BAK-99 ile söz gerçekten tutulur oldu: temsilci
 * yanıt yazınca ziyaretçinin adresine bildirim + süreli "sohbete dön" bağlantısı
 * gidiyor (`deliverAgentReplyEmail`, src/lib/live-chat/server.ts).
 *
 * Bu sabit yalnız YENİ kurulumların varsayılanıdır; ayar satırı DB'de bir kez
 * yazıldıktan sonra buradaki değişiklik o satıra yansımaz — mevcut ortamlarda
 * (prod dahil) metin Ayarlar ekranından güncellenmelidir.
 */
export const DEFAULT_OFFLINE_MESSAGE =
  "Şu an çevrimdışıyız. Mesajınızı bırakın — mesai başlar başlamaz buradan ve e-posta ile dönüş yapalım."

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
