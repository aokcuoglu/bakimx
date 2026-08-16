import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { availabilityOf, getLiveChatConfig } from "@/lib/live-chat/settings"
import { clientIpOf, findConversationByToken, rateLimit, toMessageWire, toThreadWire } from "@/lib/live-chat/server"
import { sendMessageSchema } from "@/lib/validations/live-chat"

export const dynamic = "force-dynamic"

/**
 * Ziyaretçi tarafı mesaj kanalı.
 *
 * Neden yoklama (polling), WebSocket/SSE değil: uygulama ECS Fargate'te birden
 * çok görev olarak koşuyor ve ortak bir pub/sub (Redis) yok. Bir görevde tutulan
 * SSE akışı, mesajı yazan DİĞER görevden haber alamaz — yani "gerçek zamanlı"
 * görünüp sessizce mesaj düşüren bir sistem olurdu. Yoklama her görevde doğru
 * çalışır; panel açıkken 4 sn, arka planda daha seyrek yoklanır.
 */

/** Sohbet trafiği form gönderimi değil; sınır cömert ama sonsuz değil. */
const MAX_SENDS_PER_MINUTE = 20
const MAX_POLLS_PER_MINUTE = 120
const WINDOW_MS = 60_000

/** GET /api/live-chat/messages?token=…&after=<ISO> — yeni mesajları çeker. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  const after = url.searchParams.get("after")

  if (rateLimit(`poll:${clientIpOf(request)}`, MAX_POLLS_PER_MINUTE, WINDOW_MS)) {
    return NextResponse.json({ success: false, errors: { _general: "Çok fazla istek." } }, { status: 429 })
  }

  const conversation = await findConversationByToken(token)
  if (!conversation) {
    return NextResponse.json({ success: false, errors: { _general: "Sohbet bulunamadı." } }, { status: 404 })
  }

  const afterDate = after ? new Date(after) : null
  const validAfter = afterDate && !Number.isNaN(afterDate.getTime()) ? afterDate : null

  const messages = await prisma.liveChatMessage.findMany({
    where: { conversationId: conversation.id, ...(validAfter ? { createdAt: { gt: validAfter } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
  })

  // Ziyaretçi paneli açık ve mesajları görüyor — okundu damgasını ilerlet.
  // Yalnız gerçekten yeni bir şey aldıysak yazarız (her yoklamada UPDATE atmayalım).
  if (messages.length > 0) {
    await prisma.liveChatConversation.update({
      where: { id: conversation.id },
      data: { visitorLastReadAt: new Date() },
    })
  }

  const config = await getLiveChatConfig()

  return NextResponse.json({
    ...toThreadWire(conversation, [], availabilityOf(config).online),
    messages: messages.map(toMessageWire),
  })
}

/** POST /api/live-chat/messages — ziyaretçi mesaj gönderir. */
export async function POST(request: Request) {
  if (rateLimit(`send:${clientIpOf(request)}`, MAX_SENDS_PER_MINUTE, WINDOW_MS)) {
    return NextResponse.json(
      { success: false, errors: { _general: "Çok hızlı yazıyorsunuz. Lütfen biraz bekleyin." } },
      { status: 429 },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, errors: { _general: "Geçersiz istek formatı" } }, { status: 400 })
  }

  const parsed = sendMessageSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: { body: parsed.error.issues[0]?.message ?? "Geçersiz mesaj" } },
      { status: 400 },
    )
  }

  const conversation = await findConversationByToken(parsed.data.token)
  if (!conversation) {
    return NextResponse.json({ success: false, errors: { _general: "Sohbet bulunamadı." } }, { status: 404 })
  }

  try {
    const now = new Date()
    const message = await prisma.liveChatMessage.create({
      data: { conversationId: conversation.id, sender: "visitor", body: parsed.data.body, createdAt: now },
    })

    // Kapatılmış bir görüşmeye yazmak onu yeniden açar — ziyaretçi "kapandı"
    // diye ikinci bir sohbet başlatmak zorunda kalmasın, geçmiş tek yerde dursun.
    await prisma.liveChatConversation.update({
      where: { id: conversation.id },
      data: {
        status: "open",
        closedAt: null,
        lastMessageAt: now,
        lastVisitorMessageAt: now,
        visitorLastReadAt: now,
      },
    })

    return NextResponse.json({ message: toMessageWire(message) }, { status: 201 })
  } catch (err) {
    console.error("[live-chat] send message failed:", err)
    return NextResponse.json(
      { success: false, errors: { _general: "Mesaj gönderilemedi. Lütfen tekrar deneyin." } },
      { status: 500 },
    )
  }
}
