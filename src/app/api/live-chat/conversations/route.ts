import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { availabilityOf, getLiveChatConfig } from "@/lib/live-chat/settings"
import { clientIpOf, newConversationToken, rateLimit, toThreadWire } from "@/lib/live-chat/server"
import { startConversationSchema } from "@/lib/validations/live-chat"

export const dynamic = "force-dynamic"

/** Yeni görüşme başlatma. Aynı IP'den dakikada 3 görüşme yeter. */
const MAX_PER_MINUTE = 3
const WINDOW_MS = 60_000

export async function POST(request: Request) {
  const ip = clientIpOf(request)
  if (rateLimit(`start:${ip}`, MAX_PER_MINUTE, WINDOW_MS)) {
    return NextResponse.json(
      { success: false, errors: { _general: "Çok fazla istek. Lütfen biraz bekleyin." } },
      { status: 429 },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, errors: { _general: "Geçersiz istek formatı" } }, { status: 400 })
  }

  const parsed = startConversationSchema.safeParse(payload)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === "string" && !errors[key]) errors[key] = issue.message
    }
    return NextResponse.json({ success: false, errors }, { status: 400 })
  }

  const input = parsed.data

  try {
    const config = await getLiveChatConfig()
    if (!config.enabled) {
      return NextResponse.json(
        { success: false, errors: { _general: "Canlı destek şu anda kullanılamıyor." } },
        { status: 503 },
      )
    }

    const availability = availabilityOf(config)
    const now = new Date()

    // Ziyaretçinin ilk mesajı ve otomatik yanıt tek işlemde yazılır: sohbetin
    // boş açılıp karşılama mesajının kaybolduğu ara durum oluşmasın.
    const conversation = await prisma.liveChatConversation.create({
      data: {
        publicToken: newConversationToken(),
        visitorName: input.name,
        visitorEmail: input.email,
        visitorPhone: input.phone || null,
        startedOffline: !availability.online,
        clientIp: ip,
        userAgent: request.headers.get("user-agent")?.slice(0, 300) || null,
        pageUrl: input.pageUrl || null,
        lastMessageAt: now,
        lastVisitorMessageAt: now,
        messages: {
          create: [
            { sender: "visitor", body: input.message, createdAt: now },
            {
              sender: "system",
              body: availability.online ? config.greeting : config.offlineMessage,
              // Sistem yanıtı ziyaretçi mesajından SONRA görünsün.
              createdAt: new Date(now.getTime() + 1),
            },
          ],
        },
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    })

    return NextResponse.json(
      toThreadWire(conversation, conversation.messages, availability.online),
      { status: 201 },
    )
  } catch (err) {
    console.error("[live-chat] start conversation failed:", err)
    return NextResponse.json(
      { success: false, errors: { _general: "Sohbet başlatılamadı. Lütfen tekrar deneyin." } },
      { status: 500 },
    )
  }
}
