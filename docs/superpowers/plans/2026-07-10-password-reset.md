# Self-Serve Şifre Sıfırlama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kullanıcıların e-posta linkiyle kendi şifrelerini güvenli şekilde sıfırlamasını sağlamak; mevcut destek-yönlendirmeli `/forgot-password` sayfasını gerçek self-serve sıfırlama akışına dönüştürmek.

**Architecture:** `invite.ts` deseninin birebir kopyası olan sha256-hash'li, tek kullanımlık, 1 saat TTL'li token. Talep endpoint'i token üretip Resend üzerinden e-posta gönderir (enumeration korumalı generic yanıt); tüketim endpoint'i token'ı doğrulayıp bcrypt (cost 12) ile şifreyi günceller. `PasswordResetToken` additive Prisma modeli; `SupportRequest` altyapısı (admin `/admin/leads`'te kullanımda) dokunulmadan kalır, yalnızca `/forgot-password` sayfası ondan koparılır.

**Tech Stack:** Next.js 16 (App Router, route handlers + server component), Prisma v7 (@/lib/db singleton), iron-session (dokunulmaz), bcryptjs, zod/v4, Resend (`sendSystemEmail`), `bun:test`, ShadcnUI/Base UI, framer-motion, lucide-react.

## Global Constraints

- Prisma import her yerde `import { prisma } from "@/lib/db"`.
- Zod import `import { z } from "zod/v4"`; e-posta için `z.email("…")` (top-level, v4 API). Tüm hata mesajları **Türkçe**.
- `rateLimit(key, max, windowMs)` **`{ allowed: boolean; retryAfterMs: number }`** döndürür (boolean değil). `clientIpFromHeaders` `@/lib/auth-login`'den import edilir.
- Şifre kuralı: **min 8 karakter** (register ile aynı). Şifre hash: `bcrypt.hash(pw, 12)` (`import bcrypt from "bcryptjs"`).
- Auth formları **`Loader2` (lucide) inline spinner** kullanır — bu akışta BrandSpinner/skeleton kullanma; mevcut `login-form.tsx`/`forgot-password-form.tsx` desenini izle. UI bileşenleri `@/components/ui/{button,input,label}`; birincil submit `size="xl"` (auth konvansiyonu).
- E-posta URL kaynağı: `process.env.APP_URL || "http://localhost:3000"`, sondaki `/` kırpılır.
- Token ham hâli asla DB'ye/log'a/yanıt gövdesine yazılmaz; yalnızca e-posta URL'inde. DB'de yalnız `sha256` hex.
- Enumeration koruması: talep yanıtı e-posta var/yok/pasif fark etmeksizin **aynı** generic mesaj ve `{ ok: true }`.
- `SupportRequest` modeli, `/api/support-request` route'u ve `/admin/leads` kullanımı **silinmez/değiştirilmez** — yalnızca `/forgot-password` sayfası ondan koparılır.
- Migration additive olmalı (yeni tablo + ilişki); mevcut veriyi etkilememeli. Yerel DB OrbStack ile ayakta olmalı (`docker compose -f docker-compose.local.yml up -d`).

---

### Task 1: Token helper kütüphanesi (`password-reset.ts`)

Saf (DB'siz) token üret/hash/expiry helper'ları — `src/lib/invite.ts` deseninin birebir kopyası. DB işlemleri route'larda inline yapılır (register/route.ts deseni gibi), bu dosya yalnızca test edilebilir saf fonksiyonlar içerir.

**Files:**
- Create: `src/lib/password-reset.ts`
- Test: `src/lib/password-reset.test.ts`

**Interfaces:**
- Consumes: `node:crypto` (`randomBytes`, `createHash`).
- Produces:
  - `RESET_TTL_MS: number` (= 3_600_000)
  - `hashResetToken(token: string): string` — sha256 hex
  - `generateResetToken(): { token: string; tokenHash: string }`
  - `resetExpiry(from?: Date): Date`
  - `isResetExpired(expiresAt: Date): boolean`

- [ ] **Step 1: Write the failing test**

`src/lib/password-reset.test.ts`:
```ts
import { expect, test } from "bun:test"
import {
  generateResetToken,
  hashResetToken,
  resetExpiry,
  isResetExpired,
  RESET_TTL_MS,
} from "./password-reset"

test("RESET_TTL_MS is one hour", () => {
  expect(RESET_TTL_MS).toBe(60 * 60 * 1000)
})

test("generateResetToken returns a raw token and its matching sha256 hash", () => {
  const { token, tokenHash } = generateResetToken()
  expect(typeof token).toBe("string")
  expect(token.length).toBeGreaterThan(20)
  expect(tokenHash).toBe(hashResetToken(token))
  expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
})

test("hashResetToken is deterministic and never equals the raw token", () => {
  expect(hashResetToken("abc")).toBe(hashResetToken("abc"))
  expect(hashResetToken("abc")).not.toBe("abc")
})

test("two generated tokens differ", () => {
  const a = generateResetToken()
  const b = generateResetToken()
  expect(a.token).not.toBe(b.token)
  expect(a.tokenHash).not.toBe(b.tokenHash)
})

test("resetExpiry is RESET_TTL_MS after the given time", () => {
  const from = new Date("2026-01-01T00:00:00.000Z")
  expect(resetExpiry(from).getTime()).toBe(from.getTime() + RESET_TTL_MS)
})

test("isResetExpired: past is expired, future is not", () => {
  expect(isResetExpired(new Date(Date.now() - 1000))).toBe(true)
  expect(isResetExpired(new Date(Date.now() + 60_000))).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/password-reset.test.ts`
Expected: FAIL — `Cannot find module './password-reset'`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/password-reset.ts`:
```ts
import { randomBytes, createHash } from "node:crypto"

export const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashResetToken(token) }
}

export function resetExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RESET_TTL_MS)
}

export function isResetExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/password-reset.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/password-reset.ts src/lib/password-reset.test.ts
git commit -m "feat(auth): şifre sıfırlama token helper'ları (invite.ts deseni)"
```

---

### Task 2: `PasswordResetToken` Prisma modeli + migration

**Files:**
- Modify: `prisma/schema.prisma` (User modeli ilişki alanı + yeni model)
- Create: `prisma/migrations/<timestamp>_add_password_reset_token/migration.sql` (prisma üretir)

**Interfaces:**
- Produces: `prisma.passwordResetToken` delegesi ile `{ id, userId, tokenHash (unique), expiresAt, usedAt (nullable), createdAt }` alanları; `User.passwordResets` ilişkisi.

- [ ] **Step 1: `User` modeline ilişki alanı ekle**

`prisma/schema.prisma` içinde `model User { … }` bloğunda, mevcut `sentInvites Invite[] @relation("InviteCreatedBy")` satırının hemen altına ekle:
```prisma
  passwordResets PasswordResetToken[]
```

- [ ] **Step 2: Yeni modeli ekle**

`prisma/schema.prisma` içinde `model Invite { … }` bloğunun hemen ardına ekle:
```prisma
model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```

- [ ] **Step 3: Schema'yı doğrula**

Run: `bunx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Migration üret ve uygula (yerel DB ayakta olmalı)**

Yerel Postgres OrbStack ile çalışıyor olmalı; değilse: `docker compose -f docker-compose.local.yml up -d`
Run: `bunx prisma migrate dev --name add_password_reset_token`
Expected: Yeni migration klasörü oluşur, `Your database is now in sync with your schema.`, Prisma Client yeniden üretilir. Bu additive bir migration'dır (yeni tablo + FK); mevcut tabloları değiştirmez.

- [ ] **Step 5: Client tipini doğrula**

Run: `bunx tsc --noEmit 2>&1 | head -20`
Expected: `prisma.passwordResetToken` ile ilgili tip hatası yok (bu aşamada henüz kullanan kod yok; genel typecheck temiz olmalı).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(auth): PasswordResetToken modeli + migration (additive)"
```

---

### Task 3: Zod şemaları (`forgotPasswordSchema`, `resetPasswordSchema`)

**Files:**
- Modify: `src/lib/validations/auth.ts`
- Test: `src/lib/validations/auth.test.ts`

**Interfaces:**
- Consumes: `z` from `"zod/v4"`.
- Produces:
  - `forgotPasswordSchema` → `{ email: string }`
  - `resetPasswordSchema` → `{ token: string; password: string; confirmPassword: string }` (password===confirmPassword refine)

- [ ] **Step 1: Write the failing test**

`src/lib/validations/auth.test.ts`:
```ts
import { expect, test } from "bun:test"
import { forgotPasswordSchema, resetPasswordSchema } from "./auth"

test("forgotPasswordSchema rejects invalid email, accepts valid", () => {
  expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false)
  expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true)
})

test("resetPasswordSchema needs password >= 8 chars", () => {
  const r = resetPasswordSchema.safeParse({ token: "t", password: "short", confirmPassword: "short" })
  expect(r.success).toBe(false)
})

test("resetPasswordSchema needs matching passwords", () => {
  const r = resetPasswordSchema.safeParse({ token: "t", password: "longenough", confirmPassword: "different1" })
  expect(r.success).toBe(false)
})

test("resetPasswordSchema accepts valid matching passwords", () => {
  const r = resetPasswordSchema.safeParse({ token: "t", password: "longenough", confirmPassword: "longenough" })
  expect(r.success).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/validations/auth.test.ts`
Expected: FAIL — `forgotPasswordSchema` / `resetPasswordSchema` is undefined.

- [ ] **Step 3: Add the schemas**

`src/lib/validations/auth.ts` dosyasının **sonuna** ekle (mevcut `loginSchema`/`registerSchema` dokunulmaz):
```ts
export const forgotPasswordSchema = z.object({
  email: z.email("Geçerli bir e-posta adresi giriniz"),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Geçersiz sıfırlama bağlantısı"),
    password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
    confirmPassword: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/validations/auth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/auth.ts src/lib/validations/auth.test.ts
git commit -m "feat(auth): forgot/reset password zod şemaları"
```

---

### Task 4: Şifre sıfırlama e-posta şablonu (`passwordResetEmail`)

**Files:**
- Modify: `src/lib/emails/system-emails.ts`
- Test: `src/lib/emails/system-emails.test.ts`

**Interfaces:**
- Consumes: dosya içi `renderEmailLayout`, `escapeHtml`, `BuiltEmail` (mevcut).
- Produces: `passwordResetEmail(p: { resetUrl: string; firstName?: string }): BuiltEmail` (`{ subject, html }`).

- [ ] **Step 1: Write the failing test**

`src/lib/emails/system-emails.test.ts`:
```ts
import { expect, test } from "bun:test"
import { passwordResetEmail } from "./system-emails"

test("passwordResetEmail embeds the reset url, name and mentions expiry", () => {
  const { subject, html } = passwordResetEmail({
    resetUrl: "https://bakimx.com/reset-password/TOKEN123",
    firstName: "Ali",
  })
  expect(subject.toLowerCase()).toContain("şifre")
  expect(html).toContain("https://bakimx.com/reset-password/TOKEN123")
  expect(html).toContain("Ali")
  expect(html).toContain("1 saat")
})

test("passwordResetEmail falls back to a generic greeting without a name", () => {
  const { html } = passwordResetEmail({ resetUrl: "https://bakimx.com/reset-password/X" })
  expect(html).toContain("Yetkili")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/emails/system-emails.test.ts`
Expected: FAIL — `passwordResetEmail` is not exported.

- [ ] **Step 3: Add the builder**

`src/lib/emails/system-emails.ts` dosyasının **sonuna** ekle (diğer builder'ların yanına):
```ts
export function passwordResetEmail(p: { resetUrl: string; firstName?: string }): BuiltEmail {
  const name = escapeHtml(p.firstName || "Yetkili")
  return {
    subject: "BakimX şifre sıfırlama talebi",
    html: renderEmailLayout({
      heading: "Şifrenizi sıfırlayın",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
        `<p style="margin:0 0 12px;">BakimX hesabınız için bir şifre sıfırlama talebi aldık. Yeni şifrenizi belirlemek için aşağıdaki butona tıklayın.</p>` +
        `<p style="margin:0 0 12px;">Bu bağlantı <strong>1 saat</strong> boyunca geçerlidir.</p>` +
        `<p style="margin:0 0 12px;color:#64748b;">Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.</p>`,
      cta: { label: "Şifremi Sıfırla", url: p.resetUrl },
      footerNote: "Bu e-postayı, BakimX hesabınızda şifre sıfırlama talebi yapıldığı için aldınız.",
    }),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/emails/system-emails.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/emails/system-emails.ts src/lib/emails/system-emails.test.ts
git commit -m "feat(auth): şifre sıfırlama e-posta şablonu"
```

---

### Task 5: Talep endpoint'i `POST /api/auth/forgot-password`

Enumeration-korumalı talep endpoint'i: rate-limit → zod → kullanıcı lookup → (varsa & aktifse) eski token'ları geçersiz kıl, yeni token üret, e-posta gönder → her durumda aynı generic yanıt.

**Files:**
- Create: `src/app/api/auth/forgot-password/route.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/db`), `forgotPasswordSchema` (`@/lib/validations/auth`), `rateLimit` (`@/lib/rate-limit`), `clientIpFromHeaders` (`@/lib/auth-login`), `sendSystemEmail` (`@/lib/emails/send-system-email`), `passwordResetEmail` (`@/lib/emails/system-emails`), `generateResetToken` + `resetExpiry` (`@/lib/password-reset`).
- Produces: `POST` handler; JSON `{ ok: true, message }` (200) veya `{ error }` (400/429).

- [ ] **Step 1: Route'u yaz**

`src/app/api/auth/forgot-password/route.ts`:
```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { forgotPasswordSchema } from "@/lib/validations/auth"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { passwordResetEmail } from "@/lib/emails/system-emails"
import { generateResetToken, resetExpiry } from "@/lib/password-reset"

const GENERIC_MESSAGE =
  "Eğer bu e-posta bir hesaba bağlıysa, şifre sıfırlama bağlantısı gönderildi."

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")
}

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers)

  const ipLimit = rateLimit(`pwreset-ip:${ip}`, 5, 15 * 60 * 1000)
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin." },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
  }

  const rawEmail = (body as { email?: unknown })?.email
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : ""

  const parsed = forgotPasswordSchema.safeParse({ email })
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz e-posta." },
      { status: 400 },
    )
  }

  // E-posta bazlı limit aşıldıysa da generic yanıt (enumeration sızıntısı yok)
  const emailLimit = rateLimit(`pwreset-email:${parsed.data.email}`, 3, 15 * 60 * 1000)
  if (emailLimit.allowed) {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
    if (user && user.isActive) {
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      })

      const { token, tokenHash } = generateResetToken()
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: resetExpiry() },
      })

      const resetUrl = `${appUrl()}/reset-password/${token}`
      const mail = passwordResetEmail({ resetUrl, firstName: user.firstName ?? undefined })
      await sendSystemEmail({
        to: user.email,
        subject: mail.subject,
        html: mail.html,
        workshopId: user.workshopId,
        templateKey: "password_reset",
      })
    }
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE })
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit 2>&1 | grep -i "forgot-password" || echo "OK: no type errors"`
Expected: `OK: no type errors`.

- [ ] **Step 3: Manuel doğrulama (dev server)**

`bun run dev` (ayrı terminalde ayakta olmalı) — sonra:
```bash
curl -s -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" -d '{"email":"olmayan@ornek.com"}'
```
Expected: `{"ok":true,"message":"Eğer bu e-posta bir hesaba bağlıysa, şifre sıfırlama bağlantısı gönderildi."}`
Sonra gerçek bir seed kullanıcı e-postasıyla tekrar dene → aynı yanıt; sunucu loglarında `communicationLog` "password_reset" gönderimi görülür (EMAIL_PROVIDER=mock ise HTML konsola/mock'a düşer, içindeki `/reset-password/<token>` URL'ini not al — Task 8 manuel testinde kullanılacak).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/forgot-password/route.ts
git commit -m "feat(auth): şifre sıfırlama talep endpoint'i (enumeration korumalı)"
```

---

### Task 6: Tüketim endpoint'i `POST /api/auth/reset-password`

Token'ı doğrular (hash lookup + expiry + used), geçerliyse şifreyi bcrypt ile günceller ve token'ı tüketir (tek transaction).

**Files:**
- Create: `src/app/api/auth/reset-password/route.ts`

**Interfaces:**
- Consumes: `bcrypt` (`bcryptjs`), `prisma`, `resetPasswordSchema`, `rateLimit`, `clientIpFromHeaders`, `hashResetToken` + `isResetExpired` (`@/lib/password-reset`).
- Produces: `POST` handler; `{ ok: true }` (200) veya `{ error }` (400/429).

- [ ] **Step 1: Route'u yaz**

`src/app/api/auth/reset-password/route.ts`:
```ts
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { resetPasswordSchema } from "@/lib/validations/auth"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { hashResetToken, isResetExpired } from "@/lib/password-reset"

const INVALID_MESSAGE = "Sıfırlama bağlantısı geçersiz veya süresi dolmuş."

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers)
  const limit = rateLimit(`pwreset-confirm-ip:${ip}`, 10, 15 * 60 * 1000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme yaptınız. Lütfen daha sonra tekrar deneyin." },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
  }

  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz istek." },
      { status: 400 },
    )
  }

  const tokenHash = hashResetToken(parsed.data.token)
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

  if (!record || record.usedAt || isResetExpired(record.expiresAt)) {
    return NextResponse.json({ error: INVALID_MESSAGE }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ])

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit 2>&1 | grep -i "reset-password" || echo "OK: no type errors"`
Expected: `OK: no type errors`.

- [ ] **Step 3: Manuel doğrulama**

Geçersiz token:
```bash
curl -s -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"gecersiz","password":"yenisifre1","confirmPassword":"yenisifre1"}'
```
Expected: `{"error":"Sıfırlama bağlantısı geçersiz veya süresi dolmuş."}` (400).
Kısa şifre → `{"error":"Şifre en az 8 karakter olmalıdır"}`. Eşleşmeyen → `{"error":"Şifreler eşleşmiyor"}`.
Task 5'te elde edilen gerçek token ile → `{"ok":true}`; ardından aynı token tekrar → 400 (tek kullanımlık).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/reset-password/route.ts
git commit -m "feat(auth): şifre sıfırlama tüketim endpoint'i (tek kullanımlık)"
```

---

### Task 7: Middleware public giriş noktası

`/reset-password/<token>` sayfası dinamik segment olduğu için `PUBLIC_EXACT` ile eşleşmez; `PUBLIC_PREFIX`'e (startsWith) eklenmeli. API'ler `/api/auth` prefix'i sayesinde zaten public.

**Files:**
- Modify: `middleware.ts` (repo kökü, `PUBLIC_PREFIX` tanımı)

**Interfaces:**
- Consumes/Produces: yok (yalnızca yönlendirme davranışı).

- [ ] **Step 1: `PUBLIC_PREFIX` listesine ekle**

`middleware.ts` içindeki `PUBLIC_PREFIX` dizisine `"/reset-password/"` ekle:
```ts
const PUBLIC_PREFIX = ["/s/", "/p/", "/invite/", "/demo", "/satin-al", "/payment", "/reset-password/"]
```
(Mevcut satırdaki diğer değerler aynı kalır; yalnızca sona `"/reset-password/"` eklenir.)

- [ ] **Step 2: Doğrula (giriş yapmadan erişim)**

`bun run dev` ayakta iken, oturum cookie'si olmayan bir istemciyle:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/reset-password/herhangibirtoken
```
Expected: `200` (login'e 307 redirect DEĞİL). Sayfa "Bağlantı geçersiz" ekranını render edecek (Task 8 sonrası), ama middleware artık redirect etmemeli.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): /reset-password rotasını public yap"
```

---

### Task 8: Sıfırlama sayfası + formu (`/reset-password/[token]`)

Server component token'ı DB'de doğrular; geçerliyse client formu, değilse "geçersiz bağlantı" ekranı render eder. Client form `/api/auth/reset-password`'e post eder, başarıda `/login`'e yönlendirir.

**Files:**
- Create: `src/app/(auth)/reset-password/[token]/page.tsx`
- Create: `src/components/auth/reset-password-form.tsx`

**Interfaces:**
- Consumes (page): `prisma`, `hashResetToken` + `isResetExpired` (`@/lib/password-reset`), `AuthVisualPanel`, `ResetPasswordForm`.
- Produces: `ResetPasswordForm({ token }: { token: string })` client bileşeni.

- [ ] **Step 1: Client formu yaz**

`src/components/auth/reset-password-form.tsx`:
```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Lock, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const formVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const form = new FormData(e.currentTarget)
    const password = String(form.get("password") || "")
    const confirmPassword = String(form.get("confirmPassword") || "")

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır")
      return
    }
    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setSuccess(true)
        setTimeout(() => router.push("/login"), 1800)
      } else {
        setError(data.error || "Şifre sıfırlanamadı. Lütfen tekrar deneyin.")
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={formVariants}
        className="text-center space-y-4"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Şifreniz güncellendi</h1>
        <p className="text-sm text-muted-foreground">
          Yeni şifrenizle giriş yapabilirsiniz. Giriş sayfasına yönlendiriliyorsunuz…
        </p>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Giriş sayfasına git
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.form
      initial="hidden"
      animate="visible"
      variants={formVariants}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Yeni şifre belirleyin</h1>
        <p className="text-sm text-muted-foreground">
          Hesabınız için yeni bir şifre girin.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Yeni şifre</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="En az 8 karakter"
            className="pl-9 pr-9"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Yeni şifre (tekrar)</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Şifreyi tekrar girin"
            className="pl-9"
            required
          />
        </div>
      </div>

      <Button type="submit" size="xl" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Güncelleniyor…
          </>
        ) : (
          "Şifreyi Güncelle"
        )}
      </Button>

      <div className="text-center">
        <Link href="/login" className="text-sm text-primary hover:underline">
          Giriş sayfasına dön
        </Link>
      </div>
    </motion.form>
  )
}
```

- [ ] **Step 2: Server page'i yaz**

`src/app/(auth)/reset-password/[token]/page.tsx`:
```tsx
import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { hashResetToken, isResetExpired } from "@/lib/password-reset"

export const metadata: Metadata = {
  title: "Şifre Sıfırla",
  description: "BakimX hesabınız için yeni şifre belirleyin.",
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  })
  const valid = !!record && !record.usedAt && !isResetExpired(record.expiresAt)

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-muted">
      <div className="lg:w-[45%] lg:min-h-screen">
        <AuthVisualPanel />
      </div>
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[440px]">
          {valid ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-semibold">Bağlantı geçersiz</h1>
              <p className="text-sm text-muted-foreground">
                Bu şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeni bir
                bağlantı talep edin.
              </p>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Yeni bağlantı talep et
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit 2>&1 | grep -iE "reset-password-form|reset-password/\[token\]" || echo "OK: no type errors"`
Expected: `OK: no type errors`.
(Not: `Button` `size="xl"` variant'ının mevcut olduğunu `login-form.tsx` kullanıyor; yeni variant eklemeye gerek yok.)

- [ ] **Step 4: Manuel doğrulama (uçtan uca)**

Task 5 manuel adımında elde edilen gerçek `/reset-password/<token>` URL'ini tarayıcıda aç → form görünmeli. Geçersiz bir token URL'i (`/reset-password/xxx`) → "Bağlantı geçersiz" ekranı. Formu doldurup gönder → başarı ekranı → `/login`'e yönlendirme. Yeni şifreyle giriş yapılabildiğini doğrula. Mobil genişlikte (dev tools ~375px) düzen bozulmamalı.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/reset-password src/components/auth/reset-password-form.tsx
git commit -m "feat(auth): şifre sıfırlama sayfası + formu"
```

---

### Task 9: `/forgot-password` sayfasını sıfırlama akışına dönüştür

Mevcut `forgot-password-form.tsx` (support-request talep formu) yerine yalnızca e-posta alan bir sıfırlama-talep formu. `/api/support-request` ve admin akışı dokunulmaz.

**Files:**
- Modify (tam yeniden yaz): `src/components/auth/forgot-password-form.tsx`
- Modify: `src/app/(auth)/forgot-password/page.tsx` (metadata)

**Interfaces:**
- Consumes: `/api/auth/forgot-password` (Task 5).
- Produces: `ForgotPasswordForm()` (props yok) — mevcut export imzası korunur, page değişmeden çalışır.

- [ ] **Step 1: Formu yeniden yaz**

`src/components/auth/forgot-password-form.tsx` (tüm dosyayı bununla değiştir):
```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Loader2, Mail, CheckCircle2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const formVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const form = new FormData(e.currentTarget)
    const email = String(form.get("email") || "").trim()
    if (!email) {
      setError("E-posta adresi giriniz")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setSuccess(true)
      } else {
        setError(data.error || "İşlem başarısız. Lütfen tekrar deneyin.")
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={formVariants}
        className="text-center space-y-4"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">E-postanızı kontrol edin</h1>
        <p className="text-sm text-muted-foreground">
          Eğer bu e-posta bir hesaba bağlıysa, şifre sıfırlama bağlantısı gönderildi.
          Bağlantı 1 saat boyunca geçerlidir.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Giriş sayfasına dön
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.form
      initial="hidden"
      animate="visible"
      variants={formVariants}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Şifremi Sıfırla</h1>
        <p className="text-sm text-muted-foreground">
          Hesabınızın e-posta adresini girin, size bir sıfırlama bağlantısı gönderelim.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ornek@isyeri.com"
            className="pl-9"
            required
          />
        </div>
      </div>

      <Button type="submit" size="xl" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gönderiliyor…
          </>
        ) : (
          "Sıfırlama bağlantısı gönder"
        )}
      </Button>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Giriş sayfasına dön
        </Link>
      </div>
    </motion.form>
  )
}
```

- [ ] **Step 2: Sayfa metadata'sını güncelle**

`src/app/(auth)/forgot-password/page.tsx` içindeki `metadata` bloğunu değiştir:
```tsx
export const metadata: Metadata = {
  title: "Şifremi Sıfırla",
  description: "BakimX hesabınızın şifresini e-posta ile sıfırlayın.",
}
```
(Dosyanın geri kalanı — layout, `AuthVisualPanel`, `<ForgotPasswordForm />` — aynı kalır.)

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit 2>&1 | grep -i "forgot-password" || echo "OK: no type errors"`
Expected: `OK: no type errors`.

- [ ] **Step 4: Manuel doğrulama**

`/login` → "Şifremi Unuttum" linkine tıkla → yeni "Şifremi Sıfırla" formu (tek e-posta alanı) görünmeli. Bir e-posta gönder → "E-postanızı kontrol edin" generic ekranı. `/admin/leads`'in hâlâ çalıştığını ve support-request listesinin bozulmadığını doğrula (bu akış artık forgot-password'e bağlı değil ama kırılmamalı).

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/forgot-password-form.tsx "src/app/(auth)/forgot-password/page.tsx"
git commit -m "feat(auth): forgot-password sayfasını self-serve sıfırlamaya dönüştür"
```

---

### Task 10: Bütünsel doğrulama (build / lint / typecheck / test)

Tüm parçalar birleştikten sonra proje genel sağlığını doğrula. Kod değişikliği yoksa yalnızca komutlar; hata çıkarsa ilgili task'a dön.

**Files:** (yok — doğrulama)

- [ ] **Step 1: Birim testleri**

Run: `bun test`
Expected: Tüm testler PASS; yeni `password-reset`, `validations/auth`, `system-emails` testleri dahil, mevcut testler kırılmamış.

- [ ] **Step 2: Lint**

Run: `bun run lint`
Expected: Yeni dosyalarda hata yok.

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 4: Build**

Run: `bun run build`
Expected: Başarılı derleme; `/reset-password/[token]` ve `/api/auth/*` route'ları çıktı manifest'inde.

- [ ] **Step 5: Manuel QA turu (uçtan uca)**

- `/login` → "Şifremi Unuttum" → e-posta gönder → generic ekran.
- Mock/Resend e-postasındaki linke tıkla → yeni şifre belirle → `/login`'e yönlendirme → yeni şifreyle giriş.
- Aynı linki tekrar aç → "Bağlantı geçersiz" (tek kullanımlık).
- Mobil (~375px) düzen kontrolü.
- (İsteğe bağlı) `bakimx-release-check` skill'ini çalıştır: build/lint/typecheck/migration/env risk özeti.

---

## Self-Review

**1. Spec coverage:**
- E-posta linki akışı (talep→e-posta→yeni şifre) → Task 5, 6, 8, 9. ✓
- `PasswordResetToken` modeli + additive migration → Task 2. ✓
- Token deseni (sha256, 1 saat TTL, tek kullanımlık, eski token'ları geçersiz kıl) → Task 1 (helper) + Task 5 (`updateMany usedAt`) + Task 6 (`$transaction` ile consume). ✓
- Enumeration koruması + `isActive` atlanması → Task 5. ✓
- Rate limit (ip + email) → Task 5, 6. ✓
- Şifre min 8 + bcrypt 12 → Task 3, 6. ✓
- Middleware public giriş → Task 7. ✓
- E-posta şablonu + `sendSystemEmail` + `APP_URL` → Task 4, 5. ✓
- `/forgot-password` dönüşümü + support-request altyapısının korunması → Task 9. ✓
- UI kuralları (ShadcnUI, Loader2, mobile-first) → Task 8, 9. ✓
- Testler → Task 1, 3, 4 unit; Task 5, 6, 8, 9 manuel; Task 10 bütünsel. ✓

**2. Placeholder scan:** TBD/TODO yok; her kod adımı tam içerik veriyor. ✓

**3. Type consistency:** `hashResetToken`, `generateResetToken`, `resetExpiry`, `isResetExpired`, `RESET_TTL_MS` isimleri Task 1'de tanımlanıp Task 5/6/8'de aynı imzayla kullanılıyor. `passwordResetEmail({ resetUrl, firstName? })` Task 4→5 tutarlı. `forgotPasswordSchema`/`resetPasswordSchema` Task 3→5/6 tutarlı. `rateLimit` `.allowed` alanı her yerde doğru. `prisma.passwordResetToken` alanları (`tokenHash`, `usedAt`, `expiresAt`, `userId`) Task 2 modeliyle Task 5/6/8 kullanımı eşleşiyor. ✓

## Notlar / Riskler
- Rate limiter per-process (login/register ile aynı bilinen sınır; Redis'e taşıma v0.6.0 roadmap'te, kapsam dışı).
- `APP_URL` prod/staging `.env`'de dolu olmalı; boşsa link `localhost` olur (deploy öncesi kontrol).
- Sıfırlama sonrası mevcut iron-session cookie'leri 7 gün geçerli kalır (MVP kabulü; ileride `User.passwordChangedAt` + `requireAuth` kontrolüyle iyileştirilebilir).
- Yerel migration için OrbStack Postgres ayakta olmalı.
