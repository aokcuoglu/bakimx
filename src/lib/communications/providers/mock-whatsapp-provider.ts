import type { CommunicationResult, WhatsAppProvider } from "../types"

export class MockWhatsAppProvider implements WhatsAppProvider {
  async sendWhatsApp(to: string, message: string): Promise<CommunicationResult> {
    console.log(`[MockWhatsApp] To: ${to}, Message: ${message}`)
    return {
      success: true,
      providerId: `mock-wa-${Date.now()}`,
    }
  }
}