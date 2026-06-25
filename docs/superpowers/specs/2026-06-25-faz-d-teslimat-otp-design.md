# Faz D — Teslimat (Delivery Handover) + OTP — Tasarım (Spec)

- **Tarih:** 2026-06-25
- **Durum:** Tasarım onaylandı — uygulama planı bekleniyor
- **Kapsam:** Araç müşteriye teslim edilirken `ready_for_delivery → delivered` geçişini **müşteri OTP'siyle** kapıya bağlamak (KVKK/teslim onayı). OTP intake'ten teslimata taşınır (birleşik-akış spec'inin son parçası).
- **İlgili:** `docs/superpowers/specs/2026-06-23-birlesik-is-emri-akisi-design.md` (Faz 5 "delivery OTP"); branch `feat/delivery-otp` (origin/main'den). Faz 1→C main'de.

---

## 1. Bağlam ve mevcut durum

- **Durum yaşam döngüsü** (`src/lib/status-transitions.ts`): `draft → waiting_approval → approved → in_progress → ready_for_delivery → delivered` (+ `cancelled`). `delivered` terminal. `ready_for_delivery → delivered` şu an **gate'siz**: detay sayfasındaki "Teslim Edildi" butonu doğrudan `updateIntakeStatusAction(id,"delivered")` çağırıyor.
- **Emsal — `approved`:** `canTransitionIntake` `to==="approved"`'ı manuel reddeder; `approved`'a yalnız `verifyOtpAction` (intake OTP) ulaşır (status'u doğrudan Prisma update ile set eder). Teslimat için bu deseni birebir kuracağız.
- **`ApprovalRequest`** modeli (`prisma/schema.prisma`): `workshopId, intakeFormId, phone, otpCode (düz metin), status (pending/verified/expired/cancelled), approvalType (@default "vehicle_intake"), approvedAt, ip/userAgent, createdAt`. **Expiry alanı YOK, deneme sayacı YOK.** `vehicle_delivery` değeri hiç kullanılmamış.
- **Bildirim altyapısı GERÇEK:** `sendCommunication()` (consent + rate-limit + `CommunicationLog`) ve consent-bypass `sendSMSDirect(to, message)`. **NetGSM SMS gerçek** (env `SMS_PROVIDER=netgsm`; default `mock`). Intake OTP'si kodu SMS'le GÖNDERMİYOR (yalnız link); **teslimat OTP'sinde kodu gerçekten SMS'le göndereceğiz.**
- **Rate-limit util** (`src/lib/communications/rate-limit.ts`): in-memory `checkRateLimit(key, maxPerMinute)` / `recordAttempt(key)`.
- **Order**: `ServiceOrder` paralel status (`delivered` dahil) + `paymentStatus`. `ready_for_delivery`→ `notifyWorkOrderCompleted`; `delivered` + unpaid → payment reminder (`src/app/(app)/orders/actions.ts`).

## 2. Hedefler ve kapsam dışı (YAGNI)

### Hedefler
1. `ready_for_delivery → delivered` geçişini **müşteri OTP'siyle** kapıya bağla (personel-aracılı, dükkanda).
2. OTP'yi **gerçek SMS** ile müşteri telefonuna gönder; personel girer; doğrulanınca intake **ve** order `delivered`.
3. **Sıfır migration** ile makul sertleştirme (expiry + deneme limiti).

### Kapsam dışı (şimdilik)
- Müşteri self-servis (uzaktan) teslim onayı / halka açık OTP sayfası.
- OTP hash'leme + kalıcı (DB/Redis) deneme sayacı — v0.6.0 "OTP hardening" + distributed rate-limit.
- Intake (kabul) OTP'sini yeniden devreye alma (backend dormant kalır).
- Ödeme tahsilatını teslimata zorunlu kılma (borç = **uyarı**, engellemez).
- ApprovalRequest'e yeni alan / şema değişikliği.

## 3. Alınan kararlar

| # | Karar |
|---|-------|
| D1 | **Personel-aracılı (dükkanda)**: OTP müşteri telefonuna SMS; personel detay ekranında girer. |
| D2 | **Gate = `approved` emsali**: `canTransitionIntake` `to==="delivered"`'ı manuel reddeder; `delivered`'a yalnız `verifyDeliveryOtpAction` ulaşır (doğrudan Prisma update). |
| D3 | OTP **gerçek SMS** ile gönderilir (`sendSMSDirect` + teslimat metni). Mock/dev'de kod personele **ekranda da** gösterilir (test için). |
| D4 | **Sıfır migration + türetilmiş sertleştirme**: expiry = `createdAt + 10dk` (verify kontrol eder); gönderim + doğrulama denemesi mevcut **in-memory rate-limit** ile; `approvalType="vehicle_delivery"` ayırır. OTP düz metin (mevcut desen). |
| D5 | Doğrulanınca intake **ve** order `delivered` (mevcut teslimat/ödeme-hatırlatma bildirimleri tetiklenir). Ödeme borcu = **uyarı**, engellemez. |

## 4. Tasarım

### 4.1 Sunucu aksiyonları (`src/app/(app)/intakes/delivery-actions.ts` — yeni)

- **`requestDeliveryOtpAction(intakeFormId)`**:
  - `requireAuth()` → workshop-scoped intake (+customer) bul. Intake status `ready_for_delivery` değilse hata.
  - Gönderim rate-limit: `checkRateLimit(\`delivery-otp-send:${intakeFormId}\`)`; aşılırsa hata.
  - 6-hane OTP üret; `ApprovalRequest` oluştur: `approvalType="vehicle_delivery"`, `status="pending"`, `phone=customer.phone`, `otpCode`, `approvalTextVersion` = teslim onay metni snapshot'ı (plaka + müşteri + tarih).
  - **SMS gönder:** `sendSMSDirect(customer.phone, "BakimX teslim onay kodunuz: <OTP>. Aracınızın teslimini onaylamak için bu kodu servise iletin.")`. SMS başarısızsa: prod'da hata döndür; mock/dev'de tolere et.
  - Dönüş: `{ success, otpCode? }` — `otpCode` yalnız `SMS_PROVIDER==="mock"` veya non-prod'da (personel ekranda görsün).
  - Audit + timeline ("delivery_otp_requested").
- **`verifyDeliveryOtpAction(intakeFormId, code)`**:
  - `requireAuth()` → workshop-scoped intake bul; status `ready_for_delivery` değilse hata.
  - Doğrulama rate-limit: `checkRateLimit(\`delivery-otp-verify:${intakeFormId}\`, ...)` + `recordAttempt`; aşılırsa "çok fazla deneme" hatası.
  - En güncel `pending` + `approvalType="vehicle_delivery"` ApprovalRequest'i bul. Yoksa hata.
  - **Expiry:** `isOtpExpired(approval.createdAt, now, 10*60*1000)` → true ise `status="expired"` işaretle + "kodun süresi doldu, yeniden iste" hatası.
  - Kod eşleşmezse hata (status pending kalır; rate-limit deneme sayar).
  - Başarılı: ApprovalRequest `verified` + `approvedAt`; **intake `delivered`** — status'u **doğrudan Prisma update** ile set et (gate'i bypass; tıpkı `verifyOtpAction`'ın `approved`'ı set etmesi gibi; varsa `deliveredAt`); **order `delivered`** — tercihen **mevcut order-status update aksiyonu** ile (order'ın delivered yan etkileri/ödeme-hatırlatması tetiklensin; order zaten `ready_for_delivery` değilse uyumlu/atlanır davran). Audit + timeline ("delivered_otp_verified", "müşteri OTP ile teslim aldı").
  - Dönüş `{ success }` veya `{ error }`.

### 4.2 Gate (`src/lib/status-transitions.ts`)

`canTransitionIntake`: mevcut `if (to === "approved") return false` yanına **`if (to === "delivered") return false`** ekle (manuel/generic geçiş yasak). `ready_for_delivery → delivered` artık yalnız `verifyDeliveryOtpAction`'ın doğrudan update'iyle olur. `updateIntakeStatusAction` bu kontrole uyduğu için "delivered" generic action'la reddedilir (mesaj: "Teslim yalnızca müşteri OTP'si ile verilebilir").

### 4.3 Saf yardımcı (`src/lib/intake/otp.ts` — yeni)

`isOtpExpired(createdAt: Date, now: Date, ttlMs: number): boolean` — `now - createdAt > ttlMs`. Unit-test edilir (TTL içi/dışı/sınır).

### 4.4 API route'ları

- `POST /api/intakes/[id]/delivery-otp` → `requestDeliveryOtpAction(id)` → `{ success, otpCode? }`.
- `POST /api/intakes/[id]/delivery-otp/verify` (body `{ code }`) → `verifyDeliveryOtpAction(id, code)` → `{ success }` / `{ error }`.
(İntake OTP route'larının deseni; ayrı yol, karışmaz.)

### 4.5 UI (`src/components/app/intake-detail.tsx`)

`ready_for_delivery` durumunda mevcut düz **"Teslim Edildi"** butonu → **OTP teslim akışı**:
1. "Teslim Et (OTP)" → `requestDeliveryOtpAction` → "Kod müşteriye SMS ile gönderildi" (mock/dev'de kodu da göster).
2. 6-hane kod giriş alanı + "Doğrula ve Teslim Et" → `verifyDeliveryOtpAction`.
3. Başarılı → sayfa yenilenir, status `delivered`.
- **Ödeme borcu varsa** giriş üstünde uyarı (`order.paymentStatus !== "paid"` → "Ödenmemiş bakiye: …"), engellemez.
- "Yeniden kod gönder" (rate-limit'e tabi). Hata mesajları (yanlış/expired/çok deneme) gösterilir.
- intake OTP UI desenine benzer (kod input + doğrula).

### 4.6 Bildirim / metin

- OTP SMS'i `sendSMSDirect` ile (consent-bypass — işlemsel/güvenlik mesajı). Mock provider'da konsola loglanır + ekranda gösterilir.
- Teslim sonrası: order `delivered` → mevcut `notify*`/payment-reminder akışı (değişmez).

## 5. Veri / persistence

- Yalnız mevcut **`ApprovalRequest`** (`approvalType="vehicle_delivery"`). **Yeni alan/model YOK.**
- Intake `status="delivered"`; order `status="delivered"` (mevcut alanlar). **Sıfır Prisma migrasyonu.**
- Expiry türetilmiş (createdAt+TTL); deneme in-memory rate-limit.

## 6. Hata yönetimi

- Intake `ready_for_delivery` değil → "Araç teslimata hazır değil".
- Yanlış kod → hata + deneme sayılır; çok deneme → "çok fazla deneme, sonra tekrar".
- Süre dolmuş → ApprovalRequest `expired` + "yeniden kod iste".
- SMS gönderilemedi → prod: hata + tekrar; mock/dev: kod ekranda (akış sürer).
- Zaten `delivered` → buton görünmez (status guard).
- Tenant: tüm aksiyonlar `requireAuth()` + workshop-scoped.

## 7. Bileşen değişiklikleri (dokunulan dosyalar)

- **Yeni:** `src/app/(app)/intakes/delivery-actions.ts` (`requestDeliveryOtpAction`, `verifyDeliveryOtpAction`).
- **Yeni:** `src/lib/intake/otp.ts` (`isOtpExpired`) + testi.
- **Yeni:** `src/app/api/intakes/[id]/delivery-otp/route.ts` + `.../delivery-otp/verify/route.ts`.
- **Değişen:** `src/lib/status-transitions.ts` (`canTransitionIntake` → `delivered` manuel reddet).
- **Değişen:** `src/components/app/intake-detail.tsx` (teslim OTP UI; düz buton → OTP akışı; ödeme uyarısı).
- **Dokunulmaz:** intake approval backend (dormant), ApprovalRequest şeması, communications altyapısı (yalnız tüketilir).

## 8. Mobil hususları

- Kod giriş alanı `inputMode="numeric"`, 6-hane; büyük dokunmatik butonlar (detay sayfası zaten mobil-uyumlu).

## 9. Test ve QA

- **Unit:** `isOtpExpired` (TTL içi/dışı/sınır). `canTransitionIntake` `delivered` reddi için 1 test eklenebilir.
- **Manuel/QA (:3000, demo):** bir iş emrini `ready_for_delivery`'ye getir → "Teslim Et (OTP)" → mock'ta kod ekranda → doğrula → `delivered`; yanlış kod/expired/çok deneme; ödeme borcu uyarısı; generic status action ile `delivered` reddi.
- typecheck + lint + build kapısı; sıfır migration doğrulaması.

## 10. Açık sorular

Kritik açık soru yok (D1–D5 net). Varsayılanlar: TTL 10dk; ödeme borcu = uyarı (engellemez); teslimde order da delivered; mock/dev'de kod ekranda; OTP düz metin (hash v0.6.0). Uygulama ayrıntıları `writing-plans` aşamasında.
