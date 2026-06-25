import nodemailer from "nodemailer"
import type { CommunicationResult, EmailProvider } from "../types"

/** Minimal transport contract — nodemailer's Transporter satisfies it structurally,
 *  and tests can inject a fake without pulling nodemailer's heavy types. */
export interface MailTransport {
  sendMail(options: {
    from: string
    to: string
    subject: string
    html: string
    text: string
  }): Promise<{ messageId?: string }>
}

export class GmailProvider implements EmailProvider {
  private transporter: MailTransport
  private from: string

  constructor(transporter?: MailTransport) {
    const user = process.env.GMAIL_USER || ""
    const pass = process.env.GMAIL_APP_PASSWORD || ""
    const fromName = process.env.EMAIL_FROM_NAME || "BakimX"

    if (!transporter && (!user || !pass)) {
      throw new Error(
        "Gmail yapılandırması eksik. GMAIL_USER ve GMAIL_APP_PASSWORD ortam değişkenlerini ayarlayınız."
      )
    }

    this.from = user ? `${fromName} <${user}>` : fromName
    this.transporter =
      transporter ??
      nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user, pass },
        // Bound the send so a blocked outbound SMTP port (465) fails fast instead
        // of hanging the register/approve/reject request until the OS socket timeout.
        // Sending is best-effort, so a fast failure is logged and the flow continues.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      })
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    textBody?: string
  ): Promise<CommunicationResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject: subject.slice(0, 200),
        html: htmlBody,
        text: textBody || htmlBody.replace(/<[^>]*>/g, ""),
      })
      return { success: true, providerId: info.messageId }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "E-posta gönderim hatası",
      }
    }
  }
}
