import type { WhatsAppProvider } from "../types"
import { MockWhatsAppProvider } from "../providers/mock-whatsapp-provider"
import { WhatsAppBusinessProvider } from "../providers/whatsapp-business-provider"

let _instance: WhatsAppProvider | null = null

export function getWhatsAppProvider(): WhatsAppProvider {
  if (_instance) return _instance

  const provider = process.env.WHATSAPP_PROVIDER || "mock"

  switch (provider) {
    case "business":
      _instance = new WhatsAppBusinessProvider()
      break
    default:
      _instance = new MockWhatsAppProvider()
  }

  return _instance
}

export function resetWhatsAppProvider(): void {
  _instance = null
}