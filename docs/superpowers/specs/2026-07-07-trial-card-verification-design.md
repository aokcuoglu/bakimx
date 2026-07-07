# Kayıtta kart doğrulama — 1 TL 3D'li ön provizyon (tasarım)

Tarih: 2026-07-07 · Durum: kullanıcı onayı bekliyor · Branch: feat/trial-card-verification

## Amaç
Ücretsiz 7 günlük denemeyi başlatmadan önce kullanıcının kredi kartını 1 TL'lik **3D Secure'lu
ön otorizasyon** ile doğrulamak (kart gerçek mi + sahibi mi), provizyonu **anında iptal** etmek.
Sahte/spam kayıtları sıfırlar; kart bilgisi saklanmaz (TAMI'de recurring yok — bkz. tami-payment-integration).

## Onaylanmış kararlar (2026-07-07)
1. Kart adımı /register akışının İÇİNDE — kart doğrulanmadan hesap kullanılamaz.
2. 3D'li ön otorizasyon (`/payment/pre-auth` + aynı `/payment/complete-3ds`).
3. Provizyon başarı sonrası TAMI İptal (`/payment/reverse`) ile anında serbest bırakılır;
   iptal başarısız olursa founder alert (bloke 7-9 günde kendiliğinden düşer).
4. Tutar sabit sunucuda: 100 kuruş (1 TL).

## Akış
```
/register (form) ──POST──▶ workshop+user yaratılır: approvalStatus="pending"
                            (pending'in YENİ anlamı: kart doğrulaması bekleniyor)
        │  aynı sayfada kart adımına geçilir (reference token ile)
        ▼
Kart formu ──native POST──▶ /api/payments/tami/verify/initiate
        │                     PaymentTransaction(purpose=card_verification, initiated)
        │                     tami.preAuth3ds(amount=1) → base64 3DS HTML (tam sayfa)
        ▼
Banka 3DS (SMS) ──POST──▶ /api/payments/tami/callback   ◀── TEK callback URL (portal whitelist)
        │                     hash doğrula → tek-yönlü claim → purpose'a göre dallan:
        │                     card_verification: complete-3ds → HEMEN reverse →
        │                     workshop: approved+trialing+trialEndsAt=now+7g → welcomeTrialEmail
        ▼
303 → /payment/result?ref=…  purpose'a duyarlı: "Kartınız doğrulandı, deneme başladı → Giriş yap"
```

## Bileşenler
- **Şema (tek migration):** `PaymentTransaction.billingOrderId` nullable + yeni
  `purpose` enum kolonu (`purchase` default | `card_verification`) + `workshopId` üzerinden
  doğrulama denemeleri; app-level değişmez: purchase ⇒ billingOrderId dolu.
  Doğrulama referansı: `reference` benzeri kısa token — BillingOrder olmadığından
  PaymentTransaction.providerOrderId üzerinden; sonuç sayfası/`retry` için workshop'a bağlı
  kısa canlı imzalı token ya da providerOrderId query'si (plan detaylandırır; sonuç yine DB'den okunur).
- **TAMI istemcisi:** `preAuth3ds()` eklenir; `reverse()` zaten var. Mock'a pre-auth benzeri
  sahte 3DS + reverse başarısı eklenir (yerel akış uçtan uca).
- **Register akışı:** register route pending yaratır (dünkü "anında approved" kalkar);
  onay+trial başlatma callback'in verification dalına taşınır. Aynı e-postayla ikinci deneme:
  doğrulanmamış pending kayıtsa hata yerine kart adımına devam. PlanLocked'ın `pending` ekranı
  "Kartınızı doğrulayın" CTA'sına döner (yarım kalan kayıtların girişten kurtarma yolu).
- **Cron süpürme (mevcut /api/cron/billing'e eklenir):** 48 saatten eski pending+doğrulamasız
  workshop+user silinir (e-posta yeniden kullanılabilir olur).
- **Admin:** doğrulama denemeleri mevcut PaymentTransaction panelinde purpose rozetiyle görünür.

## SANDBOX SONDA BULGULARI (2026-07-07 — gerçek wire şeması, doküman eksik/yanlıştı)
Resmi Node.js örneğinden + canlı denemelerden doğrulandı; **mevcut satış akışının istek
gövdesi de buna göre düzeltilmeli** (mock her şeyi kabul ettiği için fark yakalanmamıştı):
- `amount` SAYI (string "1.00" DEĞİL); `motoInd: false`, `paymentChannel: "WEB"`,
  `paymentGroup` ZORUNLU.
- `basket.basketItems[]`: `itemId`, `name`, `itemType` ("VIRTUAL"|"PHYSICAL"), `category`,
  `subCategory`, `numberOfProducts`, `unitPrice`, `totalPrice` (test edilen: toplam = amount).
- `buyer` genişletilmiş: identityNumber (sayı), city/country/zipCode, registrationAddress,
  lastLoginDate/registrationDate (ISO, ms'li, Z'siz).
- `billingAddress/shippingAddress`: contactName, companyName, district, phoneNumber dahil.
- Kimlik + HS512 JWS yığınımız gerçek sunucuda GEÇTİ (yanlış anahtar → 4046
  `validation.invalid_security_hash`; bizim anahtarlarda bu hata yok).
- Merchant 77006956 şu an tüm kartlarda **9050** veriyor (dokümante değil; terminal/simülatör
  aktivasyonu şüphesi) → sandbox uçtan uca test, çalışan merchant creds'ine bağlı (aşağıda).
- Doküman test kartlarının bir kısmının SKT'si geçmiş (5549… 12/25); geçerliler: 5406697543211173
  04/27 CVV 423 (Garanti), 4938… 12/29, 4155… 01/50, 4543… 09/27, 5127… 01/35.
- TAMI resmi örnek zip'indeki 77006950 JWK'sı eski (4046 veriyor) — JWK'lar portaldan güncel alınmalı.

### CANLI DOĞRULAMA TURU 2 (77006950 güncel JWK ile — HEPSİ GEÇTİ)
- `/payment/auth` VE `/payment/pre-auth` 3DS initiation → success:true + threeDSHtmlContent ✓
- GERÇEK banka callback'i yakalandı (yerel dinleyici): alanlar callbackStatus, success,
  systemTime (nanosaniyeli ISO), orderId, cardBrand (banka adı!), cardOrganization
  (MASTERCARD), cardType, maskedNumber ("54066975****73" — 8+4 maskeleme), installmentCount,
  currencyCode, txnAmount, mdStatus, mdErrorMessage, hashedData, callbackUrl, `hashParams`
  (bankanın kendisi hash girdi sırasını söylüyor:
  cardOrganization+cardBrand+cardType+maskedNumber+installmentCount+currencyCode+txnAmount+orderId+systemTime+success).
- **verifyCallbackHash GERÇEK payload'da TRUE** — HMAC formülümüz birebir doğru ✓
- ⚠️ KRİTİK DÜZELTME: `txnAmount` telde **"1"** gelir ("1.00" değil) → callback route'taki
  amount_mismatch karşılaştırması exact-string yerine SAYISAL eşdeğerlik (kuruşa çevirip
  karşılaştır) olmalı; mevcut hâliyle her gerçek ödemeyi yanlış reddederdi. Mock da "1"
  formatını taklit etmeli.
- AÇIK KONU: banka simülatörlerinin 3DS OTP kodu dokümante değil (Garanti kartında 3DS
  telefonu tanımsız; İş Bankası sim 6 haneli OTP istiyor, 147852/123456 değil) → mdStatus=1
  + complete-3ds + reverse canlı testi bu OTP öğrenilene dek açık; TAMI destek'e sorulacak.
  Mekanizma satış akışıyla aynı olduğundan geliştirmeyi BLOKLAMAZ.

## Hata yönetimi
- 3DS başarısız / kart red → txn failed + sonuç sayfasında Türkçe hata + aynı kayıtla tekrar dene.
- complete başarılı ama reverse başarısız → doğrulama YİNE BAŞARILI sayılır (kart doğrulandı),
  founder alert atılır ("1 TL bloke elle düşürülmeli/kendiliğinden düşer"), txn'e not.
- complete başarısız → failed; workshop pending kalır, tekrar deneyebilir.
- Rate limit: verify/initiate IP başına (register limitiyle uyumlu).

## Test
- Unit: purpose dallanması, pending→approved geçişi, süpürme filtresi, yeni istek şeması
  serileştirmesi (resmi örnek payload'ı fixture).
- Mock ile uçtan uca yerel QA (Playwright): register → kart → sahte 3DS → onay → giriş.
- Sandbox: çalışan merchant creds ile gerçek 3DS (SMS ekranı) + reverse'ün ekstreden düştüğünün
  portal üzerinden kontrolü. Go-live checklist'e "pre-auth + reverse sandbox testi" eklenir.

## Kapsam dışı
Kart saklama; /satin-al satın alma akışına dokunma; fraud skorlama; deneme süresi değişikliği.
