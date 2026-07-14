# VIN oto-teyit + yaygın parça prefetch + VIN model-önek dedupe — Tasarım

**Tarih:** 2026-07-14
**Branch:** `feat/vin-confirm-parts-prefetch`
**Durum:** Onaylandı (tasarım)

## Problem

İş emri → Parça & İşçilik sekmesinde parça araması boş dönüyor. Kök neden iki
ayrık koşulun birleşimi:

1. **`vinConfirmed` ile `catalogVehicleTypeId` ayrık.** `linkVehicleCatalogAction`
   ("VIN'den bağla") aracı kataloğa bağlıyor (`catalogVehicleTypeId` yazıyor) ama
   `vinConfirmed`'a dokunmuyor. Kullanıcı VIN'i API'den çözüp bağladıktan sonra
   "Teyit Edildi"yi elle işaretlemek zorunda kalıyor.
2. **Parça-ekleme UI'ı yalnız DB cache'ini okuyor.** Ad araması
   (`searchVehicleArticles`) ve araç-marka listesi (`getVehicleBrands`) sadece
   `TecdocArticle` cache satırlarını tarar. Yeni bağlanan bir araçta bu cache
   boştur → kullanıcı ne yazarsa yazsın "Eşleşen parça yok" görür. Parçalar
   ancak kullanıcı 🔍 picker'ı açıp bir kategoriye göz atınca (lazy fetch)
   cache'e dolar.

Ayrıca bir **kota israfı**: aynı araç modelinin farklı VIN'leri her seferinde
ayrı bir VIN-check API çağrısı harcıyor (aşağıda "C").

> **Ortam notu (kapsam dışı):** Staging'de ayrıca `TECDOC_PROVIDER` `rapidapi`'ye
> ayarlı değildi → mock provider ("kategoriler var ama parça yok" imzası). Bu bir
> kod hatası değil, VPS `.env` + restart meselesidir; bu PR'da kod ile
> çözülmez ama PR açıklamasında hatırlatılır. Staging her zaman `rapidapi`
> olmalı.

## Hedef

VIN API'den kataloğa bağlanınca:
1. `vinConfirmed` **otomatik** `true` olsun (elle "Teyit Et" gerekmesin).
2. O aracın yaygın bakım parçaları **arka planda** TecDoc'tan indirilip
   `TecdocArticle` cache'ine yazılsın; böylece mevcut parça-ekleme UI'ı (ad
   arama + marka/kategori dropdown'ları) **değiştirilmeden** dolu cache'ten
   beslensin.
3. Aynı modelin farklı VIN'leri **tekrar API kotası tüketmesin** — VIN çözümlemesi
   model-önek (WMI+VDS) bazında dedupe edilsin.

Parça-ekleme UI bileşenleri (parts-labor-grid, part-search-input,
tecdoc-part-picker) **bu çalışmada değiştirilmez.**

## Kısıtlar

- **Kota:** RapidAPI aylık cap = 18.000 (VIN + TecDoc paylaşımlı, `rapidapi-quota.ts`).
  Kategori ağacında **422 yaprak kategori** var ve provider'da bulk parça
  endpoint'i **yok** → "tüm parçalar" = ~423 çağrı/araç → ayda ~42 araçta kota
  biter. Bu yüzden **curated yaygın set** (~35-45 kategori) kullanılır.
- **Global + idempotent cache:** `TecdocArticle` workshop'a bağlı değil; anahtar
  `(vehicleTypeId, categoryId, tecdocArticleId)`. `getArticlesByCategory` önce DB
  cache'ini kontrol edip zaten doluysa API'yi atlar. Aynı araç tipi ikinci kez
  teyit edilince prefetch **ücretsiz**. Popüler tipler amortize olur.
- **Süre:** ~35-45 sıralı çağrı dakikalar sürebilir → teyit action'ını
  **bloke edemez**, arka planda çalışmalı.
- **Küçük additive migration** (VinLookup.modelKey) — "C" için gerekir; başka
  şema değişikliği yok.

## Çözüm

### A) VIN oto-teyit

`src/app/(app)/vehicles/actions.ts` → **`linkVehicleCatalogAction`**:
- Katalog ID'leri yazıldıktan sonra, araçta geçerli VIN varsa aynı `update`'te
  `vinConfirmed: true` de yaz (zaten teyitliyse dokunma).
- Zaten teyitli değilse `vehicle_vin_confirmed` audit log ekle.
- Bunun için mevcut `select`'e `vin` ve `vinConfirmed` alanları eklenir.

**smart-capture confirm** (`src/app/api/smart-capture/confirm/route.ts`) zaten
17-hane VIN'de `vinConfirmed=true` set ediyor + kataloğu bağlıyor → **değişmez**.

Manuel **"Teyit Et" butonu** (`confirmVehicleVinAction`) korunur — VIN'siz veya
API eşleşmeyen araçlar için gereklidir.

### B) Yaygın parça prefetch

Yeni modül: **`src/lib/tecdoc/prefetch.ts`**

```
COMMON_CATEGORY_MATCHERS: readonly string[]   // küçük-harf bakım-kategori isim parçaları
selectPrefetchTargets(tree: CategoryNode[]): number[]   // SAF: eşleşen yaprak id'leri
async function prefetchCommonVehicleParts(vehicleTypeId: number): Promise<void>
```

**Neden ID yerine isim eşleştirme:** Kategori ağacı araca göre değişir (ör. dizel
FOCUS fixture'ında benzinli araca ait "Ateşleme bobini"/"Buji"/"Radyatör" yoktur).
Tek araçtan türetilen ID listesi eksik kalır; evrensel ID tahmini ise yanlış/boş
prefetch riskidir. Bunun yerine curated Türkçe **isim parçalarını** aracın gerçek
çekilen ağacındaki yaprak kategori adlarıyla (küçük-harf `includes`) eşleştiririz.
Provider adları tutarlıdır (fixture canlı `products-groups-variant-2` çıktısıdır).
Eşleşmeyen kategori sessizce lazy-picker'a düşer — asla yanlış veri değil.

`prefetchCommonVehicleParts` adımları:
1. `getTecdocProvider().name === "mock"` ise erken çık (mock persist etmez;
   dev'de rapidapi çalışır).
2. `getVehicleCategories(vehicleTypeId)` → aracın gerçek kategori ağacı
   (1 çağrı, cache-first).
3. Hedef = `selectPrefetchTargets(tree)` — adı `COMMON_CATEGORY_MATCHERS`'tan
   herhangi birini içeren yaprak kategori id'leri (deduplike).
4. Her hedef için sıralı `getArticlesByCategory(vehicleTypeId, categoryId)`:
   - zaten cache'liyse API'yi atlar (idempotent),
   - değilse çeker + `TecdocArticle`'a yazar,
   - her çağrı `try/catch`; `TecdocError.code === "quota_exceeded"` gelirse
     döngüyü **durdur** (kalan kotayı koru), diğer hatalarda o kategoriyi atla.

`COMMON_CATEGORY_MATCHERS` (~30-35 bakım kategorisi): fren balata, fren disk,
fren kaliper, fren hidro, fren hortum, el fren, ana fren silindir, fren servo,
yağ filtre, hava filtre, yakıt filtre, polen/araç içi hava filtre, filtre takımı,
kurum filtre, triger, v kayış, kayış geric, kayış kasna, buji, ateşleme bobin,
akü, silecek, debriyaj, amortisör, rot, salıncak, termostat, su pompası, radyat,
direksiyon, marş motoru, alternatör, karter conta, silindir kapağı conta,
enjektör. (Kesin liste implementasyonda fixture'la doğrulanır — eşleşmeyen
zararsız.)

### C) VIN model-önek dedupe (kota koruması)

**Bulgu:** `lookupVin` → `/vin/tecdoc-vin-check/{vin}` yanıtındaki aday araç
listesi, VIN'in **model-tanımlayıcı öneki (WMI+VDS = ilk 9 hane, ör. "WBA5A1109")**
ile belirlenir; seri no (VIS, 10-17) sonucu değiştirmez. Motor varyantı seçimi
(`scoreCandidates`/`filterByHints`) API'den **sonra, yerelde** ruhsat ipuçlarıyla
yapılır. Yani aynı modelin farklı VIN'leri **aynı API yanıtını** hak eder — ama
şu an her biri tam-17-hane VIN ile ayrı cache'lenip ayrı çağrı harcıyor. WMI+VDS
zaten `vin.slice(0, 9)`'dur; öğrenmek için ekstra `decoder-v1` çağrısı gerekmez.

**Şema:** `VinLookup`'a **`modelKey String?`** (normalize VIN ilk 9 hane) kolonu +
**non-unique** `@@index([modelKey])`. Non-unique: mevcut satırlarda aynı modelin
birden çok VIN'i olabilir; unique kısıt backfill'de çakışırdı.
Migration SQL: kolon + index ekle, `UPDATE vin_lookups SET model_key =
substring(vin, 1, 9)` ile backfill. `vin` PK olarak kalır.

**`lookupVin` mantığı** (`src/lib/vin/lookup.ts`):
- Okuma: tam-VIN yerine `findFirst({ where: { modelKey }, orderBy: { createdAt:
  'asc' } })`. Bulunursa `hitCount++` + yanıtı döndür (**yeni faturalı satır YOK →
  kota tüketilmez**).
- Yazma (cache-miss): mevcut `upsert({ where: { vin } })` korunur, `create`'e
  `modelKey` eklenir. İlk-model-VIN'i bir satır yaratır (1 faturalı çağrı).
- Nadir yarış (aynı modelin iki farklı VIN'i eşzamanlı ilk-sorgu) → iki satır
  oluşabilir (2 çağrı); kendini düzeltir, kabul edilir.

Sonuç: ilk BMW 5 F10 → 1 çağrı; sonraki her aynı-model VIN → cache-hit, 0 çağrı.
Yerel puanlama her VIN için çalıştığından **motor-varyant doğruluğu korunur**.
`countRapidApiCallsThisMonth` (yaratılan satır = faturalı çağrı) doğru kalır.

### Tetikleme (`after()` — `next/server`)

Parça prefetch, response gönderildikten **sonra** arka planda çalışır; action'ı
bloklamaz. `after()` kod tabanında ilk kez kullanılır (Next 16.2.6, standalone
long-lived Node server → uygun). Tetik noktaları:

- `linkVehicleCatalogAction` → link + oto-teyit sonrası.
- smart-capture confirm → mevcut katalog-link bloğu sonrası (transaction dışı).
- `confirmVehicleVinAction` → araçta `catalogVehicleTypeId` varsa.

Redundant tetikleme zararsız (global + idempotent cache → cache-skip).

## Kapsam dışı

- Parça-ekleme UI bileşenleri (parts-labor-grid, part-search-input,
  tecdoc-part-picker) değişmez.
- VinLookup.modelKey dışında şema/migration yok.
- Staging `.env` (`TECDOC_PROVIDER=rapidapi`) değişikliği — VPS aksiyonu, PR
  açıklamasında hatırlatma.
- Prefetch için ilerleme UI'ı / durum kolonu yok (YAGNI; cache = durum).
- Kalıcı iş kuyruğu / retry yok — process restart'ta yarım kalırsa picker lazy
  fetch güvence ağıdır, re-run ücretsizdir.
- `decoder-v1` endpoint'i kullanılmaz — WMI+VDS VIN'den kesilir.

## Riskler

- **Kota tüketimi:** Curated set + global cache + quota-stop + model-önek dedupe
  ile sınırlı; yine de çok sayıda farklı araç tipi ilk kez teyit edilirse cap
  zorlanabilir → izlenir (`getRapidApiUsage` admin panelinde görünür).
- **Önek-determinizmi varsayımı:** `tecdoc-vin-check` yanıtının WMI+VDS ile
  belirlendiği varsayılır. Yerel hint-puanlaması her VIN için çalıştığından, aday
  listesi bir miktar geniş olsa bile doğru varyant yine seçilir → düşük risk.
- **Arka-plan görev dayanıklılığı:** restart'ta yarım kalır (kabul edilir).
- **`after()` ilk kullanım:** dev'de doğrulanır (mock değil, rapidapi ile).

## Test

- `prefetch.ts` → `selectPrefetchTargets`: gerçek FOCUS fixture'ı
  `normalizeCategories` ile ağaca çevrilip verilir; fren balatası (100030) gibi
  bilinen bakım kategorileri seçilir, alakasızlar seçilmez (saf unit).
- `linkVehicleCatalogAction`: VIN varken `vinConfirmed=true` set ediliyor,
  VIN yokken edilmiyor.
- `lookupVin` model-önek dedupe: aynı modelKey'li ikinci VIN cache-hit alır ve
  provider çağrılmaz; farklı modelKey miss olur (sahte provider + prisma ile).

## Manuel QA (dev, TECDOC_PROVIDER=rapidapi)

1. VIN'i olan bir araçta "VIN'den bağla" → araç kataloğa bağlanır, "Teyit Edildi"
   **otomatik** yeşile döner.
2. Kısa süre sonra iş emri parça satırında ad araması (ör. "balata") → sonuç gelir.
3. Marka ve kategori dropdown'ları dolu gelir.
4. Aynı araç tipini ikinci kez bağla → ek RapidAPI çağrısı olmaz (cache-hit).
5. Aynı modelin **farklı** bir VIN'ini oku → VIN-check API'si çağrılmaz
   (modelKey cache-hit), araç yine doğru çözülür.
