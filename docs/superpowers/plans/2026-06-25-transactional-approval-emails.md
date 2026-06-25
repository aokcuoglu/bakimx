# Transactional Approval E-postaları (Gmail SMTP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kayıt → admin onayı yaşam döngüsündeki 4 transactional e-postayı (`hey@bakimx.com` üzerinden Gmail SMTP ile) profesyonel HTML şablonlarıyla devreye almak.

**Architecture:** Mevcut `EmailProvider` soyutlamasına bir `GmailProvider` (nodemailer) eklenir ve factory'ye bağlanır. Saf bir sunum katmanı (`src/lib/emails/`) markalı HTML layout + 4 tipli e-posta builder'ı + ince bir `sendSystemEmail` sarmalayıcısı sağlar. Sarmalayıcı `sendEmailDirect()` üzerinden gönderir (müşteri-consent akışından bağımsız, çünkü bunlar hesap-yaşam-döngüsü mailleri), sonucu `CommunicationLog`'a yazar ve **asla hata fırlatmaz** (best-effort). 4 mail register API + admin approve/reject aksiyonlarına bağlanır.

**Tech Stack:** Next.js 16 (App Router), TypeScript (strict), Prisma 7, nodemailer, `bun test`.

## Global Constraints

- **TypeScript strict**; `any` kullanma (test fake'leri dahil — tipli interface kullan).
- **Tenant izolasyonu**: owner alıcı sorgusu daima `workshopId` ile sınırlı.
- **Şema değişikliği YOK** — migration gerekmez; `CommunicationLog` mevcut alanlarıyla kullanılır.
- **Best-effort mail**: e-posta hatası register/approve/reject ana işlemini asla bozmaz.
- **E-posta gövdesini loglama** (mevcut mock provider güvenlik notu korunur; yalnız metadata loglanır).
- **Base URL**: `process.env.APP_URL || "http://localhost:3000"` (yeni env icat etme; `triggers.ts` ile aynı).
- **Paket yöneticisi**: `bun`. Yeni bağımlılık saf JS olmalı (nodemailer ✓ — Alpine Docker prod build'ini riske atmaz).
- **Marka**: blue/navy (navy `#0b1f3a`, CTA `#2563eb`), mobil-uyumlu, tablo-tabanlı inline-CSS e-posta.

---

### Task 1: GmailProvider + factory kaydı + nodemailer bağımlılığı

**Files:**
- Add dependency: `nodemailer` + `@types/nodemailer`
- Create: `src/lib/communications/providers/gmail-provider.ts`
- Create (test): `src/lib/communications/providers/gmail-provider.test.ts`
- Modify: `src/lib/communications/email/index.ts` (factory'ye `gmail` case)
- Create (test): `src/lib/communications/email/index.test.ts`

**Interfaces:**
- Consumes: `EmailProvider`, `CommunicationResult` (`../types`); `nodemailer`.
- Produces: `class GmailProvider implements EmailProvider`; `interface MailTransport { sendMail(options: { from: string; to: string; subject: string; html: string; text: string }): Promise<{ messageId?: string }> }`. Factory `getEmailProvider()` `EMAIL_PROVIDER=gmail` iken `GmailProvider` döndürür.

- [ ] **Step 1: nodemailer bağımlılığını ekle**

```bash
bun add nodemailer && bun add -d @types/nodemailer
```

- [ ] **Step 2: Başarısız testi yaz** — `src/lib/communications/providers/gmail-provider.test.ts`

```ts
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
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run: `bun test src/lib/communications/providers/gmail-provider.test.ts`
Expected: FAIL — `Cannot find module './gmail-provider'`

- [ ] **Step 4: GmailProvider'ı yaz** — `src/lib/communications/providers/gmail-provider.ts`

```ts
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

    this.from = `${fromName} <${user}>`
    this.transporter =
      transporter ??
      nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user, pass },
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
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Run: `bun test src/lib/communications/providers/gmail-provider.test.ts`
Expected: PASS (3 test)

- [ ] **Step 6: Factory'ye gmail case ekle** — `src/lib/communications/email/index.ts`

`import { ResendProvider } from "../providers/resend-provider"` satırının altına ekle:
```ts
import { GmailProvider } from "../providers/gmail-provider"
```
`switch` içine `case "resend":` bloğunun altına ekle:
```ts
    case "gmail":
      _instance = new GmailProvider()
      break
```

- [ ] **Step 7: Factory testini yaz** — `src/lib/communications/email/index.test.ts`

```ts
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
```

- [ ] **Step 8: Testleri çalıştır**

Run: `bun test src/lib/communications/`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add package.json bun.lockb src/lib/communications/providers/gmail-provider.ts src/lib/communications/providers/gmail-provider.test.ts src/lib/communications/email/index.ts src/lib/communications/email/index.test.ts
git commit -m "feat: add Gmail SMTP email provider"
```

---

### Task 2: Markalı e-posta layout'u

**Files:**
- Create: `src/lib/emails/layout.ts`
- Create (test): `src/lib/emails/layout.test.ts`

**Interfaces:**
- Produces: `interface EmailLayoutOptions { heading: string; bodyHtml: string; cta?: { label: string; url: string }; footerNote?: string }`; `renderEmailLayout(opts: EmailLayoutOptions): string` (tam HTML belge döner).

- [ ] **Step 1: Başarısız testi yaz** — `src/lib/emails/layout.test.ts`

```ts
import { expect, test } from "bun:test"
import { renderEmailLayout } from "./layout"

test("renderEmailLayout heading, gövde ve CTA linkini içerir", () => {
  const html = renderEmailLayout({
    heading: "Hoş geldiniz",
    bodyHtml: "<p>Test gövde</p>",
    cta: { label: "Giriş Yap", url: "https://app.bakimx.com/login" },
  })
  expect(html).toContain("Hoş geldiniz")
  expect(html).toContain("Test gövde")
  expect(html).toContain("https://app.bakimx.com/login")
  expect(html).toContain("Giriş Yap")
  expect(html).toContain("BakimX")
})

test("renderEmailLayout CTA verilmezse link içermez", () => {
  const html = renderEmailLayout({ heading: "Bilgi", bodyHtml: "<p>x</p>" })
  expect(html).not.toContain("href=")
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `bun test src/lib/emails/layout.test.ts`
Expected: FAIL — `Cannot find module './layout'`

- [ ] **Step 3: layout.ts'i yaz** — `src/lib/emails/layout.ts`

```ts
export interface EmailLayoutOptions {
  heading: string
  /** Pre-built inner HTML (paragraphs etc.) — caller is responsible for escaping. */
  bodyHtml: string
  cta?: { label: string; url: string }
  footerNote?: string
}

const NAVY = "#0b1f3a"
const CTA_BLUE = "#2563eb"

export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const { heading, bodyHtml, cta, footerNote } = opts

  const ctaHtml = cta
    ? `<tr><td style="padding:12px 0 4px;">
         <a href="${cta.url}" style="display:inline-block;background:${CTA_BLUE};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;font-size:15px;">${cta.label} &rarr;</a>
       </td></tr>`
    : ""

  const footerNoteHtml = footerNote
    ? `<p style="margin:16px 0 0;color:#475569;font-size:13px;line-height:1.6;">${footerNote}</p>`
    : ""

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:${NAVY};padding:20px 28px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">&#9881; BakimX</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;color:${NAVY};font-size:20px;font-weight:700;">${heading}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="color:#334155;font-size:15px;line-height:1.7;">${bodyHtml}</td></tr>
            ${ctaHtml}
          </table>
          ${footerNoteHtml}
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 28px;">
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">BakimX &middot; Oto Servis Yönetim Sistemi<br>hey@bakimx.com &middot; bakimx.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `bun test src/lib/emails/layout.test.ts`
Expected: PASS (2 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/emails/layout.ts src/lib/emails/layout.test.ts
git commit -m "feat: add branded transactional email layout"
```

---

### Task 3: 4 sistem e-postası builder'ı

**Files:**
- Create: `src/lib/emails/system-emails.ts`
- Create (test): `src/lib/emails/system-emails.test.ts`

**Interfaces:**
- Consumes: `renderEmailLayout` (`./layout`); `process.env.APP_URL`.
- Produces: `interface BuiltEmail { subject: string; html: string }` ve 4 fonksiyon:
  - `workshopApprovedEmail(p: { firstName: string; workshopName: string }): BuiltEmail`
  - `workshopRejectedEmail(p: { firstName: string; workshopName: string }): BuiltEmail`
  - `applicationReceivedEmail(p: { firstName: string; workshopName: string }): BuiltEmail`
  - `newApplicationAdminEmail(p: { workshopName: string; ownerName: string; email: string; phone: string; city: string }): BuiltEmail`

- [ ] **Step 1: Başarısız testi yaz** — `src/lib/emails/system-emails.test.ts`

```ts
import { expect, test } from "bun:test"
import {
  workshopApprovedEmail,
  workshopRejectedEmail,
  applicationReceivedEmail,
  newApplicationAdminEmail,
} from "./system-emails"

test("workshopApprovedEmail: giriş CTA'sı + 15 gün deneme mesajı", () => {
  const e = workshopApprovedEmail({ firstName: "Ali", workshopName: "Usta Oto" })
  expect(e.subject).toContain("onayland")
  expect(e.html).toContain("Ali")
  expect(e.html).toContain("Usta Oto")
  expect(e.html).toContain("/login")
  expect(e.html).toContain("15 gün")
})

test("workshopRejectedEmail: CTA yok, iletişim notu var", () => {
  const e = workshopRejectedEmail({ firstName: "Ali", workshopName: "Usta Oto" })
  expect(e.html).not.toContain("href=")
  expect(e.html).toContain("hey@bakimx.com")
})

test("applicationReceivedEmail: onay bekleniyor mesajı", () => {
  const e = applicationReceivedEmail({ firstName: "Ali", workshopName: "Usta Oto" })
  expect(e.subject).toContain("alındı")
  expect(e.html).toContain("onay")
})

test("newApplicationAdminEmail: başvuran alanları + admin CTA", () => {
  const e = newApplicationAdminEmail({
    workshopName: "Usta Oto",
    ownerName: "Ali Veli",
    email: "a@b.com",
    phone: "5551112233",
    city: "İzmir",
  })
  expect(e.html).toContain("a@b.com")
  expect(e.html).toContain("5551112233")
  expect(e.html).toContain("/admin")
})

test("sistem e-postaları kullanıcı değerlerini HTML-escape eder", () => {
  const e = applicationReceivedEmail({ firstName: "<script>", workshopName: "A&B" })
  expect(e.html).not.toContain("<script>")
  expect(e.html).toContain("&lt;script&gt;")
  expect(e.html).toContain("A&amp;B")
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `bun test src/lib/emails/system-emails.test.ts`
Expected: FAIL — `Cannot find module './system-emails'`

- [ ] **Step 3: system-emails.ts'i yaz** — `src/lib/emails/system-emails.ts`

```ts
import { renderEmailLayout } from "./layout"

export interface BuiltEmail {
  subject: string
  html: string
}

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000"
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function workshopApprovedEmail(p: { firstName: string; workshopName: string }): BuiltEmail {
  const name = escapeHtml(p.firstName || "Yetkili")
  const ws = escapeHtml(p.workshopName)
  return {
    subject: "BakimX hesabınız onaylandı 🎉",
    html: renderEmailLayout({
      heading: "Hesabınız onaylandı",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
        `<p style="margin:0 0 12px;"><strong>${ws}</strong> için BakimX başvurunuz onaylandı. 15 günlük ücretsiz deneme süreniz başladı.</p>` +
        `<p style="margin:0 0 12px;">Hemen giriş yaparak iş yerinizi kurmaya başlayabilirsiniz.</p>`,
      cta: { label: "Giriş Yap", url: `${appUrl()}/login` },
      footerNote: "Bu e-postayı, BakimX'e iş yeri başvurusu yaptığınız için aldınız.",
    }),
  }
}

export function workshopRejectedEmail(p: { firstName: string; workshopName: string }): BuiltEmail {
  const name = escapeHtml(p.firstName || "Yetkili")
  const ws = escapeHtml(p.workshopName)
  return {
    subject: "BakimX başvurunuz hakkında",
    html: renderEmailLayout({
      heading: "Başvurunuz onaylanmadı",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
        `<p style="margin:0 0 12px;"><strong>${ws}</strong> için yaptığınız BakimX başvurusu şu an için onaylanmadı.</p>` +
        `<p style="margin:0 0 12px;">Bunun bir hata olduğunu düşünüyorsanız veya sorularınız varsa bizimle iletişime geçebilirsiniz.</p>`,
      footerNote: "İletişim: hey@bakimx.com",
    }),
  }
}

export function applicationReceivedEmail(p: { firstName: string; workshopName: string }): BuiltEmail {
  const name = escapeHtml(p.firstName || "Yetkili")
  const ws = escapeHtml(p.workshopName)
  return {
    subject: "BakimX başvurunuz alındı",
    html: renderEmailLayout({
      heading: "Başvurunuz alındı",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
        `<p style="margin:0 0 12px;"><strong>${ws}</strong> için BakimX başvurunuzu aldık. Ekibimiz başvurunuzu inceledikten sonra hesabınız onaylandığında e-posta ile bilgilendirileceksiniz.</p>` +
        `<p style="margin:0 0 12px;">Onay sonrası 15 günlük ücretsiz deneme süreniz başlayacaktır.</p>`,
      footerNote: "Bu otomatik bir bilgilendirme mesajıdır.",
    }),
  }
}

export function newApplicationAdminEmail(p: {
  workshopName: string
  ownerName: string
  email: string
  phone: string
  city: string
}): BuiltEmail {
  const ws = escapeHtml(p.workshopName)
  const owner = escapeHtml(p.ownerName)
  const email = escapeHtml(p.email)
  const phone = escapeHtml(p.phone)
  const city = escapeHtml(p.city)
  return {
    subject: `Yeni iş yeri başvurusu: ${p.workshopName}`,
    html: renderEmailLayout({
      heading: "Yeni iş yeri başvurusu",
      bodyHtml:
        `<p style="margin:0 0 12px;">Yeni bir BakimX deneme başvurusu geldi:</p>` +
        `<p style="margin:0 0 4px;"><strong>İş yeri:</strong> ${ws}</p>` +
        `<p style="margin:0 0 4px;"><strong>Yetkili:</strong> ${owner}</p>` +
        `<p style="margin:0 0 4px;"><strong>E-posta:</strong> ${email}</p>` +
        `<p style="margin:0 0 4px;"><strong>Telefon:</strong> ${phone}</p>` +
        `<p style="margin:0 0 12px;"><strong>Şehir:</strong> ${city}</p>`,
      cta: { label: "Başvuruyu incele", url: `${appUrl()}/admin` },
    }),
  }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `bun test src/lib/emails/system-emails.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/emails/system-emails.ts src/lib/emails/system-emails.test.ts
git commit -m "feat: add 4 system email builders (approve/reject/received/admin)"
```

---

### Task 4: sendSystemEmail sarmalayıcısı (best-effort + log)

**Files:**
- Create: `src/lib/emails/send-system-email.ts`
- Create (test): `src/lib/emails/send-system-email.test.ts`

**Interfaces:**
- Consumes: `sendEmailDirect` (`@/lib/communications/sender`), `prisma` (`@/lib/db`), `CommunicationResult` (`@/lib/communications/types`).
- Produces:
  - `interface SystemEmailParams { to: string; subject: string; html: string; workshopId: string; templateKey: string }`
  - `interface SystemEmailLogEntry { workshopId: string; recipient: string; templateKey: string; status: "sent" | "failed"; errorMessage: string | null; providerId: string | null }`
  - `interface SystemEmailDeps { send?: (to: string, subject: string, html: string) => Promise<CommunicationResult>; log?: (entry: SystemEmailLogEntry) => Promise<void> }`
  - `sendSystemEmail(params: SystemEmailParams, deps?: SystemEmailDeps): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Başarısız testi yaz** — `src/lib/emails/send-system-email.test.ts`

```ts
import { expect, test } from "bun:test"
import { sendSystemEmail, type SystemEmailLogEntry } from "./send-system-email"

test("sendSystemEmail başarıda ok döner ve sent loglar", async () => {
  const logs: SystemEmailLogEntry[] = []
  const res = await sendSystemEmail(
    { to: "a@b.com", subject: "S", html: "<p>x</p>", workshopId: "w1", templateKey: "workshop_approved" },
    {
      send: async () => ({ success: true, providerId: "id-1" }),
      log: async (e) => { logs.push(e) },
    },
  )
  expect(res.ok).toBe(true)
  expect(logs[0].status).toBe("sent")
  expect(logs[0].providerId).toBe("id-1")
})

test("sendSystemEmail send hatasını yutar, ok=false döner, failed loglar", async () => {
  const logs: SystemEmailLogEntry[] = []
  const res = await sendSystemEmail(
    { to: "a@b.com", subject: "S", html: "<p>x</p>", workshopId: "w1", templateKey: "workshop_rejected" },
    {
      send: async () => { throw new Error("SMTP down") },
      log: async (e) => { logs.push(e) },
    },
  )
  expect(res.ok).toBe(false)
  expect(res.error).toContain("SMTP down")
  expect(logs[0].status).toBe("failed")
})

test("sendSystemEmail log hatası çağıranı bozmaz", async () => {
  const res = await sendSystemEmail(
    { to: "a@b.com", subject: "S", html: "<p>x</p>", workshopId: "w1", templateKey: "application_received" },
    {
      send: async () => ({ success: true, providerId: "id-2" }),
      log: async () => { throw new Error("DB down") },
    },
  )
  expect(res.ok).toBe(true)
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `bun test src/lib/emails/send-system-email.test.ts`
Expected: FAIL — `Cannot find module './send-system-email'`

- [ ] **Step 3: send-system-email.ts'i yaz** — `src/lib/emails/send-system-email.ts`

```ts
import { sendEmailDirect } from "@/lib/communications/sender"
import { prisma } from "@/lib/db"
import type { CommunicationResult } from "@/lib/communications/types"

export interface SystemEmailParams {
  to: string
  subject: string
  html: string
  workshopId: string
  templateKey: string
}

export interface SystemEmailLogEntry {
  workshopId: string
  recipient: string
  templateKey: string
  status: "sent" | "failed"
  errorMessage: string | null
  providerId: string | null
}

export interface SystemEmailDeps {
  send?: (to: string, subject: string, html: string) => Promise<CommunicationResult>
  log?: (entry: SystemEmailLogEntry) => Promise<void>
}

async function defaultLog(entry: SystemEmailLogEntry): Promise<void> {
  await prisma.communicationLog.create({
    data: {
      workshopId: entry.workshopId,
      type: "email",
      provider: process.env.EMAIL_PROVIDER || "mock",
      recipient: entry.recipient,
      status: entry.status,
      templateKey: entry.templateKey,
      entityType: null,
      entityId: null,
      errorMessage: entry.errorMessage,
      providerId: entry.providerId,
    },
  })
}

/**
 * Sends a system (non-customer) transactional email and records the attempt.
 * Best-effort: never throws — returns { ok, error? } so callers can ignore failures
 * without breaking the primary flow (registration, approval, rejection).
 */
export async function sendSystemEmail(
  params: SystemEmailParams,
  deps: SystemEmailDeps = {},
): Promise<{ ok: boolean; error?: string }> {
  const send = deps.send ?? ((to, subject, html) => sendEmailDirect(to, subject, html))
  const log = deps.log ?? defaultLog

  let result: CommunicationResult
  try {
    result = await send(params.to, params.subject, params.html)
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : "E-posta gönderim hatası",
    }
  }

  try {
    await log({
      workshopId: params.workshopId,
      recipient: params.to,
      templateKey: params.templateKey,
      status: result.success ? "sent" : "failed",
      errorMessage: result.error ?? null,
      providerId: result.providerId ?? null,
    })
  } catch (logErr) {
    // Logging must never break the caller.
    console.error("[sendSystemEmail] log failed:", logErr instanceof Error ? logErr.message : logErr)
  }

  return result.success ? { ok: true } : { ok: false, error: result.error }
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `bun test src/lib/emails/send-system-email.test.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/emails/send-system-email.ts src/lib/emails/send-system-email.test.ts
git commit -m "feat: add best-effort sendSystemEmail wrapper with logging"
```

---

### Task 5: Register API'ye 2 mail bağla (başvuran + admin)

**Files:**
- Modify: `src/app/api/auth/register/route.ts`

**Interfaces:**
- Consumes: `applicationReceivedEmail`, `newApplicationAdminEmail` (`@/lib/emails/system-emails`); `sendSystemEmail` (`@/lib/emails/send-system-email`); `getAdminEmails` (`@/lib/admin`).
- Produces: yan etki — register başarısında 2 mail (best-effort).

> **Not:** Route/DB için otomatik test altyapısı yok; bu task **manuel doğrulama** ile kapanır (Task 7'deki QA turu). Mail mantığı zaten Task 3–4'te birim test edildi.

- [ ] **Step 1: Import'ları ekle** — `src/app/api/auth/register/route.ts` (mevcut importların altına)

```ts
import { getAdminEmails } from "@/lib/admin"
import { applicationReceivedEmail, newApplicationAdminEmail } from "@/lib/emails/system-emails"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
```

- [ ] **Step 2: Transaction'ı workshop döndürecek şekilde değiştir**

Mevcut:
```ts
    await prisma.$transaction(async (tx) => {
      const workshop = await tx.workshop.create({
```
Yerine:
```ts
    const workshop = await prisma.$transaction(async (tx) => {
      const ws = await tx.workshop.create({
```
ve aynı bloğun içindeki `workshopId: workshop.id,` → `workshopId: ws.id,`; transaction callback'inin sonuna (user create'ten sonra) `return ws` ekle. Kapanış `})` aynı kalır.

- [ ] **Step 3: Başarı yanıtından önce mailleri gönder**

`return NextResponse.json({ success: true, message: PENDING_MESSAGE })` satırından **hemen önce** ekle:

```ts
    // Best-effort bildirimler — hata kayıt sonucunu etkilemez.
    try {
      const applicant = applicationReceivedEmail({
        firstName: data.firstName,
        workshopName: data.workshopName,
      })
      const adminMail = newApplicationAdminEmail({
        workshopName: data.workshopName,
        ownerName: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        phone: data.phone,
        city: data.city,
      })
      await Promise.allSettled([
        sendSystemEmail({
          to: data.email,
          subject: applicant.subject,
          html: applicant.html,
          workshopId: workshop.id,
          templateKey: "application_received",
        }),
        ...getAdminEmails().map((to) =>
          sendSystemEmail({
            to,
            subject: adminMail.subject,
            html: adminMail.html,
            workshopId: workshop.id,
            templateKey: "new_application_admin",
          }),
        ),
      ])
    } catch (mailErr) {
      console.error("[register] notification failed:", mailErr instanceof Error ? mailErr.message : mailErr)
    }
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: hata yok (`workshop` artık tanımlı, `data.phone`/`data.city`/`data.lastName` registerSchema'da mevcut).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat: send application-received + admin-notification emails on register"
```

---

### Task 6: Admin approve/reject aksiyonlarına onay/red maili bağla

**Files:**
- Modify: `src/app/admin/actions.ts`

**Interfaces:**
- Consumes: `workshopApprovedEmail`, `workshopRejectedEmail` (`@/lib/emails/system-emails`); `sendSystemEmail` (`@/lib/emails/send-system-email`); `prisma`.
- Produces: yan etki — approve/reject'te iş yeri sahibine mail (best-effort).

> **Not:** Server-action/DB için otomatik test yok; **manuel doğrulama** Task 7'de.

- [ ] **Step 1: Import'ları ekle** — `src/app/admin/actions.ts` (mevcut importların altına)

```ts
import { workshopApprovedEmail, workshopRejectedEmail } from "@/lib/emails/system-emails"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
```

- [ ] **Step 2: Ortak yardımcıyı ekle** (dosyada `type Result` tanımından sonra, ilk export fonksiyondan önce)

```ts
/** İş yeri sahibine onay/red bildirimi gönderir. Best-effort — hata aksiyonu bozmaz.
 *  Alıcı: owner User'ın e-postası (yoksa workshop.email fallback). Tenant izolasyonu:
 *  sorgu workshopId ile sınırlı. */
async function sendOwnerDecisionEmail(
  workshopId: string,
  workshopName: string,
  fallbackEmail: string | null,
  decision: "approved" | "rejected",
): Promise<void> {
  try {
    const owner = await prisma.user.findFirst({
      where: { workshopId, role: "owner" },
      select: { email: true, firstName: true },
      orderBy: { createdAt: "asc" },
    })
    const to = owner?.email || fallbackEmail
    if (!to) return

    const built =
      decision === "approved"
        ? workshopApprovedEmail({ firstName: owner?.firstName || "", workshopName })
        : workshopRejectedEmail({ firstName: owner?.firstName || "", workshopName })

    await sendSystemEmail({
      to,
      subject: built.subject,
      html: built.html,
      workshopId,
      templateKey: decision === "approved" ? "workshop_approved" : "workshop_rejected",
    })
  } catch (err) {
    console.error("[admin] decision email failed:", err instanceof Error ? err.message : err)
  }
}
```

- [ ] **Step 3: `approveWorkshop`'u güncelle**

`const now = new Date()` ile başlayan bloğu, `update` sonucunu yakalayacak ve mail gönderecek şekilde değiştir:
```ts
  const now = new Date()
  const ws = await prisma.workshop.update({
    where: { id: workshopId },
    data: {
      approvalStatus: "approved",
      subscriptionStatus: "trialing",
      trialStartedAt: now,
      trialEndsAt: computeTrialEnd(now),
    },
  })
  await AuditLogAction(workshopId, admin.id, "Workshop", workshopId, "admin_workshop_approved")
  await sendOwnerDecisionEmail(workshopId, ws.name, ws.email, "approved")
  revalidatePath("/admin")
  return { ok: true }
```

- [ ] **Step 4: `rejectWorkshop`'u güncelle**

```ts
  const ws = await prisma.workshop.update({
    where: { id: workshopId },
    data: { approvalStatus: "rejected" },
  })
  await AuditLogAction(workshopId, admin.id, "Workshop", workshopId, "admin_workshop_rejected")
  await sendOwnerDecisionEmail(workshopId, ws.name, ws.email, "rejected")
  revalidatePath("/admin")
  return { ok: true }
```

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`
Expected: hata yok. (Workshop modelinde `name` ve `email` alanları mevcut — register `email`'i set ediyor. `ws.email` `string | null` olabilir; `fallbackEmail: string | null` bunu kabul eder.)

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/actions.ts
git commit -m "feat: email workshop owner on admin approve/reject"
```

---

### Task 7: Env örnekleri + tam doğrulama + manuel QA

**Files:**
- Modify: `.env.example`
- Modify: `.env.production.example`

**Interfaces:**
- Consumes: tüm önceki task'lar.

- [ ] **Step 1: `.env.example`'daki e-posta bloğunu güncelle**

Mevcut e-posta bloğunu (`EMAIL_PROVIDER=mock` + Resend satırları) aşağıdaki gibi genişlet (Resend satırlarını silme, Gmail seçeneğini ekle):
```
# E-posta sağlayıcı: mock | gmail | resend
EMAIL_PROVIDER=mock

# Gmail SMTP (EMAIL_PROVIDER=gmail iken gerekli)
GMAIL_USER=hey@bakimx.com
GMAIL_APP_PASSWORD=            # Google App Password (16 hane, boşluksuz). 2-Step Verification açık olmalı.
EMAIL_FROM_NAME=BakimX
```
Ayrıca `APP_URL`'in dosyada tanımlı olduğundan emin ol (yoksa ekle):
```
# Public app origin — e-posta linkleri (/login, /admin) ve portal linkleri bundan üretilir.
APP_URL=http://localhost:3000
```

- [ ] **Step 2: `.env.production.example`'a aynı anahtarları ekle** (üretim değerleriyle)

```
EMAIL_PROVIDER=gmail
GMAIL_USER=hey@bakimx.com
GMAIL_APP_PASSWORD=
EMAIL_FROM_NAME=BakimX
APP_URL=https://app.bakimx.com
```

- [ ] **Step 3: Tüm birim testleri çalıştır**

Run: `bun test`
Expected: tüm testler PASS (yeni: gmail-provider 3, email factory 1, layout 2, system-emails 5, send-system-email 3).

- [ ] **Step 4: Lint + typecheck**

Run: `bun run lint && bun run typecheck`
Expected: hata yok.

- [ ] **Step 5: Build**

Run: `bun run build`
Expected: başarılı derleme.

- [ ] **Step 6: Manuel QA — mock provider ile uçtan uca**

`.env.local` içinde `EMAIL_PROVIDER=mock` ve `ADMIN_EMAILS=<kendi-test-adresin>` ayarla, dev sunucuyu başlat (`bun run dev`).
1. `/register`'dan yeni bir iş yeri başvurusu yap.
2. Sunucu konsolunda **2** `[MockEmail] To: ...` satırı gör (başvurana + admin'e).
3. DB'de `communicationLog` tablosunda `type=email`, `status=sent`, `templateKey in (application_received, new_application_admin)` 2 satır olduğunu doğrula.
4. `/admin`'den başvuruyu **Onayla** → 1 `[MockEmail]` (`workshop_approved`) satırı.
5. Başka bir başvuruyu **Reddet** → 1 `[MockEmail]` (`workshop_rejected`) satırı.

- [ ] **Step 7: Manuel QA — gerçek Gmail ile (kullanıcı yapar)**

`GMAIL_APP_PASSWORD` ayarlandıktan ve `EMAIL_PROVIDER=gmail` yapıldıktan sonra: kendi e-postanla register → approve → reject turu; gelen kutusu + spam kontrolü, mobil görünüm, CTA linklerinin doğru host'a gittiği. (Bu adım, kullanıcının Google App Password + SPF/DKIM/DMARC dış kurulumunu gerektirir — bkz. spec §"Kullanıcının yapacağı dış adımlar".)

- [ ] **Step 8: Commit**

```bash
git add .env.example .env.production.example
git commit -m "chore: document Gmail SMTP env vars for approval emails"
```

---

## Notlar / dış bağımlılıklar (kod dışı)

Bu plan kodu tamamlar; **gönderimin gerçekten çalışması için kullanıcı tarafı** gerekir:
1. Google hesabında 2-Step Verification → App Password üret → `GMAIL_APP_PASSWORD`.
2. bakimx.com DNS: SPF (`include:_spf.google.com`), Workspace DKIM, opsiyonel DMARC.
3. VPS/Docker'da giden 465/587 portu açık.
