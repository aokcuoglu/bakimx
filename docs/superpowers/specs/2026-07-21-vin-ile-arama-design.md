# İş Emri Adım 1 — "VIN ile arama" tasarımı

**Tarih:** 2026-07-21
**Dal:** `feat/vin-arama` (worktree `/Users/void/www/bakimx-vin-arama`, base `origin/dev`)
**Kapsam:** UI-only. Şema / migration / API değişikliği **yok**.

## Amaç

Yeni İş Emri sihirbazının 1. adımındaki ("Müşteri & Araç") arama alanına
üçüncü bir **VIN modu** ekle. Kullanıcı geçerli bir VIN girer:

- Araç atölyeye **zaten kayıtlıysa** → onu seç (plaka modundaki davranışın aynısı).
- **Kayıtlı değilse** → yeni araç modalını VIN dolu aç ve VIN'i **otomatik decode**
  et (marka / model / motor önceden dolsun; belirsizse motor-varyant aday listesi
  çıksın). Kullanıcı sadece plakayı girip onaylar.

## Mevcut durum (analiz)

- **Adım 1 UI:** `src/components/app/customer-vehicle-picker.tsx`. `Mode = "plate" | "customer"`.
  Plaka modu Combobox + kamera-tara butonu; kişi ikonu plaka↔müşteri toggle'ı.
- **Arama API'si:** `GET /api/search/customer-vehicle?q=` — araçları `plate`, **`vin`**
  ve normalize-plaka üzerinden `contains`/insensitive arıyor (route.ts:53). Yani tam
  VIN sorgusu kayıtlı aracı **zaten** bulur → DB araması için değişiklik gerekmez.
- **VIN decode:** `resolveVinToCatalog` → `POST /api/vin/resolve`. `inline-create-modal.tsx`
  içinde `useVinResolve` + `VinResolveButton` + `VinCandidateList` olarak bağlı, ama şu an
  yalnız ruhsat-OCR sonrası veya kullanıcı "VIN'den getir"e basınca çalışıyor.
- **Doğrulama:** `isValidVin` / `normalizeVin` — `@/lib/vin/types` (17 hane, I/O/Q yok).
- **VIN alanı ve katalog ID'leri** `Vehicle` modelinde mevcut (`vin`, `catalogBrandId/ModelId/VehicleTypeId`).

## Değişiklikler

### 1) `customer-vehicle-picker.tsx` — VIN modu

- `Mode` tipine `"vin"` ekle.
- **Yeni mod-toggle ikon butonu** (VIN — lucide `Barcode`): kişi butonuyla aynı desende
  bağımsız toggle → bas VIN moduna geç, tekrar bas plakaya dön.
  `variant={mode === "vin" ? "default" : "outline"}`, `size` mevcut butonlarla aynı (`size-11 md:size-9`),
  erişilebilirlik `aria-label` + `aria-pressed`.
- Combobox artık `mode === "plate" || mode === "vin"` iken render olur; VIN modunda
  placeholder **"VIN ile ara…"**, girişi büyük harfe çevir (VIN büyük harf).
- **`modeResults`:** VIN modunda da yalnız `kind === "vehicle"` sonuçları göster.
- **Arama tetikleme (debounced effect):** VIN modunda sorgu **yalnız `isValidVin(normalizeVin(query))`**
  iken atılsın (kısmi/geçersiz girişte DB'ye gitme). Plaka/müşteri modu davranışı değişmez.
  Aramada `q` olarak `normalizeVin(query)` gönderilir.
- **Boş durum (VIN modu):**
  - Henüz geçerli VIN yok → "17 haneli VIN yazın".
  - Geçerli VIN + eşleşme yok → "«VIN» yok — VIN'den araç oluştur" butonu → modalı VIN dolu açar.
- **Enter davranışı (VIN modu):** geçerli+eşleşme → ilk aracı seç; geçerli+eşleşme yok → modalı VIN dolu aç;
  geçersiz → hiçbir şey yapma.
- **Modal çağrısı mod-duyarlı:** `initialVin={mode === "vin" ? normalizeVin(query) : undefined}`,
  `initialPlate={mode !== "vin" ? query.trim() : undefined}`.
- **Kamera-tara butonu** yalnız plaka modunda görünmeye devam eder (VIN kamera tarama kapsam dışı).

### 2) `inline-create-modal.tsx` — VIN seed + oto-decode

- Yeni prop `initialVin?: string`.
- Açılış geçişinde (`false→true`, mevcut `justOpened` mantığı):
  - `fields.vin`'i `initialVin` ile doldur.
  - `isValidVin(initialVin)` ise: `setShowDetails(true)` (teknik alanlar görünür olsun) +
    `vinResolve.resolve(initialVin, {})` (ipuçsuz decode — kullanıcı beklemeden marka/model/motor gelir;
    belirsizse `VinCandidateList` zaten görünür).
  - `reset` effect deps'ine `initialVin` eklenir.
- Aday seçimi, `catalogIds` persist ve oluşturma akışı **değişmez** (zaten mevcut).

## Sınır durumları & riskler

- **Plaka gelmez:** VIN decode plaka vermez; oluşturmada plaka zorunlu → kullanıcı elle girer. Beklenen.
- **RapidAPI kotası:** decode yalnız geçerli 17-hane VIN'de → boşa çağrı yok. Dev'de mock provider default.
- **Feature gate:** `/api/vin/resolve` `vinLookup` feature'ına kapalı + rate-limit (10/dk) + plan-write guard.
  Feature'ı olmayan planlar kodlu hata alır; modal bunu zaten `vinResolve.error` ile gösterir. Davranış değişmez.
- **`initialVin` vs `initialPlate` çakışması:** ikisi aynı anda dolu gönderilmez (mod-duyarlı). Modal
  reset'inde `plate` yalnız `initialPlate`'ten, `vin` yalnız `initialVin`'den seed edilir.
- **Tenant izolasyonu:** arama API'si `requireAuth()` → `workshopId` scope'lu (değişmiyor).

## Test / QA

- **Unit:** VIN-modu arama-gating saf yardımcıya çıkarılabilir (örn. `shouldSearchVin(query)` = `isValidVin(normalizeVin(query))`)
  ve küçük bir test eklenir. Aksi halde mantık inline kalır; component testi projede yok.
- **Manuel QA (mobil-öncelikli):**
  1. VIN moduna geç → placeholder "VIN ile ara…" + kamera butonu gizli.
  2. Kayıtlı aracın VIN'ini yaz → araç sonucu çıkar, seçilince özet kartı doğru.
  3. Kayıtsız geçerli VIN yaz → "VIN'den araç oluştur" / Enter → modal VIN dolu açılır, decode otomatik çalışır,
     marka/model/motor dolar (veya aday listesi), plaka boş → elle gir → Oluştur.
  4. Geçersiz/kısmi VIN → arama atılmaz, boş-durum "17 haneli VIN yazın".
  5. Plaka ve müşteri modları eskisi gibi çalışır (regresyon yok).

## Kapsam dışı (YAGNI)

- VIN kamera/OCR tarama.
- Arama API'sinde VIN'e özel değişiklik.
- Şema/migration.
