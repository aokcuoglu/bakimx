# Araç Kabulünden Hızlı Teklif Oluşturma

## Amaç

`/intakes/[id]` sayfasındaki "Sipariş" sekmesinden, mevcut servis emri (varsa) bilgilerine
istinaden tek tıkla bir `Teklif` (`/quotes`) kaydı oluşturup kullanıcıyı doğrudan o teklife
yönlendirmek. Şu an teklif oluşturmanın tek yolu `/quotes/new` formunu baştan doldurmak;
bu, kabul sırasında zaten girilmiş müşteri/araç/kalem bilgisini tekrar yazdırıyor.

## Kapsam

- Yeni server action: `createQuoteFromIntakeAction(intakeId: string)`
  (`src/app/(app)/quotes/actions.ts`).
- `IntakeDetail` bileşenine ("Sipariş" sekmesi) "Teklif Oluştur" butonu.
- Şema değişikliği yok (mevcut `Quote`/`QuoteItem`/`ServiceOrder`/`ServiceOrderItem`
  modelleri yeterli).

## Davranış

1. Kullanıcı "Sipariş" sekmesinde "Teklif Oluştur" butonuna basar. Bu buton hem servis
   emri henüz oluşturulmamışken (boş durum kartında) hem de servis emri varken (kalem
   listesinin yanında) görünür — aynı handler'ı kullanır.
2. İstemci, `intake.id` ile `createQuoteFromIntakeAction`'ı çağırır (mevcut
   `handleConvert` / `convertQuoteToWorkOrderAction` çağrı deseniyle aynı: doğrudan
   server action import + `FormData`, `useTransition` yok).
3. Server action:
   - `requireAuth()` ile `workshopId` alır (tenant izolasyonu).
   - `VehicleIntakeForm`'u `{ id: intakeId, workshopId }` ile bulur; `order` (varsa)
     `items` dahil çekilir.
   - Yeni `Quote` oluşturur:
     - `customerId` ← `intake.customerId`, `vehicleId` ← `intake.vehicleId`
     - `quoteNo` ← `generateQuoteNo()`
     - `customerRequest` ← `intake.customerComplaint`
     - `internalNote` ← `intake.internalNote`
     - `status` ← `"draft"`
     - `discountAmount` / `taxRate` ← siparişten kopyalanır (sipariş yoksa `null`)
     - `estimatedLaborTotal` / `estimatedPartsTotal` / `grandTotal` ← sipariş kalemlerinden
       `calculateOrderTotals` ile **sunucuda** yeniden hesaplanır (mevcut
       `createQuoteAction` ile aynı otorite kuralı — istemciden toplam kabul edilmez).
   - Sipariş kalemleri varsa, her biri için `QuoteItem` oluşturulur (`type`, `name`,
     `quantity`, `unitPrice`, `totalPrice`, `note` birebir kopyalanır; para zaten kuruş,
     TRY↔kuruş dönüşümü gerekmez). Sipariş yoksa veya kalemsizse, kalemsiz taslak teklif
     oluşturulur.
   - `AuditLogAction(workshopId, user.id, "Quote", quote.id, "quote_created_from_intake")`
   - `revalidatePath("/quotes")`
   - Döner: `{ success: true, id: quote.id }` veya `{ error: string }`
     (örn. kabul bulunamazsa `"Kabul bulunamadı"`).
4. İstemci başarı durumunda `router.push(`/quotes/${id}`)` yapar; hata durumunda mevcut
   `error` state'ine yazar (component zaten bunu render ediyor).

## Veri / Tip Değişiklikleri

- `IntakeDetailProps.order` tipi (`src/components/app/intake-detail.tsx`) şu an sadece
  `{ id, status, paymentStatus, items }` alanlarını taşıyor. `discountAmount: number | null`
  ve `taxRate: number | null` eklenir. Sayfa sorgusu (`intakes/[id]/page.tsx`) zaten
  `order: { include: { items: true } }` ile tüm `ServiceOrder` alanlarını çekiyor —
  sorguda değişiklik gerekmez, sadece TypeScript tipi genişletilir.

## Hata Durumları

- Kabul bulunamazsa (`workshopId` eşleşmezse) → `{ error: "Kabul bulunamadı" }`.
- Diğer tüm veri erişimleri mevcut `requireAuth()` / `workshopId` filtreleme deseniyle
  tenant izolasyonunu korur.

## Kapsam Dışı

- Teklif → sipariş dönüşümünde olduğu gibi tersine bir referans (`Quote.sourceIntakeId`
  gibi) eklenmiyor; bu, MVP hız hedefi için gerekli değil ve şema migrasyonu gerektirir.
- Aynı kabulden birden fazla teklif oluşturulmasını engelleyen bir kısıtlama yok
  (kullanıcı birden fazla revizyon oluşturabilir, taslaklar silinebilir).

## Test / Doğrulama

- Yeni action için birim/entegrasyon testi (varsa mevcut quote action testleriyle aynı
  desende) — sipariş kalemli / kalemsiz / sipariş yok senaryoları.
- Manuel QA: `/intakes/[id]` → Sipariş sekmesi → "Teklif Oluştur" → `/quotes/[id]`'e
  yönlenip kalemlerin/toplamların doğru göründüğünü doğrula (hem sipariş var hem yok
  durumunda).
