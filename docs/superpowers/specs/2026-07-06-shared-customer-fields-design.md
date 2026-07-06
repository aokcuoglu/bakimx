# Ortak Müşteri Alanları + İl/İlçe Cascade Dropdown — Tasarım

Tarih: 2026-07-06
Dal: `feat/tami-payments` (çalışma ağacında yarım kalmış inline-form işi mevcut)

## Sorun

Müşteri iki yerde oluşturuluyor ve alanlar ıraksıyor:

1. **`/customers/new` → `CustomerCreateForm`** (tam sayfa, react-hook-form + `customerSchema`).
   İl/İlçe düz `Input`. Vergi/Kimlik bölümü TC + Vergi No + Vergi Dairesi **üçünü birden** gösterir.
2. **İş emri akışı → `InlineCreateModal` → `CustomerSearchOrCreate`** (hafif, `useState`, doğrudan `/api/customers`).
   "Ek bilgiler (opsiyonel)" katlanır bölümünde İl/İlçe düz `Input`; vergi alanları **tipe göre koşullu**
   (bireysel→TC, kurumsal→Vergi No+Dairesi).

İstenen: iki form **component-based** aynı alanları kullansın; İl/İlçe **cascade dropdown** olsun
(İstanbul → Kadıköy/Beykoz…); vergi alanları her iki yerde de **her zaman üçü** (`/customers/new` referans).

Not: Bu değişiklik kapsamı DIŞINDA, çalışma ağacında binen 2 alakasız değişiklik var
(`intake-wizard.tsx` kilometre numeric input, `vehicle-detail.tsx` pasaport butonu kaldırma) —
oldukları gibi bırakılır, bu işe dahil edilmez.

## Kapsam sınırı

Inline modal genel yapısı **hafif kalır** (isim/telefon + katlanır "Ek bilgiler"). `/customers/new`
sayfasındaki profil/etiket/fiyat/izin/KVKK sidebar'ı modala TAŞINMAZ. Sadece iki alan grubu paylaşılır.

## Çözüm

### 1. Veri — `src/lib/tr-districts.ts`

- `export const TR_DISTRICTS: Record<string, string[]>` — 81 il → ilçe listesi. Anahtar yazımı mevcut
  `TR_CITIES` (src/lib/tr-cities.ts) ile birebir aynı (ör. "İstanbul", "Afyonkarahisar").
- `export function getDistricts(city: string): string[]` — `TR_DISTRICTS[city] ?? []`.
- Statik resmî referans veri (~970 ilçe). Ayrı dosya; `tr-cities.ts` küçük kalır.
- **Doğruluk riski:** liste elle yazılacak; en az birkaç il (İstanbul, Ankara, İzmir + küçük bir il)
  gözle doğrulanır. İlçe adları Türkçe alfabetik, resmî ilçe adlarıyla.

### 2. Ortak sunum component'leri (RHF-agnostik, kontrollü)

İki tüketici farklı state modeli kullandığı için (RHF vs `useState`), component'ler **presentational**:
`value` / `onChange` / opsiyonel `error` alır. FormField/RHF'e bağımlı değildir. Her ebeveyn kendi
state'iyle besler; hata metnini opsiyonel `error` prop'uyla gösterir.

**`src/components/app/forms/city-district-fields.tsx`**
```
CityDistrictFields({
  city, district,
  onCityChange, onDistrictChange,
  cityError?, districtError?,
  className?,
})
```
- İl: `Combobox` (aramalı), `items = TR_CITIES`. Seçilince `onCityChange(v)` + `onDistrictChange("")`
  (cascade reset — SADECE kullanıcı değişiminde tetiklenir, mount'ta değil).
- İlçe: `Combobox`, `items = getDistricts(city)`. `city` boşken `disabled`.
- **Legacy güvenliği:** kayıtlı `city`/`district` ilgili listede yoksa, o değer geçici olarak `items`'a
  eklenip gösterilir (müşteri düzenlemede eski serbest-metin veri kaybolmasın).
- Her ikisi de shadcn ölçüsü (web `h-9`), mobil-öncelik.

**`src/components/app/forms/tax-identity-fields.tsx`**
```
TaxIdentityFields({
  identityNumber, taxNumber, taxOffice,
  onIdentityChange, onTaxNumberChange, onTaxOfficeChange,
  errors?, showHeading = true, className?,
})
```
- **Başlık:** `showHeading` (varsayılan açık) ile "Vergi / Kimlik Bilgileri" başlığı +
  "Fatura ve resmi kayıtlar için" alt metni render edilir — `/customers/new` bölümüyle birebir.
  İnline modalda da bu başlıklı grup gösterilir.
- Her zaman üç alan: TC Kimlik No (`maxLength=11`, numeric), Vergi No (numeric), Vergi Dairesi (metin).
  Masaüstünde 3 sütun (`sm:grid-cols-3`), mobilde tek sütun.
- Tip'e bağlı DEĞİL (`/customers/new` davranışı).

Picker seçimi: **Combobox** (aramalı) — mobil-öncelik; 81 il aramasız `Select` kaydırması kötü.
(Register formu `Select` kullanıyor; burada referans `/customers/new` ve mobil UX olduğu için Combobox.)

### 3. Bağlama

**`customer-create-form.tsx`** (create + edit):
- Temel Bilgiler'deki iki düz İl/İlçe `FormField` → `CityDistrictFields`, `form.watch`/`form.setValue`
  ile beslenir; `onCityChange` içinde `setValue("district","")` ile cascade reset. `cityError`/`districtError`
  RHF `formState.errors`'tan geçilir.
- Vergi/Kimlik bölümündeki üç `FormField` → `TaxIdentityFields` (görsel/davranış aynı kalır).

**`customer-search-or-create.tsx`** (inline):
- "Ek bilgiler (opsiyonel)" katlanır bölümü kalır; içeriği ortak component'lerle dolar.
- Tipe-koşullu vergi bloğu → `TaxIdentityFields` (başlıklı "Vergi / Kimlik Bilgileri", her tipte üçü).
- Düz İl/İlçe input'ları → `CityDistrictFields` (`city`/`district` state'leri) + Adres `Textarea` korunur.
- `handleCreate` submit: koşulu kaldır; dolu olan üç vergi alanı + city/district gönderilir
  (mevcut `if (x.trim()) cf.set(...)` deseni korunur; `type === "individual"` koşulu kalkar).

## Dosya değişiklikleri

- `+ src/lib/tr-districts.ts`
- `+ src/components/app/forms/city-district-fields.tsx`
- `+ src/components/app/forms/tax-identity-fields.tsx`
- `~ src/components/app/customer-create-form.tsx`
- `~ src/components/app/customer-search-or-create.tsx`

Şema değişikliği YOK (`city`/`district`/`identityNumber`/`taxNumber`/`taxOffice` zaten opsiyonel string).
API değişikliği YOK.

## Test / QA

- `/customers/new`: İl seç → İlçe listesi o ile göre dolar; İl değişince İlçe sıfırlanır; kaydet → detayda görünür.
- Müşteri düzenleme: eski serbest-metin il/ilçe olan bir kayıt açılınca değer kaybolmaz (legacy).
- İş emri akışı → yeni araç → yeni müşteri: aynı cascade + üç vergi alanı; oluştur → seçili gelir.
- Tenant izolasyonu ve auth: mevcut `/api/customers` akışı değişmiyor (sadece client alanları).
- typecheck + lint + build (değişiklik anlamlı, build önerilir).

## Riskler

- **İlçe veri doğruluğu** (birincil) — elle yazım; örnek illerle doğrulanır.
- Base UI Combobox Enter/serbest-metin davranışı — strict picker (listeden seçim) olduğu için beklenen;
  `[[base-ui-combobox-not-freeform]]` notu göz önünde.
- Combobox `Value` ham değer gösterme tuzağı (`[[base-ui-select-value-raw-label]]`) — string value =
  görünen etiket olduğundan sorun yok.
