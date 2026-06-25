import { expect, test } from "bun:test"
import { GmailProvider, type MailTransport } from "./gmail-provider"

function fakeTransport(impl: MailTransport["sendMail"]): MailTransport {
  return { sendMail: impl }
}

test("GmailProvider gönderim başarısında messageId ile success döner", async () => {
  const provider = new GmailProvider(fakeTransport(async () => ({ messageId: "abc-123" })))
  const res = await provider.sendEmail("x@y.com", "Konu", "<p>Merhaba</p>")
  expect(res.success).toBe(true)
  expect(res.providerId).toBe("abc-123")
})

test("GmailProvider transport hatasını failure result'a çevirir", async () => {
  const provider = new GmailProvider(fakeTransport(async () => {
    throw new Error("SMTP down")
  }))
  const res = await provider.sendEmail("x@y.com", "Konu", "<p>Merhaba</p>")
  expect(res.success).toBe(false)
  expect(res.error).toContain("SMTP down")
})

test("GmailProvider env eksik + transport verilmemişse hata fırlatır", () => {
  const prevUser = process.env.GMAIL_USER
  const prevPass = process.env.GMAIL_APP_PASSWORD
  delete process.env.GMAIL_USER
  delete process.env.GMAIL_APP_PASSWORD
  try {
    expect(() => new GmailProvider()).toThrow("Gmail yapılandırması eksik")
  } finally {
    if (prevUser !== undefined) process.env.GMAIL_USER = prevUser
    if (prevPass !== undefined) process.env.GMAIL_APP_PASSWORD = prevPass
  }
})
