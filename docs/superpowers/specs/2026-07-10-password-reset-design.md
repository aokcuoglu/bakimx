# Self-Serve Şifre Sıfırlama (E-posta Linki) — Tasarım

**Tarih:** 2026-07-10
**Branch:** `feat/password-reset` (base: `dev`)
**Durum:** Onaylandı, implementasyona hazır

## Amaç

Kullanıcıların şifrelerini kendi başlarına sıfırlayabilmesi. Şu an `/forgot-password`
gerçek bir sıfırlama değil, bir **destek talebi formudur** (`POST /api/support-request`,
DB'ye kaydeder, e-posta bile göndermez). Bu, CLAUDE.md'deki *"forgot password should guide
users to support"* kuralının bilinçli hâliydi. Bu iş o kararı değiştirir: destek
yönlendirmesi yerine e-posta linkiyle self-serve sıfırlama getirir.

## Kapsam

**Dahil:**
- E-posta ile şifre sıfırlama linki akışı (talep → e-posta → yeni şifre).
- `PasswordResetToken` Prisma modeli (additive migration).
- Sıfırlama e-postası şablonu.
- `/forgot-password` sayfasının destek formundan sıfırlama formuna dönüştürülmesi.

**Hariç (YAGNI):**
- SMS/OTP ile sıfırlama seçeneği.
- "Şifre değişince tüm oturumları kapat" (iron-session'ın sunucu tarafı store'u yok;
  MVP'de sıfırlama sonrası eski cookie'ler 7 günlük süre dolana kadar geçerli kalır).
  İleride `User.passwordChangedAt` + `requireAuth` kontrolüyle eklenebilir — bu iş
  kapsamında değil, sadece not.

## Akış

1. **Talep:** Kullanıcı `/forgot-password`'da e-postasını girer → `POST /api/auth/forgot-password`.
   - Kullanıcı bulunur ve `isActive` ise: eski kullanılmamış token'ları geçersiz kılınır,
     yeni token üretilir, sıfırlama e-postası gönderilir.
   - Kullanıcı yoksa veya pasifse: sessizce hiçbir şey yapılmaz.
   - **Her durumda aynı yanıt** döner (enumeration koruması):
     *"Eğer bu e-posta kayıtlıysa, sıfırlama linki gönderildi."*
2. **E-posta:** Kullanıcı e-postadaki linke tıklar → `/reset-password/<rawToken>`.
   - Sayfa yüklenirken token doğrulanır (var mı, süresi geçmemiş mi, kullanılmamış mı).
     Geçersizse "link geçersiz veya süresi dolmuş" ekranı + yeniden talep linki.
3. **Yeni şifre:** Kullanıcı yeni şifre + tekrarını girer → `POST /api/auth/reset-password`.
   - Token yeniden doğrulanır, şifre bcrypt (cost 12) ile hash'lenir, `User.password`
     güncellenir, token `usedAt` ile tüketilir.
   - Başarılıysa login sayfasına yönlendirilir ("Şifreniz güncellendi, giriş yapabilirsiniz").

## Veri Modeli

Yeni Prisma modeli, `src/lib/invite.ts` + `Invite` modeli deseninin birebir kopyası:

```prisma
model PasswordResetToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash  String    @unique          // sha256(rawToken), ham token asla DB'de değil
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime  @default(now())

  @@index([userId])
}
```

- `User` modeline `passwordResetTokens PasswordResetToken[]` ilişki alanı eklenir.
- **Migration:** additive (yeni tablo + ilişki), mevcut veriyi etkilemez.
  `schema-migrate-deploy` kuralına uygun: `prisma migrate dev` ile isimli migration.

### Token üretimi/doğrulaması

`src/lib/password-reset.ts` (invite.ts deseni):
- `createResetToken(userId)`: `randomBytes(32).toString("base64url")` ham token üretir,
  DB'ye `sha256(rawToken)` yazar, ham token'ı döndürür (yalnızca e-postada kullanılır).
- `verifyResetToken(rawToken)`: hash'le, DB'de ara; süresi geçmiş / kullanılmış / yok →
  `null`. Geçerliyse `{ token, userId }`.
- `consumeResetToken(id)`: `usedAt = now()`.
- `invalidateUserResetTokens(userId)`: yeni talep öncesi eski kullanılmamışları
  `usedAt = now()` ile geçersiz kıl.
- TTL: **1 saat** (`RESET_TTL_MS = 60 * 60 * 1000`).

## Güvenlik

- **Enumeration koruması:** talep yanıtı e-posta kayıtlı olsun olmasın aynı; mesaj ve
  HTTP durumu ayırt edilemez.
- `isActive=false` kullanıcılar sessizce atlanır.
- **Rate limit** (mevcut `src/lib/rate-limit.ts` helper'ı, per-process fixed-window):
  - `rateLimit("pwreset-ip:<ip>", 5, 15*60*1000)` — IP başına 15 dk / 5 talep.
  - `rateLimit("pwreset-email:<emailLower>", 3, 15*60*1000)` — e-posta başına 15 dk / 3.
  - `reset-password` (tüketim) endpoint'i için de IP limit: `pwreset-confirm-ip:<ip>`.
- **Şifre kuralı:** min 8 karakter (register ile aynı), Zod ile sunucu tarafında doğrulanır;
  yeni şifre = tekrar eşleşmesi client + sunucu.
- Ham token yanıt gövdesine/loglara yazılmaz; yalnızca e-posta gövdesindeki URL'de.
- **Middleware:** yeni public giriş noktaları `middleware.ts` içindeki public listelere
  eklenir: `/reset-password` (path prefix, token segment'i için), `/api/auth/forgot-password`,
  `/api/auth/reset-password`. (`/forgot-password` zaten public.)

## E-posta

- `src/lib/emails/system-emails.ts`'e yeni `passwordResetEmail({ resetUrl, firstName? })`
  builder'ı — mevcut `renderEmailLayout({ heading, bodyHtml, cta, footerNote })` iskeletiyle,
  diğer sistem e-postalarıyla tutarlı. CTA butonu = "Şifremi Sıfırla" → `resetUrl`.
  Not: link 1 saat geçerli; talep etmeyen kullanıcı için "yok sayın" cümlesi.
- Gönderim: `sendSystemEmail({ to, subject, html, workshopId, templateKey: "password_reset" })`
  — best-effort, `communicationLog`'a düşer.
- **URL kaynağı:** `resetUrl` `APP_URL` env'inden türetilir (`APP_URL` unset → localhost;
  prod/staging `.env`'de dolu olmalı — bkz. email-logo/APP_URL gotcha). Domain: login
  tarafı `bakimx.com`, dolayısıyla `${APP_URL}/reset-password/<rawToken>`.

## Route / Dosya Yapısı

| Dosya | Değişiklik |
|---|---|
| `prisma/schema.prisma` | `PasswordResetToken` modeli + `User` ilişki alanı |
| `prisma/migrations/<ts>_add_password_reset_token/` | yeni migration |
| `src/lib/password-reset.ts` | **yeni** — token üret/doğrula/tüket |
| `src/lib/validations/auth.ts` | `forgotPasswordSchema` (email), `resetPasswordSchema` (password+confirm) |
| `src/app/api/auth/forgot-password/route.ts` | **yeni** — talep endpoint'i |
| `src/app/api/auth/reset-password/route.ts` | **yeni** — tüketim endpoint'i |
| `src/app/(auth)/reset-password/[token]/page.tsx` | **yeni** — token doğrula + form |
| `src/components/auth/reset-password-form.tsx` | **yeni** — yeni şifre client formu |
| `src/components/auth/forgot-password-form.tsx` | destek formundan e-posta sıfırlama formuna dönüştür |
| `src/app/(auth)/forgot-password/page.tsx` | başlık/metin güncelle ("Şifremi Sıfırla") |
| `src/lib/emails/system-emails.ts` | `passwordResetEmail` builder |
| `middleware.ts` | yeni public giriş noktaları |

### `/api/support-request` temizliği

**Karar:** Kaldır, sadece sıfırlama. Ancak `SupportRequest` modeli ve `/api/support-request`
route'unun **admin panelinde kullanılıp kullanılmadığı implementasyon başında doğrulanacak**:
- Admin konsolu bu kayıtları listeliyorsa: model + API korunur, yalnızca `/forgot-password`
  sayfasındaki destek formu ve ona giden bağlantı kaldırılır.
- Hiçbir yerde kullanılmıyorsa: route ve (gerekirse) model temizlenir — ayrı, dikkatli
  bir adım olarak, migration etkisi açıklanarak.

## UI/UX (memory kurallarına uygun)

- ShadcnUI / Base UI bileşenleri; elle özel UI yok.
- Form bileşenleri web'de `h-9`; birincil CTA `size="lg"`.
- Yükleme durumları `BrandSpinner` (skeleton değil).
- Mobile-first; auth layout'un mevcut görsel paneliyle tutarlı.
- Base UI Select kullanılmıyor (bu akışta select yok), o gotcha ilgisiz.

## Test / QA

- **Birim:** `password-reset.ts` — token üret→doğrula (hit), süresi geçmiş→null,
  kullanılmış→null, hash DB'de düz token değil.
- **Sunucu doğrulama:** forgot-password aynı yanıtı döndürüyor mu (var/yok/pasif),
  rate-limit tetikleniyor mu; reset-password geçersiz token'ı reddediyor mu, kısa şifreyi
  reddediyor mu.
- **Manuel QA:** gerçek e-posta (mock provider veya Resend staging) ile uçtan uca;
  süresi dolmuş/tekrar kullanılan link ekranı; mobil görünüm; yeni şifreyle login.

## Riskler

- Rate limiter per-process (yatay ölçeklemede paylaşılmaz) — mevcut login/register ile aynı
  bilinen sınır; Redis'e taşıma roadmap'te (v0.6.0), bu iş kapsamında değil.
- `APP_URL` prod/staging `.env`'de dolu değilse link localhost olur — deploy öncesi kontrol.
- Eski oturumların sıfırlama sonrası geçerli kalması (yukarıda not) — MVP kabulü.
