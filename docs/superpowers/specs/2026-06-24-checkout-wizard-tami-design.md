# BakımX — Satın Alma Wizard Redesign + Tami Ödeme (v1) — Tasarım

- **Tarih:** 2026-06-24
- **Durum:** Tasarım onaylandı (mockup'larla) — uygulama planı bekliyor
- **Konum:** Faturalandırma v1'in ([[billing-purchase-flow-shipped]]) üstüne; "gerçek ödeme geçidi" adımı (önceden PaymentProvider seam + `BillingMethod.card` ile hazırlanmıştı)
- **Branch:** `feat/checkout-wizard-tami`

---

## 1. Amaç

Satın alma sihirbazını üç yönde yükseltmek:
1. **UX redesign** — `/fiyatlar → /satin-al` (ve uygulama içi `/billing/checkout`) sihirbazını profesyonel, Framer Motion'lu, değer-önerisini net gösteren bir akışa taşımak; "ince-uzun" formu düzeltmek; layout-shift bug'ını gidermek.
2. **Tami ödeme** — Step 3'te **gerçek kart ödemesi** (Tami), havale yanında.
3. **Admin evrimi** — talep/ödeme takip ekranını (zaten var) Tami'nin otomatik teyit akışına göre evirmek.

## 2. Alınan kararlar (mockup'larla onaylı)

| # | Karar | Seçim | Not |
|---|---|---|---|
| 1 | Wizard layout | **A — İki panel** (form + sabit değer paneli) | Mobilde değer paneli üste taşınır, form tek kolon |
| 2 | Tami modeli | **Hosted "Ortak Ödeme Sayfası"** (redirect) | Kart verisi bize HİÇ gelmez → **PCI hafif (SAQ-A)** |
| 3 | Ödeme yöntemi | **Kart (Tami) + Havale birlikte** | Step 3'te yöntem seçici |
| 4 | Aktivasyon | Başarılı kart ödemesi → **anında aktivasyon** | Ödeme = onay; 3DS güçlü kapı. Onay-kapısı gerçek ödeme için gevşer ([[register-is-approval-gated-by-design]]) |
| 5 | Admin | "Bekleyen" artık **havale-only** + yeni **"Son ödemeler"** akışı | Kart auto-confirm görünmez |

## 3. Mevcut durum (üzerine inşa)

- `src/components/billing/purchase-wizard.tsx` — 3 adımlı sihirbaz (react-hook-form + Zod), `mode: public|inapp`. `/satin-al` (public) + `/billing/checkout` (in-app).
- `src/lib/billing/provider.ts` — `PaymentProvider` arabirimi + `manualHavaleProvider` + `getHavaleInstructions`. **Tami burayı dolduracak.**
- `prisma/schema.prisma` — `BillingOrder` (status: pending_payment|confirmed|cancelled; method: havale|manual|**card**); `BillingMethod.card` zaten rezerve.
- `src/app/api/checkout/route.ts` (public) + `createBillingOrder` (in-app) — order + (public) workshop yaratır, pending_payment.
- `src/app/admin/admin-billing.tsx` — Bekleyen Ödemeler (Havale alındı/İptal) + Abonelikler + gelir.
- `confirmBillingOrder` (admin) — order'ı confirmed yapar + workshop active+period (idempotent updateMany).
- **`framer-motion@12.40` kurulu** (yeni dep gerekmez). `car-damage-illustration.tsx` inline-SVG illüstrasyon deseni var.

## 4. UX redesign (Faz A)

### 4.1 İki-panel layout
- `WizardLayout`: solda form paneli (~%60), sağda **`ValuePanel`** (~%40, sticky). Mobilde (`< md`) değer paneli forma **üstte** kompakt özet olarak iner, form tek kolon.
- Üstte progress (Adım N/3 + 3 segment).

### 4.2 Form (Adım 2)
- **2-kolon ızgara:** Ad/Soyad · E-posta/Şifre · Telefon/Şehir · Vergi-no/Vergi-dairesi yan yana; İş yeri adı, Adres, Fatura ünvanı tam genişlik. (in-app modda hesap alanları yok, sadece fatura bilgisi.)
- **Layout-shift fix:** `Field` bileşeninde validation mesajı için **sabit min-yükseklikli slot** (mesaj olsun/olmasın aynı yükseklik) → kayma yok.

### 4.3 ValuePanel
- Seçili paket özeti (ad + fiyat + KDV dahil + koltuk).
- Hafif **inline-SVG illüstrasyon** (araç/servis temalı, marka mavisi).
- "Bu pakette kazandıkların" — seçili paketin `plans-catalog` highlight'larından 4 madde (✓).
- Güven satırı: 🔒 Tami güvenli ödeme · ⚡ anında aktivasyon · ↩︎ iptal.
- Adım 3'te ValuePanel **sipariş özetine** dönüşür (paket/dönem/toplam prominent).

### 4.4 Framer Motion
- Adım geçişleri: `AnimatePresence` + slide/fade (yatay). Progress segment dolum animasyonu. Buton/seçim micro-interactions (hover/tap). **`prefers-reduced-motion` saygısı** (kapalıysa animasyon yok).

### 4.5 Bileşen yapısı
- `purchase-wizard.tsx` büyüyorsa böl: `WizardLayout`, `ValuePanel`, `StepPlan`, `StepAccount`, `StepPayment`, `Field` (slot'lu). Mobil-öncelikli, mevcut shadcn/ui + brand stili.

> Faz A **Tami'siz** çalışır: step 3 havale akışıyla kalır; UX + bug fix bağımsız teslim edilebilir.

## 5. Tami entegrasyonu (Faz B)

### 5.1 PaymentProvider seam genişler
`initiate` artık iki tip üretebilir:
- **havale** → `{ kind: "havale", reference, havale }` (mevcut).
- **redirect** → `{ kind: "redirect", url, reference }` (Tami hosted sayfa URL'i).
Ek: `verifyCallback(payload) → { reference, status: "paid"|"failed", providerRef }`.

### 5.2 `tamiProvider`
- **`createHostedPayment(order)`** (server): Tami token servisine `merchantNumber` + `terminalNumber` + **`securityHash`** (JWT, secret ile) + amount/orderId/currency/callbackUrl ile istek → **URL token** → Tami **Ortak Ödeme Sayfası** URL'i döner.
- Müşteri o URL'e **redirect** → kart/Masterpass'ı **Tami'de** girer → başarı/başarısızlık sonrası bizim **`callbackUrl`**'imize döner (Tami POST eder). Yanıt gelmezse **`tami/Query`** ile teyit.
- **`callback route`** (`/api/checkout/tami-callback` vb.): `securityHash`/imza doğrula + reference/amount cross-check → order `paid` veya `payment_failed`.
- Ortam/uçlar: sandbox `https://sandbox-paymentapi.tami.com.tr`, prod `https://paymentapi.tami.com.tr`. **Tam token endpoint + securityHash formülü uygulama sırasında `dev.tami.com.tr/tami-ortak-odeme-sayfasi`'ndan kesinleşir.**
- **Env (`.env`, commit edilmez; `.env.example`'a dokümante):** `TAMI_MERCHANT_NUMBER`, `TAMI_TERMINAL_NUMBER`, `TAMI_SECRET_KEY`, `TAMI_BASE_URL` (sandbox/prod), `TAMI_CALLBACK_URL`. **Demo:** dokümandaki public sandbox merchant/terminal/secret + test kartları ile uçtan uca test edilir; prod için kullanıcı gerçek değerleri sağlar.

### 5.3 Akışlar (kart)
- **Public:** `/api/checkout` → workshop(pending) + order(pending_payment, method=card) → `createHostedPayment` → redirect. **Callback success** → order confirmed + workshop **approved+active** (anında) → "Ödendi, hesabınız aktif → Giriş yap". **Callback fail** → order `payment_failed` → "Ödeme tamamlanmadı → Tekrar dene".
- **In-app:** `createBillingOrder` (order pending_payment, method=card) → redirect → callback success → mevcut **`confirmBillingOrder` mantığı callback'ten** (admin değil) → plan/period güncellenir.
- **Havale:** mevcut akış **aynen** (admin manuel teyit).

### 5.4 Idempotency & güvenlik
- Callback tekrarına karşı **status-guard** (order zaten confirmed ise no-op) — `confirmBillingOrder`'daki `updateMany({where:{status:"pending_payment"}})` deseni.
- Callback'te reference + amount + securityHash doğrulanır; sahte callback reddedilir.
- **PCI hafif:** kart verisi sunucumuza HİÇ gelmez. Tami secrets yalnız env'de.

## 6. Sipariş yaşam döngüsü & şema değişikliği

- `BillingOrderStatus`'a **`payment_failed`** ekle.
- `BillingOrder`'a **`tamiTransactionId String?`** (provider ref) + **`paidAt DateTime?`** ekle.
- Kart başarı: order `confirmed` + `paidAt` + `tamiTransactionId`; workshop `active`+period (+ public ise `approved`). Mevcut `confirmBillingOrder` çekirdek mantığı **paylaşılan bir helper'a** çıkarılıp hem admin (havale) hem callback (kart) çağırır.
- **Migration:** additive (1 yeni enum değeri + 2 nullable kolon). Dev DB drift nedeniyle **offline `prisma migrate diff`** ([[billing-purchase-flow-shipped]] yöntemi); prod `migrate deploy`.

## 7. Admin evrimi (Faz C)

- **"Bekleyen havale onayları":** yalnız `method=havale && status=pending_payment`. Kart auto-confirm → burada görünmez. ("Havale alındı/İptal" butonları kalır.)
- **"Son ödemeler" (yeni):** son N order (kart+havale) — yöntem (💳/🏛️) + durum (✓ Ödendi · ⏳ Teyit bekliyor · ✕ Başarısız) + tutar + tarih + **Tami referansı** + **makbuz** linki.
- **Stat:** + "Bekleyen havale" sayacı.

## 8. Başarı/başarısızlık ekranları (wizard)
- **Kart paid** → "Ödendi! Hesabınız aktif → Giriş yap" (anlık; Image #3'ten farklı).
- **Havale** → mevcut "Talebiniz alındı, ödeme teyit edilince" ekranı.
- **Kart failed/cancelled** → "Ödeme tamamlanmadı → Tekrar dene" (yeniden Öde).

## 9. Kapsam sınırları
- **Hosted page** (gömülü kart formu DEĞİL) — PCI hafif.
- **Tek-seferlik** kart ödemesi; **unattended recurring yok** (Masterpass hızlı tekrar-öde sağlar). Otomatik yenileme sonraki iş.
- **Demo/sandbox önce**; prod creds kullanıcı sağlar.
- e-Fatura yok (mevcut basit makbuz sürer).

## 10. Fazlar (uygulama planı önerisi)
- **Faz A — Wizard UX redesign + bug fix** (Tami'siz; havale akışı kalır). Bağımsız, hızlı, görünür kazanım.
- **Faz B — Tami entegrasyonu** (provider, hosted token, redirect, callback, lifecycle, şema).
- **Faz C — Admin evrimi.**
(A bağımsız; B+C bağlı. Her faz kendi planı/uygulaması olabilir.)

## 11. Riskler & QA
- **Tami sandbox uçtan uca:** token → redirect → Tami sayfası → callback → confirm; test kartları (başarı/başarısız/iptal/timeout).
- Callback güvenliği + idempotency + sahte-callback reddi.
- Migration additive; dev DB offline-diff.
- **Manuel QA:** public kart → anında aktif + makbuz; public havale → teyit bekler; in-app kart yükseltme → plan güncellenir; kart başarısız → tekrar dene; admin'de kart auto-confirm "Son ödemeler"de, havale "Bekleyen"de.

## 12. Açık varsayımlar
- Tami Ortak Ödeme Sayfası token endpoint + `securityHash` formülü uygulama sırasında `dev.tami.com.tr`'den kesinleşecek (tasarım/akış nettir; uç+imza implementasyon detayı).
- Fiyatlar **KDV dahil** (mevcut karar).
- Reduced-motion saygısı zorunlu.

## Kaynaklar (Tami)
- Sanal POS: https://www.tami.com.tr/sanal-pos
- Ortak Ödeme Sayfası (hosted): https://dev.tami.com.tr/tami-ortak-odeme-sayfasi
- 3DS satış (API ref): https://dev.tami.com.tr/tami-satis-islemi-3dli
- Sandbox + test kimlikleri/kartları: https://dev.tami.com.tr/tami-iade-islemi
