# Deneme akışı: 1 TL kart provizyonu → e-posta doğrulama

**Tarih:** 2026-07-12
**Durum:** Onaylandı (implementasyon planına hazır)
**İlgili:** `2026-07-07-trial-card-verification-design.md` (bu tasarımın yerini aldığı akış)

## Amaç

Deneme (trial) başlatmayı **1 TL kart ön provizyonu** yerine **e-posta doğrulaması**na
bağlamak. Kullanıcı `/register` ile başvurur, e-postasına gelen doğrulama linkine
tıklayınca 7 günlük ücretsiz deneme başlar ve otomatik olarak uygulamaya girer.

Karttan hiçbir provizyon alınmaz; kayıt sırasında kart bilgisi hiç istenmez.

## Mevcut durum (özet)

- `/register` → `pending` durumunda Workshop + owner User oluşturur, `trialStartedAt: null`.
- Zorunlu kart-doğrulama adımı: `VerifyCardPanel` → `POST /api/payments/tami/verify/initiate`
  → TAMI 3DS ile **1 TL pre-auth** → callback'te provizyon iptal + `activateVerifiedWorkshop()`
  → `pending → approved`, trial başlar, welcome e-postası + audit.
- `/satin-al` bundan **ayrı** (gerçek ödeme / PurchaseWizard) — bu değişiklikten etkilenmez.
- `activateVerifiedWorkshop()` zaten `pending → approved` claim-guard'lı ve idempotent.

## Kararlar (onaylı)

1. **Token mekanizması:** Stateless imzalı link — mevcut `src/lib/billing/verify-token.ts`
   yeniden kullanılır (SESSION_SECRET-imzalı, workshopId taşır, **DB migrasyonu YOK**).
   TTL 24s → **48s** (48 saatlik purge penceresiyle hizalı). Süresi dolana kadar tekrar
   tıklanabilir; aktivasyon idempotent olduğu için zararsız.
2. **Doğrulama sonrası:** Otomatik giriş — link tıklanınca oturum açılır
   (`userId` + `workshopId`) ve kullanıcı doğrudan uygulamaya (`/`) düşer.
3. **Kart-doğrulama kodu:** Trial kart-doğrulama yolu kaldırılır. Ortak TAMI ödeme
   altyapısı (`/satin-al` gerçek ödeme için) dokunulmaz kalır.
4. **"Tekrar gönder" endpoint'i dahil** (kilit ekranı için).
5. **Geçersiz/süresi dolmuş link → `/login`** (kullanıcı zaten aktifleşmiş olabilir).

## Yeni akış

1. `POST /api/auth/register` → bugünkü gibi `pending` Workshop + owner oluşturur
   (`trialStartedAt: null`). **Fark:** kart token'ı döndürmek yerine owner e-postasına
   **doğrulama linki** gönderir, `{ ok: true }` döner (client'a token verilmez).
   Resume yolu (aynı e-posta + doğru şifre + hâlâ pending+trialsız) da linki **yeniden yollar**.
2. Kullanıcı e-postadaki linke tıklar → `GET /api/auth/verify-email?token=…`:
   - token → `workshopId` (geçersiz/süresi dolmuş → `/login`'e `?verify=invalid` ile redirect).
   - `activateVerifiedWorkshop(workshopId)` (mevcut; `pending → approved`, trial başlar,
     welcome e-postası + audit).
   - owner User bulunur → **oturum aç** (`session.destroy()` + `userId` + `workshopId` +
     `session.save()`, login route ile aynı desen) → `/` (uygulamaya) redirect.
   - aktivasyon zaten yapılmışsa (idempotent, `claimed===0`) yine oturum açılır ve uygulamaya girilir.
3. Register formu artık kart paneli yerine **"E-postanızı kontrol edin"** onay ekranı gösterir.

## Bileşenler

### Yeni

- **`GET /api/auth/verify-email`** — token doğrula → `activateVerifiedWorkshop` → owner
  için oturum aç → `/`'a redirect. Token geçersiz/süresi geçmiş → `/login?verify=invalid`.
  Workshop bulunamaz → `/login?verify=invalid`.
  - Not (GET link + prefetch): e-posta tarayıcı prefetch'i linke basarsa trial erken
    aktifleşir (idempotent, zararsız) ve oturum çerezi tarayıcı botuna gider (kullanıcı değil).
    Gerçek kullanıcı tıkladığında aktivasyon idempotent, oturum yine **onun** çerezine yazılır.
    Ek karmaşıklık (GET→sayfa→POST) MVP için gerekmez; risk kabul edilir.
- **`POST /api/auth/resend-verification`** — (app) kilit ekranındaki "tekrar gönder" için.
  `workshopId` **session'dan türetilir** (tenant-izolasyon kuralı — client param'a güvenilmez).
  Workshop pending + `trialStartedAt: null` ise doğrulama e-postasını yeniden yollar; değilse
  no-op benzeri sessiz başarı. Rate-limit (IP + workshop) uygulanır.
- **`verifyEmailEmail({ verifyUrl, firstName })`** şablonu (`src/lib/emails/system-emails.ts`) —
  mevcut `passwordResetEmail` desenini izler; başlıkta hosted PNG logo + tek CTA butonu.

### Değişen

- **`src/app/api/auth/register/route.ts`** — `verifyToken` döndürmek yerine
  `verifyEmailEmail` gönderir, `{ ok: true }` döner. Resume yolu linki yeniden yollar
  (`{ ok: true, resumed: true }`). **E-posta gönderimi best-effort DEĞİL:** doğrulama e-postası
  akışın kilit taşı (link olmadan kullanıcı ilerleyemez). Karar: Workshop+User transaction'ı
  başarıyla commit edildikten SONRA e-posta gönderilir; gönderim başarısızsa route **500 +
  "Doğrulama e-postası gönderilemedi, lütfen tekrar deneyin"** döner. Pending kayıt zaten
  oluştuğu için kullanıcı aynı e-posta+şifre ile tekrar POST edince resume yolu (pending +
  trialsız) linki yeniden yollar — veri kaybı yok. (admin bildirimi bugünkü gibi best-effort kalır.)
- **`src/components/auth/register-form.tsx`** — `VerifyCardPanel` adımı yerine
  "E-posta gönderildi / gelen kutunuzu kontrol edin" onay ekranı. Kart importu kaldırılır.
  Kopya güncellenir ("Kart doğrulamasının ardından…" → "E-posta doğrulamasının ardından
  7 günlük deneme başlar"). `verifyToken` state'i → `submitted` bool'una iner.
- **`src/components/app/plan-locked.tsx` + `src/app/(app)/layout.tsx`** — `pending`
  tam-ekran kilidi kart paneli yerine **"E-postanızı doğrulayın" + "Tekrar gönder"**
  gösterir. Layout artık kart `verifyToken` üretmez; kilit ekranı resend endpoint'ine POST atar.
  `rejected` dalı değişmez.
- **`src/lib/billing/verify-activation.ts`** — `activateVerifiedWorkshop` çekirdeği korunur
  (claim-guard + trial başlat + welcome e-postası). Audit action
  `card_verified_trial_started` → `email_verified_trial_started`. `alertVerifyCancelFailureOnce`
  (1 TL iptal uyarısı) **silinir**.
- **`src/app/payment/result/page.tsx`** — `vref` (kart doğrulama sonucu) dalı ve ilgili
  importlar (`VerifyCardPanel`, `card_verification` txn okuması) **kaldırılır**.
  Satın-alma (`ref`) dalı dokunulmaz.

### Silinen (kart-doğrulama yolu)

- `src/app/api/payments/tami/verify/initiate/route.ts`
- `src/components/billing/verify-card-panel.tsx`
- `src/app/api/payments/tami/callback/route.ts` içindeki `handleCardVerificationCallback`
  dalı + `if (txn.purpose === "card_verification")` dispatch'i. Kaldırılınca kalan stray
  `card_verification` callback'i `if (!txn.billingOrder)` no-op dalına düşer (zararsız).
- `alertVerifyCancelFailureOnce` (`verify-activation.ts`)

### Dokunulmayan

- `/satin-al` gerçek ödeme akışı + ortak TAMI altyapısı (`client`, `hash`, purchase callback yolu).
  TAMI client'ta `preAuth3ds` / `cancel` metodları kalır (paylaşılan yetenek; silmek testleri kırar,
  YAGNI dışı).
- `src/lib/billing/lifecycle.ts` purge (`sweepUnverifiedRegistrations` /
  `shouldPurgeUnverifiedWorkshop`): `pending` + `trialStartedAt: null` mantığı aynen çalışır.
  `liveVerificationTxnCount` guard'ı artık hep 0 döner (kart txn üretilmiyor) — zararsız,
  bu turda dokunulmuyor.
- `src/lib/billing/verify-token.ts` mantığı (yalnız TTL 24s→48s ve doküman yorumu "e-posta
  doğrulama" olarak güncellenir; fonksiyon/dosya adları korunur — geniş import değişikliğinden kaçınmak için).

## Veri modeli

**Şema değişikliği YOK.** `verify-token.ts` stateless imzalı token; doğrulama durumu
`Workshop.approvalStatus` (`pending` → `approved`) + `trialStartedAt` üzerinden okunur
(bugünkü ile aynı). Migrasyon gerektirmez.

## Güvenlik / değişmezler

- Aktivasyon `activateVerifiedWorkshop` claim-guard'ı ile idempotent (pending→approved
  yalnız bir kez yan-etki üretir); tekrar tıklama / prefetch replay güvenli.
- `resend-verification` ve verify-email `workshopId`'yi **token/session'dan** türetir,
  client param'a güvenmez ([[server-action-tenant-isolation]]).
- Oturum yalnız e-posta doğrulandıktan (linke tıklandıktan) sonra açılır — register anında
  değil. Böylece doğrulanmamış hesap uygulamaya erişemez (plan gate + oturumsuzluk çift bariyer).
- verify-token HMAC secret'i SESSION_SECRET (oturum katmanı ile aynı) — prod'da sabit kalmalı
  ([[deploy-chunk-resilience]] SESSION_SECRET notu).

## Rollout / migrasyon riski

- Prod şu an kart-doğrulamalı. Deploy anındaki "in-flight" bir kart doğrulaması aktive
  olmayabilir; kullanıcı e-posta akışıyla yeniden başlar. Küçük, kabul edilebilir pencere.
- `TRIAL_PURGE_CUTOFF` env'i prod-merge'de yine gerekli (mevcut purge kuralı korunuyor).
- `APP_URL` prod .env.production'da dolu olmalı — doğrulama linki ve e-posta logo URL'i
  bundan beslenir (unset → localhost) ([[email-logo-and-app-url]]). Resend prod'da aktif olmalı
  ([[approval-emails-gmail-shipped]]).

## Riskler (ürün)

- E-posta doğrulaması karttan **zayıf** bir kapı: throwaway e-postalarla çok sayıda deneme
  açılabilir. 48s purge + register rate-limit kısmen hafifletir. İleride e-posta domain
  kısıtı / hesap başına deneme limiti eklenebilir (bu turda kapsam dışı, ürün kararı).

## Test / QA

- **Birim:** `verify-token.test.ts` korunur (TTL güncellenirse assert'i güncelle). Yeni:
  verify-email route happy-path + geçersiz token; `activateVerifiedWorkshop` audit action adı;
  resend-verification tenant-izolasyon (başka workshop'u tetikleyememe).
- **Silinen testler:** kart verify initiate / `handleCardVerificationCallback` /
  `alertVerifyCancelFailureOnce` testleri kaldırılır veya güncellenir.
- **Manuel QA:** kaydol → doğrulama e-postası geldi mi → linke tıkla → otomatik giriş +
  trial başladı mı (7 gün) → welcome e-postası tek sefer mi → linke 2. kez tıkla (idempotent,
  yine girer) → süresi dolmuş token → `/login?verify=invalid` → /login'den gir (pending
  kullanıcı) → kilit ekranı "tekrar gönder" çalışıyor mu → `/satin-al` gerçek ödeme
  etkilenmedi mi.

## Kapsam dışı (YAGNI)

- E-posta domain kısıtı / deneme başına limit.
- `verify-token.ts` / `verify-activation.ts` dosya-fonksiyon yeniden adlandırması (yalnız
  yorum/audit-string güncellenir).
- `lifecycle.ts` purge'ünden `liveVerificationTxnCount` guard'ının çıkarılması (zararsız, kalıyor).
- TAMI client `preAuth3ds`/`cancel` metotlarının silinmesi.
