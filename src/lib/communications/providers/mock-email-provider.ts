import type { CommunicationResult, EmailProvider } from "../types"

export class MockEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, _htmlBody: string, _textBody?: string): Promise<CommunicationResult> {
    // Log metadata only — never the body. Bodies can contain secrets (e.g. team
    // invite links carry a one-time token); logging them would defeat the
    // hashed-at-rest token design.
    console.log(`[MockEmail] To: ${to}, Subject: ${subject}`)
    return {
      success: true,
      providerId: `mock-email-${Date.now()}`,
    }
  }
}