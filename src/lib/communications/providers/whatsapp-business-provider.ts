import type { CommunicationResult, WhatsAppProvider } from "../types"

export class WhatsAppBusinessProvider implements WhatsAppProvider {
  private phoneNumberId: string
  private accessToken: string
  private apiUrl: string

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ""
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || ""
    this.apiUrl = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v18.0"

    if (!this.phoneNumberId || !this.accessToken) {
      throw new Error("WhatsApp Business API yapılandırması eksik. WHATSAPP_PHONE_NUMBER_ID ve WHATSAPP_ACCESS_TOKEN ortam değişkenlerini ayarlayınız.")
    }
  }

  async sendWhatsApp(to: string, message: string): Promise<CommunicationResult> {
    try {
      const formattedPhone = to.startsWith("90") ? to : `90${to}`

      const response = await fetch(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: formattedPhone,
            type: "text",
            text: { body: message.slice(0, 4096) },
          }),
        }
      )

      const data = await response.json()

      if (response.ok && data.messages?.[0]?.id) {
        return {
          success: true,
          providerId: data.messages[0].id,
        }
      }

      return {
        success: false,
        error: `WhatsApp API error: ${JSON.stringify(data.error || data)}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "WhatsApp gönderim hatası",
      }
    }
  }
}