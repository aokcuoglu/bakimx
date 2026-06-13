"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { COMMUNICATION_TEMPLATES, getDefaultTemplate, sanitizeTemplate } from "@/lib/communications/templates"
import type { CommunicationTemplateKey, CommunicationType } from "@/lib/communications/types"
import type { TemplateChannel } from "@/lib/communications/templates"

export async function getNotificationTemplates(workshopId: string) {
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

  revalidatePath("/app/settings/notifications")
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

  revalidatePath("/app/settings/notifications")
  return { success: true }
}

export async function getCommunicationProviders() {
  return {
    sms: process.env.SMS_PROVIDER || "mock",
    whatsapp: process.env.WHATSAPP_PROVIDER || "mock",
    email: process.env.EMAIL_PROVIDER || "mock",
  }
}