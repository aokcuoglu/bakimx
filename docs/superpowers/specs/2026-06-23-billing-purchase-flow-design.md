# BakımX — Satın Alma Akışı & Faturalandırma Paneli (v1) — Tasarım

- **Tarih:** 2026-06-23
- **Durum:** Tasarım onaylandı — uygulama planı bekliyor
- **Konum:** Roadmap'teki "v0.8.0 Subscription & billing" milestone'unun ilk dilimi (manuel/havale)
- **Branch:** `feat/billing-purchase-flow`

---

## 1. Amaç

İki uçlu ihtiyaç:

1. **Müşteri (workshop) tarafı:** Uygulamayı satın almak için bir **wizard** akışı — iki giriş noktasından:
   - (a) **Deneme bitince** uygulama içinde (mevcut `<PlanLocked>` ekranından).
   - (b) **Siteden doğrudan** (yeni ziyaretçi, public).
2. **BakımX (platform) tarafı:** Bu satın alma/abonelik süreçlerini yönetebileceğim, **manuel/havale ödeme teyidi** ve **gelir görünürlüğü** olan bir panel.

## 2. Alınan kararlar (gerekçeleriyle)

| # | Karar | Seçim | Gerekçe |
|---|---|---|---|
| 1 | Ödeme derinliği (v1) | **Manuel/havale**; gerçek kart geçidi (iyzico) sonraki adımda | En hızlı, en az risk; mevcut manuel aktivasyona ve `money→Decimal` düzeltmesinin v0.7.0'a ertelenmesine uygun |
| 2 | Public yeni-ziyaretçi girişi | **Satın alma "ödeme bekliyor" hesabı yaratır** | "Siteden direk satın al"ı gerçekler; manuel teyit, "anında provizyon yok" kuralını (approval-gated by design) korur |
| 3 | Veri modeli | **Tek `BillingOrder` tablosu** + mevcut onay-kapısını yeniden kullan | v1'i tam karşılar (sihirbaz + panel + gelir); en küçük şema deltası; tam billing domaini (Subscription/Payment/Invoice) kart geçidiyle birlikte gelir |

## 3. Mevcut durum (üzerine inşa edeceğimiz iskelet)

- **Paketler:** `src/lib/plans-catalog.ts` — Başlangıç ₺749 / Pro ₺1.299 / Premium ₺2.199 (aylık + yıllık).
- **`Workshop` alanları** (`prisma/schema.prisma`): `planTier`, `subscriptionStatus` (`trialing|active|past_due|canceled`), `approvalStatus` (`pending|approved|rejected`), `trialStartedAt`, `trialEndsAt`, `requestedPlanTier`, `planRequestedAt`, `extraSeats`.
- **Deneme enforcement:** `getPlanState(workshop)` → `PlanState` (`lib/plan.ts`); `(app)/layout.tsx` erişimi keser; `<PlanLocked reason=…>` (`components/app/plan-locked.tsx`) kilit ekranını gösterir. `lockReason ∈ {pending, rejected, trial_expired, subscription_inactive, null}`.
- **Mevcut billing:** `/billing` sayfası + `requestPlanActivation(tier)` (`app/(app)/billing/actions.ts`) — sadece talep oluşturur, aktivasyon **manuel**.
- **Admin:** `/admin` tek sayfa, `ADMIN_EMAILS` allowlist (`lib/admin.ts` → `requireAdmin()`); `approveWorkshop`, `rejectWorkshop`, `activateWorkshopPlan`, `setWorkshopExtraSeats` (`app/admin/actions.ts`); bileşenler `admin-workshops.tsx`, `admin-requests.tsx`.
- **Wizard deseni:** `components/app/intake-wizard.tsx` — 6 adım, `react-hook-form` + Zod, progress bar, `Card` per step. Yeniden kullanılacak.
- **Register:** `api/auth/register/route.ts` — Workshop + ilk User (owner) tek transaction'da, `approvalStatus=pending`. Public checkout bu mantığı yeniden kullanacak.
- **Yok:** gerçek ödeme geçidi, fatura/ödeme/abonelik işlem modeli, müşteri checkout sihirbazı, panelde gelir/abonelik/ödeme yönetimi.

## 4. Hedefler / Hedef olmayanlar

**Hedefler (v1):**
- Müşteri checkout sihirbazı (public + uygulama içi).
- Public satın alma → "ödeme bekliyor" workshop + `BillingOrder`.
- BakımX panelinde: ödeme inbox'ı + teyit/aktive, abonelik listesi, gelir özeti.
- Abonelik dönem sonu (yenileme) yaşam döngüsü + kilit + banner.
- Onaylı ödeme için basit PDF makbuz.
- `PaymentProvider` soyutlaması + `ManualHavaleProvider` adaptörü (iyzico drop-in'e hazır).

**Hedef değil (v1) — bilinçli ertelenenler:**
- Gerçek kart geçidi / 3D Secure / webhook (soyutlama hazır, adaptör sonra).
- Otomatik (kayıtlı kart) yenileme, dunning.
- Yasal e-Fatura / e-Arşiv entegrasyonu (makbuz var; yasal fatura offline).
- Çoklu para birimi (yalnız TRY).
- Mevcut `Float` para alanlarının `Decimal`/minor-units migrasyonu (ayrı v0.7.0 işi).

## 5. Veri modeli

### 5.1 `Workshop`'a eklenecek alanlar (hepsi nullable → additive)
- `billingCycle BillingCycle?` — aktif ödeme döngüsü.
- `currentPeriodEnd DateTime?` — ödenmiş dönemin bitişi; geçmesi = yenileme gerek.
- `billingCompanyTitle String?` — fatura ünvanı.
- `billingTaxOffice String?` — vergi dairesi.
- `billingTaxNumber String?` — VKN/TCKN.
- `billingEmail String?` — makbuz/fatura e-postası.

> Mevcut iletişim/adres alanları (workshop adı, telefon, şehir, adres) yeniden kullanılır; yalnızca yukarıdaki vergi/fatura alanları eklenir.

### 5.2 Yeni model `BillingOrder`
Tek tablo; tüm satın alma/yükseltme/yenileme yaşam döngüsünü taşır.

```
model BillingOrder {
  id              String              @id @default(cuid())
  workshopId      String
  workshop        Workshop            @relation(fields: [workshopId], references: [id], onDelete: Cascade)
  type            BillingOrderType                       // new_purchase | upgrade | renewal
  planTier        PlanTier
  billingCycle    BillingCycle                           // monthly | yearly
  amountMinor     Int                                    // kuruş — satın alma anındaki fiyat snapshot'ı
  currency        String              @default("TRY")
  status          BillingOrderStatus  @default(pending_payment)
  method          BillingMethod       @default(havale)   // havale | manual | card(rezerve)
  reference       String              @unique            // havale eşleştirme kodu, ör. "BX-7K3Q9"
  billingSnapshot Json?                                  // o anki ünvan/vergi no/adres → makbuz için
  note            String?                                // admin notu
  createdAt       DateTime            @default(now())
  confirmedAt     DateTime?
  confirmedByEmail String?                               // teyit eden admin (ADMIN_EMAILS modeline uygun)
  periodStart     DateTime?                              // teyitte yazılır
  periodEnd       DateTime?                              // teyitte yazılır

  @@index([workshopId])
  @@index([status])
}
```

### 5.3 Yeni enum'lar
- `BillingCycle { monthly, yearly }`
- `BillingOrderType { new_purchase, upgrade, renewal }`
- `BillingOrderStatus { pending_payment, confirmed, cancelled }`
- `BillingMethod { havale, manual, card }` — v1: `havale` (müşteri) + `manual` (admin'in ofline/özel anlaşma kaydı). `card` rezerve, kart geçidiyle kullanılacak.

### 5.4 Migration etkisi (CLAUDE.md gereği)
- **Tamamen additive:** 1 yeni tablo, birkaç nullable kolon, 4 yeni enum. Mevcut satıra dokunulmaz, **backfill yok**.
- `prisma migrate dev` ile yeni migration üretilir ve commit'lenir; prod'da `prisma migrate deploy`. Deploy DB'yi otomatik migrate **etmiyor** → tag'lemeden önce prod şema senkronu yapılmalı.
- **Mevcut `Float` para alanlarına dokunulmaz.**

## 6. Para temsili
- Tüm **yeni** faturalama tutarları **`Int` kuruş** (`amountMinor`). Tamsayı olduğu için yuvarlama denetimi gerekmez.
- Fiyat kaynağı `plans-catalog.ts`; satın alma anında ilgili (tier, cycle) fiyatı **kuruşa çevrilip order'a snapshot'lanır** — sonra fiyat değişse de geçmiş sabit kalır.
- Yardımcı: `getPlanPriceMinor(tier, cycle): number` (katalog fiyatı × 100). Katalog görünüm kaynağı olarak kalır.

## 7. PaymentProvider soyutlaması
- Arabirim (kavramsal):
  ```
  interface PaymentProvider {
    initiate(order): { method, reference, instructions }  // v1 havale: referans + IBAN talimatı döner
    // sonra: confirm(webhookPayload) — kart geçidi otomatik teyit için
  }
  ```
- **v1 `ManualHavaleProvider`:** benzersiz referans üretir, havale talimatını (IBAN + açıklama = referans) döner. Teyit **admin** tarafından panelden manuel.
- **Sonra `IyzicoProvider`:** aynı arabirimi doldurur; teyit webhook'la otomatik olur. **Checkout UI ve `BillingOrder` modeli değişmez** → rework yok.
- **Havale talimatı (IBAN, ünvan)** uygulama ayarı olarak tutulur — env değişkenleri (`ADMIN_EMAILS` deseniyle tutarlı). `.env` bizim tarafımızdan düzenlenmez; gereken değişkenler dokümante edilir, kullanıcı ekler.

## 8. Müşteri checkout sihirbazı

`PurchaseWizard` bileşeni, `mode: "public" | "inapp"` ile iki giriş noktasını paylaşır (IntakeWizard deseni: progress bar, Card/step, react-hook-form + Zod).

### 8.1 Giriş noktaları
- **Public (bakimx.com):** yeni `/fiyatlar` (pricing) → "Satın Al" → `/satin-al` (wizard) → `/satin-al/tamam` (referans + havale talimatı). Yeni workshop yaratır.
- **Uygulama içi (app.bakimx.com):** `/billing` — trial banner, `<PlanLocked>` "paket seç", "Yükselt" → `/billing/checkout` (aynı wizard, `inapp` modu). Hesap zaten var.

> Routing, mevcut host-aware middleware + subdomain ayrımına uyar: public sayfalar landing host'ta, `/billing*` app host'ta.

### 8.2 Adımlar
1. **Paket & döngü:** starter/pro/premium + aylık/yıllık toggle → fiyat. (inapp: mevcut tier'a göre öneri/işaret.)
2. **Hesap & fatura bilgisi:**
   - `public`: workshop adı, sahip ad/iletişim, e-posta, şifre (register alanları) **+** vergi/fatura bilgisi (ünvan, vergi dairesi, VKN, fatura e-postası).
   - `inapp`: yalnızca eksik vergi/fatura bilgisi (önceden doldurulmuş, düzenlenebilir).
3. **Ödeme yöntemi & talimat:** havale/EFT talimatı (IBAN + **benzersiz referans**). "Havaleyi bu referansla yapın." (Kart geçidi gelince bu adımda görünecek.)
4. **Özet & onay:** gözden geçir → gönder.
   - `public`: `Workshop(approvalStatus=pending)` + `User(owner)` + `BillingOrder(new_purchase, pending_payment)`. Onay ekranı: "Ödemeniz teyit edilince hesabınız aktifleşecek" + havale detayı + referans.
   - `inapp`: `BillingOrder(pending_payment)` (type = aşağıdaki kurala göre). Kullanıcı trial/locked'ta kalır; teyitte aktive olur. Mesaj: "Talebiniz alındı; havale teyidinden sonra planınız açılacak."

### 8.3 `BillingOrderType` kuralı
- Hiç ödenmiş dönemi olmayan (`currentPeriodEnd == null`) → `new_purchase`.
- Aktif + aynı plan → `renewal`.
- Aktif + farklı plan → `upgrade`.

### 8.4 Sunucu tarafı
- Her adım **server-side Zod** validation.
- Public checkout **rate-limit** (register'ın 5/10dk IP deseni) + e-posta benzersizliği.
- Referans **server'da** üretilir (ör. `BX-` + kısa base32 random, unique constraint + collision retry).
- `inapp` order'da `workshopId` **`requireAuth()`'tan** türetilir, client'tan alınmaz (tenant izolasyonu).
- Sunucu aksiyonları: `app/(app)/billing/actions.ts` → `createBillingOrder({planTier, billingCycle, billingInfo})`; public → `POST /api/checkout` (Workshop+User+Order, register mantığını yeniden kullanır).

## 9. BakımX yönetim paneli (mevcut `/admin` genişletilir)

`ADMIN_EMAILS` gating aynı. Mevcut tek-sayfa + bileşen desenine yeni `admin-billing.tsx` eklenir (gerekirse `/admin/orders` alt-route).

- **Ödemeler / Satın almalar (inbox):** `BillingOrder` listesi, `pending_payment` üstte. Satır: workshop, type, plan, döngü, tutar, referans, fatura bilgisi, tarih, not. Aksiyonlar:
  - **"Havale alındı → Onayla"** → `confirmBillingOrder(orderId)` (aşağıda).
  - **"İptal"** → `cancelBillingOrder(orderId)` (status=cancelled).
- **Abonelikler:** tüm workshop'lar — plan, `subscriptionStatus`, `currentPeriodEnd`, kalan gün, son onaylı ödeme. Filtreler: yakında bitecek / bitmiş / deneme / aktif.
- **Gelir özeti:** aktif abonelik sayısı, **MRR** (aboneliklerin aylığa normalize tutarı), bu ay onaylanan gelir (confirmed order toplamı). Basit kartlar.
- Mevcut demo/destek talepleri + onay/koltuk aksiyonları **korunur**. CLI `workshop-admin.ts set-plan` panel ile değiştirilir (yedek kalır).

## 10. Yaşam döngüsü, durum makinesi & kod değişiklikleri

### 10.1 `confirmBillingOrder(orderId)` (admin, transaction)
1. Order yüklenir (admin-gated), `pending_payment` olmalı.
2. `periodStart = (currentPeriodEnd && currentPeriodEnd > now) ? currentPeriodEnd : now` (erken yenilemeyi uzatır, kesmez).
3. `periodEnd = periodStart + (cycle == monthly ? 1 ay : 1 yıl)`.
4. **Workshop:** `planTier=order.planTier`, `billingCycle=order.billingCycle`, `subscriptionStatus=active`, `currentPeriodEnd=periodEnd`, `approvalStatus=approved` (pending ise), `requestedPlanTier/planRequestedAt` temizlenir.
5. **Order:** `status=confirmed`, `confirmedAt=now`, `confirmedByEmail`, `periodStart`, `periodEnd`.
6. PDF makbuz üretilir (snapshot'tan).

### 10.2 `getPlanState` değişikliği (dönem sonu kilidi)
- Yeni kontrol: `subscriptionStatus == active && currentPeriodEnd && now > currentPeriodEnd` → `hasAccess=false`, **yeni `lockReason="subscription_expired"`**.
- `<PlanLocked>`'a `subscription_expired` case'i: "Aboneliğiniz sona erdi. Devam etmek için paketinizi yenileyin." + paket seçtirme.
- Mevcut `subscription_inactive` (`past_due|canceled`) ve `trial_expired` davranışları korunur.

### 10.3 Yenileme banner'ı
- `(app)/layout.tsx`'te trial banner deseninin yanına: `subscriptionStatus=active && currentPeriodEnd` ve kalan ≤ 7 gün → "Aboneliğiniz N gün sonra sona eriyor → Yenile" (`/billing/checkout`).

### 10.4 Akış özetleri
- **Public satın alma:** ziyaretçi → `/fiyatlar` → `/satin-al` → Workshop(pending)+Order(pending_payment) → admin onayla → Workshop(approved, active, period) + Order(confirmed) → erişim açılır + makbuz.
- **Deneme bitişi:** `<PlanLocked trial_expired>` → `/billing/checkout` → Order(pending_payment) → admin onayla → aktive.
- **Yükseltme:** `/billing` "Yükselt" → Order(upgrade) → onay → plan değişir.
- **Yenileme:** banner/kilit → Order(renewal) → onay → period uzar.
- **İptal:** admin → `subscriptionStatus=canceled` → dönem sonunda erişim kapanır.

## 11. e-Fatura / makbuz (v1)
- **Yasal e-Fatura/e-Arşiv entegrasyonu YOK** (kendi başına büyük; Premium roadmap'inde ayrı `eInvoice` özelliği).
- Onaylı ödeme için **basit PDF makbuz** üretilir (mevcut PDF altyapısı yeniden kullanılır), `billingSnapshot`'tan. Yasal fatura muhasebe tarafından **offline** kesilir.
- Vergi/fatura bilgisi şimdiden toplanır → e-Fatura sonra eklenince hazır.

## 12. Landing değişikliği (bilinçli)
- Mevcut "landing'de fiyat tablosu yok" kararı ([[landing-page-honesty-and-structure]]) **bilinçli güncellenir**: artık gerçek bir satın alma akışı olduğundan `/fiyatlar` + checkout eklenir. Self-serve CTA ve demo korunur; pazarlama yalnızca canlı özellikleri anlatma ilkesi sürer.

## 13. Riskler & azaltımlar
- **Tenant izolasyonu:** `inapp` order'da `workshopId` server-side ([[server-action-tenant-isolation]]); admin aksiyonları `ADMIN_EMAILS`-gated; public checkout yalnız kendi yeni workshop'unu yazar.
- **Public abuse / spam workshop:** rate-limit + e-posta benzersizliği + teyide kadar **erişim yok** (spam pending'de kalır; admin görür/iptal eder).
- **Para doğruluğu:** `Int` kuruş + snapshot; mevcut Float'a dokunulmaz.
- **Migration:** additive, backfill yok; prod'da `migrate deploy` + tag öncesi şema senkronu.
- **Çift teyit/yarış:** `confirmBillingOrder` transaction içinde `pending_payment` ön-koşulunu kontrol eder (idempotent değilse de güvenli geçiş).

## 14. Kabul kriterleri (manuel QA senaryoları)
1. Public ziyaretçi `/fiyatlar` → Pro/aylık satın al → Workshop `pending` + Order `pending_payment` oluşur, **giriş yapılamaz**.
2. Admin inbox'ta order'ı görür → "Onayla" → Workshop `approved`+`active`, `currentPeriodEnd ≈ now+1 ay`, Order `confirmed`, makbuz üretilir, müşteri giriş yapıp uygulamayı kullanabilir.
3. Trial workshop'ta deneme biter → `<PlanLocked trial_expired>` → checkout → Order → admin onayla → erişim açılır.
4. `currentPeriodEnd` 7 gün içindeyken in-app yenileme banner'ı görünür; geçince `<PlanLocked subscription_expired>` devreye girer; yenileme order'ı onayınca period uzar.
5. Panelde gelir özeti onaylı order'ları doğru toplar; abonelik listesi dönem-sonu filtreleri doğru çalışır.
6. `inapp` order client'tan `workshopId` ile manipüle edilemez (server `requireAuth`).

## 15. Açık varsayımlar
- Tek dönem birimi: aylık = +1 takvim ayı, yıllık = +1 takvim yılı.
- Yenileme hatırlatma eşiği 7 gün (ayarlanabilir sabit).
- Makbuz PDF içeriği mevcut PDF çıktısıyla aynı görsel dilde olacak.
- Plan fiyatları `plans-catalog.ts`'ten; KDV gösterimi v1'de basit (fiyatlar KDV dahil/hariç notu implementasyonda netleşecek — varsayılan: katalogdaki tutar nihai tutar).
