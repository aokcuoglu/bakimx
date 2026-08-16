/**
 * Widget ile /api/live-chat arasındaki tel formatı. Sunucu bağımlılığı YOK —
 * istemci paketine güvenle girer.
 */

export type LiveChatSenderWire = "visitor" | "agent" | "system"

export interface LiveChatMessageWire {
  id: string
  sender: LiveChatSenderWire
  body: string
  /** ISO 8601. */
  createdAt: string
}

export interface LiveChatStatusWire {
  /** Widget hiç gösterilmeyecekse false (ayarlardan kapatılmış). */
  available: boolean
  online: boolean
  /** Kapalıysak neden — metin seçimi için. */
  reason: "online" | "disabled" | "holiday" | "outside_hours" | "day_off"
  greeting: string
  offlineMessage: string
  responseNote: string
  /** "Yarın 09:00'da tekrar buradayız." — kapalıyken dolu. */
  nextOpeningText: string | null
  /** Panelde gösterilen haftalık saat listesi. */
  hours: { label: string; text: string }[]
}

export interface LiveChatConversationWire {
  token: string
  status: "open" | "closed"
  visitorName: string
  startedOffline: boolean
}

export interface LiveChatThreadWire {
  conversation: LiveChatConversationWire
  messages: LiveChatMessageWire[]
  online: boolean
}

export type LiveChatErrorWire = { success: false; errors: Record<string, string> }
