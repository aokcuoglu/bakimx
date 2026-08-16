import { NextResponse } from "next/server"
import { getLiveChatConfig } from "@/lib/live-chat/settings"
import { toStatusWire } from "@/lib/live-chat/server"
import type { LiveChatStatusWire } from "@/lib/live-chat/types"

const UNAVAILABLE: LiveChatStatusWire = {
  available: false,
  online: false,
  reason: "disabled",
  greeting: "",
  offlineMessage: "",
  responseNote: "",
  nextOpeningText: null,
  hours: [],
}

/**
 * Widget'ın açılışta ve panel her açıldığında sorduğu "şu an açık mıyız?"
 * uç noktası. Cevap saate bağlı olduğu için ASLA cache'lenmez.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const config = await getLiveChatConfig()
    return NextResponse.json(toStatusWire(config))
  } catch (err) {
    console.error("[live-chat] status failed:", err)
    // Ayarlar okunamazsa widget'ı sessizce kapat — pazarlama sayfasında
    // kırık bir kutu göstermektense hiç göstermemek yeğdir.
    return NextResponse.json(UNAVAILABLE, { status: 200 })
  }
}
