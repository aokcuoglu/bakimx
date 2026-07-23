# Birleşik Parça Ekleme (Odoo-tarzı tek arama menüsü) — Tasarım

**Tarih:** 2026-07-23
**Kapsam:** Bileşen düzeyi — İş Emri detayındaki "Kullanılan Parçalar & İşçilikler" bölümü (`PartsLaborGrid`).
**Durum:** Onaylandı, uygulamaya hazır.

## Amaç

Parça ekleme akışını Odoo'nun sipariş satırı modeline indirmek: iki ayrı parça sekmesini
(`Araca Uygun Parça` katalog araması + `Elle Parça Yaz` serbest metin) **tek bir arama
kutusuna** birleştirmek. Kullanıcı arar; katalog eşleşmesi varsa listelenir, yoksa
`Oluştur "X"` / `Oluştur & Düzenle` ile kendi kalemini ekler.

Katalog verisi zaten VIN→RapidAPI ile DB'ye çekilip cache'lendiği için ("araca uygun
parça") arama sonuçları bu cache'ten gelir. Bu değişmiyor — sadece giriş noktası tekleşiyor.

## Genel yapı

- `TabsList` **3 → 2 sekme** olur: **`Parça`** (birleşik arama kutusu) + **`İşçilik`** (aynen).
- Parça sekmesindeki üst "Yeni kalem ekle" kartı (`ComposerCard` + `CatalogComposer` +
  `ManualComposer` + `ComposerFooter`) **tamamen kalkar**; yerine tek satır arama kutusu gelir.
- **Composer draft kavramı kalkar**: saf arama kutusu modunda üstte Miktar/Fiyat/Marka/Kategori
  alanı yoktur. Her aksiyon doğrudan `addItem` POST'u yapar → satır anında alttaki listeye düşer
  → kullanıcı miktar/fiyat/marka/kategoriyi **satır-içinde** (mevcut inline editör) düzenler.

```
[ 🔍  Parça ara veya ekle...                        🔍 ]   ← tek satır (sağdaki 🔍 = TecDoc picker modalı)
      │ yazınca:
      ▼
   ┌───────────────────────────────────┐
   │ [img] Hava filtresi  C27125·MANN  │  ← katalog eşleşmeleri (varsa)
   │ [img] Yağ filtresi   ...          │
   │ ───────────────────────────────── │
   │ ➕ Oluştur "fren balatası"         │  ← HER ZAMAN en altta (eşleşme olsa da)
   │ ✏️  Oluştur & Düzenle...           │
   └───────────────────────────────────┘
```

- Sağdaki **🔍 ikonu** = mevcut tam TecDoc katalog picker modalı (`TecdocPartPicker`), araç
  kataloğa bağlıysa. Aynen korunur.
- İki "Oluştur" seçeneği dropdown'un altında **her zaman** görünür (Odoo davranışı).
- Araç kataloğa bağlı değilse (`vehicleTypeId == null`): katalog eşleşmesi hiç çıkmaz, yalnız
  "Oluştur" seçenekleri gelir → eski "Elle Parça Yaz" senaryosu doğal olarak buraya erir.

## Aksiyon davranışları

Tüm aksiyonlar mevcut `addItem(draft: Row): Promise<boolean>` üzerinden gider (yeni POST yolu yok).

**a) Katalog eşleşmesi seçme** — `onSelectArticle`
`addItem` anında çağrılır: `name/sku/brand/category/categoryId` katalogdan;
`source="catalog"`, `quantity=1`, `unitPrice=null`. Kullanıcı **fiyatı satırda** girer
(TecDoc fiyat vermez — dürüstlük kuralı: parça fiyatı asla uydurulmaz).

**b) `Oluştur "X"`**
`addItem` ile anında satır: `name=X`, `source="manual"`, `quantity=1`, `unitPrice=null`,
marka/kategori boş. Enter = ilk seçeneği tetikler; eşleşme yoksa doğrudan `Oluştur "X"`.

**c) `Oluştur & Düzenle…`**
Odaklı modal (mobil-first, `ui/dialog`). Alanlar: Parça adı (yazılan metin ön-dolu), Marka,
Kategori, Miktar, Birim Fiyat. "Ekle" → tüm alanlarla `addItem(source="manual")`.
Marka/Kategori için mevcut `PartAttributeField` (araç bağlıysa öneri + serbest metin),
Miktar için `QtyStepper`, fiyat için `PriceField` yeniden kullanılır.

**Ortak:** başarılı her eklemeden sonra arama kutusu temizlenir + odak korunur → hızlı ardışık
giriş. (`PartSearchInput` zaten `value=""` ile temizlenir; ekleme sonrası bir `nonce` remount
veya kontrollü reset ile kutu boşaltılır ve odak geri verilir.)

## Değişmeyen

Alttaki liste (masaüstü `Table` + mobil kart), satır-içi düzenleme, otosave + `✓ Kaydedildi`
flash, `SupplierPriceDialog` fiyat karşılaştırma, `SourceBadge`/`PurchaseDetailButton` dış-alım
rozeti, kilitli-emir davranışı (`isOrderLocked`), `EmptyItemsHint`. Hepsi aynen.

## Dosya değişiklikleri

- **`src/components/app/parts-labor-grid.tsx`** (ana değişiklik):
  - `TabsList` 3 → 2 sekme (`katalog`+`manuel` → tek `parca`).
  - `CatalogComposer`/`CatalogComposerBody`/`ManualComposer`/`ManualComposerBody` **kaldırılır**.
  - Yeni `UnifiedPartComposer`: `PartSearchInput`'u sarar, `onSelectArticle`/`onCreate`/
    `onCreateEdit` → doğrudan `addItem`; ekleme sonrası kutuyu reset eder. `🔍` TecDoc picker
    tetikleyici ve `RowTecdocPicker` mantığı korunur.
  - `defaultValue` sekme mantığı: `linked ? "parca" : "parca"` (parça hep varsayılan; artık
    tek parça sekmesi var). `İşçilik` sekmesi + `LaborComposer` aynen.
  - `EmptyItemsHint` metni sekme-adına göre güncellenir ("Parça").
  - `ComposerCard`/`ComposerFooter` parça tarafında kullanılmaz (İşçilik hâlâ kendi düzeninde;
    `ComposerFooter` İşçilik'te kullanılmıyorsa ölü kod olarak temizlenir — kontrol edilecek).
- **`src/components/app/part-search-input.tsx`**:
  - Dropdown'a **her zaman görünen** iki create aksiyonu (footer): `Oluştur "<query>"` +
    `Oluştur & Düzenle…`. Hem eşleşme varken (liste altı) hem boşken (`AutocompleteEmpty` yerine).
  - Yeni prop'lar: `onCreate(name)`, `onCreateEdit(name)`. `onCommit` yerine/yanında.
  - Enter mantığı: eşleşme yokken Enter → `onCreate(query)`.
  - `vehicleTypeId == null` (katalogsuz) dalında da create aksiyonları çıkar.
- **`src/components/app/manual-part-dialog.tsx`** (yeni): `Oluştur & Düzenle` modalı. `ui/dialog`
  + `PartAttributeField` + `QtyStepper` + `PriceField`. `parts-labor-grid.tsx` 1200+ satır
  olduğu için modal ayrı dosyaya alınır (odak/test kolaylığı).

## Risk alanları

- **`PartSearchInput` iki tüketici**: composer (yeni birleşik) + liste satırları (`bare` mod).
  Create aksiyonları yalnız composer'da görünmeli; `bare` modda ASLA (liste satırı ad düzenleme
  kutusu create önermez). `bare`/create-gösterimi bayrağıyla ayrılacak.
- **Odak/reset**: ekleme sonrası kutu temizlenmeli ama odak kaybolmamalı; mevcut `value` prop
  senkron `useEffect`'i (`skipNextSearch`) ile çakışmamalı.
- **`vehicleTypeId == null` dalı**: bu dal ayrı bir `InputGroup` render ediyor (Autocomplete yok);
  create footer'ı burada da tutarlı görünmeli — muhtemelen her iki dalı da Autocomplete'e
  taşımak yerine bu dalda basit "Oluştur/Düzenle" butonları gösterilecek.
- **Kilitli emir**: composer zaten `!locked` ile gizli; create aksiyonları da otomatik gizli olur.
- **Şema/DB**: değişiklik YOK — mevcut `POST /api/orders/items` alanları (`source` dahil) yeterli.
- **Tenant izolasyonu**: yeni sunucu yolu yok; mevcut korumalar geçerli.

## Manuel QA

1. Kataloğa bağlı araçta parça ara → eşleşme seç → satır düşer, fiyatı satırda gir.
2. Eşleşmeyen metin yaz → `Oluştur "X"` → manuel satır düşer.
3. `Oluştur & Düzenle` → modalda marka/kategori/miktar/fiyat doldur → Ekle.
4. Kataloğa bağlı OLMAYAN araçta: sadece Oluştur seçenekleri çıkıyor mu?
5. Ekleme sonrası kutu temizleniyor + odakta kalıyor mu (ardışık giriş)?
6. Sağdaki 🔍 TecDoc picker modalı hâlâ çalışıyor mu?
7. İşçilik sekmesi (iç/dış) aynen çalışıyor mu?
8. Kilitli emirde composer + create aksiyonları gizli mi?
9. Mobil: modal + arama kutusu + satır kartları dokunma-dostu mu?
10. Liste satır-içi düzenleme, otosave flash, fiyat karşılaştırma, dış-alım rozeti bozulmadı mı?

## Uygulama notu

İş izole bir git worktree'de yapılmalı (paralel oturum çakışma dersi — bkz. memory
`isolate-parallel-work-in-worktree`). Base dal = `dev`.
