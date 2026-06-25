import { expect, test } from "bun:test"
import { getEmailProvider, resetEmailProvider } from "./index"
import { GmailProvider } from "../providers/gmail-provider"

test("factory EMAIL_PROVIDER=gmail iken GmailProvider döndürür", () => {
  const prev = {
    p: process.env.EMAIL_PROVIDER,
    u: process.env.GMAIL_USER,
    pw: process.env.GMAIL_APP_PASSWORD,
  }
  process.env.EMAIL_PROVIDER = "gmail"
  process.env.GMAIL_USER = "hey@bakimx.com"
  process.env.GMAIL_APP_PASSWORD = "test-pass"
  resetEmailProvider()
  try {
    expect(getEmailProvider()).toBeInstanceOf(GmailProvider)
  } finally {
    resetEmailProvider()
    if (prev.p !== undefined) process.env.EMAIL_PROVIDER = prev.p
    else delete process.env.EMAIL_PROVIDER
    if (prev.u !== undefined) process.env.GMAIL_USER = prev.u
    else delete process.env.GMAIL_USER
    if (prev.pw !== undefined) process.env.GMAIL_APP_PASSWORD = prev.pw
    else delete process.env.GMAIL_APP_PASSWORD
  }
})
