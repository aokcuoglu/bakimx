# Transactional Approval E-postaları (Gmail SMTP) — Tasarım

**Tarih:** 2026-06-25
**Dal:** `feat/transactional-approval-emails`
**Durum:** Onaylandı (tasarım) → uygulama planı bekleniyor

## Amaç

Kayıt (register) → admin onayı yaşam döngüsündeki e-posta boşluklarını kapatmak.
Bugün register formu "e-posta ile bilgilendirileceksiniz" diyor ama **hiçbir mail
gönderilmiyor**. Bu çalışma 4 transactional e-postayı, `hey@bakimx.com`
(Google Workspace) üzerinden **Gmail SMTP** ile devreye alır ve profesyonel,
markalı (blue/navy) HTML şablonları ekler.

## Kapsam (4 e-posta)

| # | Tetik | Alıcı | Amaç |
|---|-------|-------|------|
| 1 | `register` API başarılı | Başvuran (iş yeri sahibi) | "Başvurunuz alındı, onay bekleniyor" |
| 2 | `register` API başarılı | Admin (`ADMIN_EMAILS`) | "Yeni iş yeri başvurusu var, /admin'den onayla" |
| 3 | `approveWorkshop` | İş yeri sahibi | "Hesabınız onaylandı, 15 gün deneme başladı, giriş yapın" |
| 4 | `rejectWorkshop` | İş yeri sahibi | "Başvurunuz onaylanmadı" (kibar) |

**Kapsam dışı:** Müşterilere giden mevcut SMS/WhatsApp/e-posta akışları
(`sendCommunication`), OTP/intake onayı, pazarlama e-postaları.

## Kararlar (brainstorm sonucu)

- **Gönderim yöntemi:** Gmail SMTP + App Password (nodemailer). OAuth2 ve Resend
  alternatifleri elendi (OAuth = fazla kurulum; Resend = Gmail'den gitmiyor).
- **Mimari yaklaşım (A):** Mevcut `EmailProvider` soyutlamasına yeni bir Gmail
  provider eklenir; 4 mail müşteri-consent'li `sendCommunication()` yerine
  `sendEmailDirect()` üzerinden gider. Bunlar hesap-yaşam-döngüsü/transactional
  mailler; KVKK onayı kayıt anında alınıyor, ayrı consent gerekmez.

## Mimari

### Provider katmanı
- **Yeni:** `src/lib/communications/providers/gmail-provider.ts`
  - `EmailProvider` arayüzünü (`sendEmail(to, subject, htmlBody, textBody?)`)
    implemente eder, `ResendProvider`'ı aynalar (aynı `CommunicationResult`
    dönüşü, aynı hata yakalama).
  - `nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } })`.
  - Config eksikse (env yok) constructor anlamlı Türkçe hata fırlatır (ResendProvider
    deseni).
  - `from`: `"${EMAIL_FROM_NAME} <${GMAIL_USER}>"`.
- **Değişiklik:** `src/lib/communications/email/index.ts` factory'sine
  `case "gmail": _instance = new GmailProvider()` eklenir.

### Sunum katmanı (yeni klasör `src/lib/emails/`)
- `layout.ts` — `renderEmailLayout({ heading, bodyHtml, cta?, footerNote? })`:
  tablo-tabanlı, inline-CSS, mobil-uyumlu markalı HTML iskelet + plain-text üretimi.
  Marka: navy başlık (#0b1f3a / #1e3a8a), mavi CTA butonu, gri footer.
  Görsel bağımlılığı yok (logo = metin wordmark; opsiyonel hosted logo URL'i env'den).
- `system-emails.ts` — her biri `{ subject, html, text }` döndüren 4 tipli fonksiyon:
  - `workshopApprovedEmail({ firstName, workshopName, loginUrl })`
  - `workshopRejectedEmail({ firstName, workshopName })`
  - `applicationReceivedEmail({ firstName, workshopName })`
  - `newApplicationAdminEmail({ workshopName, ownerName, email, phone, city, adminUrl })`
- `send-system-email.ts` — ince sarmalayıcı
  `sendSystemEmail({ to, subject, html, text, workshopId, templateKey })`:
  - `sendEmailDirect()` çağırır.
  - Sonucu `CommunicationLog`'a yazar (`type: "email"`, `workshopId` her zaman elimizde).
  - **Hata fırlatmaz** — `{ ok, error? }` döner. Çağıran taraf best-effort kullanır.

### Tetik entegrasyonu
- `src/app/api/auth/register/route.ts`: workshop + owner user oluştuktan sonra,
  `try/catch` içinde `applicationReceivedEmail` (başvurana) + `newApplicationAdminEmail`
  (her `ADMIN_EMAILS` adresine). Mail hatası kayıt akışını **bozmaz**.
- `src/app/admin/actions.ts` `approveWorkshop`: `prisma.workshop.update` sonrası owner
  user'ın `email` + `firstName`'ini çek (yoksa workshop.email fallback), `loginUrl =
  ${APP_BASE_URL}/login` ile `workshopApprovedEmail`. Best-effort.
- `src/app/admin/actions.ts` `rejectWorkshop`: aynı şekilde `workshopRejectedEmail`. Best-effort.

## Veri / sorgular

- Owner alıcı bilgisi: `approve`/`reject` sadece `workshopId` alıyor; owner `User`
  (`role: "owner"`) `email`+`firstName` ayrı sorgu ile çekilir. Tenant izolasyonu:
  sorgu `workshopId` ile sınırlı.
- Admin alıcıları: mevcut `getAdminEmails()` (`ADMIN_EMAILS` env) yeniden kullanılır.
- Yeni şema değişikliği **yok** (migration gerekmez). `CommunicationLog` mevcut
  alanlarıyla yeterli (`workshopId`, `type`, `provider`, `recipient`, `status`,
  `templateKey`, `entityType`, `entityId`, `errorMessage`, `providerId`).

## Şablon görünümü

Tüm 4 mail tek paylaşılan layout; yalnız başlık/gövde/CTA değişir.

```
┌───────────────────────────────────────────┐
│  ⚙  BakimX                 ← navy başlık   │
├───────────────────────────────────────────┤
│  Merhaba {Ad},                             │
│  {Ana mesaj}                               │
│   ┌──────────────────────┐                 │
│   │   {CTA}  →            │  ← mavi buton  │
│   └──────────────────────┘                 │
│  {İkincil bilgi}                           │
├───────────────────────────────────────────┤
│  BakimX · Oto Servis Yönetim Sistemi       │
│  hey@bakimx.com · bakimx.com               │
└───────────────────────────────────────────┘
```

Mail bazında CTA:
- Onay maili → "Giriş Yap" → `APP_BASE_URL/login`
- Red maili → CTA yok (sadece destek/iletişim notu)
- Başvuru alındı → CTA yok (bilgilendirme)
- Admin bildirimi → "Başvuruyu incele" → `APP_BASE_URL/admin`; gövdede başvuran
  bilgileri (iş yeri, ad, e-posta, telefon, şehir).

## Konfigürasyon (env)

`.env.example` ve `.env.production.example`'a eklenir (değerler kullanıcıya ait):

```
EMAIL_PROVIDER=gmail
GMAIL_USER=hey@bakimx.com
GMAIL_APP_PASSWORD=                    # Google App Password (16 hane), boşluksuz
EMAIL_FROM_NAME=BakimX
APP_BASE_URL=https://app.bakimx.com    # login/admin link tabanı; mevcut bir base-url env'i varsa o kullanılır
```

Yeni bağımlılık: `nodemailer` + `@types/nodemailer` (dev). Saf JS, native derleme
yok → Alpine Docker prod build'ini riske atmaz (bkz. jscanify/opencv notu).

## Kullanıcının yapacağı dış adımlar (kodla yapılamaz)

1. Google hesabında **2-Step Verification** aç → **App Password** üret
   (`hey@bakimx.com`) → `GMAIL_APP_PASSWORD`.
2. bakimx.com DNS deliverability: **SPF** (`include:_spf.google.com`),
   Workspace Admin'den **DKIM**, opsiyonel **DMARC**. (Yoksa mailler spam'e düşebilir.)
3. VPS/Docker'da giden **465/587** portu açık olmalı.

## Hata yönetimi

- Tüm mail çağrıları **best-effort**: hata register/approve/reject ana işlemini
  bozmaz; `CommunicationLog`'a `status: "failed"` + mesaj yazılır.
- Mock provider (geliştirme/test): gerçek gönderim yapmaz, sadece metadata loglar
  (gövde loglanmaz — mevcut güvenlik notu korunur).
- `GmailProvider` config eksikse anlamlı hata; üretimde env zorunlu.

## Test

- Birim: `gmail-provider` (transport çağrısı mock'lanmış), `system-emails`
  (subject/html/text üretimi snapshot/içerik kontrolü), `send-system-email`
  (best-effort dönüş + log yazımı). Mevcut `bun test` altyapısı.
- Manuel QA:
  1. `EMAIL_PROVIDER=mock` ile register → log'da 2 mail kaydı.
  2. Gerçek App Password ile kendi adresine register → approve → reject turu;
     gelen kutusu + spam kontrolü, mobil görünüm.

## Riskler

- **Deliverability:** SPF/DKIM ayarlanmazsa spam riski (kullanıcı görevi).
- **Gmail gönderim limiti:** Workspace ~2.000/gün; onay hacmi için fazlasıyla yeterli.
- **Port engeli:** VPS giden SMTP portu kapalıysa gönderim sessizce başarısız
  (loglanır, ana akış bozulmaz).
- **App Password sırrı:** uzun ömürlü secret; `.env`'de tutulur, repoya girmez.

## Dosya özeti

**Yeni:** `gmail-provider.ts`, `src/lib/emails/{layout,system-emails,send-system-email}.ts`,
ilgili testler.
**Değişiklik:** `email/index.ts` (factory), `api/auth/register/route.ts`,
`admin/actions.ts`, `.env.example` (+ production example), `package.json` (nodemailer).
**Migration:** yok.
