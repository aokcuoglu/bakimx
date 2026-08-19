"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { requireAdminCapability } from "@/lib/admin"
import { deliverAgentReplyEmail } from "@/lib/live-chat/server"
import { parseHolidayList, parseWeeklySchedule } from "@/lib/live-chat/schedule"
import {
  DEFAULT_GREETING,
  DEFAULT_OFFLINE_MESSAGE,
  DEFAULT_RESPONSE_NOTE,
} from "@/lib/live-chat/settings"
import { DEFAULT_SCHEDULE } from "@/lib/live-chat/schedule"
import { agentReplySchema, liveChatSettingsSchema } from "@/lib/validations/live-chat"

type Result = { ok: true } | { ok: false; error: string }

const INBOX_PATH = "/admin/live-chat"

/**
 * Yönetici yanıtı. `requireAdminCapability` her aksiyonda yeniden çağrılır —
 * sayfa katmanındaki kapı devralınmaz (mevcut /admin deseni).
 */
export async function sendAgentReplyAction(conversationId: string, body: string): Promise<Result> {
  const ctx = await requireAdminCapability("manageLiveChat")

  const parsed = agentReplySchema.safeParse({ conversationId, body })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz mesaj" }
  }

  // Yığın kararı için güncelleme ÖNCESİ damgalar okunur: aşağıdaki update
  // `lastAgentMessageAt`i şimdiye çeker, sonra okunsaydı her yanıt "ilk yanıt"
  // gibi görünüp ardışık mesajlar ayrı ayrı e-posta üretirdi.
  const conversation = await prisma.liveChatConversation.findUnique({
    where: { id: parsed.data.conversationId },
    select: {
      id: true,
      visitorName: true,
      visitorEmail: true,
      lastAgentMessageAt: true,
      lastVisitorMessageAt: true,
    },
  })
  if (!conversation) return { ok: false, error: "Görüşme bulunamadı" }

  const now = new Date()
  await prisma.$transaction([
    prisma.liveChatMessage.create({
      data: {
        conversationId: conversation.id,
        sender: "agent",
        agentEmail: ctx.user.email,
        body: parsed.data.body,
        createdAt: now,
      },
    }),
    prisma.liveChatConversation.update({
      where: { id: conversation.id },
      data: {
        // Yanıtlayan yönetici görüşmeyi okumuş sayılır — yanıttan hemen sonra
        // satır "okunmamış" kalırsa gelen kutusu asla temizlenmez.
        lastMessageAt: now,
        lastAgentMessageAt: now,
        agentLastReadAt: now,
        status: "open",
        closedAt: null,
      },
    }),
  ])

  // Ziyaretçi sekmeyi kapattıysa yanıtı yalnız e-posta ulaştırır. Gönderim
  // best-effort ve beklenmez: temsilcinin yanıtı sağlayıcı hatasıyla düşmesin.
  void deliverAgentReplyEmail(conversation, parsed.data.body, now)

  revalidatePath(INBOX_PATH)
  return { ok: true }
}

/** Görüşmeyi okundu işaretler. Yönetici konuşmayı açtığında çağrılır. */
export async function markConversationReadAction(conversationId: string): Promise<Result> {
  await requireAdminCapability("manageLiveChat")
  if (!conversationId) return { ok: false, error: "Görüşme bulunamadı" }

  await prisma.liveChatConversation.updateMany({
    where: { id: conversationId },
    data: { agentLastReadAt: new Date() },
  })

  revalidatePath(INBOX_PATH)
  return { ok: true }
}

export async function setConversationStatusAction(
  conversationId: string,
  status: "open" | "closed",
): Promise<Result> {
  await requireAdminCapability("manageLiveChat")

  const updated = await prisma.liveChatConversation.updateMany({
    where: { id: conversationId },
    data: { status, closedAt: status === "closed" ? new Date() : null },
  })
  if (updated.count === 0) return { ok: false, error: "Görüşme bulunamadı" }

  revalidatePath(INBOX_PATH)
  return { ok: true }
}

export interface SaveSettingsInput {
  enabled: boolean
  timezone: string
  greeting: string
  offlineMessage: string
  responseNote: string
  holidays: string
  schedule: unknown
}

export async function saveLiveChatSettingsAction(input: SaveSettingsInput): Promise<Result> {
  const ctx = await requireAdminCapability("manageLiveChat")

  const parsed = liveChatSettingsSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : ""
    return { ok: false, error: `${issue?.message ?? "Geçersiz ayar"}${where}` }
  }

  const values = parsed.data
  // Saat dilimi adını Intl'e sorarak doğrula — uydurma bir değer kaydedilirse
  // müsaitlik hesabı sessizce UTC'ye düşerdi.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: values.timezone })
  } catch {
    return { ok: false, error: "Geçersiz saat dilimi" }
  }

  await prisma.liveChatSettings.upsert({
    where: { id: "singleton" },
    update: {
      enabled: values.enabled,
      timezone: values.timezone,
      schedule: parseWeeklySchedule(values.schedule),
      holidays: parseHolidayList(values.holidays ?? ""),
      greeting: values.greeting,
      offlineMessage: values.offlineMessage,
      responseNote: values.responseNote,
      updatedByEmail: ctx.user.email,
    },
    create: {
      id: "singleton",
      enabled: values.enabled,
      timezone: values.timezone,
      schedule: parseWeeklySchedule(values.schedule),
      holidays: parseHolidayList(values.holidays ?? ""),
      greeting: values.greeting || DEFAULT_GREETING,
      offlineMessage: values.offlineMessage || DEFAULT_OFFLINE_MESSAGE,
      responseNote: values.responseNote || DEFAULT_RESPONSE_NOTE,
      updatedByEmail: ctx.user.email,
    },
  })

  revalidatePath("/admin/live-chat/settings")
  revalidatePath(INBOX_PATH)
  return { ok: true }
}

/** Ayarları fabrika varsayılanına döndürür (kurtarma yolu). */
export async function resetLiveChatScheduleAction(): Promise<Result> {
  const ctx = await requireAdminCapability("manageLiveChat")

  await prisma.liveChatSettings.update({
    where: { id: "singleton" },
    data: { schedule: DEFAULT_SCHEDULE, holidays: [], updatedByEmail: ctx.user.email },
  })

  revalidatePath("/admin/live-chat/settings")
  return { ok: true }
}
