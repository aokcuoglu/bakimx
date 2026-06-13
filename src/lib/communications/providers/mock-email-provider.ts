import type { CommunicationResult, EmailProvider } from "../types"

export class MockEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, htmlBody: string, textBody?: string): Promise<CommunicationResult> {
    console.log(`[MockEmail] To: ${to}, Subject: ${subject}, Text: ${textBody || htmlBody.replace(/<[^>]*>/g, "").slice(0, 100)}...`)
    return {
      success: true,
      providerId: `mock-email-${Date.now()}`,
    }
  }
}