import type { CommunicationResult, EmailProvider } from "../types"

export class ResendProvider implements EmailProvider {
  private apiKey: string
  private fromEmail: string
  private fromName: string
  private apiUrl: string

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || ""
    this.fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@bakimx.com"
    this.fromName = process.env.RESEND_FROM_NAME || "BakimX"
    this.apiUrl = process.env.RESEND_API_URL || "https://api.resend.com/emails"

    if (!this.apiKey) {
      throw new Error("Resend yapılandırması eksik. RESEND_API_KEY ortam değişkenini ayarlayınız.")
    }
  }

  async sendEmail(to: string, subject: string, htmlBody: string, textBody?: string): Promise<CommunicationResult> {
    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: [to],
          subject: subject.slice(0, 200),
          html: htmlBody,
          text: textBody || htmlBody.replace(/<[^>]*>/g, ""),
        }),
      })

      const data = await response.json()

      if (response.ok && data.id) {
        return {
          success: true,
          providerId: data.id,
        }
      }

      return {
        success: false,
        error: `Resend error: ${JSON.stringify(data)}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "E-posta gönderim hatası",
      }
    }
  }
}