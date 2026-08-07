# Parça formu: zorunlu SKU, serbest marka, tedarikçi bazlı alış fiyatları

Tarih: 2026-07-31
Durum: Tasarım onaylandı, uygulama bekliyor

## Problem

`/parts/new` formu üç noktada gerçek atölye akışını yansıtmıyor:

1. **Parça Kodu (SKU) opsiyonel.** Kodsuz parça kaydı arama, mükerrer kayıt ve tedarikçi eşleştirmesini bozuyor.
2. **Marka alanı serbest girişi kaydetmiyor.** Combobox "Listede yok — yazdığınız değer kullanılacak" diyor ama Base UI Combobox Enter'da girişi geri alıyor; TecDoc listesinde olmayan marka pratikte girilemiyor.
3. **Alış fiyatı parçanın kendi alanı.** Aynı parça farklı tedarikçilerden farklı fiyata alınır; tek alan bu gerçeği taşıyamıyor. Ayrıca parça tek bir tedarikçiye bağlanabiliyor ve form hâlâ serbest metin tedarikçi adı/telefonu istiyor.

## Mevcut durum

- `PartStockItem`: tekil `supplierId` (nullable FK), legacy `supplierName`/`supplierPhone` metin alanları, tek `purchasePrice`/`salePrice`/`currency` (kuruş).
- `Supplier`: tam cari modeli; `parts PartStockItem[]` ile tek yönlü bağlı. `/suppliers/[id]` o tedarikçinin parçalarını listeliyor.
- `PartStockItem.purchasePrice` okuyucuları: `src/lib/analytics/queries.ts` (stok değeri), `src/lib/reports/queries.ts` (parça raporu), `src/components/parts/part-detail.tsx`.
- Marka önerileri `/api/tecdoc/brands` üzerinden geliyor.
- `SupplierAutocompleteField` (serbest-form tedarikçi adı) yalnız teknisyen dış-alım akışında kullanılıyor; bu tasarım onu değiştirmiyor.

## Kararlar

| Konu | Karar |
|---|---|
| Fiyat modeli | Yeni `PartSupplierPrice` tablosu (parça ↔ tedarikçi çoklu ilişki) |
| `PartStockItem.purchasePrice` | Kolon kalır, **türetilmiş** olur: varsayılan tedarikçi satırından senkronlanır |
| Marka | Şema değişmez; Autocomplete + TecDoc markaları ∪ atölyenin geçmiş markaları |
| SKU | Zorunlu, benzersizlik kontrolü yok |

## Veri modeli

```prisma
model PartSupplierPrice {
  id            String        @id @default(cuid())
  workshopId    String
  workshop      Workshop      @relation(fields: [workshopId], references: [id])
  partId        String
  part          PartStockItem @relation(fields: [partId], references: [id], onDelete: Cascade)
  supplierId    String
  supplier      Supplier      @relation(fields: [supplierId], references: [id])
  purchasePrice Int           // kuruş
  currency      String        @default("TRY")
  supplierSku   String?       // tedarikçinin kendi parça kodu
  isPreferred   Boolean       @default(false)
  note          String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@unique([partId, supplierId])
  @@index([workshopId])
  @@index([partId])
  @@index([supplierId])
}
```

`PartStockItem` ve `Supplier` modellerine `supplierPrices PartSupplierPrice[]` / `partPrices PartSupplierPrice[]` ters ilişkileri eklenir.

### Türetilmiş alanların senkronu

Parça her kaydedildiğinde (create + update), gönderilen satırlardan varsayılan olan seçilir ve parçaya yazılır:

- `PartStockItem.purchasePrice` = varsayılan satırın `purchasePrice`'ı, satır yoksa `null`
- `PartStockItem.currency` = varsayılan satırın `currency`'si (satır yoksa formdaki değer korunur)
- `PartStockItem.supplierId` = varsayılan satırın `supplierId`'si, satır yoksa `null`

Böylece `analytics/queries.ts`, `reports/queries.ts`, `/suppliers/[id]` parça listesi ve kritik-stok-tedarikçi widget'ı **kod değişikliği olmadan** çalışmaya devam eder.

### Migration

Tek migration, iki adım:

1. `CREATE TABLE part_supplier_prices` (+ index/unique/FK).
2. Backfill: `supplierId IS NOT NULL AND purchasePrice IS NOT NULL` olan her parça için `isPreferred = true` tek satır (`INSERT ... SELECT`).

Mevcut hiçbir kolon silinmez, veri kaybı yok. Yerelde `bun run db:migrate`, AWS dev'e `bun run db:deploy`.

**Legacy metin alanları:** `supplierName`/`supplierPhone` kolonları kalır ama formdan kaldırılır. Parça detayında yalnız bağlı cari yoksa gösterilir (eski kayıtların bilgisi kaybolmasın).

## Form değişiklikleri (`part-form.tsx`)

### Parça Bilgileri
- **Parça Kodu / SKU**: zorunlu. Placeholder "Opsiyonel" → örnek kod. Etiket `Parça Kodu / SKU *`.
- **Marka**: `Combobox` → `Autocomplete`. Yazılan değer her koşulda kaydedilir. Öneri kaynağı: `/api/tecdoc/brands` ∪ server'dan prop olarak gelen atölye markaları (`SELECT DISTINCT brand FROM part_stock_items WHERE workshopId = ? AND brand IS NOT NULL`).

### Fiyat Bilgileri
- **Alış Fiyatı** alanı kaldırılır. Kartta yalnız Satış Fiyatı + Para Birimi kalır.

### Tedarikçi Bilgisi → "Tedarikçiler & Alış Fiyatları"
- Serbest metin `Tedarikçi Adı` / `Tedarikçi Telefonu` alanları ve tekil `Tedarikçi Seç` select'i kaldırılır.
- Yerine satır listesi. Her satır: `Tedarikçi (kayıtlı carilerden select)` · `Tedarikçi parça kodu` (ops.) · `Alış fiyatı ₺` · `varsayılan` radio · sil butonu.
- `+ Tedarikçi ekle` yeni boş satır ekler.
- Tedarikçi select'inin sonunda **"+ Yeni tedarikçi oluştur"** → modal (ad zorunlu; telefon, şehir opsiyonel) → mevcut `createSupplierAction` ile gerçek cari açar, dönen id listeye eklenip satıra seçilir.
- Hiç cari yoksa boş-durum: açıklama + aynı modalı açan CTA.
- İlk satır eklendiğinde otomatik `isPreferred = true`. Varsayılan satır silinirse kalan ilk satır varsayılan olur.
- **Para birimi satırda girilmez.** Tüm satırlar parçanın para birimini (`Fiyat Bilgileri` kartındaki select) kullanır; `PartSupplierPrice.currency` bu değerle doldurulur. Kolon ileride tedarikçi-bazlı döviz için var, v1'de forma açılmaz.
- Mobilde satırlar kart olarak alt alta, `md+` grid. Sabit/sticky dip bar yok; tüm kontroller `h-9`.

## Doğrulama ve sunucu tarafı

- `partSchema` ve `partCreateSchema`: `sku` → `min(1, "Parça kodu zorunludur")`.
- Yeni `partSupplierPriceSchema` (dizi):
  - `supplierId` boş olamaz
  - `purchasePrice` tam sayı (kuruş), ≥ 0
  - `supplierSku` opsiyonel
  - dizide aynı `supplierId` iki kez olamaz → "Aynı tedarikçi birden fazla eklenemez"
  - en fazla bir satır `isPreferred = true`; satır varsa en az bir tanesi varsayılan olmalı
- Satırlar FormData'ya `supplierPrices` adıyla JSON string olarak yazılır; action `JSON.parse` + zod ile doğrular.
- **Tenant izolasyonu:** action `requireWritableWorkshop()` ile gelen `workshopId`'yi kullanır ve gönderilen tüm `supplierId`'lerin bu atölyeye ait olduğunu tek sorguda doğrular (`count === satır sayısı` değilse hata döner). Client'tan gelen workshopId'ye asla güvenilmez.
- Yazma: tek `prisma.$transaction` içinde `deleteMany({ partId })` + `createMany(rows)` + parça `update` (türetilmiş alanlar). **Satır-başına upsert kullanılmaz** — TecDoc parça persist'inde yaşanan 5 sn transaction timeout tuzağı tekrarlanmasın.

## Yan ekranlar

- `part-detail.tsx`: tek "Alış Fiyatı" satırı yerine tedarikçi fiyat tablosu (varsayılan rozetli, en düşük fiyat vurgulu). Satır yoksa "—".
- `supplier-detail.tsx`: tedarikçinin parça listesine alış fiyatı kolonu (`PartSupplierPrice` üzerinden).

## Test ve QA

**Unit testler** (mevcut `*.test.ts` deseninde, saf fonksiyon olarak):
- Varsayılan seçimi ve `purchasePrice`/`supplierId` türetme mantığı: satır yok → null; tek satır → o satır; varsayılan silindi → kalan ilk satır.
- Doğrulama: duplicate tedarikçi reddi, birden fazla varsayılan reddi, negatif fiyat reddi.

**Manuel QA:**
1. `/parts/new`: SKU boş bırak → "Parça kodu zorunludur".
2. Markaya listede olmayan bir değer yaz, kaydet → değer korunuyor mu.
3. İki tedarikçi + farklı fiyat ekle, varsayılanı değiştir → parça detayında doğru fiyat.
4. Select'ten "+ Yeni tedarikçi oluştur" → cari `/suppliers` listesinde görünüyor mu.
5. Mevcut bir parçayı düzenle → eski tedarikçi/fiyat satır olarak geliyor mu (backfill).
6. Raporlar → Parçalar ve Operasyonel Analiz stok değeri değişmemiş olmalı.
7. Mobil (375 px): satırlar okunabilir, yatay taşma yok.

## Riskler

- **SKU'su boş eski kayıtlar:** düzenleme sırasında kod girmek zorunlu olur. Bilinçli kabul edildi.
- **Tüm satırların silinmesi:** `purchasePrice` null'a düşer, stok değeri raporunda o parça 0 sayılır. Bu bilinçli davranış — tedarikçisiz parçanın alış fiyatı yoktur. Varsayılan satır silindiğinde ise kalan ilk satır varsayılan olur, fiyat null'a düşmez.
- **Tedarikçi silme/pasife alma:** FK korunuyor; pasif tedarikçi satırda "pasif" etiketiyle gösterilir, yeni satır eklemede listelenmez.
- **Backfill:** yalnız hem tedarikçisi hem fiyatı olan parçalar taşınır; sadece serbest metin tedarikçi adı olan kayıtlar satır üretmez (cari karşılığı yok), metin alanı detayda görünmeye devam eder.

## Kapsam dışı

- Tedarikçi fiyat geçmişi/versiyonlama.
- Teklif ve iş emri akışlarında tedarikçi seçimine göre otomatik fiyatlama.
- SKU benzersizlik kontrolü.
- Toplu fiyat güncelleme / içe aktarma.
