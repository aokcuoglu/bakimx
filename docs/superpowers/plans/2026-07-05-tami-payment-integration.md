# TAMI Ödeme Entegrasyonu — Uçtan Uca Proje Planı

## Bağlam

BakımX bugün yalnızca **havale/EFT + admin onayı** ile satılıyor: kullanıcı sipariş oluşturuyor, admin ödemeyi görüp `confirmBillingOrder` ile aktive ediyor. Hedef: müşteri **kredi kartıyla 3 paketten birini seçip self-serve üye olsun**, deneme süresi **15 → 7 gün** insin, süre biterken **e-posta + UI uyarıları** çıksın.

**Belirleyici kısıt (TAMI dokümanından doğrulandı):** TAMI'nin API kataloğunda kart saklama/tekrarlayan ödeme YOK (kart saklama yalnızca Masterpass'li hosted sayfada). Bu yüzden model **manuel yenilemeli ön ödemeli dönem**: müşteri ay/yıl peşin öder (3DS), dönem bitmeden uyarılarla yenilemeye yönlendirilir, yenilemede kartı tekrar girer.

**Onaylanan ürün kararları:**
1. Manuel yenileme modeli (recurring yok)
2. Aylık + yıllık dönem (katalogda zaten var: starter ₺749, pro ₺1.299, premium ₺2.199/ay; yıllık = 10× aylık)
3. **Admin onayı tamamen kalkıyor** — kayıt anında 7 gün deneme, kartla ödeyen anında aktif (admin'e kill-switch kalır)
4. Deneme bitince **salt-okunur kilit** (veri görünür, yazma kapalı) + T-3/T-1/T-0 e-posta + kalıcı banner

**Kod tabanı hazır durumda (keşifle doğrulandı):**
- `src/lib/billing/provider.ts` — `PaymentProvider` seam'i zaten kart sağlayıcıyı bekliyor
- `BillingOrder.method` enum'unda `card` değeri hazır ama kullanılmıyor
- `confirmBillingOrder` (src/app/admin/actions.ts:194) — claim-guard'lı aktivasyon transaction'ı; webhook yolu bunu paylaşacak
- `getPlanState` (src/lib/plan.ts:91) — lazy erişim kapısı; `(app)/layout.tsx`'te deneme/abonelik banner'ları ZATEN var
- Cron deseni (`/api/cron/reminders` + `recordCronRun`), e-posta altyapısı (`sendSystemEmail` + `renderEmailLayout` + `CommunicationLog`) mevcut

## TAMI API özeti (dev.tami.com.tr)

- 3DS akışı: `POST /payment/auth` (callbackUrl zorunlu) → yanıttaki base64 HTML render edilir (banka 3DS ekranı) → banka `callbackUrl`'e POST atar (`mdStatus=1` başarı, `hashedData` HMAC-SHA256 doğrulaması) → **`POST /payment/complete-3ds` çağrılmadan para çekilmez**
- Kimlik: `PG-Auth-Token: merchant:terminal:Base64(SHA256(merchant+terminal+secret))` + istek başına `CorrelationId`
- `securityHash` body alanı: istek JSON'u üzerinde **HS512 JWS** (JWK `{kty:oct, kid, k}`) → `jose` paketi (yeni dependency)
- Sandbox: `sandbox-paymentapi.tami.com.tr`, portal `sandbox-portal.tami.com.tr`, test kartları `/test-kartlari`, hata kodları `/hata-kodlari`
- İptal/iade/işlem-sorgulama endpoint'leri mevcut (admin fazında)
- PCI: kart verisi bizim sunucudan geçiyor (direct API) — **PAN/CVV asla loglanmaz/saklanmaz**

## Fazlar (her biri bağımsız ship'lenebilir, ayrı commit/PR)

### Faz 1 — Onay kaldırma + 7 günlük anında deneme (TAMI'siz, önce bu)
- `src/lib/plan.ts:26` → `TRIAL_DAYS = 7` (+ dosya doc yorumu güncelle)
- `src/app/api/auth/register/route.ts` → workshop `approved` + `trialing` + `trialStartedAt/trialEndsAt=now+7g`; `PENDING_MESSAGE` yerine "Hesabınız hazır — 7 günlük deneme başladı"; `applicationReceivedEmail` yerine yeni `welcomeTrialEmail`; `newApplicationAdminEmail` "yeni kayıt" bildirimi olarak kalır (founder görünürlüğü)
- `src/app/api/checkout/route.ts` (public /satin-al) → aynı: anında `approved` + deneme; ödeme yarıda kalsa bile giriş yapabilir. Kart başarısı sonra `active`'e çevirir (tek state machine, "ödedi ama deneme yok" dalı yok)
- `src/app/admin/actions.ts` → `approveWorkshop` legacy pending satırlar + un-reject için kalır; `rejectWorkshop` kill-switch (login'i zaten blokluyor); admin UI'da onay kuyruğu → "yeni kayıtlar" listesi
- Tek seferlik: mevcut `pending` workshoplar için onay+deneme başlatma (az satır; admin'den elle de olur)
- Copy taraması: `grep -r "15 gün\|onay\|başvuru"` (landing, register, login, e-postalar)
- Abuse: register'da 5/10dk IP rate-limit zaten var; takip işi olarak normalize-email dedup + günlük kayıt founder-alert
- **Not:** "approval-gated by design" hafıza kararını kullanıcı bilinçli olarak tersine çevirdi (2026-07-05)

### Faz 2 — TAMI istemci kütüphanesi (`src/lib/tami/`)
Mock-first desen (OCR/TecDoc gibi: env yoksa mock). Yeni dosyalar:
- `config.ts` — `TAMI_ENV` (sandbox|production), merchant/terminal/secret/JWK env'leri, `isTamiConfigured()`
- `hash.ts` — `buildAuthToken()` (SHA-256, node crypto), `signSecurityHash(body)` (HS512 JWS, `jose`), `verifyCallbackHash(payload)` ("cardOrg+cardBrand+cardType+maskedNumber+installmentCount+currency+originalAmount+orderID+systemTime+status" HMAC-SHA256, `timingSafeEqual`)
- `types.ts`, `errors.ts` (hata kodu → Türkçe mesaj haritası; log serileştirmede `card` alanı her zaman strip)
- `client.ts` — fetch wrapper (PG-Auth-Token + CorrelationId + 30s timeout): `auth3ds()`, `complete3ds()`, `cancel()`, `refund()`, `queryTransaction()`
- `mock.ts` — sahte 3DS formu döner, test kart numarasına göre başarı/başarısızlık callback'i POST'lar
- Testler: `hash.test.ts` (doküman örneklerine karşı), `client.test.ts`
- Dependency: `bun add jose`

### Faz 3 — Şema: `PaymentTransaction` modeli
Yeni model (BillingOrder'a kolon değil — bir sipariş birden çok deneme alabilir, callback idempotency deneme-başına unique key ister):
- `billingOrderId`, `workshopId` (denormalize, tenant-scoped admin sorguları), `provider="tami"`, `providerOrderId @unique` (TAMI orderId, 2-36 kar.), `status` enum (`initiated|callback_received|completed|failed|expired`), `amountMinor`, `maskedPan?`, `cardBrand?`, `errorCode/Message?`, `correlationId?`, `callbackPayload Json?` (sanitize), `createdAt/completedAt`
- Idempotency: callback `updateMany({where: {providerOrderId, status in [initiated, callback_received]}})` claim — replay count=0 → 200, yan etkisiz
- **Saklanmaz:** PAN, CVV, son kullanma, kart sahibi adı
- Migration: additive, `prisma migrate dev` → deploy'da otomatik `migrate deploy`; mevcut satırlara etki sıfır

### Faz 4 — Sunucu ödeme akışı + ortak aktivasyon
1. **Önce refactor (ayrı commit):** `src/lib/billing/activate.ts` → `activateBillingOrder(orderId, {actor, confirmedByEmail})` — `confirmBillingOrder`'daki transaction aynen taşınır (claim guard, `periodStartFrom`/`addPeriod`, workshop→active). Admin action ince wrapper olur. Yenileme "kalan gün kaybı yok" mantığı kart yenilemesine bedavaya gelir.
2. `src/app/api/payments/tami/initiate/route.ts` — **native HTML form POST** (fetch değil): `reference` + kart alanları. Sunucu: IP rate-limit; siparişi `reference`'tan yükler (`pending_payment`); session varsa workshop eşleşmesi doğrulanır; **tutar HER ZAMAN `order.amountMinor`'dan**; `PaymentTransaction(initiated)` yaratır; `tami.auth3ds()` (callbackUrl = `${APP_URL}/api/payments/tami/callback`); base64 HTML decode edilip `text/html` yanıt → **tam sayfa navigasyon** (iframe değil: banka ACS sayfaları frame-bust yapar, mobil-güvenli varsayılan)
3. `src/app/api/payments/tami/callback/route.ts` — bankadan public POST: form parse → `verifyCallbackHash` (uymazsa 400) → idempotent claim → `mdStatus===1` ise `complete3ds()` → başarıda `completed` + `activateBillingOrder(actor:"payment")` + makbuz e-postası; sonra her durumda 302 → `/payment/result?ref=...` (sonuç sayfası gerçeği DB'den okur, query param'dan değil — sahte başarı ekranı engellenir). Middleware/CSRF muafiyeti gerekir (harici POST)
4. Başarısız/yarıda kalan: sipariş `pending_payment` kalır (retry = aynı sipariş, yeni PaymentTransaction); cron 2 saatten eski `initiated`'ları `expired`, 7 günden eski kartlı `pending_payment` siparişleri `cancelled` yapar
5. **Kritik risk:** complete-3ds başarılı ama bizim aktivasyon tx patlar → para çekilmiş, `callback_received`'da takılı → founder alert + cron işaretler, admin'den `activateBillingOrder` retry

### Faz 5 — Checkout UX (kart adımı, 3DS, sonuç sayfası)
- `src/components/billing/purchase-wizard.tsx` — Özet adımına ödeme yöntemi seçici (**Kart | Havale/EFT**, h-9). Havale → mevcut DonePanel aynen. Kart → sipariş yaratıldıktan sonra (`method:"card"` ile) yeni `CardPaymentPanel`
- Yeni `src/components/billing/card-payment-panel.tsx` — mobile-first kart formu (Luhn + brand ipucu, `inputMode="numeric"`, `autocomplete="cc-*"`); **native `<form method="POST" action="/api/payments/tami/initiate">`** + hidden `reference`; BrandSpinner. Kart alanları asla JSON API'lerimize gitmez
- Yeni `src/app/payment/result/page.tsx` — public ((app) kapısı dışında, /checkout gibi): siparişi + son transaction'ı `reference`'tan yükler; başarı (paket, dönem sonu, "Uygulamaya git") / hata (Türkçe mesaj, "Tekrar dene" + havale fallback); `callback_received`'da kısa poll
- `src/lib/validations/billing.ts` — şemalara opsiyonel `method` alanı; kart alanları yalnız panel-lokal zod'da
- `src/lib/billing/provider.ts` — `tamiCardProvider` eklenir (seam dürüst kalır)
- Her iki giriş noktası (public `/satin-al` → `/api/checkout`; in-app `/checkout`+`/billing` → `createBillingOrder`, prorated upgrade dahil) aynı kart paneline akar

### Faz 6 — Süre bitiminde salt-okunur kilit (TAMI'den bağımsız)
- `src/lib/plan.ts` — `PlanState.canWrite` (lockReason `trial_expired|subscription_expired|subscription_inactive` → false) + `assertWriteAccess(workshop)` (Türkçe mesajla `PlanWriteLockedError`)
- `src/lib/auth.ts` — `requireWritableWorkshop()` = `getCurrentUserWithWorkshop()` + `assertWriteAccess`; **~28 `"use server"` dosyasında** mutasyon action'ları ilk satırını buna çevirir (mekanik grep taraması; salt-okunurun dürüst maliyeti). Muaf: `billing/actions.ts` (satın alma!) + ödeme route'ları
- `src/app/(app)/layout.tsx` — bu üç lockReason'da tam ekran `PlanLocked` yerine children + kalıcı kırmızı banner (CTA → /checkout); `pending|rejected` için PlanLocked kalır. Ana CTA'lar (örn. "Yeni İş Emri") `canWrite=false`'ta disabled
- Mutasyon yapan API route'ları da `assertWriteAccess` → 403 `plan_locked`
- Dürüst risk: gözden kaçan action yazmaya devam eder — MVP için kabul edilebilir (UI giriş noktaları zaten gizli); takip: lint kuralı

### Faz 7 — Yaşam döngüsü e-postaları + `/api/cron/billing`
- `src/lib/emails/system-emails.ts` — yeni şablonlar (`renderEmailLayout` ile): `trialExpiryWarningEmail` (T-3/T-1/T-0), `subscriptionExpiryWarningEmail` (T-7/T-3/T-1/T-0), `paymentReceiptEmail` (receipt.ts verisi), `paymentFailedEmail`
- **Dedup:** `CommunicationLog`'da workshopId + dönem-kapsamlı `templateKey` sorgusu (örn. `sub_expiry_t3:2026-08-01` — periodEnd gömülü, yenilemede doğal reset). Şema değişikliği yok
- Yeni `src/app/api/cron/billing/route.ts` (reminders klonu: Bearer CRON_SECRET + `recordCronRun({job:"billing"})`); iş mantığı `src/lib/billing/lifecycle.ts`: (a) deneme uyarıları, (b) abonelik uyarıları, (c) eski `initiated` → `expired`, (d) 7g+ kartlı pending iptal, (e) takılı `callback_received` → founder alert
- DEPLOY.md §7: `0 8 * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://app.bakimx.com/api/cron/billing` (günlük 08:00)
- Banner'lar: `(app)/layout.tsx`'teki mevcut banner'lar eşiklere göre genişletilir, CTA /checkout

### Faz 8 — Admin & ops
- Admin billing paneli: `method` rozeti (kart/havale), sipariş başına PaymentTransaction listesi (status, maskedPan, brand, errorCode, **correlationId** — TAMI destek talepleri için şart)
- Kartlı siparişte `confirmedByEmail = "tami"` ("otomatik" kaynağı)
- **İade/iptal: faz-2** — go-live'da TAMI portalından manuel iade + lokal `cancelBillingOrder`; admin butonları (`tami.cancel()/refund()`) sonra
- Founder alert (mevcut debounce deseni): aktivasyon uyuşmazlığı, callback hash hatası (olası kurcalama), ardışık gateway hataları

### Faz 9 — Env & dokümantasyon
```
# TAMI sanal POS (boş = mock, yerel geliştirme)
TAMI_ENV="sandbox"
TAMI_MERCHANT_NUMBER=""
TAMI_TERMINAL_NUMBER=""
TAMI_SECRET_KEY=""
TAMI_JWK_KID=""
TAMI_JWK_KEY=""
```
- callbackUrl mevcut `APP_URL`'den türetilir (yeni URL env yok — staging/prod APP_URL zaten dolu olmalı)
- DEPLOY.md: TAMI creds bölümü, TAMI portalında callback URL whitelist, crontab satırı, go-live checklist

### Faz 10 — Test & QA
- **Unit:** hash/JWS/HMAC (doküman örnekleri), lifecycle dedup, `activate.ts` idempotency + dönem matematiği, sahte/replay callback
- **Entegrasyon (sandbox):** dokümandaki sandbox merchant creds + test kartları; gerçek callback payload'ı yakalanıp parser ona göre sertleştirilir
- **Manuel QA:** (1) kayıt → anında giriş + 7 gün banner; (2) /satin-al mobilde tam 3DS; (3) in-app upgrade prorated tutar; (4) erken yenileme dönem uzatması; (5) başarısız ödeme → aynı siparişte retry; (6) deneme bitişi → salt-okunur → satın al → kilit açılır; (7) callback replay → tek aktivasyon; (8) havale regresyonu
- **Rollout:** staging'e sandbox creds → prod creds ile gerçek kart smoke test + portal'dan anında iade → `TAMI_ENV=production` en son

## Sıralama
P1 onay kaldırma → P2 tami lib → P3 migration → P4a activate.ts refactor → P4b initiate/callback → P5 UX → P6 salt-okunur → P7 cron/e-posta → P8 admin → P9 docs. (P1 ve P6 TAMI'den bağımsız; P1 hemen ship'lenebilir.)

## Riskler
- **Para çekildi, aktivasyon yok** (P4 madde 5) — founder alert + admin retry ile karşılanır
- TAMI callback gövde şekli dokümanla birebir olmayabilir — sandbox'ta gerçek payload görülmeden parser sertleştirilmez
- Salt-okunur kilitte gözden kaçan write action — kabul edilmiş MVP riski, lint takibi
- PCI kapsamı: kart verisi sunucudan geçiyor (SAQ D bölgesi) — loglama disiplini + HTTPS zorunlu; ileride Ortak Ödeme sayfasına geçiş kapsamı düşürür
- "15 gün" copy'si dağınık — grep taraması şart
- Gerçek merchant hesabı: prod creds için TAMI başvurusu/onboarding gerekir (dış bağımlılık, geliştirmeye paralel yürütülmeli)
