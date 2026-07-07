# Kayıtta Kart Doğrulama (1 TL 3DS Ön Provizyon) — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** /register akışına 1 TL'lik 3D Secure ön provizyonla kart doğrulama eklemek (başarıda
anında iptal + 7 gün deneme başlatma) ve canlı sandbox'ta keşfedilen gerçek TAMI wire
şemasını mevcut satış akışına uygulamak.

**Architecture:** Mevcut TAMI 3DS altyapısı (initiate→callback→complete) `purpose` ekseninde
genelleştirilir: PaymentTransaction hem satın alma hem kart-doğrulama denemelerini taşır; tek
callback URL purpose'a göre dallanır. Register pending yaratır; doğrulama başarısı workshop'u
approved+trialing yapar. Spec: docs/superpowers/specs/2026-07-07-trial-card-verification-design.md

**Tech Stack:** Next.js 16 App Router, Prisma/PostgreSQL, bun test, jose (mevcut), TAMI sandbox.

## Global Constraints
- TypeScript strict; Türkçe kullanıcı copy'si; tenant izolasyonu (workshopId asla client'tan).
- Kart verisi (PAN/CVV/expiry/holder) asla log/DB/hata nesnesine girmez; sanitizeForLog kullan.
- Doğrulama tutarı SUNUCUDA sabit: 100 kuruş (1 TL). TAMI wire'da `amount: 1` (SAYI).
- Callback'te ödeme sonucu yalnız DB'den okunur; query param asla sonuç taşımaz.
- İdempotency: tek-yönlü claim (initiated→callback_received) korunur.
- bun install/add YASAK (yeni dependency yok). Şema değişikliği `prisma migrate dev` ile.
- Kullanıcının commitlenmemiş WIP dosyalarını stage etme (görev sırasında `git status --short` bak).
- UI: yalnız mevcut ui/* bileşenleri, web'de h-9, BrandSpinner, mobile-first.
- GERÇEK WIRE ŞEMASI (canlı doğrulandı, spec'teki sonda bulguları): istek gövdesi resmi Node.js
  örneğindeki şekil; callback `txnAmount` "1" formatında (nokta yok) → tutar karşılaştırması
  SAYISAL; `hashParams` alanı gelebilir; maskedNumber "54066975****73" biçimli.

---

### Task 1: Gerçek wire şeması — istek gövdesi + txnAmount düzeltmesi (mevcut satış akışı dahil)

**Files:**
- Modify: `src/lib/tami/types.ts` (istek tipleri gerçek şemaya)
- Create: `src/lib/tami/request-builder.ts` + `src/lib/tami/request-builder.test.ts`
- Modify: `src/lib/tami/client.ts` (auth3ds gövdeyi builder'dan alır)
- Modify: `src/lib/tami/mock.ts` (callback'i gerçek yakalanan şekle uydur)
- Modify: `src/app/api/payments/tami/initiate/route.ts` (payload kurulumu builder'a)
- Modify: `src/app/api/payments/tami/callback/route.ts` (amount_mismatch SAYISAL karşılaştırma)
- Modify: `src/lib/billing/payment-helpers.ts` + `.test.ts` (`tamiAmountEqualsMinor` eklenir)

**Interfaces:**
- Produces: `buildTamiPaymentBody(input: TamiPaymentInput): TamiPaymentBody` — Task 3'ün
  preAuth3ds'i AYNI builder'ı kullanır. `TamiPaymentInput = { orderId: string; amountMinor: number;
  callbackUrl?: string; card: TamiCard; contact: { name: string; surName: string; email: string;
  phone: string; ip: string; city?: string; address?: string; companyName?: string };
  basketItemName: string }`.
- Produces: `tamiAmountEqualsMinor(wire: string, amountMinor: number): boolean` — callback route kullanır.

- [ ] **Step 1: Failing test — builder gerçek şemayı üretir** (`request-builder.test.ts`)

```ts
import { describe, expect, test } from "bun:test"
import { buildTamiPaymentBody } from "./request-builder"

const input = {
  orderId: "VRFTEST01", amountMinor: 100, callbackUrl: "http://x/cb",
  card: { holderName: "TEST KART", number: "5406697543211173", cvv: "423", expireMonth: 4, expireYear: 2027 },
  contact: { name: "Test", surName: "Kart", email: "t@x.com", phone: "05346484808", ip: "85.34.78.112", city: "İstanbul", address: "Adres 1" },
  basketItemName: "Kart doğrulama",
}

test("amount SAYI ve kuruş→TL; zorunlu sabit alanlar mevcut", () => {
  const b = buildTamiPaymentBody(input)
  expect(b.amount).toBe(1)                      // 100 kuruş → 1 (number!)
  expect(b.motoInd).toBe(false)
  expect(b.paymentChannel).toBe("WEB")
  expect(b.paymentGroup).toBe("PRODUCT")
  expect(b.installmentCount).toBe(1)
  expect(b.currency).toBe("TRY")
})

test("sepet: tek VIRTUAL kalem, toplam=amount, gerçek alan adları", () => {
  const item = buildTamiPaymentBody(input).basket.basketItems[0]
  expect(item).toEqual({ itemId: "VRFTEST01", name: "Kart doğrulama", itemType: "VIRTUAL",
    category: "SaaS", subCategory: "Abonelik", numberOfProducts: 1, unitPrice: 1, totalPrice: 1 })
})

test("buyer/adres genişletilmiş alanlar; kuruşlu tutar ondalık üretir", () => {
  const b = buildTamiPaymentBody({ ...input, amountMinor: 129900 })
  expect(b.amount).toBe(1299)
  expect(buildTamiPaymentBody({ ...input, amountMinor: 129950 }).amount).toBe(1299.5)
  expect(b.buyer.registrationDate).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(b.billingAddress.contactName).toBe("Test Kart")
  expect(b.billingAddress.country).toBe("Türkiye")
})
```

- [ ] **Step 2: `bun test src/lib/tami/request-builder.test.ts` → FAIL (modül yok)**

- [ ] **Step 3: `request-builder.ts` implementasyonu**

```ts
import type { TamiCard } from "./types"

export interface TamiPaymentInput {
  orderId: string
  amountMinor: number
  callbackUrl?: string
  card: TamiCard
  contact: { name: string; surName: string; email: string; phone: string; ip: string;
             city?: string; address?: string; companyName?: string }
  basketItemName: string
}

/** Kuruş → TAMI'nin SAYI amount'u (canlı sandbox doğrulaması: string "1.00" DEĞİL, 1). */
export function minorToTamiAmountNumber(amountMinor: number): number {
  return Math.round(amountMinor) / 100
}

/** Canlı sandbox'ta doğrulanmış istek gövdesi (resmi Node.js örneği şekli).
 *  identityNumber/registration* alanları sandbox'ta zorunluydu; sabit güvenli değerler. */
export function buildTamiPaymentBody(input: TamiPaymentInput) {
  const amount = minorToTamiAmountNumber(input.amountMinor)
  const contactName = `${input.contact.name} ${input.contact.surName}`.trim()
  const addr = {
    address: input.contact.address || "Belirtilmedi",
    city: input.contact.city || "İstanbul",
    companyName: input.contact.companyName || contactName,
    country: "Türkiye",
    district: "Merkez",
    contactName,
    phoneNumber: input.contact.phone,
    zipCode: "34000",
  }
  const nowIso = new Date().toISOString().replace(/Z$/, "")
  return {
    ...(input.callbackUrl ? { callbackUrl: input.callbackUrl } : {}),
    currency: "TRY" as const,
    installmentCount: 1,
    motoInd: false,
    paymentGroup: "PRODUCT" as const,
    paymentChannel: "WEB" as const,
    card: input.card,
    billingAddress: addr,
    shippingAddress: addr,
    buyer: {
      ipAddress: input.contact.ip,
      buyerId: input.orderId,
      name: input.contact.name,
      surName: input.contact.surName || input.contact.name,
      identityNumber: 11111111111,
      city: addr.city, country: "Türkiye", zipCode: addr.zipCode,
      emailAddress: input.contact.email,
      phoneNumber: input.contact.phone,
      registrationAddress: addr.address,
      lastLoginDate: nowIso, registrationDate: nowIso,
    },
    basket: {
      basketId: input.orderId,
      basketItems: [{ itemId: input.orderId, name: input.basketItemName, itemType: "VIRTUAL",
        category: "SaaS", subCategory: "Abonelik", numberOfProducts: 1,
        unitPrice: amount, totalPrice: amount }],
    },
    orderId: input.orderId,
    amount,
  }
}
```

- [ ] **Step 4: Test yeşil; `types.ts`'i buna hizala** (istek tipini builder dönüş tipinden türet:
  `export type TamiPaymentBody = ReturnType<typeof buildTamiPaymentBody>`; eski string-amount
  tipi kaldır, tsc'nin gösterdiği kullanım yerlerini düzelt).

- [ ] **Step 5: `client.ts` auth3ds: gövdeyi hazır `TamiPaymentBody` alır** (builder çağrısı route'ta).
  `initiate/route.ts`: mevcut alan-alan payload kurulumunu sil, `buildTamiPaymentBody({...})` kullan
  (amountMinor: order.amountMinor; contact: billingSnapshot/workshop'tan mevcut çözümleme;
  basketItemName: `${planLabel} · ${cycleLabel}`).

- [ ] **Step 6: Failing test — sayısal tutar karşılaştırma** (`payment-helpers.test.ts`'e ekle)

```ts
test("tamiAmountEqualsMinor: wire formatlarından bağımsız", () => {
  expect(tamiAmountEqualsMinor("1", 100)).toBe(true)      // canlı yakalanan format
  expect(tamiAmountEqualsMinor("1.00", 100)).toBe(true)
  expect(tamiAmountEqualsMinor("1299.5", 129950)).toBe(true)
  expect(tamiAmountEqualsMinor("2", 100)).toBe(false)
  expect(tamiAmountEqualsMinor("abc", 100)).toBe(false)
  expect(tamiAmountEqualsMinor("", 100)).toBe(false)
})
```

- [ ] **Step 7: Implement + callback route'u değiştir**

```ts
// payment-helpers.ts
/** Callback txnAmount ("1" | "1.00" | "1299.5") ↔ kuruş eşitliği; parse edilemeyen → false. */
export function tamiAmountEqualsMinor(wire: string, amountMinor: number): boolean {
  const n = Number(wire)
  if (!Number.isFinite(n) || wire.trim() === "") return false
  return Math.round(n * 100) === Math.round(amountMinor)
}
```
`callback/route.ts` amount_mismatch bloğunda exact-string karşılaştırmayı
`!tamiAmountEqualsMinor(raw.txnAmount ?? "", txn.amountMinor)` ile değiştir (currencyCode kontrolü kalır).

- [ ] **Step 8: mock.ts callback'ini gerçek yakalanan şekle uydur**: txnAmount'u
  `String(minorToTamiAmountNumber(amountMinor))` üret ("1", "1299.5"); maskedNumber `"54066975****73"`
  deseni (ilk 8 + **** + son 2); `hashParams` ve `mdErrorMessage`/`callbackStatus` alanlarını ekle
  (hash HESABI değişmez — hashParams yalnız bilgi alanı). Mock testleri güncelle.

- [ ] **Step 9: Tüm suite + tsc + lint; commit**
`git add <dokunulan dosyalar>` → `fix(tami): gerçek wire şeması (sayı amount, tam gövde) + txnAmount sayısal karşılaştırma`

---

### Task 2: Şema — PaymentTransaction.purpose + nullable billingOrderId

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_payment_txn_purpose/migration.sql` (migrate dev üretir)
- Modify: `src/lib/billing/lifecycle.ts` (sipariş-iptal süpürmesi purpose=purchase filtresi)

**Interfaces:**
- Produces: `PaymentTransactionPurpose` enum (`purchase | card_verification`);
  `PaymentTransaction.billingOrderId: String?`; Task 3-4 `purpose: "card_verification"` yazar.

- [ ] **Step 1: Şema değişikliği**

```prisma
enum PaymentTransactionPurpose {
  purchase
  card_verification
}
// PaymentTransaction içinde:
//   billingOrderId String?          (nullable'a çevir; relation optional)
//   billingOrder   BillingOrder?    @relation(...)
//   purpose        PaymentTransactionPurpose @default(purchase)
```

- [ ] **Step 2: `bunx prisma migrate dev --name payment_txn_purpose`** (additive + kolon gevşetme;
  mevcut satırlar default purchase alır). Ardından generate. Shadow-drift çıkarsa DB.md deseni
  (elle SQL + migrate deploy/resolve) — raporla.

- [ ] **Step 3: tsc'nin gösterdiği kullanım yerlerini düzelt**: activate/admin/data sorguları
  purchase satırlarında `billingOrderId` non-null varsayar → `where: { purpose: "purchase" }`
  eklendiğinde tip daralt (`txn.billingOrderId!` YOK; null-guard yaz).
  `lifecycle.ts` sipariş-iptal adayları sorgusuna `purpose: "purchase"` filtresi ekle
  (doğrulama txn'leri sipariş süpürmesine karışmasın); `initiated>2h→expired` süpürmesi
  purpose'suz kalır (her ikisini de kapsar — istenen davranış).

- [ ] **Step 4: `bun test` + `bunx prisma migrate status` temiz; commit**
`feat(db): PaymentTransaction purpose ekseni (kart doğrulama denemeleri için)`

---

### Task 3: Doğrulama sunucu akışı — preAuth3ds, verify token, initiate + callback dalı

**Files:**
- Modify: `src/lib/tami/client.ts` + `src/lib/tami/mock.ts` (preAuth3ds)
- Create: `src/lib/billing/verify-token.ts` + `.test.ts`
- Create: `src/lib/billing/verify-activation.ts`
- Create: `src/app/api/payments/tami/verify/initiate/route.ts`
- Modify: `src/app/api/payments/tami/callback/route.ts` (purpose dallanması)
- Modify: `src/app/payment/result/page.tsx` (purpose'a duyarlı görünüm; `vref` param)

**Interfaces:**
- Consumes: `buildTamiPaymentBody` (Task 1), `purpose` kolonu (Task 2).
- Produces: `createVerifyToken(workshopId: string): string` ve
  `readVerifyToken(token: string): string | null` (24h TTL, HMAC-SHA256, SESSION_SECRET
  env'inden — src/lib/session.ts hangi env adını kullanıyorsa AYNISI);
  `activateVerifiedWorkshop(workshopId: string): Promise<{ok: boolean}>` — Task 4 register
  akışı token üretir; POST /api/payments/tami/verify/initiate form alanları:
  `vtoken` + kart alanları (holderName, number, expireMonth, expireYear, cvv).

- [ ] **Step 1: Failing test — verify token** (`verify-token.test.ts`)

```ts
test("token gidiş-dönüş + kurcalama + süre", () => {
  const t = createVerifyToken("ws_123")
  expect(readVerifyToken(t)).toBe("ws_123")
  expect(readVerifyToken(t.slice(0, -2) + "xx")).toBeNull()
  expect(readVerifyToken("bozuk")).toBeNull()
})
```

- [ ] **Step 2: Implement** — `workshopId.expEpoch.base64url(hmacSHA256(secret, workshopId+"."+expEpoch))`
  üçlüsü nokta ile; `readVerifyToken` timingSafeEqual + exp kontrolü; secret yoksa throw.

- [ ] **Step 3: `client.preAuth3ds(body: TamiPaymentBody)`** — auth3ds ile aynı sarmalayıcı,
  path `/payment/pre-auth` (canlıda doğrulandı). Mock: auth3ds'teki sahte 3DS aynen (amount 1).
  Mevcut client testine path assert'i ekle.

- [ ] **Step 4: verify/initiate route** — akış:

```
POST form: vtoken + kart alanları
1. IP rate-limit (satış initiate'iyle aynı desen/limit).
2. readVerifyToken → workshopId; null → 303 /payment/result?err=vtoken
3. Workshop yükle: approvalStatus==="pending" değilse (zaten doğrulanmış) → 303 result?vref=<token> (sayfa "zaten doğrulanmış → giriş" gösterir)
4. Kart alanları zod (satıştakiyle aynı şema).
5. providerOrderId üret: `VRF-` + 12 hex (satıştaki üreticiyi paylaş/uyarla, 2-36 kar.)
6. PaymentTransaction yarat: purpose card_verification, billingOrderId null,
   workshopId, amountMinor: 100, status initiated, correlationId.
7. buildTamiPaymentBody({ orderId: providerOrderId, amountMinor: 100, callbackUrl:
   `${APP_URL}/api/payments/tami/callback`, card, contact: workshop kayıt bilgilerinden,
   basketItemName: "Kart doğrulama" }) → tami.preAuth3ds()
8. Başarı: decode base64 → text/html (tam sayfa). Hata: txn failed + 303 result?vref=<token>
KART VERİSİ: yalnız bellekte; sanitizeForLog.
```

- [ ] **Step 5: callback purpose dallanması** — claim SONRASI (tek-yönlü claim aynen):

```ts
if (txn.purpose === "card_verification") {
  // tutar/para birimi kontrolü satıştaki gibi (tamiAmountEqualsMinor)
  // mdStatus==="1" && success: complete3ds → BAŞARIDA:
  //   (a) tami.cancel(providerOrderId) best-effort — hata: founder alert
  //       ("1 TL bloke düşürülemedi, kendiliğinden 7-9 günde düşer") + txn.errorMessage'a not; AKIŞI BOZMAZ
  //   (b) activateVerifiedWorkshop(txn.workshopId)
  //   (c) txn completed
  // başarısızlık: failed + errorCode (mevcut satış dalıyla simetrik)
  // her durumda 303 → /payment/result?vref=<createVerifyToken(txn.workshopId)>
}
```
`verify-activation.ts`: `updateMany({ where: { id, approvalStatus: "pending" }, data: {
approvalStatus: "approved", subscriptionStatus: "trialing", trialStartedAt: now,
trialEndsAt: computeTrialEnd(now) } })` claim-guard'lı; count===1'de welcomeTrialEmail
(sendSystemEmail, templateKey `welcome_trial`) + AuditLog "card_verified_trial_started";
count===0 (zaten approved — replay) → ok:true yan etkisiz.

- [ ] **Step 6: result sayfası `vref` görünümü** — token → workshopId → workshop + son
  card_verification txn; durumlar: approved → "Kartınız doğrulandı, 7 günlük deneme başladı"
  + "Giriş Yap" CTA; pending + son txn failed/yok → hata + yeniden dene (VerifyCardPanel,
  Task 4'te) ; callback_received → işleniyor (mevcut poll deseni). Workshop adı/e-posta
  GÖSTERME (token taşıyan herkes açabilir — yalnız durum + maskedPan son hane).

- [ ] **Step 7: Suite + tsc + lint; commit**
`feat(payments): kart doğrulama sunucu akışı (preAuth3ds + verify token + callback dalı)`

---

### Task 4: Register akışı + kart adımı UI

**Files:**
- Modify: `src/app/api/auth/register/route.ts` (pending + verifyToken; resume mantığı)
- Modify: `src/components/**/register-form*.tsx` (kart adımı)
- Create: `src/components/billing/verify-card-panel.tsx` (CardPaymentPanel'den genelleme)
- Modify: `src/components/billing/card-payment-panel.tsx` (ortak forma dönüş — aşağıda)
- Modify: `src/components/app/plan-locked.tsx` + `src/app/(app)/layout.tsx` (pending → doğrulama CTA'sı)

**Interfaces:**
- Consumes: register yanıtı `{ verifyToken: string }`; POST /api/payments/tami/verify/initiate
  (`vtoken` + kart alanları); createVerifyToken (Task 3).

- [ ] **Step 1: Kart formu genelleme** — `card-payment-panel.tsx`'ten paylaşılan
  `CardFormFields` + submit iskeleti çıkar (`action: string`, `hidden: Record<string,string>`,
  `submitLabel`, `note` prop'ları). `CardPaymentPanel` = satış öntanımları; YENİ
  `VerifyCardPanel` = `action="/api/payments/tami/verify/initiate"`,
  `hidden={{ vtoken }}`, `submitLabel="Kartı Doğrula (1 TL provizyon)"`,
  not: "Kartınızdan 1 TL'lik doğrulama provizyonu alınır ve anında iade edilir.
  Kart bilgileriniz saklanmaz." Havale yolu ve satış paneli REGRESYONSUZ.

- [ ] **Step 2: register route** — workshop create geri `approvalStatus: "pending"`,
  `subscriptionStatus: "trialing"`, `trialStartedAt/EndsAt: null` (trial CALLBACK'te başlar —
  dünkü anında-onay satırları kaldırılır; welcomeTrialEmail gönderimi de buradan KALKAR,
  Task 3 activateVerifiedWorkshop'a taşındı — çifte gönderim OLMASIN). Yanıt:
  `{ ok: true, verifyToken: createVerifyToken(workshop.id) }`. `newApplicationAdminEmail` kalır.
  RESUME: e-posta mevcutsa VE o kullanıcının workshop'u pending+doğrulamasız VE gönderilen
  şifre mevcut hash'le doğrulanıyorsa (mevcut login şifre kontrol fonksiyonunu kullan) →
  hata yerine `{ ok: true, verifyToken, resumed: true }`. Şifre tutmuyorsa normal
  "e-posta kullanımda" hatası (hesap ele geçirme yolu OLMASIN).

- [ ] **Step 3: register-form kart adımı** — başarı yanıtında form yerine VerifyCardPanel
  render (verifyToken ile). "Daha sonra doğrula" YOK (karar: kartsız hesap kullanmaz).
  Metin: "Son adım: kartınızı doğrulayın".

- [ ] **Step 4: pending kilit ekranı** — `(app)/layout.tsx` pending dalında verifyToken üretip
  PlanLocked'a geç; PlanLocked pending görünümü: "Hesabınız kart doğrulaması bekliyor" +
  VerifyCardPanel (legacy gerçek-pending satırlar da bu yoldan doğrulanabilir — kabul edilen
  davranış değişikliği; raporda not et).

- [ ] **Step 5: Copy taraması** — "7 günlük deneme süreniz başladı" register başarı mesajı
  artık KART SONRASI habere döner; register sayfasındaki anında-başlama vaadi
  "kart doğrulamasının ardından 7 günlük deneme" olarak güncellenir.

- [ ] **Step 6: Suite + tsc + lint; commit**
`feat(register): kayıtta kart doğrulama adımı (1 TL ön provizyon)`

---

### Task 5: Süpürme + admin görünürlük + docs

**Files:**
- Modify: `src/lib/billing/lifecycle.ts` + `src/lib/billing/lifecycle.test.ts`
- Modify: `src/app/admin/admin-billing.tsx` + `src/app/admin/data.ts` (purpose rozeti)
- Modify: `.env.example`, `DEPLOY.md` (go-live checklist'e pre-auth maddesi)

**Interfaces:**
- Consumes: purpose kolonu; pending+doğrulamasız workshop semantiği.

- [ ] **Step 1: Failing test — süpürme adayı saf filtresi**

```ts
const CUTOFF = new Date("2026-07-07T00:00:00Z")  // özellik yayın tarihi; öncesi legacy pending
test("shouldPurgeUnverifiedWorkshop", () => {
  const base = { approvalStatus: "pending", trialStartedAt: null, createdAt: new Date("2026-07-08"),
    billingOrderCount: 0, serviceOrderCount: 0 }
  expect(shouldPurgeUnverifiedWorkshop({ ...base }, hoursAgo(49))).toBe(true)
  expect(shouldPurgeUnverifiedWorkshop({ ...base }, hoursAgo(1))).toBe(false)          // taze
  expect(shouldPurgeUnverifiedWorkshop({ ...base, createdAt: new Date("2026-06-01") }, hoursAgo(999))).toBe(false) // legacy
  expect(shouldPurgeUnverifiedWorkshop({ ...base, billingOrderCount: 1 }, hoursAgo(99))).toBe(false)
  expect(shouldPurgeUnverifiedWorkshop({ ...base, trialStartedAt: new Date() }, hoursAgo(99))).toBe(false)
})
```
(İmza: `(w: {approvalStatus,trialStartedAt,createdAt,billingOrderCount,serviceOrderCount}, now: Date) => boolean`;
48 saat eşiği fonksiyon içinde sabit.)

- [ ] **Step 2: Implement + sweep** — `sweepUnverifiedRegistrations()`: adayları çek
  (pending, trialStartedAt null, createdAt >= CUTOFF ve < now-48h, _count ile order sayıları),
  saf filtre, sil: txn'ler (card_verification), workshopSettings, user'lar, workshop —
  Task 5 silme sırası QA cleanup'taki FK sırasına uyar. Cron route'a sweep'i ekle, sayaçlar
  CronRun'a. AuditLog: silinen workshop id+email özet log'u console'a (sanitize).

- [ ] **Step 3: Admin rozeti** — txn listesinde purpose === "card_verification" →
  "Doğrulama" rozeti (Badge, mevcut stiller); data.ts stuck sorgusu purpose'tan bağımsız
  kalır (doğrulama da takılabilir — retry butonu doğrulama için `activateVerifiedWorkshop`
  çağıran ayrı dal gerektirir: retryStuckActivation'a purpose dalı ekle).

- [ ] **Step 4: Docs** — `.env.example` yorumuna "sandbox JWK'ları portaldan alınır (zip'teki
  eski)" notu; DEPLOY.md go-live checklist'e: "1 TL pre-auth + anında iptalin sandbox'ta
  uçtan uca testi (banka sim OTP'si TAMI destekten öğrenilecek)".

- [ ] **Step 5: Suite + tsc + lint + `bun run build`; commit**
`feat(billing): doğrulamasız kayıt süpürmesi + admin doğrulama rozeti + docs`

---

## Doğrulama (plan sonu)
1. Mock ile Playwright QA: register → kart adımı → sahte 3DS → "deneme başladı" → giriş →
   uygulama açık; başarısız kart → pending kilit ekranından tekrar doğrulama.
2. Gerçek sandbox (77006950): verify/initiate → İş Bankası 3DS ekranı açılıyor (OTP bilinince tam tur).
3. Regresyon: satış akışı mock'la uçtan uca (Task 1 şema değişikliği satışı da etkiledi!) +
   202+ test suite + build.
