# Kategoriye özel cascade marka/kategori seçimi (Parça/İşçilik ızgarası)

**Tarih:** 2026-07-10
**Durum:** Onaylandı (tasarım) — implementasyon planı bekliyor
**Dal:** `feat/cascade-brand-category` (taban: `dev`, izole worktree `/Users/void/www/bakimx-cascade-filter`)
**Kapsam:** İş emri "Kullanılan Parçalar & İşçilikler" ızgarasında parça satırlarının **marka** ve **kategori** seçicileri

## Problem

Parça satırındaki **marka** dropdown'u (`part-brand-combobox.tsx`) `/api/tecdoc/brands`'ten TÜM global TecDoc tedarikçi listesini çekiyor — araçtan ve seçili kategoriden bağımsız. Sonuç: kullanıcı "-KYB", "0 WARM UP", "1A FIRST AUTOMOTIVE" gibi binlerce alakasız jenerik marka arasında kayboluyor.

**Kategori** seçici (`item-category-cascade.tsx`) ise ayrı bir Popover drill-down ağacı; searchable değil ve marka seçimiyle hiçbir ilişkisi yok.

İstenen: iki seçici **cascade** (karşılıklı filtreleyen) olsun, ikisi de **ShadcnUI (Base UI) searchable** bileşen olsun.

## Kararlar (kullanıcı onayı ile)

1. **Veri kaynağı — kategori öncelikli, tek yön güvenilir.** Kategori seçilince o kategorinin parçaları çekilip (picker'ın zaten yaptığı gibi) markalar ona göre daraltılır (**güvenilir**). Marka önce seçilirse kategoriler yalnızca DB'de o an cache'lenmiş `TecdocArticle` satırlarından **best-effort** daraltılır. Tam katalog öng-yüklemesi YAPILMAZ (prod'da TecDoc/RapidAPI kotası nedeniyle).
2. **Kategori seçici UX — düz aranabilir liste.** Drill-down ağaç kaldırılır; tüm yaprak kategoriler tek düz Combobox listesinde, her yaprağın üst-kategori yolu satırda ikincil (muted) metin olarak gösterilir. Yazınca anında aranır.
3. **Kategori seçilmeden marka listesi — araç-scoped.** Bu araç için cache'lenmiş tüm kategorilerdeki distinct markalar gösterilir (global jenerik liste kaldırılır).
4. **Çakışma — güvenilir yönde otomatik temizle, best-effort yönde sadece filtrele.** Kategori→marka (güvenilir): seçili marka yeni kategorinin marka setinde yoksa temizlenir. Marka→kategori (best-effort): değer SİLİNMEZ, yalnızca dropdown seçenekleri filtrelenir — cache eksikliği yüzünden geçerli bir kategorinin yanlışlıkla silinmesini önlemek için.
5. **Serbest metin — katalog-bağlı araçta kapalı.** Katalog-bağlı araçta yalnızca listeden seçim (katı). Base UI Combobox'ın Enter'da revert davranışı bu katı modda istenen davranıştır; `part-brand-combobox`'taki mevcut serbest-metin hack'i (`preventBaseUIHandler`) kaldırılır.
6. **Uç durum — katalog-bağlı olmayan araç.** `vehicle.catalogVehicleTypeId == null` ise cascade mümkün değil; mevcut **serbest-metin fallback** korunur (her iki alan için). Katı liste-only kuralı yalnızca katalog-bağlı araçta geçerli.

## Mimari

Üç bileşen + bir lib + iki API route değişir; hepsi mevcut `@/components/ui/combobox` (Base UI, searchable) sarmalayıcısı üzerine.

### Server lib (`src/lib/tecdoc/catalog.ts`)
- `getVehicleBrands(vehicleId)` → cache'li `TecdocArticle` satırlarından `vehicleTypeId=vehicleId` için distinct `(supplierId, supplierName)`, tr-locale sıralı `PartBrandSummary[]`.
- `getCategoryBrands(vehicleId, categoryId)` → `getArticlesByCategory(vehicleId, categoryId)` çağırır (yoksa provider'dan çekip persist eder), sonuçtan distinct `PartBrandSummary[]`. **Güvenilir yol.**
- `getBrandCategoryIds(vehicleId, supplierId)` → cache'li `TecdocArticle` satırlarından distinct `categoryId[]` (best-effort).

### API (`src/app/api/tecdoc/brands/route.ts`)
- Opsiyonel `?vehicleId=X` ve `&categoryId=Y` parametreleri eklenir.
- Parametresiz → eski global davranış (geri uyumluluk korunur).
- `vehicleId` + `categoryId` → `getCategoryBrands` (güvenilir).
- yalnız `vehicleId` → `getVehicleBrands`.
- `tecdocRouteGuard()` aynen uygulanır.

### API (`src/app/api/tecdoc/categories/route.ts`)
- Opsiyonel `&supplierId=Z` eklenir → yalnızca o markanın cache'li makalelerinin bulunduğu kategori id'lerini içerecek şekilde ağaç budanır (best-effort).

### `src/components/app/part-brand-combobox.tsx`
- Yeni prop'lar: `vehicleTypeId: number | null`, `categoryId: number | null`.
- Veri kaynağı:
  - `vehicleTypeId == null` → mevcut serbest-metin davranışı (fallback, `preventBaseUIHandler` korunur).
  - `categoryId != null` → `GET /api/tecdoc/brands?vehicleId=X&categoryId=Y`.
  - yalnız `vehicleTypeId != null` → `GET /api/tecdoc/brands?vehicleId=X`.
- Katalog-bağlı modda serbest metin kapalı (`preventBaseUIHandler` hack'i yalnız fallback'te kalır).

### `src/components/app/item-category-cascade.tsx`
- Popover drill-down ağacı → düz aranabilir `Combobox`. `GET /api/tecdoc/categories?vehicleId=X` ağacı çekilir, client'ta yapraklara düzleştirilir (`{id, name, path}`; `path` = üst kategori adları " › " ile). Yaprak listesi combobox'ta; arama `name` üzerinde.
- Yeni prop: `supplierId: number | null`. Verildiğinde `&supplierId=Z` ile daraltılmış ağaç çekilir.
- `vehicleTypeId == null` → mevcut serbest-metin `Input` fallback korunur.
- Seçimde eskisi gibi hem `category` (yaprağın adı) hem `categoryId` yazılır.

### `src/components/app/parts-labor-grid.tsx` (`GridRow`)
- Satır state'ine persist-EDİLMEYEN runtime alanı eklenir: `brandSupplierId?: number | null` (marka→kategori best-effort filtresi için supplierId taşır).
- Marka combobox `onChange` imzası `(name, supplierId)` verir; `brand` persist edilir, `brandSupplierId` yalnız local state'te tutulur.
- Markaya `vehicleTypeId` + `categoryId={row.categoryId}`, kategoriye `vehicleTypeId` + `supplierId={row.brandSupplierId ?? null}` geçilir.
- **Otomatik temizleme (yalnız güvenilir yön):** kategori değişince markanın yeni kategorinin marka setinde olup olmadığı `getCategoryBrands` cevabından kontrol edilir; yoksa `brand`/`brandSupplierId` temizlenir. Marka→kategori yönünde temizleme YOK.

## Veri modeli
Şema değişikliği YOK. Kullanılan mevcut alanlar:
- `TecdocArticle(vehicleTypeId, categoryId, supplierId, supplierName)` — cascade türetiminin kaynağı; `@@index([vehicleTypeId, categoryId])` mevcut.
- `ServiceOrderItem(brand, category, categoryId)` — satırda saklanan seçili değerler; değişmez (`brandSupplierId` persist edilmez).
- `Vehicle.catalogVehicleTypeId` — cascade'in anahtarı (null ise fallback).

## Risk alanları
- **Best-effort yön eksikliği:** Marka önce seçilirse, henüz göz atılmamış kategoriler listede görünmez (karar 1 & 4). Silme yapılmadığı için veri kaybı yok; kullanım arttıkça zenginleşir.
- **TecDoc kota:** Kategori seçimi bir makale fetch'i tetikleyebilir. Picker zaten aynı maliyeti taşıyor; mock ücretsiz, prod'da `rapidapi-quota.ts`'ten düşer. Mock asla cache'lenmez.
- **UX kayması:** Kategori artık ağaç değil düz liste; üst-kategori yolu satırda gösterilerek bağlam korunur.
- **supplierId türetimi:** Satır state'i markayı hem ad hem `brandSupplierId` olarak tutar (yalnız runtime; DB'ye yalnız `brand` adı gider).

## Manuel QA
Katalog-bağlı araçta:
1. Kategori seç → marka listesi o kategoriye daralır; arama çalışır.
2. Marka değiştir → kategori listesi best-effort daralır (değer silinmez).
3. Kategori değiştir → uyumsuz seçili marka otomatik temizlenir.
4. Kategori seçmeden marka aç → yalnızca araç-scoped markalar.
5. Her iki combobox'ta yazarak arama.
6. Kaydet → `brand`/`category`/`categoryId` doğru persist.

Katalog-bağlı OLMAYAN araçta:
7. Her iki alan serbest metin olarak çalışır (fallback bozulmamış).
