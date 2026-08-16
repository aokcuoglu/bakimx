import "server-only"

import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db"
import type { LiveChatConversation, LiveChatMessage } from "@prisma/client"
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
