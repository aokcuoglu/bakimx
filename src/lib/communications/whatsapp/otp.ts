import { normalizePhone } from "@/lib/format"
import type { CommunicationResult } from "../types"

export function isMockWhatsAppOtp(): boolean {
  return (process.env.WHATSAPP_PROVIDER || "mock") === "mock"
}

/** Authentication templates work independently of the 24-hour conversation window. */
export async function sendWhatsAppOtp(to: string, code: string): Promise<CommunicationResult> {
  const phone = normalizePhone(to)
  if (!/^5\d{9}$/.test(phone) || !/^\d{6}$/.test(code)) {
    return { success: false, error: "Geçersiz WhatsApp numarası veya kod" }
  }
  if (isMockWhatsAppOtp()) return { success: true, providerId: "mock-whatsapp-otp" }
  if (process.env.WHATSAPP_PROVIDER !== "business") {
    return { success: false, error: "WhatsApp sağlayıcısı geçersiz" }
  }
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const name = process.env.WHATSAPP_OTP_TEMPLATE_NAME
  const language = process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE || "tr"
  if (!phoneNumberId || !token || !name) {
    return { success: false, error: "WhatsApp OTP yapılandırması eksik" }
  }
  try {
    const response = await fetch(
      `${process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v25.0"}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: `90${phone}`,
          type: "template",
          template: {
            name,
            language: { code: language },
            components: [
              { type: "body", parameters: [{ type: "text", text: code }] },
              { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
            ],
          },
        }),
      },
    )
    const data = await response.json()
    if (response.ok && typeof data.messages?.[0]?.id === "string") {
      return { success: true, providerId: data.messages[0].id }
    }
    // Do not expose provider bodies: they can contain recipient/code/token details.
    return { success: false, error: "WhatsApp OTP gönderimi reddedildi" }
  } catch {
    return { success: false, error: "WhatsApp OTP gönderilemedi" }
  }
}
