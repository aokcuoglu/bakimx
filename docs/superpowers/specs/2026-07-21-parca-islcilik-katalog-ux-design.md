# Parça/İşçilik Composer UX İyileştirmeleri — Tasarım

Tarih: 2026-07-21
Branch: `feat/parca-islcilik-katalog-ux` (base: `dev`)
Dosya odağı: `src/components/app/parts-labor-grid.tsx`

## Amaç

İş emri "Kullanılan Parçalar & İşçilikler" tab'lı composer'ında dört kullanıcı
geri bildirimini gidermek:

1. Katalog tarafından da **işçilik** eklenebilmeli (ön-tanımlı işçilik tablosu;
   şimdilik mock, sonra DB).
2. Manuel composer'da **Miktar/Birim Fiyat** alanları alt satıra kayıyor (layout
   hatası).
3. Parça/İşçilik, Marka, Kategori hücrelerinde **metin kırpılıyor**, tamamı
   okunamıyor (mobile-first tam okunurluk gerekli).
4. Eklenen kalem **katalogdan mı manuel mi** geldiği belli değil — kaynak rozeti
   gerekli.

## Kararlar (kullanıcı onaylı)

- Katalog işçilik UX'i: **Katalog tab'ında Parça/İşçilik segment toggle** (tab
  sayısı 2 kalır).
- Kaynak sinyali: **yeni nullable `source` enum kolonu** (`catalog | manual`).
- Tam metin: **Tooltip (masaüstü hover / mobil dokun) + mobil kartta wrap**.

## 1. Katalogdan işçilik

- **Yeni dosya** `src/lib/labor/mock-labor-catalog.ts`, `mock-supplier-prices.ts`
  deseninde: deterministik, saf veri, gerçek DB'ye tek noktadan bağlanacak.
  - Tip: `LaborCatalogEntry = { id: string; name: string; category: string; defaultPriceKurus: number }`.
  - `getMockLaborCatalog(): LaborCatalogEntry[]` — ~20-25 gerçekçi TR işçilik
    kalemi (Bakım, Fren, Motor, Elektrik, Kaporta/Boya, Teşhis, Lastik/Balans…).
  - `searchLaborCatalog(query: string): LaborCatalogEntry[]` — ada/kategoriye göre
    basit filtre (aksansız, case-insensitive).
- **Katalog composer**'a `Parça / İşçilik` segment toggle (mevcut `Tabs`
  değil; küçük iki-düğmeli inline segment). Varsayılan: Parça.
  - İşçilik modunda: parça arama input'u yerine **işçilik combobox'ı**
    (Base UI `ui/combobox` — ön-tanımlı listeden seçim; free-form gerekmez;
    Enter guard'lı — `base-ui-combobox-not-freeform` notu). Marka/Kategori
    alanları gizli (mevcut `AttrCell` `!isPart` davranışı).
  - Seçimde: `type="labor"`, `name`, `unitPrice = defaultPriceKurus`
    (düzenlenebilir), `source="catalog"`.
- Katalog composer'ın mode'u remount nonce'ına dahil edilir — ekleme sonrası
  temiz sıfırlama korunur.

## 2. Layout düzeltmesi

- Manuel composer'da 5 alan (Tür, Ad, Marka, Kategori, Miktar+Fiyat) `lg:grid-cols-4`
  gridine sığmayıp sarıyordu. Her iki composer için **tutarlı responsive grid**:
  Miktar + Birim Fiyat tek hizalı blok; dar ekranda temiz sarar, `lg`'de tek
  satır. İşçilik modunda ad alanı geniş span alır (marka/kategori yokken boşluk
  oluşmaz).

## 3. Tam metin okunurluğu

- Yeni küçük yardımcı: değer dolu olduğunda hücreyi `ui/tooltip` ile sarmalayan
  ortak sarıcı (masaüstü hover, mobil dokun-basılı). İlgili input'lara `title`.
- Parça/İşçilik input'u, Marka ve Kategori (`AttrCell`) dolu değerlerinde tooltip.
- `MobilePartRow`'da değer satırları truncate yerine **wrap** — mobilde tam metin.

## 4. Kaynak rozeti

- **Şema** (`prisma/schema.prisma`):
  - `enum OrderItemSource { catalog manual }`
  - `ServiceOrderItem.source OrderItemSource?` (nullable).
  - Migration: additive + nullable, backfill yok, mevcut sorgular etkilenmez.
    Düşük risk. Akış: `db:migrate` (yerel throwaway authoring) → `db:deploy`
    (AWS dev tüneli).
- **Plumbing**:
  - `orderItemCreateSchema`: opsiyonel `source` alanı (`z.enum([...]).optional()`).
  - `addOrderItemAction`: `source` formData'dan okunur, doğrulanır, `create.data`'ya yazılır.
  - `PartsLaborGrid.addItem`: draft'ın `source`'unu POST'a ekler.
  - Katalog composer → `source="catalog"` (parça ve işçilik); manuel composer →
    `source="manual"`.
  - `OrderItem` tipi (`order-management-panel.tsx`) + `orders/[id]/page.tsx`'teki
    iki `items.map` → `source` alanı eklenir. `Row` draft'ında `source` taşınır.
- **UI rozeti**: Parça/İşçilik hücresinde ad'ın yanında küçük ikon + tooltip:
  - `source="catalog"` → `PackageCheck` + "Katalogdan eklendi"
  - `source="manual"` → `PencilLine` + "Manuel eklendi"
  - `source==null` (eski satır) → rozet yok.

## Dosyalar

- `prisma/schema.prisma` (+ yeni migration)
- `src/lib/labor/mock-labor-catalog.ts` (yeni) + testi
- `src/components/app/parts-labor-grid.tsx`
- `src/app/(app)/orders/actions.ts`
- `orderItemCreateSchema` (schemas dosyası)
- `src/app/(app)/orders/[id]/page.tsx`
- `src/components/app/order-management-panel.tsx`

## Risk alanları

- Migration (nullable additive — düşük risk, ama AWS dev DB paylaşımlı: deploy
  diğer worktree'leri de etkiler, additive olduğu için güvenli).
- Katalog composer'ın iki-modlu remount/sıfırlama davranışı.
- Base UI Combobox Enter/free-form davranışı (mobilde).
- Tenant izolasyonu: `source` sadece açıklayıcı; mevcut `workshopId` scope'u
  değişmez.

## Test/QA

- Unit: `mock-labor-catalog` determinizmi + arama filtresi.
- Manuel QA (mobil öncelik):
  - Katalog tab → İşçilik toggle → işçilik seç → fiyat dolar → Ekle → liste + rozet.
  - Katalog tab → Parça (mevcut akış bozulmadı) → rozet "Katalogdan".
  - Manuel tab → parça/işçilik → rozet "Manuel".
  - Uzun marka/kategori/ad → tooltip + mobil wrap tam okunur.
  - Manuel composer'da Miktar/Fiyat hizalı, sarmıyor.
