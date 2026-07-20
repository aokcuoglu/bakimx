# Deneme Akışı: E-posta Doğrulama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deneme başlatmayı 1 TL kart ön provizyonu yerine e-posta doğrulamasına bağlamak; kullanıcı e-postadaki linke tıklayınca 7 günlük trial başlar ve otomatik uygulamaya girer.

**Architecture:** `/register` pending workshop oluşturur ve owner'a stateless imzalı token'lı bir doğrulama e-postası yollar. `GET /api/auth/verify-email` token'ı doğrular, mevcut `activateVerifiedWorkshop()` (idempotent, claim-guard'lı) ile trial'ı başlatır, owner için oturum açar ve `/dashboard`'a yönlendirir. Kart-doğrulama yolu (verify initiate route, VerifyCardPanel, callback dalı, 1 TL iptal uyarısı, payment/result vref dalı) tamamen kaldırılır. Şema değişikliği yoktur.

**Tech Stack:** Next.js (App Router, route handlers), TypeScript (strict), Prisma, iron-session, Bun test runner, TAMI (dokunulmuyor).

## Global Constraints

- **Şema değişikliği YOK** — doğrulama durumu `Workshop.approvalStatus` (`pending`→`approved`) + `trialStartedAt` üzerinden okunur; migrasyon eklenmez.
- **Tenant izolasyonu:** `workshopId` daima token/session'dan türetilir; client param'a asla güvenilmez.
- **TypeScript strict**, `any` yok.
- **ShadcnUI/Base UI bileşenleri** — özel/native kontrol elle yazılmaz; web'de bileşen yüksekliği `h-9`.
- **Chat/kopya Türkçe.** Kullanıcıya dönük tüm metinler Türkçe.
- **Oturum alanları minimal:** `session.userId` + `session.workshopId` (login route ile birebir).
- **`/satin-al` gerçek ödeme akışı + ortak TAMI altyapısı (client/hash/purchase callback yolu) DOKUNULMAZ.**
- **`activateVerifiedWorkshop` SİLİNMEZ** — admin stuck-txn retry paneli (`src/app/admin/actions.ts`) hâlâ çağırır; yalnız audit action string'i değişir.
- Test runner: `bun test <dosya>`; typecheck: `bun run typecheck` (veya `bunx tsc --noEmit`); lint: `bun run lint`; build: `bun run build`.
- E-posta/logo linkleri `APP_URL`'den beslenir (unset → localhost). verify-token HMAC secret = `SESSION_SECRET` (oturum katmanıyla aynı, prod'da sabit).

---

## File Structure

**Oluşturulacak:**
- `src/lib/billing/verify-email.ts` — doğrulama e-postası gönderen yardımcı (`sendVerifyEmail`) + saf `buildVerifyUrl`.
- `src/lib/billing/verify-email.test.ts` — `buildVerifyUrl` birim testi.
- `src/app/api/auth/verify-email/route.ts` — `GET` token doğrula → aktive et → oturum aç → `/dashboard`.
- `src/app/api/auth/resend-verification/route.ts` — `POST` (session'lı) doğrulama e-postasını yeniden yolla.
- `src/components/app/resend-verify-button.tsx` — kilit ekranındaki "tekrar gönder" (client).

**Değiştirilecek:**
- `src/lib/emails/system-emails.ts` — `verifyEmailEmail` şablonu ekle.
- `src/lib/billing/verify-token.ts` — TTL 24s→48s + doküman yorumu.
- `src/lib/billing/verify-activation.ts` — audit action rename; `alertVerifyCancelFailureOnce` sil (T9).
- `src/app/api/auth/register/route.ts` — token döndürme yerine e-posta gönder.
- `src/components/auth/register-form.tsx` — kart adımı → "e-posta gönderildi" ekranı.
- `src/components/app/plan-locked.tsx` — pending kopyası + resend butonu.
- `src/app/(app)/layout.tsx` — `verifyToken` üretimini kaldır.
- `src/app/payment/result/page.tsx` — `vref` dalını kaldır (T9).
- `src/app/api/payments/tami/callback/route.ts` — `card_verification` dalını kaldır (T9).

**Silinecek:**
- `src/app/api/payments/tami/verify/initiate/route.ts`
- `src/components/billing/verify-card-panel.tsx`

---

### Task 1: `verifyEmailEmail` şablonu + token TTL

**Files:**
- Modify: `src/lib/emails/system-emails.ts` (dosya sonuna ekle)
- Modify: `src/lib/billing/verify-token.ts:16` (TTL) + doküman yorumu
- Test: `src/lib/emails/system-emails.test.ts`

**Interfaces:**
- Produces: `verifyEmailEmail(p: { verifyUrl: string; firstName?: string }): BuiltEmail`
- Produces: `verify-token.ts` `createVerifyToken`/`readVerifyToken` imzaları DEĞİŞMEZ; yalnız TTL 48s.

- [ ] **Step 1: `verifyEmailEmail` için failing test yaz**

`src/lib/emails/system-emails.test.ts` içine (mevcut testlerin yanına) ekle:

```typescript
import { verifyEmailEmail } from "./system-emails"

describe("verifyEmailEmail", () => {
  test("verifyUrl'i CTA olarak gömer, isim escape edilir, 7 gün deneme metni içerir", () => {
    const built = verifyEmailEmail({ verifyUrl: "https://app.bakimx.com/api/auth/verify-email?token=abc", firstName: "Ali<x>" })
    expect(built.subject).toContain("doğrula")
    expect(built.html).toContain("https://app.bakimx.com/api/auth/verify-email?token=abc")
    expect(built.html).toContain("7 günlük")
    // XSS koruması: ham "<x>" HTML'de görünmez, escape'lenir.
    expect(built.html).not.toContain("Ali<x>")
    expect(built.html).toContain("Ali&lt;x&gt;")
  })

  test("firstName yoksa 'Yetkili' kullanılır", () => {
    const built = verifyEmailEmail({ verifyUrl: "https://x/y" })
    expect(built.html).toContain("Yetkili")
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `bun test src/lib/emails/system-emails.test.ts`
Expected: FAIL — `verifyEmailEmail is not a function` / import hatası.

- [ ] **Step 3: Şablonu ekle**

`src/lib/emails/system-emails.ts` dosyasının SONUNA ekle (mevcut `escapeHtml`, `appUrl`, `renderEmailLayout` importlarını kullanır — hepsi dosyada mevcut):

```typescript
/** Kayıt sonrası e-posta doğrulama linki — linke tıklayınca 7 günlük deneme
 *  başlar (bkz. activateVerifiedWorkshop). Kart provizyonunun yerini alır. */
export function verifyEmailEmail(p: { verifyUrl: string; firstName?: string }): BuiltEmail {
  const name = escapeHtml(p.firstName || "Yetkili")
  return {
    subject: "BakimX — e-posta adresinizi doğrulayın",
    html: renderEmailLayout({
      heading: "E-posta adresinizi doğrulayın",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
        `<p style="margin:0 0 12px;">BakimX ücretsiz denemenizi başlatmak için e-posta adresinizi doğrulamanız yeterli. Aşağıdaki butona tıkladığınızda <strong>7 günlük ücretsiz denemeniz</strong> hemen başlar.</p>` +
        `<p style="margin:0 0 12px;">Bu bağlantı <strong>48 saat</strong> boyunca geçerlidir.</p>` +
        `<p style="margin:0 0 12px;color:#64748b;">Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>`,
      cta: { label: "E-postamı Doğrula ve Denemeyi Başlat", url: p.verifyUrl },
      footerNote: "Bu e-postayı, BakimX'e iş yeri kaydı başlattığınız için aldınız.",
    }),
  }
}
```

- [ ] **Step 4: verify-token TTL'i 48 saate çıkar**

`src/lib/billing/verify-token.ts:16` değiştir:

```typescript
// E-posta doğrulama linki ömrü — 48 saatlik purge penceresiyle hizalı
// (bkz. lifecycle.ts PURGE_STALE_MS). Süresi dolan link /login?verify=invalid'e düşer.
const TTL_MS = 48 * 60 * 60 * 1000
```

Ayrıca dosya başındaki blok yorumda "kart doğrulama" ifadesini "e-posta doğrulama" olarak güncelle (satır 4-8 civarı, `/register` PENDING workshop yaratır ... token'ı üretir cümlesi): `kart doğrulama akışının` → `e-posta doğrulama akışının`, `doğrulama formunu açabilir` → `doğrulama linkini kullanabilir`. Fonksiyon/dosya adları KORUNUR.

- [ ] **Step 5: Testlerin geçtiğini doğrula**

Run: `bun test src/lib/emails/system-emails.test.ts src/lib/billing/verify-token.test.ts`
Expected: PASS (her iki dosya). verify-token testi TTL'e assert etmiyor → hâlâ geçer.

- [ ] **Step 6: Commit**

```bash
git add src/lib/emails/system-emails.ts src/lib/emails/system-emails.test.ts src/lib/billing/verify-token.ts
git commit -m "feat(auth): e-posta doğrulama e-posta şablonu + token TTL 48s

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `sendVerifyEmail` yardımcısı + `buildVerifyUrl`

**Files:**
- Create: `src/lib/billing/verify-email.ts`
- Test: `src/lib/billing/verify-email.test.ts`

**Interfaces:**
- Consumes: `createVerifyToken` (Task 1 sonrası verify-token.ts), `verifyEmailEmail` (Task 1), `sendSystemEmail` (`{ ok: boolean; error?: string }` döner), `prisma`.
- Produces:
  - `buildVerifyUrl(appUrl: string, token: string): string`
  - `sendVerifyEmail(workshopId: string): Promise<{ ok: boolean }>`

- [ ] **Step 1: `buildVerifyUrl` için failing test yaz**

`src/lib/billing/verify-email.test.ts`:

```typescript
import { describe, expect, test } from "bun:test"
import { buildVerifyUrl } from "./verify-email"

describe("buildVerifyUrl", () => {
  test("sondaki slash'i temizler ve token'ı encode eder", () => {
    expect(buildVerifyUrl("https://app.bakimx.com/", "a.b.c")).toBe(
      "https://app.bakimx.com/api/auth/verify-email?token=a.b.c"
    )
  })
  test("slash olmadan da doğru birleştirir; özel karakterleri encode eder", () => {
    expect(buildVerifyUrl("http://localhost:3000", "a b+c")).toBe(
      "http://localhost:3000/api/auth/verify-email?token=a%20b%2Bc"
    )
  })
})
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `bun test src/lib/billing/verify-email.test.ts`
Expected: FAIL — modül/`buildVerifyUrl` bulunamıyor.

- [ ] **Step 3: `verify-email.ts`'i yaz**

`src/lib/billing/verify-email.ts`:

```typescript
import { prisma } from "@/lib/db"
import { createVerifyToken } from "@/lib/billing/verify-token"
import { verifyEmailEmail } from "@/lib/emails/system-emails"
import { sendSystemEmail } from "@/lib/emails/send-system-email"

/**
 * Kayıt e-posta doğrulama linkini owner'a yollar. Token stateless + imzalı
 * (verify-token); yalnız workshopId taşır. Recipient owner user (yoksa workshop
 * e-postası). Best-effort DEĞİL: çağıran { ok } sonucunu kullanır — link olmadan
 * kullanıcı ilerleyemez. sendSystemEmail asla throw etmez (CommunicationLog yazar).
 */
export async function sendVerifyEmail(workshopId: string): Promise<{ ok: boolean }> {
  const [workshop, owner] = await Promise.all([
    prisma.workshop.findUnique({ where: { id: workshopId }, select: { name: true, email: true } }),
    prisma.user.findFirst({
      where: { workshopId, role: "owner" },
      orderBy: { createdAt: "asc" },
      select: { email: true, firstName: true },
    }),
  ])
  const to = owner?.email || workshop?.email
  if (!workshop || !to) return { ok: false }

  const token = createVerifyToken(workshopId)
  const verifyUrl = buildVerifyUrl(process.env.APP_URL || "http://localhost:3000", token)
  const built = verifyEmailEmail({ verifyUrl, firstName: owner?.firstName || "" })

  const res = await sendSystemEmail({
    to,
    subject: built.subject,
    html: built.html,
    workshopId,
    // Statik key: resend akışında birden çok gönderime izin ver (sendSystemEmail dedup ETMEZ).
    templateKey: "verify_email",
  })
  return { ok: res.ok }
}

/** Doğrulama linki: `${appUrl}/api/auth/verify-email?token=<token>` (slash-güvenli). */
export function buildVerifyUrl(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/$/, "")
  return `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `bun test src/lib/billing/verify-email.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/verify-email.ts src/lib/billing/verify-email.test.ts
git commit -m "feat(auth): sendVerifyEmail yardımcısı + buildVerifyUrl

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `activateVerifiedWorkshop` audit action rename

**Files:**
- Modify: `src/lib/billing/verify-activation.ts:80` (audit action string)

**Interfaces:**
- Consumes/Produces: `activateVerifiedWorkshop(workshopId: string): Promise<{ ok: boolean }>` — imza DEĞİŞMEZ. Yalnız audit action string'i değişir. (`alertVerifyCancelFailureOnce` bu task'ta DEĞİL, Task 9'da silinir — callback hâlâ import ediyor.)

- [ ] **Step 1: Audit action string'ini değiştir**

`src/lib/billing/verify-activation.ts` içindeki `AuditLogAction(...)` çağrısında (satır ~76-82):

```typescript
  await AuditLogAction(
    workshopId,
    undefined,
    "Workshop",
    workshopId,
    "email_verified_trial_started"
  ).catch((err) => {
    console.error("[activateVerifiedWorkshop] audit failed:", err instanceof Error ? err.message : err)
  })
```

Ayrıca dosya başındaki blok yorumda `kart doğrulaması başarıya ulaştığında` gibi ifadeleri `e-posta doğrulaması tamamlandığında` olarak güncelle (fonksiyon davranışı aynı; yalnız tetikleyici değişti).

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS (string değişimi; tip etkilenmez).

- [ ] **Step 3: Commit**

```bash
git add src/lib/billing/verify-activation.ts
git commit -m "refactor(billing): trial audit action email_verified_trial_started

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `GET /api/auth/verify-email` route

**Files:**
- Create: `src/app/api/auth/verify-email/route.ts`

**Interfaces:**
- Consumes: `readVerifyToken` (verify-token), `activateVerifiedWorkshop` (verify-activation), `getSession` (`@/lib/session`), `prisma`.
- Produces: `GET(request: Request): Promise<Response>` — 303/redirect. Başarı → `/dashboard` (oturum çerezi set edilmiş). Geçersiz token/workshop → `/login?verify=invalid`. Aktivasyon hatası → `/login?verify=error`.

- [ ] **Step 1: Route dosyasını yaz**

`src/app/api/auth/verify-email/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { readVerifyToken } from "@/lib/billing/verify-token"
import { activateVerifiedWorkshop } from "@/lib/billing/verify-activation"
import { getSession } from "@/lib/session"

/**
 * E-posta doğrulama linki (public, GET). Token → workshopId → trial'ı başlat
 * (activateVerifiedWorkshop; idempotent + claim-guard'lı) → owner için oturum aç
 * → /dashboard. Token/workshop geçersizse /login?verify=invalid.
 *
 * Not: GET link e-posta tarayıcı prefetch'ine açıktır — prefetch trial'ı erken
 * aktifleştirebilir (idempotent, zararsız) ve oturum çerezini bota yazar. Gerçek
 * kullanıcı tıkladığında aktivasyon idempotent, oturum yine ONUN çerezine gider.
 */
function appOrigin(request: Request): string {
  return process.env.APP_URL || new URL(request.url).origin
}

export async function GET(request: Request): Promise<Response> {
  const origin = appOrigin(request)
  const token = new URL(request.url).searchParams.get("token")
  const workshopId = token ? readVerifyToken(token) : null
  if (!workshopId) {
    return NextResponse.redirect(new URL("/login?verify=invalid", origin))
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { id: true },
  })
  if (!workshop) {
    return NextResponse.redirect(new URL("/login?verify=invalid", origin))
  }

  // pending→approved bir kez yan-etki üretir; zaten approved ise ok:true (idempotent).
  const activation = await activateVerifiedWorkshop(workshopId)
  if (!activation.ok) {
    return NextResponse.redirect(new URL("/login?verify=error", origin))
  }

  const owner = await prisma.user.findFirst({
    where: { workshopId, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!owner) {
    // Aktivasyon başarılı ama owner bulunamadı (imkansıza yakın) — girişe düş.
    return NextResponse.redirect(new URL("/login?verify=1", origin))
  }

  // Oturum aç (login route ile aynı desen): önce temizle, sonra kimliği yaz.
  const session = await getSession()
  session.destroy()
  session.userId = owner.id
  session.workshopId = workshopId
  await session.save()

  return NextResponse.redirect(new URL("/dashboard", origin))
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Middleware'in route'u engellemediğini kontrol et**

`/api/auth/*` public olmalı (login/register ile aynı). Kontrol:

Run: `grep -n "api/auth\|verify-email\|publicPath\|matcher" src/middleware.ts | head`
Expected: `/api/auth` zaten public/muaf (login & register çalışıyor). Yeni path aynı prefix altında — ek değişiklik gerekmez. Değilse verify-email path'ini muafiyet listesine ekle.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/verify-email/route.ts
git commit -m "feat(auth): GET /api/auth/verify-email — trial başlat + oto giriş

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `register` route — token yerine e-posta gönder

**Files:**
- Modify: `src/app/api/auth/register/route.ts`

**Interfaces:**
- Consumes: `sendVerifyEmail` (Task 2), `canResumeVerification` (mevcut).
- Produces: POST yanıtı artık `verifyToken` İÇERMEZ. Başarı: `{ ok: true }` (yeni) / `{ ok: true, resumed: true }` (resume). E-posta gönderilemezse: `{ error: EMAIL_SEND_ERROR }` 500.

- [ ] **Step 1: Import'ları güncelle**

`src/app/api/auth/register/route.ts` başında `createVerifyToken` importunu KALDIR, `sendVerifyEmail` ekle:

```typescript
import { canResumeVerification } from "@/lib/billing/verify-resume"
import { sendVerifyEmail } from "@/lib/billing/verify-email"
```

(`import { createVerifyToken } from "@/lib/billing/verify-token"` satırını sil.)

- [ ] **Step 2: Hata sabitini ekle**

Mevcut `EMAIL_IN_USE_ERROR` sabitinin yanına ekle:

```typescript
const EMAIL_SEND_ERROR = "Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin."
```

- [ ] **Step 3: Resume dalını güncelle**

Mevcut resume return bloğunu (`if (canResumeVerification({...})) { return NextResponse.json({ ok: true, resumed: true, verifyToken: ... }) }`) şununla değiştir:

```typescript
    if (
      canResumeVerification({
        passwordValid,
        approvalStatus: existing.workshop.approvalStatus,
        trialStartedAt: existing.workshop.trialStartedAt,
      })
    ) {
      const sent = await sendVerifyEmail(existing.workshop.id)
      if (!sent.ok) {
        return NextResponse.json({ error: EMAIL_SEND_ERROR }, { status: 500 })
      }
      return NextResponse.json({ ok: true, resumed: true })
    }
```

- [ ] **Step 4: Yeni-kayıt dalını güncelle**

Transaction'dan sonra, admin bildirim bloğunun ÖNCESİNE e-posta gönderimini ekle ve sondaki `return NextResponse.json({ ok: true, verifyToken: ... })`'ı değiştir. Nihai hâl (admin notify bloğu AYNEN kalır):

```typescript
    // Doğrulama e-postası — akışın kilit taşı. Workshop+User zaten commit edildi;
    // gönderim başarısızsa 500 döner ve kullanıcı aynı bilgilerle tekrar POST edince
    // resume yolu (pending + trialsız) linki yeniden yollar (veri kaybı yok).
    const sent = await sendVerifyEmail(workshop.id)

    // Best-effort admin bildirimi — hata kayıt sonucunu etkilemez.
    try {
      const adminMail = newApplicationAdminEmail({
        workshopName: data.workshopName,
        ownerName: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        phone: data.phone,
        city: data.city,
      })
      await Promise.allSettled(
        getAdminEmails().map((to) =>
          sendSystemEmail({
            to,
            subject: adminMail.subject,
            html: adminMail.html,
            workshopId: workshop.id,
            templateKey: "new_application_admin",
          }),
        ),
      )
    } catch (mailErr) {
      console.error("[register] notification failed:", mailErr instanceof Error ? mailErr.message : mailErr)
    }

    if (!sent.ok) {
      return NextResponse.json({ error: EMAIL_SEND_ERROR }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
```

Ayrıca dosya başındaki blok yorumu (`card-verification gated trial` / `verifies a card via a 1 TL 3DS pre-auth` / `signed verifyToken`) e-posta doğrulama anlatımıyla güncelle.

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat(auth): register kart token yerine doğrulama e-postası yollar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `register-form` — "e-posta gönderildi" ekranı

**Files:**
- Modify: `src/components/auth/register-form.tsx`

**Interfaces:**
- Consumes: `/api/auth/register` yanıtı `{ ok: true }` (token yok).
- Produces: Başarıda `VerifyCardPanel` yerine "gelen kutunuzu kontrol edin" onay ekranı.

- [ ] **Step 1: VerifyCardPanel importunu ve token state'ini kaldır, `submitted` ekle**

`src/components/auth/register-form.tsx`:
- `import { VerifyCardPanel } from "@/components/billing/verify-card-panel"` satırını SİL.
- `const [verifyToken, setVerifyToken] = useState<string | null>(null)` → `const [submitted, setSubmitted] = useState<string | null>(null)` (girilen e-postayı tutar; onay ekranında gösterilir).
- `Mail` ikonu zaten import edilmiş (lucide) — onay ekranında kullanılacak.

- [ ] **Step 2: handleSubmit başarısını güncelle**

`handleSubmit` içindeki başarı dalını değiştir:

```typescript
      const data = await res.json()
      if (data.ok) {
        const email = (formData.get("email") as string || "").trim()
        setSubmitted(email)
      } else {
        setError(data.error || "Kayıt başarısız")
      }
```

- [ ] **Step 3: Onay ekranını değiştir**

`if (verifyToken) { ... }` bloğunun TAMAMINI şununla değiştir:

```tsx
  // Kayıt başarılı → e-posta doğrulama linki gönderildi. Linke tıklayınca 7 günlük
  // deneme başlar ve otomatik giriş yapılır (bkz. /api/auth/verify-email).
  if (submitted) {
    return (
      <motion.div variants={formVariants} initial="hidden" animate="visible" className="w-full">
        <div className="mb-2 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            E-postanızı kontrol edin
          </h1>
          <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
            <span className="font-medium text-foreground">{submitted}</span> adresine bir doğrulama
            bağlantısı gönderdik. Bağlantıya tıkladığınızda 7 günlük ücretsiz denemeniz başlar ve
            otomatik olarak giriş yaparsınız.
          </p>
          <p className="mt-4 text-muted-foreground text-xs leading-relaxed">
            E-posta birkaç dakika içinde gelmezse spam/gereksiz klasörünü kontrol edin. Bağlantı 48
            saat geçerlidir.
          </p>
        </div>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="text-primary hover:underline transition-colors font-medium">
            Giriş yapın
          </Link>
        </div>
      </motion.div>
    )
  }
```

(`CheckCircle2` importu artık kullanılmıyorsa kaldır; `Mail` kullanılıyor.)

- [ ] **Step 4: Başlık/alt-başlık kopyasını güncelle**

Formun üstündeki `<p>` metnini kart → e-posta olarak değiştir:

```tsx
        <p className="mt-2 text-muted-foreground text-sm lg:text-base">
          E-posta doğrulamasının ardından 7 günlük ücretsiz deneme başlar.
        </p>
```

- [ ] **Step 5: Typecheck + lint**

Run: `bunx tsc --noEmit && bun run lint`
Expected: PASS; kullanılmayan import uyarısı kalmamalı (`VerifyCardPanel`, gerekirse `CheckCircle2` kaldırıldı).

- [ ] **Step 6: Commit**

```bash
git add src/components/auth/register-form.tsx
git commit -m "feat(auth): register formu e-posta doğrulama onay ekranı

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `POST /api/auth/resend-verification` route

**Files:**
- Create: `src/app/api/auth/resend-verification/route.ts`

**Interfaces:**
- Consumes: `requireAuth` (`@/lib/auth`, `{ workshopId }` içerir), `rateLimit`, `clientIpFromHeaders` (`@/lib/auth-login`), `sendVerifyEmail` (Task 2), `prisma`.
- Produces: `POST(request: Request): Promise<Response>` — `{ ok: true }` (pending+trialsız ise e-posta yollandı; değilse sessiz ok), 401 oturumsuz, 429 rate-limit.

- [ ] **Step 1: Route dosyasını yaz**

`src/app/api/auth/resend-verification/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"
import { clientIpFromHeaders } from "@/lib/auth-login"
import { sendVerifyEmail } from "@/lib/billing/verify-email"

/**
 * Doğrulama e-postasını yeniden yollar. Kilit ekranından (pending kullanıcı giriş
 * yapıp uygulamaya gelince) çağrılır. workshopId SESSION'dan türetilir (client
 * param'a güvenilmez). Yalnız pending + trialsız workshop için gönderir; aksi
 * halde sessiz başarı (durum sızdırmadan). IP+workshop başına rate-limit.
 */
const RL_MAX = 3
const RL_WINDOW_MS = 10 * 60_000

export async function POST(request: Request): Promise<Response> {
  let user
  try {
    user = await requireAuth()
  } catch {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 })
  }

  const ip = clientIpFromHeaders(request.headers)
  const limit = rateLimit(`resend-verify:${user.workshopId}:${ip}`, RL_MAX, RL_WINDOW_MS)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek. Lütfen birkaç dakika sonra tekrar deneyin." },
      { status: 429 },
    )
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
    select: { approvalStatus: true, trialStartedAt: true },
  })
  // Yalnız hâlâ doğrulanmamış (pending + trialsız) kayıt için yeniden yolla.
  if (workshop?.approvalStatus === "pending" && workshop.trialStartedAt === null) {
    await sendVerifyEmail(user.workshopId)
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/resend-verification/route.ts
git commit -m "feat(auth): POST /api/auth/resend-verification (session-scoped)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Kilit ekranı — pending → e-posta doğrulama + tekrar gönder

**Files:**
- Create: `src/components/app/resend-verify-button.tsx`
- Modify: `src/components/app/plan-locked.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/resend-verification` (Task 7).
- Produces: `PlanLocked` artık `verifyToken` prop'u ALMAZ; `pending` durumunda `ResendVerifyButton` gösterir. `layout.tsx` `createVerifyToken`/`verifyToken` üretmez.

- [ ] **Step 1: `ResendVerifyButton` client bileşenini yaz**

`src/components/app/resend-verify-button.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Loader2, Mail, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Kilit ekranından doğrulama e-postasını yeniden yollar (session-scoped endpoint). */
export function ResendVerifyButton() {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle")

  async function resend() {
    setState("loading")
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" })
      setState(res.ok ? "sent" : "error")
    } catch {
      setState("error")
    }
  }

  if (state === "sent") {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-primary">
        <Check className="size-4" /> Doğrulama e-postası tekrar gönderildi.
      </p>
    )
  }

  return (
    <div className="space-y-2 text-center">
      <Button onClick={resend} disabled={state === "loading"} className="w-full">
        {state === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Gönderiliyor…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Mail className="size-4" /> Doğrulama e-postasını tekrar gönder
          </span>
        )}
      </Button>
      {state === "error" && (
        <p className="text-sm text-destructive">Gönderilemedi. Lütfen birkaç dakika sonra tekrar deneyin.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `plan-locked.tsx`'i güncelle**

- `import { VerifyCardPanel } from "@/components/billing/verify-card-panel"` → `import { ResendVerifyButton } from "@/components/app/resend-verify-button"`
- `COPY.pending` içeriğini değiştir:

```typescript
  pending: {
    title: "E-postanızı doğrulayın",
    description:
      "Ücretsiz denemenizi başlatmak için e-posta adresinize gönderdiğimiz doğrulama bağlantısına tıklayın. E-posta gelmediyse aşağıdan yeniden gönderebilirsiniz.",
    icon: Mail,
    showPackages: false,
  },
```

- Dosya başındaki lucide importuna `Mail` ekle: `import { Clock, Lock, Mail } from "lucide-react"`.
- Props'tan `verifyToken`'ı kaldır, `showVerifyCard` yerine resend göster:

```tsx
export function PlanLocked({
  reason,
  workshopName,
  hasPendingOrder = false,
}: {
  reason: Exclude<LockReason, null>
  workshopName?: string
  hasPendingOrder?: boolean
}) {
  const { title, description, icon: Icon, showPackages } = COPY[reason]
  const showResend = reason === "pending"
```

- `{showVerifyCard && (...VerifyCardPanel...)}` bloğunu şununla değiştir:

```tsx
        {showResend && (
          <div className="mx-auto max-w-md rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
            <ResendVerifyButton />
          </div>
        )}
```

- [ ] **Step 3: `(app)/layout.tsx`'i güncelle**

- `import { createVerifyToken } from "@/lib/billing/verify-token"` satırını SİL.
- pending/rejected bloğundaki `verifyToken` hesaplamasını ve prop geçişini kaldır:

```tsx
  if (!plan.hasAccess && (plan.lockReason === "pending" || plan.lockReason === "rejected")) {
    const pendingOrder = await prisma.billingOrder.findFirst({
      where: { workshopId: user.workshopId, status: "pending_payment" },
      select: { id: true },
    })
    return (
      <>
        {impersonation && <ImpersonationBanner workshopName={workshop.name} />}
        <PlanLocked
          reason={plan.lockReason}
          workshopName={workshop.name}
          hasPendingOrder={!!pendingOrder}
        />
      </>
    )
  }
```

- [ ] **Step 4: Typecheck + lint**

Run: `bunx tsc --noEmit && bun run lint`
Expected: PASS. `createVerifyToken` artık layout'ta yok; `VerifyCardPanel` importu plan-locked'ta yok.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/resend-verify-button.tsx src/components/app/plan-locked.tsx "src/app/(app)/layout.tsx"
git commit -m "feat(app): pending kilit ekranı e-posta doğrulama + tekrar gönder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Kart-doğrulama yolunu kaldır

**Files:**
- Delete: `src/app/api/payments/tami/verify/initiate/route.ts`
- Delete: `src/components/billing/verify-card-panel.tsx`
- Modify: `src/app/api/payments/tami/callback/route.ts` (card_verification dalı + import)
- Modify: `src/lib/billing/verify-activation.ts` (`alertVerifyCancelFailureOnce` sil)
- Modify: `src/app/payment/result/page.tsx` (`vref` dalı + import)

**Interfaces:**
- Kaldırma sonrası: hiçbir yeni `card_verification` txn üretilmez. Callback'e gelen stray `card_verification` txn (billingOrder null) mevcut `if (!txn.billingOrder)` no-op dalına düşer (zararsız). `activateVerifiedWorkshop` KORUNUR (admin retry + verify-email kullanır).

- [ ] **Step 1: verify/initiate route ve VerifyCardPanel'i sil**

```bash
git rm src/app/api/payments/tami/verify/initiate/route.ts src/components/billing/verify-card-panel.tsx
```

- [ ] **Step 2: callback route — card_verification dalını kaldır**

`src/app/api/payments/tami/callback/route.ts`:
- Importlardan şunları SİL: `activateVerifiedWorkshop, alertVerifyCancelFailureOnce` (verify-activation'dan) ve `createVerifyToken` (verify-token'dan).
- `verifyResultRedirect` yardımcı fonksiyonunu (satır ~46-52) SİL.
- purpose dallanmasını kaldır — şu bloğu:

```typescript
  if (txn.purpose === "card_verification") {
    return handleCardVerificationCallback(request, txn, raw, now, mdStatus, successTruthy)
  }
```

TAMAMEN SİL.
- `handleCardVerificationCallback` fonksiyonunun (satır ~304-421, dosya sonundaki tüm fonksiyon) TAMAMINI SİL.

Sonuç: `card_verification` purpose'lu bir txn claim edilirse, `if (!txn.billingOrder)` kontrolüne düşer, sanitize log + no-op result döner. (Bu davranış tasarımda kabul edildi.)

- [ ] **Step 3: verify-activation — `alertVerifyCancelFailureOnce`'ı sil**

`src/lib/billing/verify-activation.ts` içindeki `alertVerifyCancelFailureOnce` fonksiyonunun TAMAMINI (satır ~89-129, blok yorumu dahil) SİL. Artık kullanılmayan importları temizle: `getAdminEmails`, `sendSystemEmail`, `founderAlertEmail` HÂLÂ `activateVerifiedWorkshop` içinde welcome e-postası için kullanılıyor mu kontrol et — welcome e-postası `sendSystemEmail` + welcome template kullanıyor; `founderAlertEmail` yalnız silinen fonksiyondaydı → `founderAlertEmail` importunu `welcomeTrialEmail, founderAlertEmail` satırından çıkar (`welcomeTrialEmail` kalır). `getAdminEmails` de yalnız silinen fonksiyondaydı → importunu SİL.

Doğrula (silmeden sonra hangi importlar gerçekten kullanılıyor):

Run: `grep -n "getAdminEmails\|founderAlertEmail\|sendSystemEmail\|welcomeTrialEmail" src/lib/billing/verify-activation.ts`
Expected: yalnız `sendSystemEmail` ve `welcomeTrialEmail` kalmalı (welcome e-postası). Kullanılmayan importları kaldır.

- [ ] **Step 4: payment/result — `vref` dalını kaldır**

`src/app/payment/result/page.tsx`:
- Importlardan SİL: `import { VerifyCardPanel } from "@/components/billing/verify-card-panel"` ve `import { readVerifyToken, createVerifyToken } from "@/lib/billing/verify-token"`.
- `VerifyResultView` fonksiyonunun (satır ~92-217) TAMAMINI SİL.
- `PaymentResultPage` içinde `vref` okuma + dallanmasını SİL:

```typescript
  const sp = await searchParams
  const ref = typeof sp.ref === "string" ? sp.ref : null
  const err = typeof sp.err === "string" ? sp.err : null

  // 1) Referans yok → nazik genel hata.
  if (!ref) {
```

(Yani `const vref = ...` satırı ve `if (vref) { return <VerifyResultView .../> }` bloğu kaldırılır. `searchParams` tipinden `vref?: string`'i de çıkar.)

- `revealedCardSuffix` importu hâlâ `OrderSummary`'de kullanılıyor → KALIR.

- [ ] **Step 5: Typecheck + lint**

Run: `bunx tsc --noEmit && bun run lint`
Expected: PASS. Hiçbir yerde `VerifyCardPanel`, `handleCardVerificationCallback`, `alertVerifyCancelFailureOnce`, `verifyResultRedirect` referansı kalmamalı.

Doğrula:

Run: `grep -rn "VerifyCardPanel\|alertVerifyCancelFailureOnce\|handleCardVerificationCallback\|verify/initiate" src/`
Expected: (boş çıktı) — hiçbir eşleşme yok.

- [ ] **Step 6: card verification'a ait ölü testleri temizle**

Run: `grep -rln "alertVerifyCancelFailureOnce\|handleCardVerificationCallback\|verify/initiate\|VerifyCardPanel" src --include=*.test.ts`
Eğer eşleşen test dosyası varsa ilgili test bloklarını kaldır/güncelle. (Beklenen: yok — daha önceki tarama register/verify route testi göstermedi.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(billing): trial kart-doğrulama (1 TL) yolunu kaldır

verify/initiate route, VerifyCardPanel, callback card_verification dalı,
alertVerifyCancelFailureOnce ve payment/result vref görünümü silindi.
Ortak TAMI ödeme altyapısı ve /satin-al dokunulmadı.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Bütünsel doğrulama (lint + typecheck + test + build + manuel QA)

**Files:** (yok — doğrulama task'ı)

- [ ] **Step 1: Tüm test paketini çalıştır**

Run: `bun test`
Expected: PASS (yeni testler dahil; silinen card-verify testleri yoksa regresyon yok).

- [ ] **Step 2: Lint + typecheck**

Run: `bun run lint && bunx tsc --noEmit`
Expected: PASS, uyarısız.

- [ ] **Step 3: Prod build (değişiklik anlamlı — App Router route + component değişti)**

Run: `bun run build`
Expected: Başarılı derleme; `/api/auth/verify-email`, `/api/auth/resend-verification` route'ları çıktı listesinde.

- [ ] **Step 4: Manuel QA (lokal, `docker compose -f docker-compose.local.yml up -d` DB açıkken)**

Aşağıdakileri elle doğrula (dev sunucu `bun run dev`):
1. `/register` doldur → gönder → "E-postanızı kontrol edin" ekranı çıkıyor mu.
2. Gönderilen e-postadaki linke tıkla (lokalde e-posta sağlayıcı loglar/CommunicationLog'dan URL'i al) → `/dashboard`'a düşüyor + oturum açık + üstte "Deneme sürenizin bitmesine 7 gün kaldı" bandı.
3. DB'de workshop `approvalStatus=approved`, `trialStartedAt` dolu, `trialEndsAt ≈ +7 gün`; welcome e-postası CommunicationLog'da TEK kayıt.
4. Aynı linke 2. kez tıkla → yine `/dashboard` (idempotent, hata yok).
5. Süresi geçmiş/bozuk token (`?token=bozuk`) → `/login?verify=invalid`.
6. Yeni kayıt yap, doğrulamadan `/login`'den gir → kilit ekranı "E-postanızı doğrulayın" + "tekrar gönder" butonu → tıkla → "tekrar gönderildi" + yeni CommunicationLog kaydı.
7. `/satin-al` gerçek ödeme akışı hâlâ açılıyor ve etkilenmedi.

- [ ] **Step 5: Hafıza + spec işaretle (kod değişikliği değil)**

Bu turdaki kalıcı gerçekleri hafızaya işle: `tami-payment-integration.md` içindeki "kayıtta 1 TL ön provizyon" ifadesini "kayıtta e-posta doğrulama (1 TL provizyon EMEKLİ)" olarak güncelle; `register-is-approval-gated-by-design.md` notunu güncel akışla revize et. (Bu adım implementasyon değil; commit sonrası yapılır.)

---

## Notlar (rollout / deploy)

- **`TRIAL_PURGE_CUTOFF`** prod-merge'de yine gerekli (mevcut purge kuralı `pending`+`trialStartedAt:null` korunuyor; kart txn guard'ı artık hep 0 → zararsız).
- **`APP_URL`** prod `.env.production`'da dolu olmalı (doğrulama linki + e-posta logo URL'i) — [[email-logo-and-app-url]].
- **Resend** prod'da aktif olmalı (VPS 465/587 bloklu) — [[approval-emails-gmail-shipped]].
- **`SESSION_SECRET`** prod'da sabit kalmalı (verify-token imzası) — [[deploy-chunk-resilience]].
- **In-flight kart doğrulaması:** deploy anındaki yarım kart doğrulaması aktive olmaz; kullanıcı e-posta akışıyla yeniden başlar (kabul edilen küçük pencere).
- **admin stuck-txn paneli** historik `card_verification` txn'leri göstermeye devam eder (zararsız); `activateVerifiedWorkshop` korundu.
