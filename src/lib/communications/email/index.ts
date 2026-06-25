import type { EmailProvider } from "../types"
import { MockEmailProvider } from "../providers/mock-email-provider"
import { ResendProvider } from "../providers/resend-provider"
import { GmailProvider } from "../providers/gmail-provider"

let _instance: EmailProvider | null = null

export function getEmailProvider(): EmailProvider {
  if (_instance) return _instance

  const provider = process.env.EMAIL_PROVIDER || "mock"

  switch (provider) {
    case "resend":
      _instance = new ResendProvider()
      break
    case "gmail":
      _instance = new GmailProvider()
      break
    default:
      _instance = new MockEmailProvider()
  }

  return _instance
}

export function resetEmailProvider(): void {
  _instance = null
}