"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { COMMUNICATION_TEMPLATES, getDefaultTemplate, sanitizeTemplate } from "@/lib/communications/templates"
import { sendSMSDirect, sendWhatsAppDirect, sendEmailDirect, checkRateLimit, recordAttempt } from "@/lib/communications"
import type { CommunicationTemplateKey, CommunicationType } from "@/lib/communications/types"
import type { TemplateChannel } from "@/lib/communications/templates"

export async function getNotificationTemplates() {
  const { workshopId } = await requireAuth()
  const saved = await prisma.communicationTemplate.findMany({
    where: { workshopId },
    orderBy: [{ templateKey: "asc" }, { channel: "asc" }],
  })

  return COMMUNICATION_TEMPLATES.map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    channels: t.channels,
    savedTemplates: saved
      .filter((s) => s.templateKey === t.key)
      .reduce(
        (acc, s) => {
          acc[s.channel as TemplateChannel] = {
            id: s.id,
            content: s.content,
          }
          return acc
        },
        {} as Record<TemplateChannel, { id: string; content: string }>,
      ),
    defaults: t.channels.reduce(
      (acc, ch) => {
        acc[ch] = getDefaultTemplate(t.key as CommunicationTemplateKey, ch)
        return acc
      },
      {} as Record<TemplateChannel, string>,
    ),
  }))
}

export async function saveNotificationTemplateAction(formData: FormData) {
  const user = await requireAuth()
  const templateKey = formData.get("templateKey") as string
  const channel = formData.get("channel") as string
  const content = formData.get("content") as string

  if (!templateKey || !channel || !content) {
    return { error: "Eksik parametre" }
  }

  const sanitized = sanitizeTemplate(content)

  await prisma.communicationTemplate.upsert({
    where: {
      workshopId_templateKey_channel: {
        workshopId: user.workshopId,
        templateKey,
        channel: channel as CommunicationType,
      },
    },
    update: { content: sanitized },
    create: {
      workshopId: user.workshopId,
      templateKey,
      channel: channel as CommunicationType,
      content: sanitized,
    },
  })

  revalidatePath("/settings/notifications")
  return { success: true }
}

export async function resetNotificationTemplateAction(formData: FormData) {
  const user = await requireAuth()
  const templateKey = formData.get("templateKey") as string
  const channel = formData.get("channel") as string

  if (!templateKey || !channel) {
    return { error: "Eksik parametre" }
  }

  await prisma.communicationTemplate.deleteMany({
    where: {
      workshopId: user.workshopId,
      templateKey,
      channel: channel as CommunicationType,
    },
  })

  revalidatePath("/settings/notifications")
  return { success: true }
}

export async function getCommunicationProviders() {
  return {
    sms: process.env.SMS_PROVIDER || "mock",
    whatsapp: process.env.WHATSAPP_PROVIDER || "mock",
    email: process.env.EMAIL_PROVIDER || "mock",
  }
}

function activeProviderName(channel: CommunicationType): string {
  switch (channel) {
    case "sms": return process.env.SMS_PROVIDER || "mock"
    case "whatsapp": return process.env.WHATSAPP_PROVIDER || "mock"
    case "email": return process.env.EMAIL_PROVIDER || "mock"
    default: return "mock"
  }
}

export async function sendProviderTestAction(formData: FormData): Promise<{
  success?: boolean
  provider?: string
  providerId?: string
  error?: string
}> {
  const { workshopId } = await requireAuth()

  const channel = formData.get("channel") as CommunicationType
  const rawRecipient = (formData.get("recipient") as string | null)?.trim() ?? ""

  if (channel !== "sms" && channel !== "whatsapp" && channel !== "email") {
    return { error: "Geçersiz kanal" }
  }
  if (!rawRecipient) {
    return { error: "Alıcı bilgisi gerekli" }
  }

  let recipient = rawRecipient
  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return { error: "Geçerli bir e-posta adresi girin" }
    }
  } else {
    recipient = recipient.replace(/[\s-]/g, "")
    if (!/^\+?\d{10,15}$/.test(recipient)) {
      return { error: "Geçerli bir telefon numarası girin" }
    }
  }

  const rateKey = `${workshopId}:test:${channel}`
  if (!checkRateLimit(rateKey, 5).allowed) {
    return { error: "Çok fazla test denemesi. Lütfen biraz bekleyip tekrar deneyin." }
  }

  const provider = activeProviderName(channel)
  const testMessage = "BakımX test mesajı — iletişim sağlayıcı bağlantısı çalışıyor."

  let result: { success: boolean; providerId?: string; error?: string }
  try {
    if (channel === "sms") {
      result = await sendSMSDirect(recipient, testMessage)
    } else if (channel === "whatsapp") {
      result = await sendWhatsAppDirect(recipient, testMessage)
    } else {
      result = await sendEmailDirect(
        recipient,
        "BakımX Test E-postası",
        `<p>${testMessage}</p>`,
        testMessage,
      )
    }
  } catch (error) {
    result = { success: false, error: error instanceof Error ? error.message : "Sağlayıcı yapılandırma hatası" }
  }

  recordAttempt(rateKey)

  await prisma.communicationLog.create({
    data: {
      workshopId,
      type: channel,
      provider,
      recipient,
      status: result.success ? "sent" : "failed",
      templateKey: "test",
      entityType: "test",
      entityId: null,
      errorMessage: result.error ?? null,
      providerId: result.providerId ?? null,
    },
  })

  return {
    success: result.success,
    provider,
    providerId: result.providerId,
    error: result.error,
  }
}