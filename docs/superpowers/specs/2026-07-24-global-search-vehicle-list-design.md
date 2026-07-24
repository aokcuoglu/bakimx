# Global başlık araması → araç/müşteri canlı sonuç listesi

Tarih: 2026-07-24
Dal: `feat/global-search-vehicle-list` (base: `dev`)
Worktree: `/Users/void/www/bakimx-global-search`

## Problem

Uygulama kabuğundaki (`AppShellChrome`) üst başlık arama kutusu
(`src/components/app/app-shell.tsx:270-283`) placeholder olarak
"Plaka, müşteri, iş emri ara" dese de gerçekte:

- Yazarken hiçbir istek atmıyor, hiçbir sonuç listelemiyor.
- Submit'te (`handleSearch`, `app-shell.tsx:211-216`) yanlış biçimde
  `/parts?q=<değer>` (parça/stok sayfası) rotasına gidiyor.

Kullanıcı, özellikle **plaka** ile arama yapıldığında araçların
listelenmesini istiyor.

## Hedef

Üst arama kutusunu, halihazırda var olan birleşik arama backend'ine
bağlı **canlı sonuç dropdown'una** dönüştürmek. Yeni backend, yeni API
rotası veya şema değişikliği yok.

## Mevcut hazır altyapı (yeniden kullanılacak)

- **API:** `GET /api/search/customer-vehicle?q=<değer>`
  (`src/app/api/search/customer-vehicle/route.ts`) — `requireAuth()` ile
  auth + tenant-scoped (`workshopId`), plaka normalize dahil, her tür için
  `take: 8`, `{ results: UnifiedResult[] }` döndürür. Boş `q`'da
  `{ results: [] }`.
- **Sonuç tipi:** `UnifiedResult` (`src/lib/search/unified-results.ts`),
  `kind` ile ayrımlı birleşim:
  - `{ kind: "vehicle"; vehicleId; customerId; plate; label; sublabel }`
    - `label` = `"{plaka} — {marka} {model}"`
    - `sublabel` = `"Sahip: {müşteri adı}"`
  - `{ kind: "customer"; customerId; label; sublabel }`
    - `label` = müşteri adı, `sublabel` = telefon
  - `buildUnifiedResults` **araçları önce**, sonra müşterileri döndürür
    (plaka senaryosu birincil).
- **Örnek desen:** `src/components/app/customer-vehicle-picker.tsx` —
  aynı endpoint'i `q` param + **250ms debounce** ile çağırır; satırları
  Base UI `ItemMedia`/`ItemTitle`/`ItemDescription` ile, araç için `Car`,
  müşteri için `User` ikonuyla render eder; araç seçince
  `/vehicles/{vehicleId}`'e link verir.
- **Detay rotaları:** `/vehicles/{id}` ve `/customers/{id}` mevcut.

## Çözüm

### Bileşen

- Yeni odaklı istemci bileşeni: `src/components/app/global-search.tsx`.
- `app-shell.tsx`'teki mevcut inert `<form onSubmit={handleSearch}>`
  bloğu (satır 270-283) bu bileşenle değiştirilir. `showGlobalSearch`
  bayrağı ve onu `false` yapan sayfalar aynen korunur; bayrak `false`
  iken yine spacer `<div className="flex-1" />` render edilir.
- Artık kullanılmayan `searchValue` state'i (`app-shell.tsx:203`) ve
  `handleSearch` fonksiyonu (`app-shell.tsx:211-216`) kaldırılır.
- UI, `customer-vehicle-picker.tsx` ile **aynı Base UI/shadcn yapı
  taşlarını** kullanır (el yapımı UI yok — proje kuralı). Uygun bileşen
  implementasyon sırasında doğrulanır: serbest-metin arama + navigasyon
  için Base UI `Autocomplete` tercih edilir (Base UI `Combobox` Enter'da
  input'u geri alır — bu akışa uygun değil).

### Davranış

- Yazarken **250ms debounce** ile `GET /api/search/customer-vehicle?q=`.
  Boş/whitespace sorguda istek atılmaz, dropdown kapalı kalır.
- Sonuçlar kutunun hemen altında dropdown olarak listelenir; mobil-öncelikli,
  tam genişlik.
- Satır düzeni picker ile birebir: araç → `Car` ikonu + `label` + `sublabel`;
  müşteri → `User` ikonu + `label` + `sublabel`. Anahtar `v-{vehicleId}` /
  `c-{customerId}`.
- Yükleniyor durumu: `BrandSpinner` (dual gear — proje kuralı, skeleton
  değil).
- Sonuç yoksa (sorgu var, dizi boş): "Sonuç bulunamadı".
- **Seçim aksiyonu:**
  - araç → `router.push('/vehicles/{vehicleId}')`
  - müşteri → `router.push('/customers/{customerId}')`
  - ardından dropdown kapanır ve kutu temizlenir.
- Klavye (ok tuşları / Enter) ve mobil dokunma seçimi Base UI bileşeninden
  gelir.

### Kapsam

- **Araç + müşteri** (backend zaten ikisini döndürüyor). İş emri araması
  bu iş kapsamı dışında (backend'de yok, sonraya bırakıldı).

## Kapsam dışı (YAGNI)

- İş emri / parça araması.
- Ayrı `/search` sonuç sayfası.
- Backend/şema değişikliği, yeni API rotası.
- `showGlobalSearch` görünürlük kurallarının değişmesi.

## Risk alanları

- **Tek gerçek davranış değişikliği:** global arama artık `/parts`'a
  gitmiyor. Parça/stok sayfasının kendi arama kutusu olduğu ve placeholder
  zaten plaka/müşteri dediği için işlev kaybı yok.
- Tenant izolasyonu backend tarafında (`requireAuth()` → `workshopId`);
  istemci yalnızca `q` gönderir, dokunulmaz.
- Kabuk kalıcı (layout'ta bir kez mount); bileşenin kendi state'i
  navigasyondan sonra temizlenmeli (kutu boşalır).

## Manuel QA

1. Herhangi bir uygulama sayfasında üst arama kutusuna kayıtlı bir plakanın
   parçasını yaz (örn. `34myl`) → 250ms sonra araç sonuçları listelenir.
2. Bir araç sonucuna dokun → `/vehicles/{id}` açılır, kutu temizlenir.
3. Müşteri adı/telefon yaz → müşteri sonuçları listelenir; seçince
   `/customers/{id}` açılır.
4. Eşleşmeyen bir sorgu → "Sonuç bulunamadı".
5. Kutuyu temizle → dropdown kapanır, istek atılmaz.
6. Başka bir atölye hesabıyla dene → sadece kendi tenant'ının araç/müşterileri
   görünür (tenant izolasyonu).
7. Mobil genişlikte dropdown tam genişlik ve dokunmayla seçilebilir.
