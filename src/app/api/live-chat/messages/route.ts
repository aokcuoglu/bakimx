import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { availabilityOf, getLiveChatConfig } from "@/lib/live-chat/settings"
import { clientIpOf, findConversationByToken, toMessageWire, toThreadWire } from "@/lib/live-chat/server"
import { rateLimit, rateLimitLocal } from "@/lib/rate-limit"
import { notifyAdminsOfVisitorMessage, startsNewBurst } from "@/lib/live-chat/notify"
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

/**
 * Sohbet trafiği form gönderimi değil; sınır cömert ama sonsuz değil.
 *
 * İki sınır BİLEREK farklı limiter kullanır (BAK-196):
 *   - `send` kimliksiz bir YAZMA yüzeyi → paylaşımlı sayaç, eşik görev sayısıyla
 *     çarpılmaz.
 *   - `poll` salt okuma ve açık panelde 4 saniyede bir çalışıyor (`POLL_MS`,
 *     `src/components/site-assistant/use-live-chat.ts:9`) → ziyaretçi başına
 *     ~15 istek/dk. Paylaşımlı sayaç her istekte bir satır yazardı; okunan işten
 *     pahalı bir yazma yükü için değeri yok. Süreç-içi kalıyor: eşik görev
 *     sayısıyla çarpılıyor ama yoklama yeni kayıt açmıyor, yalnız kendi
 *     görüşmesini okuyor ve `token` bilmeyene 404 veriyor.
 */
const MAX_SENDS_PER_MINUTE = 20
const MAX_POLLS_PER_MINUTE = 120
const WINDOW_MS = 60_000

/** GET /api/live-chat/messages?token=…&after=<ISO> — yeni mesajları çeker. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  const after = url.searchParams.get("after")

  if (!rateLimitLocal(`live-chat:poll:${clientIpOf(request)}`, MAX_POLLS_PER_MINUTE, WINDOW_MS).allowed) {
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
  if (!(await rateLimit(`live-chat:send:${clientIpOf(request)}`, MAX_SENDS_PER_MINUTE, WINDOW_MS)).allowed) {
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

    // Yeni bir yanıtsız yığın başlıyorsa yöneticilere haber ver. Ardışık mesajlar
    // tek e-posta ile geçilir — kararın kendisi startsNewBurst'te, test edilebilir.
    if (
      startsNewBurst({
        isNew: false,
        previousVisitorMessageAt: conversation.lastVisitorMessageAt,
        lastAgentMessageAt: conversation.lastAgentMessageAt,
        now,
      })
    ) {
      void notifyAdminsOfVisitorMessage({
        visitorName: conversation.visitorName,
        visitorEmail: conversation.visitorEmail,
        visitorPhone: conversation.visitorPhone,
        body: parsed.data.body,
        pageUrl: conversation.pageUrl,
        startedOffline: conversation.startedOffline,
        isNew: false,
      })
    }

    return NextResponse.json({ message: toMessageWire(message) }, { status: 201 })
  } catch (err) {
    console.error("[live-chat] send message failed:", err)
    return NextResponse.json(
      { success: false, errors: { _general: "Mesaj gönderilemedi. Lütfen tekrar deneyin." } },
      { status: 500 },
    )
  }
}
