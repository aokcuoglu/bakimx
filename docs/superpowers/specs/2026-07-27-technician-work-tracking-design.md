# Teknisyen İş Takibi: Zorunlu Kontrol Listesi + Kalem Tamamlama + Katalog Bağlı Parça Talebi

Tarih: 2026-07-27
Durum: Onaylandı, uygulama bekliyor
Dal: `feat/technician-work-tracking` (base: `dev`)

## Problem

Teknisyen detay sayfası (`/technician/orders/[id]`) bugün üç yerde eksik:

1. **Kontrol listesi boş geliyor.** `ChecklistItem` modeli ve üç kategorisi (`inspection`/`repair`/`delivery`) var, ama hiçbir yerde otomatik oluşturulmuyor — teknisyen her maddeyi elle yazmak zorunda. Pratikte hiç kullanılmıyor. "Zorunlu" kavramı yok; `startWorkAction`/`completeWorkAction` kontrol listesine hiç bakmıyor.
2. **Parça/işçilik kalemleri salt-okunur.** İş emrine eklenen kalemlerin teknisyen tarafından yapılıp yapılmadığı hiçbir yerde tutulmuyor.
3. **Parça talebi tamamen serbest metin.** Teknisyen `partName`/`partSku` alanlarını elle yazıyor; iş emrindeki araca-uygun TecDoc katalog araması (`PartSearchInput`) burada yok. Ayrıca talepler ofis tarafında (`/orders/[id]`) hiç görünmüyor — döngü kapanmıyor.

## Hedef

Teknisyen aracı teslim alırken jenerik kontrolleri yapmak zorunda kalsın; iş emrindeki her parça/işçilik kaleminin yapılıp yapılmadığı takip edilebilsin; teknisyen parçayı katalogdan talep etsin ve ofis talebi tek tıkla iş emri kalemine çevirsin.

## Kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Şablon kaynağı | Kodda sabit sistem şablonu | Hızlı çıkar, şema yükü minimum; atölye-özel şablona sonradan genişletilebilir |
| Oluşma anı | Teknisyene atandığı anda | Kullanıcı senaryosuyla birebir; atanmamış emirlerde gürültü yok |
| Zorunluluk | İki kapı: başlama + tamamlama | Kabul kontrolünün işin sonunda toplu işaretlenmesini engeller |
| Kalem takibi | `ServiceOrderItem`'a 3 kolon | Tek gerçek kaynak; kopya kayıt senkronizasyon sorunu yok |
| Kalem kapısı | Tamamlamayı bloklar | Takibin gerçekten işlemesini garanti eder |
| Talep → katalog | Arama + seçimi kalıcılaştır | Ofis talebi kalemlerken doğru parçayı görür |
| Ofis tarafı | Gör + tek tıkla kaleme çevir | Teknisyen ister → ofis kalemler → teknisyen "yapıldı" işaretler |

## Şema değişiklikleri

Tek migration, 7 kolon — hepsi nullable veya varsayılanlı. Mevcut satırlar etkilenmez, geriye dönük veri riski yok.

```prisma
model ChecklistItem {
  // ...
  isRequired  Boolean @default(false)
  templateKey String?          // örn. "inspection.mileage_fuel"
  @@index([serviceOrderId, templateKey])
}

model ServiceOrderItem {
  // ...
  completedAt    DateTime?
  completedById  String?
  completedBy    Technician? @relation("ItemCompletedBy", fields: [completedById], references: [id])
  completionNote String?
}

model PartsRequest {
  // ...
  brand           String?
  tecdocArticleId Int?
}
```

`Technician` modeline `completedItems ServiceOrderItem[] @relation("ItemCompletedBy")` ters ilişkisi eklenir (mevcut `purchasedItems` ilişkisi ile çakışmaması için adlandırılmış relation şart).

## A. Jenerik kontrol listesi

### Şablon

`src/lib/technician/checklist-template.ts` — kategori + `templateKey` + açıklama + `sortOrder` içeren sabit dizi. Tüm maddeler `isRequired: true`.

**Kontrol (`inspection`)** — araç teslim alınırken:
1. Araç KM ve yakıt seviyesi kaydedildi
2. Görünür hasar/çizik kontrol edildi
3. Müşteri şikayeti araç üzerinde teyit edildi
4. Araç içi kişisel eşya kontrolü yapıldı
5. Motor yağı ve soğutma sıvısı seviyeleri kontrol edildi
6. Akü ve şarj durumu kontrol edildi
7. Lastik durumu ve hava basıncı kontrol edildi
8. Fren balata/disk gözle kontrol edildi

**Onarım (`repair`)**:
1. İş emrindeki tüm parça ve işçilik kalemleri tamamlandı
2. Sökülen parçalar müşteriye gösterilmek üzere ayrıldı
3. Arıza tekrar test edildi, giderildiği doğrulandı
4. Hata kodu / uyarı lambası kontrolü yapıldı

**Teslim (`delivery`)**:
1. Yol testi yapıldı
2. Sıvı kaçağı kontrolü yapıldı
3. Araç içi/dışı temizlik yapıldı, aletler toplandı
4. Yapılan işlemler müşteriye aktarılacak şekilde özetlendi

### Seed

`seedChecklistFromTemplate(tx, workshopId, serviceOrderId)` — `assignTechnicianAction` içinde, atama ile aynı transaction'da çağrılır.

İdempotanlık: o iş emrinde hâlihazırda var olan `templateKey`'ler okunur, yalnız eksikler `createMany` ile yazılır. Yeniden atama veya usta değişikliği tekrar madde üretmez, işaretlenmiş maddeleri sıfırlamaz.

`sortOrder` şablondaki sırayı korur; teknisyenin elle eklediği maddeler mevcut davranışla (kategori sonuna) eklenir.

### Silme koruması

`deleteChecklistItemAction` → `isRequired === true` ise `{ error: "Zorunlu kontrol maddesi silinemez" }`. Serbest eklenen maddeler silinebilir kalır. UI'da zorunlu maddede çöp ikonu gösterilmez.

## B. Zorunluluk kapıları

Ortak yardımcı: `src/lib/technician/gates.ts`

```ts
getBlockingChecklistItems(orderId, workshopId, categories) // tamamlanmamış zorunlu maddeler
getIncompleteOrderItems(orderId, workshopId)              // completedAt === null olan kalemler
```

- **`startWorkAction`**: tamamlanmamış zorunlu `inspection` maddesi varsa
  `{ error: "Araç kabul kontrolleri tamamlanmadan işe başlanamaz (N madde eksik)" }`.
- **`completeWorkAction`**: tamamlanmamış zorunlu `repair` + `delivery` maddesi **veya** tamamlanmamış parça/işçilik kalemi varsa blok; hata mesajı hangisinin eksik olduğunu ayırt eder.

Server action gerçek kapıdır. UI'da buton `disabled` + altında eksik sayısı gösterilir (mobilde tek satır, örn. "3 kontrol maddesi eksik"). İstemci durumu yalnız görünürlük içindir.

Kapı **"İşe Başla"** (durum geçişi, `startWorkAction`) butonuna uygulanır; "İşçilik Başlat" (`startLaborSessionAction`, kronometre) kapısız kalır — teknisyen kontrolleri yaparken de süre kaydı tutabilmeli.

Ofis kaynaklı `updateOrderStatusAction` gibi mevcut durum geçişleri **değiştirilmez** — kapılar yalnız teknisyen akışına uygulanır, böylece ofis gerektiğinde manuel geçiş yapabilir.

## C. Parça/işçilik kalemi takibi

### Action

`toggleOrderItemCompletedAction(itemId: string, done: boolean)` — `src/app/(app)/technician/actions.ts`:
- `requireWritableWorkshop()`, kalem `workshopId` ile doğrulanır (tenant izolasyonu),
- iş emri `isOrderLocked(status)` ise reddedilir,
- `completedAt = done ? new Date() : null`, `completedById = done ? order.assignedTechnicianId : null`,
- `AuditLog` kaydı (`orderId` + `metadata` ile — mevcut konvansiyon),
- `revalidatePath` teknisyen ve ofis detayları için.

### Attribution notu

`Technician` ile `User` arasında ilişki yok. `completedById` iş emrinin **atanmış ustası** olarak yazılır; gerçek eylemi yapan kullanıcı `AuditLog`'a düşer. Aynı düzeltme mevcut `toggleChecklistItemAction`'daki no-op'a da uygulanır (`completedById: checked ? null : null` → atanmış usta / null).

### UI

`technician-order-detail.tsx` içindeki salt-okunur kalem listesi → **"Yapılacak İşler"** bölümü:
- Parça ve İşçilik ayrı alt gruplar (mevcut `type` ayrımı korunur),
- Her satır tek dokunuşla ✓ (mobil öncelikli, satır yüksekliği ≥44px),
- Başlıkta ilerleme (`4/7`), tamamlananlar soluk + üstü çizili,
- Kilitli emirde (delivered/cancelled) toggle devre dışı.

Ofis tarafında `parts-labor-grid.tsx` satırına küçük salt-okunur "Yapıldı" rozeti — ofis buradan işaretleyemez, yalnız görür.

## D. Parça talebi → katalog

`AddPartsRequestForm` içindeki düz "Parça adı" input'u `PartSearchInput` ile değişir:
- `vehicleTypeId={vehicle.catalogVehicleTypeId}` — araç kataloğa bağlı değilse bileşen düz input gibi davranır (mevcut davranış, ek iş yok),
- `showCreate` kapalı (talep formunda "Oluştur & Düzenle" akışı anlamsız),
- Seçimde `partName` + `partSku` + `brand` + `tecdocArticleId` birlikte doldurulur; serbest metin yazılırsa yalnız `partName` gider.

`src/app/(app)/technician/orders/[id]/page.tsx` içindeki `safeOrder.vehicle`'a `catalogVehicleTypeId` eklenir (şu an client'a geçmiyor).

`partsRequestSchema` (`src/lib/validations/technician.ts`) `brand` ve `tecdocArticleId` alanlarıyla genişletilir; `tecdocArticleId` pozitif tamsayı veya yok.

## E. Ofis: Parça Talepleri kartı

- `/orders/[id]` sorgusuna `partsRequests` include edilir (`work-order-detail.tsx`'e serialize edilmiş alanlarla geçer).
- Yeni `parts-request-panel.tsx` (`src/components/orders/`): talepler durum rozetiyle listelenir; `requested` durumundaki her talepte **"Kaleme Ekle"** butonu.
- `convertPartsRequestToOrderItemAction(requestId)`:
  - tenant + kilit doğrulaması,
  - `ServiceOrderItem` oluşturur: `type: "part"`, `name`/`sku`/`brand`/`quantity` talepten, `source: request.tecdocArticleId ? "catalog" : "manual"`, `tecdocArticleId` taşınır, fiyat alanları boş (ofis girer),
  - talebi `prepared` yapar,
  - `AuditLog` + zaman çizelgesi kaydı,
  - tek transaction; çift tıklamada ikinci çağrı `status !== "requested"` kontrolüyle reddedilir.

## Kapsam dışı (bilinçli)

- Atölye-özel düzenlenebilir şablon (Ayarlar CRUD) — sabit şablon önce sahada denenecek.
- Servis tipine göre değişen madde setleri — iş emrinde güvenilir servis-tipi alanı yok.
- Kalemde adet bazlı kısmi tamamlama — tümü-ya-hiç yeterli.
- Kontrol listesinin ofis `/orders` detayında gösterilmesi.

## Risk alanları

- **Kapı çok sıkı olabilir**: ofis işi tamamlandıktan sonra kalem eklerse iş emri tekrar "eksik" duruma düşer. Bu bilinçli tercih (kullanıcı onayladı) ama sahada sürtünme yaratırsa ilk gevşetilecek yer burasıdır.
- **Seed sırası**: `assignTechnicianAction` bugün transaction kullanmıyor; seed eklenirken atama + seed tek `$transaction`'a alınır. Satır-başına upsert yerine tek `createMany` kullanılır (bkz. TecDoc persist transaction timeout olayı).
- **Migration**: yalnız kolon ekleme; `db:migrate` ile yerelde authoring, `db:deploy` ile AWS dev'e. Prod'a merge ile otomatik gider.

## Manuel QA

1. İş emrini teknisyene ata → teknisyen detayında 16 madde üç kategoride dolu gelir; hepsi zorunlu, çöp ikonu yok.
2. Ustayı değiştir → madde sayısı artmaz, işaretlenmişler sıfırlanmaz.
3. Kontrol maddeleri eksikken "İşe Başla" → engellenir, eksik sayısı görünür ("İşçilik Başlat" çalışmaya devam eder).
4. Kontroller tamam → işe başlanır. Onarım/Teslim eksikken "İşi Tamamla" → engellenir.
5. Parça/işçilik kalemlerinden biri işaretsizken "İşi Tamamla" → engellenir; hepsi ✓ ise geçer.
6. Kataloğa bağlı araçta parça talebi → arama önerileri gelir, seçilen parçanın markası talepte görünür.
7. Kataloğa bağlı olmayan araçta talep → serbest metin çalışır.
8. Ofis `/orders/[id]` → talep görünür, "Kaleme Ekle" kalemi oluşturur, talep "hazırlandı" olur; teknisyen sayfasında yeni kalem işaretlenebilir çıkar.
9. Teslim edilmiş emirde: kalem toggle ve madde işaretleme kilitli.
10. Mobil (375px): kalem satırları ve kontrol maddeleri tek elle dokunulabilir, yatay taşma yok.
