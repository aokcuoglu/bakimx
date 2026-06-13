import { prisma } from "@/lib/db"
import { getSMSProvider } from "./sms"
import { getWhatsAppProvider } from "./whatsapp"
import { getEmailProvider } from "./email"
import { getDefaultTemplate, renderTemplate, sanitizeTemplate } from "./templates"
import { checkRateLimit, recordAttempt } from "./rate-limit"
import type { CommunicationType, CommunicationTemplateKey, TemplateVariables, CommunicationResult } from "./types"

interface SendOptions {
  workshopId: string
  customerId: string
  templateKey: CommunicationTemplateKey
  variables: TemplateVariables
  channels: CommunicationType[]
  entityType?: string
  entityId?: string
}

async function getCustomerPreferences(workshopId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, workshopId },
    select: {
      id: true,
      phone: true,
      email: true,
      smsConsent: true,
      whatsappConsent: true,
      emailConsent: true,
      fullName: true,
      firstName: true,
      lastName: true,
      companyName: true,
      type: true,
    },
  })
  return customer
}

async function getWorkshopTemplate(workshopId: string, templateKey: CommunicationTemplateKey, channel: CommunicationType): Promise<string | null> {
  const saved = await prisma.communicationTemplate.findFirst({
    where: { workshopId, templateKey, channel },
    select: { content: true },
  })
  return saved?.content ?? null
}

async function logCommunication(params: {
  workshopId: string
  type: CommunicationType
  provider: string
  recipient: string
  status: "sent" | "failed"
  templateKey: string
  entityType: string | null
  entityId: string | null
  errorMessage: string | null
  providerId: string | null
}) {
  await prisma.communicationLog.create({ data: params })
}

export async function sendCommunication(options: SendOptions): Promise<{
  sms?: CommunicationResult
  whatsapp?: CommunicationResult
  email?: CommunicationResult
}> {
  const { workshopId, customerId, templateKey, variables, channels, entityType, entityId } = options

  const customer = await getCustomerPreferences(workshopId, customerId)
  if (!customer) {
    return {}
  }

  const channelName = (provider: string) => {
    switch (provider) {
      case "sms": return process.env.SMS_PROVIDER || "mock"
      case "whatsapp": return process.env.WHATSAPP_PROVIDER || "mock"
      case "email": return process.env.EMAIL_PROVIDER || "mock"
      default: return "mock"
    }
  }

  const results: { sms?: CommunicationResult; whatsapp?: CommunicationResult; email?: CommunicationResult } = {}

  const enrichedVars: TemplateVariables = {
    ...variables,
    customerName: variables.customerName || customer.fullName || customer.firstName || customer.companyName || "Müşteri",
  }

  for (const channel of channels) {
    if (channel === "sms" && !customer.smsConsent) continue
    if (channel === "whatsapp" && !customer.whatsappConsent) continue
    if (channel === "email" && !customer.emailConsent) continue

    const rateLimitKey = `${workshopId}:${channel}:${customerId}`
    const rateCheck = checkRateLimit(rateLimitKey)
    if (!rateCheck.allowed) continue

    const templateContent = await getWorkshopTemplate(workshopId, templateKey, channel) || getDefaultTemplate(templateKey, channel)
    const sanitized = sanitizeTemplate(templateContent)
    const rendered = renderTemplate(sanitized, enrichedVars)

    let result: CommunicationResult
    let providerName: string

    try {
      switch (channel) {
        case "sms": {
          const provider = getSMSProvider()
          providerName = channelName("sms")
          result = await provider.sendSMS(customer.phone, rendered)
          break
        }
        case "whatsapp": {
          const provider = getWhatsAppProvider()
          providerName = channelName("whatsapp")
          result = await provider.sendWhatsApp(customer.phone, rendered)
          break
        }
        case "email": {
          if (!customer.email) continue
          const provider = getEmailProvider()
          providerName = channelName("email")
          const subject = renderTemplate(
            getDefaultTemplate(templateKey, "email").match(/<h2>([^<]*)<\/h2>/)?.[1] || templateKey,
            enrichedVars
          )
          result = await provider.sendEmail(customer.email, subject, rendered, rendered.replace(/<[^>]*>/g, ""))
          break
        }
        default:
          continue
      }

      recordAttempt(rateLimitKey)
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      }
      providerName = channel
    }

    await logCommunication({
      workshopId,
      type: channel,
      provider: providerName,
      recipient: channel === "email" ? customer.email! : customer.phone,
      status: result.success ? "sent" : "failed",
      templateKey,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      errorMessage: result.error ?? null,
      providerId: result.providerId ?? null,
    })

    results[channel] = result
  }

  return results
}

export async function sendSMSDirect(to: string, message: string): Promise<CommunicationResult> {
  const provider = getSMSProvider()
  return provider.sendSMS(to, message)
}

export async function sendWhatsAppDirect(to: string, message: string): Promise<CommunicationResult> {
  const provider = getWhatsAppProvider()
  return provider.sendWhatsApp(to, message)
}

export async function sendEmailDirect(to: string, subject: string, htmlBody: string, textBody?: string): Promise<CommunicationResult> {
  const provider = getEmailProvider()
  return provider.sendEmail(to, subject, htmlBody, textBody)
}