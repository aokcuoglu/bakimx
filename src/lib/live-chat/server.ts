import "server-only"

import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db"
import type { LiveChatConversation, LiveChatMessage } from "@prisma/client"
import { agentReplyStartsNewBurst, notifyVisitorOfAgentReply } from "./notify"
import {
  generateResumeToken,
  hashResumeToken,
  isResumeTokenUsable,
  isWellFormedResumeToken,
  resumeExpiry,
} from "./resume"
import { describeNextOpening, scheduleSummary } from "./schedule"
import { availabilityOf, type LiveChatConfig } from "./settings"
import type { LiveChatMessageWire, LiveChatStatusWire, LiveChatThreadWire } from "./types"

/** Ziyaretçi kimliği. Oturum yok — token'ın kendisi yetkidir, tahmin edilemez olmalı. */
export function newConversationToken(): string {
  return randomBytes(24).toString("base64url")
}

export function clientIpOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

/**
 * Süreç-içi kaba akış sınırı. `/api/support-request` ile aynı desen ve aynı
 * bilinen sınır: ECS'te birden fazla görev varsa sayaç görev başınadır, yani
 * gerçek üst sınır (görev sayısı × limit) olur. Amaç kötü niyetli bir saldırıyı
 * durdurmak değil, kazara/basit spam'i ucuza kesmek.
 */
const buckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = buckets.get(key)
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > max
}

export function toMessageWire(message: LiveChatMessage): LiveChatMessageWire {
  return {
    id: message.id,
    sender: message.sender,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  }
}

export function toThreadWire(
  conversation: LiveChatConversation,
  messages: LiveChatMessage[],
  online: boolean,
): LiveChatThreadWire {
  return {
    conversation: {
      token: conversation.publicToken,
      status: conversation.status,
      visitorName: conversation.visitorName,
      startedOffline: conversation.startedOffline,
    },
    messages: messages.map(toMessageWire),
    online,
  }
}

export function toStatusWire(config: LiveChatConfig, now: Date = new Date()): LiveChatStatusWire {
  const availability = availabilityOf(config, now)
  return {
    available: config.enabled,
    online: availability.online,
    reason: availability.reason,
    greeting: config.greeting,
    offlineMessage: config.offlineMessage,
    responseNote: config.responseNote,
    nextOpeningText: describeNextOpening(availability.nextOpening),
    hours: scheduleSummary(config.schedule).map(({ label, text }) => ({ label, text })),
  }
}

/**
 * Token ile görüşmeyi çözer. Token yoksa/eşleşmiyorsa null — çağıran 404 döner.
 * Bilerek `findUnique`: token tek erişim anahtarıdır, başka filtre yoktur.
 */
export async function findConversationByToken(token: string | null): Promise<LiveChatConversation | null> {
  if (!token || token.length < 16 || token.length > 128) return null
  return prisma.liveChatConversation.findUnique({ where: { publicToken: token } })
}

/* -------------------------------------------------------------------------- */
/* Devam bağlantısı: token üretimi, çözümü ve ziyaretçi bildirimi (BAK-99)     */
/* -------------------------------------------------------------------------- */

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")
}

/** E-postaya girecek bağlantı. Ham token yalnız burada ve e-posta gövdesinde. */
export function resumeUrlFor(token: string): string {
  return `${appUrl()}/destek/${token}`
}

/**
 * Yeni bir devam bağlantısı üretir ve HAM token'ı döner.
 *
 * Önceki token'lar iptal edilir: `issuePasswordReset` ile aynı takas — her an
 * yalnız en son gönderilen e-postanın bağlantısı çalışır, iletilmiş eski bir
 * e-posta görüşmeyi açamaz. Ham token DB'de tutulmadığı için yeniden
 * kullanılamaz, yani her bildirimde yeni bir kayıt gerekir.
 */
export async function issueResumeToken(conversationId: string): Promise<string> {
  const now = new Date()
  await prisma.liveChatResumeToken.updateMany({
    where: { conversationId, revokedAt: null },
    data: { revokedAt: now },
  })

  const { token, tokenHash } = generateResumeToken()
  await prisma.liveChatResumeToken.create({
    data: { conversationId, tokenHash, expiresAt: resumeExpiry(now) },
  })
  return token
}

/** Bir görüşmenin tüm açık bağlantılarını iptal eder (kurtarma/temizlik yolu). */
export async function revokeResumeTokens(conversationId: string): Promise<number> {
  const result = await prisma.liveChatResumeToken.updateMany({
    where: { conversationId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count
}

export type ResumeLookup =
  | { status: "ok"; conversation: LiveChatConversation }
  /** Kayıt var ama süresi dolmuş ya da iptal edilmiş — ziyaretçiye ayrı metin. */
  | { status: "expired" }
  | { status: "not_found" }

/**
 * URL'deki ham token'ı görüşmeye çevirir.
 *
 * "Süresi dolmuş" ile "hiç yok" AYRI: ilkinde ziyaretçiye ne olduğu söylenir,
 * ikincisinde bir şey doğrulanmaz. İkisi de sohbeti AÇMAZ.
 */
export async function resolveResumeToken(raw: string | null | undefined): Promise<ResumeLookup> {
  if (!isWellFormedResumeToken(raw)) return { status: "not_found" }

  const record = await prisma.liveChatResumeToken.findUnique({
    where: { tokenHash: hashResumeToken(raw) },
    include: { conversation: true },
  })
  if (!record) return { status: "not_found" }
  if (!isResumeTokenUsable(record)) return { status: "expired" }

  // Denetim izi; bağlantının açılması akışı bloke etmesin diye hata yutulur.
  await prisma.liveChatResumeToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => null)

  return { status: "ok", conversation: record.conversation }
}

export interface AgentReplyDelivery {
  id: string
  visitorName: string
  visitorEmail: string
  /** Bu yanıttan ÖNCEKİ değerler — çağıran güncellemeden ÖNCE okumalı. */
  lastAgentMessageAt: Date | null
  lastVisitorMessageAt: Date | null
}

/**
 * Temsilci yanıtını ziyaretçiye e-posta ile duyurur.
 *
 * BEST-EFFORT: bu fonksiyon asla throw etmez. Yanıtın kendisi zaten yazılmıştır;
 * e-posta gitmezse ziyaretçi mesajı widget'ta görür.
 */
export async function deliverAgentReplyEmail(
  conversation: AgentReplyDelivery,
  body: string,
  now: Date = new Date(),
): Promise<{ sent: boolean; reason?: "burst" | "error" }> {
  try {
    if (
      !agentReplyStartsNewBurst({
        previousAgentMessageAt: conversation.lastAgentMessageAt,
        lastVisitorMessageAt: conversation.lastVisitorMessageAt,
        now,
      })
    ) {
      return { sent: false, reason: "burst" }
    }

    const token = await issueResumeToken(conversation.id)
    const { sent } = await notifyVisitorOfAgentReply({
      visitorName: conversation.visitorName,
      visitorEmail: conversation.visitorEmail,
      body,
      resumeUrl: resumeUrlFor(token),
    })
    return sent ? { sent: true } : { sent: false, reason: "error" }
  } catch (err) {
    console.error("[live-chat] visitor reply delivery failed:", err instanceof Error ? err.message : err)
    return { sent: false, reason: "error" }
  }
}
