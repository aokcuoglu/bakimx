import type { SMSProvider } from "../types"
import { MockSMSProvider } from "../providers/mock-sms-provider"
import { NetgsmProvider } from "../providers/netgsm-provider"

let _instance: SMSProvider | null = null

export function getSMSProvider(): SMSProvider {
  if (_instance) return _instance

  const provider = process.env.SMS_PROVIDER || "mock"

  switch (provider) {
    case "netgsm":
      _instance = new NetgsmProvider()
      break
    default:
      _instance = new MockSMSProvider()
  }

  return _instance
}

export function resetSMSProvider(): void {
  _instance = null
}