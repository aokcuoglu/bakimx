# Parça prefetch tetiklemesini kayıt anına ve mevcut araçlara genişletme

**Tarih:** 2026-07-25
**Durum:** Onaylandı (tasarım)
**İlgili önceki spec:** `2026-07-14-vin-confirm-parts-prefetch-design.md` (prefetch altyapısını kuran orijinal tasarım)

## Problem

Katalog-bağlı bir araçta (`Vehicle.catalogVehicleTypeId` dolu) İş Emri → "Parça & İşçilik" → Parça sekmesinde "filtre" gibi yaygın bir parça arandığında "Eşleşen parça yok" çıkıyor ve kullanıcının "Katalogdan getir" butonuna tıklaması gerekiyor. Kullanıcı beklentisi: VIN teyit edildiyse (RapidAPI ya da yerel katalogtan doğrulanmış) parçalar zaten DB'de hazır olmalı, ekstra tıklama gerekmemeli.

## Kök neden

Prefetch altyapısı (`prefetchCommonVehicleParts`, `src/lib/tecdoc/prefetch.ts`) mevcut ve ~30 yaygın bakım kategorisini (fren, yağ/hava/yakıt/polen filtresi, buji, akü, triger, amortisör…) araç bazında `tecdoc_articles` cache'ine dolduruyor. "filtre" araması (`/api/tecdoc/articles/search` → `searchVehicleArticles`) bu tabloyu ayraç-duyarsız okuyor; prefetch çalışmış olsaydı sonuç dönerdi.

Ancak prefetch yalnızca iki yolda tetikleniyor:
- `linkVehicleCatalogAction` (VIN kısayolundan katalog bağlama)
- `confirmVehicleVinAction` (VIN teyidi, araç zaten kataloğa bağlıysa)

Tetiklenmediği yerler:
- `createVehicleAction` — "Yeni araç" formuyla doğrudan oluşturma
- `updateVehicle` — araç düzenleme

Bu yüzden bu yollarla oluşturulmuş/bağlanmış araçlarda `catalogVehicleTypeId` dolu ama `tecdoc_articles` boş kalıyor.

## Çözüm

Mimari değişiklik yok. Mevcut `prefetchCommonVehicleParts` altyapısı korunuyor; yalnızca **tetikleme noktaları** ekleniyor. Üç parça:

### 1. Kayıt anında eager prefetch (yeni araçlar)

`src/app/(app)/vehicles/actions.ts` içinde:
- `createVehicleAction`: araç oluşturma başarılıysa, `catalogVehicleTypeId` dolu **ve** `vinConfirmed === true` ise `after(() => prefetchCommonVehicleParts(catalogVehicleTypeId))` eklenir.
- `updateVehicle`: aynı koşul; güncelleme sonrası araç katalog-bağlı ve VIN teyitli hale geldiyse tetiklenir.

**"VIN teyitli" koşulu neden:** Kullanıcının ifadesiyle birebir ("VIN teyit edildi ise"). VIN'siz/düşük-güvenli araçlarda boşuna RapidAPI kotası harcanmaz; bu araçlar 2. adımdaki güvenlik ağıyla yine dolar. `confirmVehicleVinAction`/`linkVehicleCatalogAction` zaten kendi içinde tetiklediğinden bu yollarda çift-tetik olmamasına dikkat edilir (idempotent olduğundan zarar vermez ama gereksiz iş yaratılmaz).

### 2. Güvenlik ağı (mevcut araçlar)

`src/components/app/parts-labor-grid.tsx` Parça sekmesi/composer yüklendiğinde:
- Araç katalog-bağlı (`vehicle.catalogVehicleTypeId != null`) ama o araç için `tecdoc_articles` cache'i boşsa, bir server action arka planda `prefetchCommonVehicleParts` tetikler.
- Server action `after()` ile bloklamadan çalışır; UI ince bir "Araca uygun parçalar hazırlanıyor…" notu gösterir.
- Debounce'lı arama (`/api/tecdoc/articles/search`) her tuşta DB'yi yeniden sorguladığından, parçalar cache'e düştükçe sonuçlara yansır. Kullanıcı elle yenilemeye zorlanmaz.
- Tetik idempotent olmalı (mount başına en fazla bir kez; cache doluysa hiç tetiklenmez).

**Yeni server action:** `ensureVehiclePartsPrefetched(vehicleId)` benzeri — workshopId `requireAuth()`'tan türetilir (tenant izolasyonu), araç workshop'a ait mi doğrulanır, `catalogVehicleTypeId` okunur, cache boşluğu kontrol edilir, boşsa `after(prefetch)` tetiklenir. Client'tan gelen `vehicleTypeId`'ye güvenilmez.

### 3. "Katalogdan getir" fallback olarak korunur

`part-search-input.tsx` / `tecdoc-part-picker.tsx` değişmez. 30 yaygın kategori dışındaki uzun-kuyruk parçalar (nadir kaporta/gövde vb.) için picker tek erişim yolu. Yaygın senaryoda (filtre, balata, buji…) artık gerekmeyecek ama silinmez.

## Kapsam dışı (YAGNI)

- Var olan tüm araçlar için toplu backfill script'i — güvenlik ağı zaten talep üzerine dolduruyor.
- Prefetch kategori listesini genişletmek — mevcut ~30 matcher yeterli; ayrı iş.
- Prefetch tamamlanınca UI'ı otomatik "push" ile yenilemek (polling/websocket) — debounce'lı arama pratik olarak yeterli.

## Veri / şema etkisi

Şema değişikliği **yok**. Yalnızca `tecdoc_articles` (global referans cache) satırları artabilir.

## Kota etkisi

- Kayıt anında: katalog-bağlı + VIN-teyitli araç başına tek seferlik ~30 kategori RapidAPI çağrısı (cache-first + idempotent, tekrar tetiklenmez). VIN'siz araçlarda hiç çağrı yok.
- Güvenlik ağı: yalnızca birisi Parça sekmesini gerçekten açtığında ve cache boşsa; araç başına tek seferlik.
- `quota_exceeded` durumunda prefetch döngüsü kalan kotayı koruyarak durur (mevcut davranış).
- mock provider'da hiç çalışmaz (mevcut davranış).

## Risk alanları

- **Çift tetik:** `createVehicleAction`/`updateVehicle` ile `confirmVehicleVinAction`/`linkVehicleCatalogAction` aynı akışta arka arkaya çalışırsa aynı araç için prefetch iki kez planlanabilir. `getArticlesByCategory` cache-first olduğundan sonuç doğru; sadece gereksiz kontrol. Koşulları örtüşmeyecek şekilde kurgula.
- **Cache-boşluğu kontrolü maliyeti:** Güvenlik ağındaki "cache boş mu" sorgusu her Parça sekmesi açılışında bir `count`/`findFirst` çalıştırır — `tecdoc_articles` üzerinde `vehicleTypeId` indeksli olduğundan ucuz.
- **Yarış (race):** Prefetch arka planda sürerken kullanıcı hızlı arama yaparsa ilk saniyelerde sonuç kısmi/boş olabilir; "hazırlanıyor" notu bunu iletir. Kabul edilebilir.
- **Tenant izolasyonu:** Yeni server action workshopId'yi mutlaka `requireAuth()`'tan türetmeli.

## Test / QA

- Birim: `selectPrefetchTargets` zaten saf/test edilebilir (değişmiyor). Yeni action için cache-boş/dolu dallarını doğrula (mock provider ile prefetch no-op).
- Manuel QA:
  1. VIN teyitli yeni araç oluştur → İş emri aç → Parça sekmesi → "filtre" yaz → "Katalogdan getir" olmadan sonuç gelmeli.
  2. Ekrandaki gibi mevcut katalog-bağlı araç (cache boş) → Parça sekmesi aç → "hazırlanıyor" notu → birkaç saniye sonra "filtre" araması sonuç vermeli.
  3. VIN'siz araç → kayıt anında prefetch tetiklenmemeli (kota harcanmamalı); Parça sekmesi açılınca güvenlik ağı devreye girmeli (araç yine de katalog-bağlıysa).
  4. mock provider ortamında hiçbir prefetch çalışmamalı, hata fırlatmamalı.
  5. Kota tükendiğinde UI patlamamalı; sadece sonuç boş kalır + fallback picker çalışır.

## Dokunulacak dosyalar (tahmini)

- `src/app/(app)/vehicles/actions.ts` — create/update'e koşullu prefetch tetiği.
- `src/components/app/parts-labor-grid.tsx` — güvenlik ağı tetiği + "hazırlanıyor" notu.
- Yeni/mevcut server action dosyası — `ensureVehiclePartsPrefetched` (parça/araç action'larının bulunduğu uygun yer).
- (Gerekirse) `src/lib/tecdoc/prefetch.ts` — yalnızca yardımcı gerekirse; şu an değişiklik öngörülmüyor.
