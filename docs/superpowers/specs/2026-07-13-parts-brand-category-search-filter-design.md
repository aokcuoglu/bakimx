# Marka & Kategori ile arama/filtre (Parça/İşçilik ızgarası)

**Tarih:** 2026-07-13
**Durum:** Onaylandı (tasarım) — implementasyon planı bekliyor
**Kapsam:** İş emri "Kullanılan Parçalar & İşçilikler" ızgarasında parça satırının **Marka** ve **Kategori** kolonlarını arama/filtre girişine dönüştürmek
**İlişki:** `2026-07-10-cascade-brand-category-filter-design.md`'yi **geçersiz kılar**. O tasarımın bileşenleri (`part-brand-combobox.tsx`, `item-category-cascade.tsx`) arama-öncelikli redesign'da (fix/tecdoc-picker-search) silindi; marka/kategori salt-görünür kolona indi. Bu spec, filtreyi o arama-öncelikli akışa entegre eder. Prior spec'in veri-kaynağı kararları (araç-scoped marka, flatten leaf + üst-kategori yolu, kategori-öncelikli güvenilir yol) devralınır.

## Problem

Arama-öncelikli redesign'da **Marka** ve **Kategori** kolonları salt-görünür oldu; yalnız picker'dan parça seçilince doluyor. Kullanıcı parçayı **marka veya kategori üzerinden de** arayabilmek istiyor — sadece 🔍 ikon-butonuyla değil, doğrudan bu kolonlardan.

## Kararlar (kullanıcı onayı ile, bu oturum)

1. **Hibrit etkileşim.** Cache'te veri varsa inline combobox ile hızlı filtre; yanında picker'ı ön-odaklı açan "Katalogda ara →" kısayolu.
2. **Böngöz seçim davranışı.** Marka veya Kategori seçilir seçilmez (parça adı yazmadan) o gruptaki cache'li parçalar "Parça/İşçilik" kutusunda hemen listelenir; yazınca daralır.
3. **Filtre satıra yazılmaz.** Combobox seçimi yalnız aramayı daraltır; satırın kalıcı `brand`/`category`/`categoryId` değeri hâlâ **seçilen parçadan** gelir (persist modeli değişmez). Parça seçilince combobox'lar o parçanın marka/kategorisini yansıtır; satır temizlenince filtreler de sıfırlanır.
4. **Kategori combobox = flatten leaf liste.** Dar kolonda drill-down yerine tüm yaprak kategoriler tek aranabilir listede; her yaprağın üst-kategori yolu ikincil (muted) metin. Tam ağaç gezintisi picker'da kalır.
5. **Çapraz-budama YOK (v1).** Marka seçince kategoriler / kategori seçince markalar daraltılmaz; ikisi bağımsız filtre, aramada AND'lenir. (İleride `categories?supplierId=` ile eklenebilir — kapsam dışı.)
6. **Masaüstü (md+) özelliği.** Kolonlar zaten `hidden md:block`. Mobilde marka/kategori filtresi picker üzerinden kalır (mobil-first korunur; dar ekranda combobox kalabalık yapardı).

## Mimari

Bir lib fonksiyonu + bir API route parametresi + bir yeni bileşen + iki mevcut bileşen değişir. Şema değişikliği **YOK**.

### Server lib (`src/lib/tecdoc/catalog.ts`)
`searchVehicleArticles(vehicleId, query, opts?)` genişletilir:
- Yeni `opts?: { supplierId?: number; categoryId?: number; limit?: number }`.
- Prisma `where`'e opsiyonel `supplierId` / `categoryId` AND-filtresi eklenir.
- **Böngöz kuralı:** `query.trim().length < 2` olsa bile `supplierId` veya `categoryId` verilmişse `[]` yerine o grubun parçaları döner (mevcut `limit`/sıralama korunur). Hiç filtre yoksa ve query < 2 ise mevcut davranış: `[]`.
- Mevcut kategori-adı çözümleme (cache'li ağaçtan `id→ad`) korunur.

`getVehicleBrands(vehicleId)` ve `getVehicleCategories(vehicleId)` **aynen kullanılır** (yeni fonksiyon yok).

### API (`src/app/api/tecdoc/articles/search/route.ts`)
- Opsiyonel `supplierId` & `categoryId` query paramları `parsePositiveInt` ile okunur, `searchVehicleArticles`'a `opts` olarak geçer.
- Guard/DB-only/kotasız davranış aynen korunur.
- Marka/kategori **seçenek listeleri** için yeni endpoint yok: mevcut `GET /api/tecdoc/brands?vehicleId=` (araç-scoped distinct markalar) ve `GET /api/tecdoc/categories?vehicleId=` (araç kategori ağacı) kullanılır.

### Yeni bileşen (`src/components/app/part-filter-combobox.tsx`)
Tek amaçlı, `@/components/ui/combobox` (Base UI, searchable) sarmalayıcısı üzerine; grid dosyasını şişirmemek için ayrı.
- Props: `kind: "brand" | "category"`, `vehicleTypeId: number`, `value` (seçili ad), `selectedId` (supplierId|categoryId), `disabled`, `onSelect(id, name)`, `onClear`, `onOpenPicker()`.
- Seçenekler:
  - `brand` → `GET /api/tecdoc/brands?vehicleId=X` → `{supplierId, supplierName}[]`.
  - `category` → `GET /api/tecdoc/categories?vehicleId=X` → ağaç; client'ta yapraklara düzleştirilir `{id, name, path}` (`path` = üst kategori adları " › " ile, satırda muted).
- Liste sonunda sabit **"Katalogda ara →"** kalemi → `onOpenPicker()` (seçenek seçmez).
- Base UI Combobox'ın free-form olmama davranışına dikkat (bkz. base-ui-combobox-not-freeform): katı liste-seçim modu; serbest metin gerekmez.
- Boş/hatalı fetch → sadece "Katalogda ara →" gösterilir (sessiz düşüş, arama akışını bozmaz).

### Grid (`src/components/app/parts-labor-grid.tsx`)
- Salt-görünür Marka/Kategori hücreleri (yalnız `isPart && editable && vehicle.catalogVehicleTypeId != null` iken) `PartFilterCombobox` ile değiştirilir; aksi halde mevcut salt-görünür metin/`—` korunur (fallback bozulmaz).
- Satır-yerel **filtre state** (persist edilmez): `filterSupplierId`, `filterCategoryId`. Combobox seçimi bunları günceller.
- Bu filtreler `PartSearchInput`'a prop olarak geçer.
- **"Katalogda ara →"** → mevcut per-satır `TecdocPartPicker`'ı açar; picker'ın `initialSupplierId`/`initialCategoryId`'sine seçili filtre değeri beslenir (zaten destekli).
- Parça seçilince (`onSelect`) mevcut davranış: `brand`/`category`/`categoryId`/`brandSupplierId` set edilir; filtre state seçilen parçanınkine senkronlanır.

### `src/components/app/part-search-input.tsx`
- Yeni props: `supplierId?: number | null`, `categoryId?: number | null`.
- Arama effect tetikleme koşulu: `query>=2` **VEYA** (`supplierId != null` || `categoryId != null`) — böngöz.
- Fetch URL'ine `&supplierId=`/`&categoryId=` eklenir.
- Dropdown görünürlük koşulu (`query.trim().length >= 2`) → filtre varsa da açılacak şekilde güncellenir.
- "Katalogdan getir" boş-durum kısayolu (bu oturumda eklendi) korunur.

## Veri modeli
Şema değişikliği **YOK**. Kullanılan mevcut alanlar:
- `TecdocArticle(vehicleTypeId, categoryId, supplierId, supplierName)` — filtre kaynağı; `@@index([vehicleTypeId, categoryId])` mevcut. (supplierId için ayrı index yok; araç başına satır sayısı düşük — yüzler mertebesi — sorun değil.)
- `ServiceOrderItem(brand, category, categoryId)` — satırda saklanan seçili değerler; **değişmez**.
- `Vehicle.catalogVehicleTypeId` — combobox'ların anahtarı (null → salt-görünür fallback).

## Risk alanları
- **Böngöz + büyük kategori:** çok sonuç → mevcut `limit`/`MAX_VISIBLE_ARTICLES` mantığı uygulanır; sıralama `articleNo asc` korunur.
- **Cache-only kısıt:** filtre yalnız daha önce picker'la gezilmiş kategori/markaları gösterir. "Katalogda ara →" bu boşluğu doldurur; kotasız DB-only davranış bozulmaz.
- **İmza değişimi:** `searchVehicleArticles` çağıranları tek (arama route'u); tarandı, başka çağıran yok.
- **Base UI Combobox tuzağı:** free-form olmayan davranış katı seçim için doğru; Enter/temizle guard'ları (base-ui-combobox-not-freeform notu) uygulanır.

## Manuel QA (Playwright, katalog-bağlı araç 34MHP923)
1. Kategori seç → Parça kutusu o kategorinin cache'li parçalarını hemen listeler (böngöz).
2. Marka seç → aynı şekilde markaya göre listeler; ikisi birden → AND daraltma.
3. Filtre seçiliyken parça adı yaz → sonuçlar hem filtreye hem metne daralır.
4. "Katalogda ara →" → picker o marka/kategoriye ön-odaklı açılır.
5. Parça seç → satır dolar; Marka/Kategori combobox'ları seçilen parçanınkini yansıtır.
6. Satırı temizle → filtreler sıfırlanır, Parça kutusu boşalır.
7. Katalog-bağlı **olmayan** araçta → Marka/Kategori salt-görünür fallback korunur, combobox çıkmaz.
8. Boş cache + filtre yok → mevcut "Eşleşen parça yok" + "Katalogdan getir" davranışı bozulmamış.
