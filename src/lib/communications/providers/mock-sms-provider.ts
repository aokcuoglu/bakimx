import type { CommunicationResult, SMSProvider } from "../types"

export class MockSMSProvider implements SMSProvider {
  async sendSMS(to: string, message: string): Promise<CommunicationResult> {
    console.log(`[MockSMS] To: ${to}, Message: ${message}`)
    return {
      success: true,
      providerId: `mock-sms-${Date.now()}`,
    }
  }
}