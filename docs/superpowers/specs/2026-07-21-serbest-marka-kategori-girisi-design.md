# Faz 1 — Serbest Marka/Kategori Girişi (İş Emri Parça Satırı)

**Tarih:** 2026-07-21
**Kapsam:** Faz 1 (bu spec). Faz 2 (öğrenen atölye kataloğu + TecDoc join) ayrı bir spec'te ele alınacak.

## Problem

İş emri parça satırındaki (`PartsLaborGrid`) **Marka** ve **Kategori** kolonları bugün
`PartFilterCombobox` ile Base UI **Combobox** üzerine kurulu. Combobox katı
liste-seçimdir (free-form değil; listede olmayan girdiyi blur/Enter'da geri alır).
Liste yalnız **TecDoc/rapidapi kataloğundan** dolar. Katalogda olmayan bir marka
(örn. "seta") yazınca "Bulunamadı" gösterir ve **elle girilemez**.

İki ek sorun:
- Combobox seçimi `row.brand`/`row.category`'yi **hiç yazmıyor** — yalnız parça
  aramasını daraltan runtime `filter.supplierId`'yi set ediyor. `row.brand`
  yalnızca katalogdan tam parça seçilince doluyor. Yani kolon gerçek bir
  düzenlenebilir alan değil, salt filtre.
- Alanlar yalnız `md+` (masaüstü) ve yalnız araç TecDoc'a bağlıysa
  (`catalogVehicleTypeId != null`) düzenlenebilir. Mobilde salt-görünür; bağlı
  olmayan araçta marka/kategori girmek imkânsız.

## Amaç

Marka ve Kategori kolonlarını, katalog önerisi sunan **ama serbest metin de kabul
eden gerçek düzenlenebilir alana** çevirmek. Mobilde de düzenlenebilir olacak.
Araç TecDoc'a bağlı olmasa da serbest giriş çalışacak.

## Kararlar (brainstorm)

1. **Kapsam:** Faz 1 = serbest giriş. Faz 2 (öğrenen katalog) ayrı spec.
2. **Commit UX:** Açık `＋ "{yazılan}" ekle` liste aksiyonu (Enter/blur otomatik
   commit DEĞİL — kazara commit'i önlemek için).
3. **Mobil:** Marka/Kategori mobilde de düzenlenebilir olacak.

## Tasarım

### 1. Bileşen: `PartFilterCombobox` → Autocomplete tabanlı alan

Base UI Combobox free-form değildir (`base-ui-combobox-not-freeform` hafızası).
Bileşeni `src/components/ui/autocomplete.tsx` üzerine taşıyoruz — `PartSearchInput`
ile aynı desen (autoHighlight, free-text onChange, öneri seçince doldur).

**İki mod:**

- **Araç TecDoc'a bağlı** (`catalogVehicleTypeId != null`): katalog marka/kategorileri
  öneri listesi olarak yüklenir (bugünkü kotasız cache fetch: `/api/tecdoc/brands`,
  `/api/tecdoc/categories`). Ek olarak serbest metin yazılabilir.
- **Araç bağlı değil**: katalog fetch YOK, boş öneriyle saf serbest-metin input
  olarak görünür (bugün hiç görünmüyordu).

Yazılan metin hiçbir öneriyle eşleşmiyor **ve** boş değilse, liste altında
`＋ "{yazılan}" ekle` aksiyonu görünür → tıklayınca serbest değer satıra yazılır.
`🔍 Katalogda ara →` aksiyonu (yalnız bağlı araçta) korunur.

Öneri: bileşeni işlevi yansıtacak şekilde yeniden adlandır (`PartAttributeField`),
ya da mevcut ad korunabilir. Karar uygulamada.

### 2. Anlam değişikliği: kolon artık satıra yazar (persist)

| Seçim türü | `row.brand` / `row.category` | `row.categoryId` | Arama filtresi (`filter.supplierId` / `filter.categoryId`) |
|---|---|---|---|
| Katalogdan öneri | ✅ yazılır | ✅ (kategori için) | ✅ set edilir (aramayı daraltır) |
| Serbest `＋ ekle` | ✅ yazılır | ❌ `null` | ❌ (TecDoc'ta karşılığı yok) |
| Temizle | `null` | `null` | temizlenir |

Persist boru hattı hazır: `onCell(row, { brand })` ve
`onCell(row, { category, categoryId })` taslakta debounce + POST, kalıcı satırda
PATCH yapıyor. Sunucu `/api/orders/items` (POST/PATCH) `brand`/`category`/
`categoryId` alanlarını zaten kabul ediyor.

**API / Prisma şema / migration değişikliği YOK.**

### 3. Mobil

Marka/Kategori kolonları mobilde de düzenlenebilir olacak (bugün salt-görünür).
Mobil kartta parça adının altına aynı Autocomplete alanları eklenir; kompakt
tutulur. Base UI Autocomplete popup'ı mobilde çalışır.

### 4. Değer kaynağı (source of truth)

Bugün alan değeri `filter.supplierName ?? row.brand ?? ""` ile sürülüyor.
Her-seçim-persist ile bu ikisi yakınsar. Alan değeri **`row.brand`/`row.category`**
kaynağından sürülür; `filter.supplierId`/`filter.categoryId` yalnız arama-daraltma
için (katalog seçiminde set, serbestte bilinmez) korunur.

## Sınır durumları

- Katalog parçası seçildikten sonra markayı elle "seta" ile ezme: serbest commit
  `row.brand`'i ezer, `filter.supplierId` temizlenir (o marka artık TecDoc filtresi
  değil).
- `＋ ekle` metni `trim()`'lenir; boşsa aksiyon görünmez.
- Serbest marka satırda kalır ama `brandSupplierId` (runtime picker ipucu) `null`
  olur → picker o markayı ön-seçemez; sorun değil.
- Kilitli emirde (`isOrderLocked`) alan disabled kalır (bugünkü davranış).

## Dokunulacak dosyalar

- `src/components/app/part-filter-combobox.tsx` — Autocomplete'e taşı; `＋ ekle`
  + free-form commit + unlinked mod. (Yeniden adlandırılabilir.)
- `src/components/app/parts-labor-grid.tsx` — `onSelect` + yeni serbest-commit
  callback'i `onCell` ile persist et; unlinked araçta alanı göster; mobil
  düzenlenebilir alanlar ekle; alan değerini `row.*` kaynağından sür.
- API / Prisma / migration: **yok**.

## Risk alanları

- Combobox→Autocomplete geçişi mevcut **filtre-daraltma** davranışını korumalı:
  katalog markası seçimi hâlâ `filter.supplierId` set edip parça aramasını
  daraltmalı.
- "Her seçim persist eder" değişimi davranış değişikliğidir: markayı yalnız
  *filtrelemek* için seçen kullanıcı artık markayı da yazmış olur. Kasıtlı ve daha
  sezgisel.
- Mobil grid yerleşimine input eklemek dikeyde yer kaplar; kompakt tutulmalı.

## Test / QA

**Manuel QA senaryoları:**
1. Bağlı araçta katalog markası seç → parça araması daraldı **ve** `row.brand`
   yazıldı; refresh sonrası durur.
2. Bağlı araçta "seta" yaz → `＋ "seta" ekle` → satırda kalır; refresh sonrası durur.
3. **Bağlı olmayan araçta** marka ve kategori serbest gir → persist olur.
4. Mobilde (1)–(3) tekrar → düzenlenebilir + persist.
5. Kilitli/teslim edilmiş emirde alanlar disabled.
6. Serbest kategori commit'inde `categoryId=null` gidiyor (katalog kategorisinde
   dolu id gidiyor).

**Otomatik test:** Bileşenin free-form commit'i doğru callback'i çağırıyor mu
(projede ilgili test deseni varsa ekle).

## Faz 2 (bu spec'in DIŞINDA — ileride)

Elle girilen marka/parça-no/kategori'yi araç grubuna göre biriktiren atölyeye özel
"öğrenen" katalog; gelecekteki iş emirlerinde öneri; TecDoc (rapidapi) sonuçlarıyla
birleşik arama. Faz 1'in ürettiği serbest-metin verisi bunun girdisidir.
