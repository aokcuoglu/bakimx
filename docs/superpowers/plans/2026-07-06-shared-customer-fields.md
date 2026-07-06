# Ortak Müşteri Alanları + İl/İlçe Cascade Dropdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Müşteri oluşturma alanlarını (İl/İlçe cascade dropdown + Vergi/Kimlik) ortak component'lere çıkarıp hem `/customers/new` (tam sayfa) hem iş emri akışındaki inline modalda aynı component'leri kullanmak.

**Architecture:** RHF-agnostik iki kontrollü sunum component'i (`CityDistrictFields`, `TaxIdentityFields`) — `value`/`onChange`/opsiyonel `error` alır, FormField'e bağımlı değildir. RHF tarafı `form.watch`/`form.setValue` ile, inline taraf `useState` ile besler. İl→İlçe cascade için yeni statik veri modülü `tr-districts.ts`.

**Tech Stack:** Next.js 16, TypeScript (strict), Base UI (`@/components/ui/combobox`, `input`, `label`, `textarea`), react-hook-form, `bun test`.

## Global Constraints

- Paket yöneticisi: **bun** (`bun test`, `bun run typecheck`, `bun run lint`, `bun run build`). Docker YOK (local).
- ShadcnUI/Base UI component'leri kullan; native/custom kontrol hand-roll etme. Web'de form component yüksekliği `h-9`.
- Şema/DB değişikliği YOK: `city`,`district`,`identityNumber`,`taxNumber`,`taxOffice` zaten `customerSchema`'da opsiyonel string.
- API değişikliği YOK: `/api/customers` ve `createCustomerAction` aynen kalır.
- Türkçe UI metni. İl adları yazımı `src/lib/tr-cities.ts` `TR_CITIES` ile **birebir aynı** olmalı (cascade anahtarı bu).
- Kapsam DIŞI ve DOKUNULMAZ: çalışma ağacındaki `intake-wizard.tsx` (kilometre) ve `vehicle-detail.tsx` (pasaport butonu) değişiklikleri — oldukları gibi bırak.
- Tenant izolasyonu / auth mevcut akışta; bu iş sadece client alan katmanı.

## File Structure

- `src/lib/tr-districts.ts` (yeni) — `TR_DISTRICTS: Record<string,string[]>` + `getDistricts(city)`.
- `src/lib/tr-districts.test.ts` (yeni) — veri sözleşmesi (bun test).
- `src/components/app/forms/city-district-fields.tsx` (yeni) — İl+İlçe cascade Combobox.
- `src/components/app/forms/tax-identity-fields.tsx` (yeni) — TC+Vergi No+Vergi Dairesi (başlıklı).
- `src/components/app/customer-create-form.tsx` (değişiklik) — iki alan grubunu ortak component'e bağla.
- `src/components/app/customer-search-or-create.tsx` (değişiklik) — inline "Ek bilgiler" içeriğini ortak component'e bağla + submit koşulunu kaldır.

---

### Task 1: `tr-districts.ts` veri modülü + `getDistricts`

**Files:**
- Create: `src/lib/tr-districts.ts`
- Test: `src/lib/tr-districts.test.ts`

**Interfaces:**
- Produces: `export const TR_DISTRICTS: Record<string, string[]>` (81 il anahtarı, her biri o ilin resmî ilçeleri, Türkçe alfabetik); `export function getDistricts(city: string): string[]` → `TR_DISTRICTS[city] ?? []`.
- Consumes: `TR_CITIES` (yalnız testte, anahtar kümesi doğrulaması için).

- [ ] **Step 1: Testi yaz** — `src/lib/tr-districts.test.ts`

```ts
import { test, expect } from "bun:test"
import { TR_DISTRICTS, getDistricts } from "./tr-districts"
import { TR_CITIES } from "./tr-cities"

test("TR_DISTRICTS 81 ili kapsar ve anahtarlar TR_CITIES ile birebir eşleşir", () => {
  const keys = Object.keys(TR_DISTRICTS)
  expect(keys.length).toBe(81)
  const cities = new Set<string>(TR_CITIES)
  for (const k of keys) expect(cities.has(k)).toBe(true)
  for (const c of TR_CITIES) expect(TR_DISTRICTS[c]).toBeDefined()
})

test("her ilin en az bir ilçesi var, boş/yinelenen ilçe yok", () => {
  for (const [city, districts] of Object.entries(TR_DISTRICTS)) {
    expect(Array.isArray(districts)).toBe(true)
    expect(districts.length).toBeGreaterThan(0)
    for (const d of districts) expect(d.trim().length).toBeGreaterThan(0)
    expect(new Set(districts).size).toBe(districts.length) // yinelenme yok
  }
})

test("bilinen il/ilçe eşleşmeleri (spot-check)", () => {
  expect(getDistricts("İstanbul")).toEqual(expect.arrayContaining(["Kadıköy", "Beykoz", "Üsküdar", "Şişli"]))
  expect(getDistricts("Ankara")).toEqual(expect.arrayContaining(["Çankaya", "Keçiören", "Yenimahalle"]))
  expect(getDistricts("İzmir")).toEqual(expect.arrayContaining(["Konak", "Bornova", "Karşıyaka"]))
  expect(getDistricts("Yalova")).toEqual(expect.arrayContaining(["Çınarcık", "Altınova"]))
})

test("getDistricts bilinmeyen il için boş dizi döner", () => {
  expect(getDistricts("Bilinmeyen")).toEqual([])
  expect(getDistricts("")).toEqual([])
})

test("her ilçe listesi Türkçe alfabetik sıralı", () => {
  const coll = new Intl.Collator("tr")
  for (const districts of Object.values(TR_DISTRICTS)) {
    const sorted = [...districts].sort((a, b) => coll.compare(a, b))
    expect(districts).toEqual(sorted)
  }
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu gör**

Run: `bun test src/lib/tr-districts.test.ts`
Expected: FAIL — `Cannot find module './tr-districts'`

- [ ] **Step 3: `src/lib/tr-districts.ts` dosyasını TAM resmî veri setiyle oluştur**

İçerik sözleşmesi (Step 1 testi = kabul kriteri):
- `TR_DISTRICTS`: 81 ilin **tamamı**, T.C. resmî il/ilçe listesine göre. Anahtarlar `TR_CITIES` yazımıyla birebir. Her ilin **bütün** ilçeleri, her ilçe listesi **`Intl.Collator("tr")`** ile alfabetik sıralı, yinelenme yok.
- Veri, yürütme sırasında güvenilir resmî kaynaktan (T.C. İçişleri Bakanlığı il/ilçe listesi) doğrulanarak yazılır; büyükşehir ilçe adları (ör. İstanbul 39, Ankara 25, İzmir 30 ilçe) tam olmalı. Test bunları spot-check + yapısal olarak zorlar.

Dosya iskeleti (veri tam doldurulur — kısaltma yok):

```ts
/** Türkiye il → ilçe listesi. Anahtarlar src/lib/tr-cities.ts TR_CITIES ile birebir aynı.
 *  Her ilçe listesi Türkçe alfabetik (Intl.Collator("tr")). Form il/ilçe cascade seçicileri için. */
export const TR_DISTRICTS: Record<string, string[]> = {
  "Adana": ["Aladağ", "Ceyhan", "Çukurova", "Feke", "İmamoğlu", "Karaisalı", "Karataş", "Kozan", "Pozantı", "Saimbeyli", "Sarıçam", "Seyhan", "Tufanbeyli", "Yumurtalık", "Yüreğir"],
  "Adıyaman": ["Besni", "Çelikhan", "Gerger", "Gölbaşı", "Kâhta", "Merkez", "Samsat", "Sincik", "Tut"],
  // … 81 ilin TAMAMI aynı formatta doldurulur (İstanbul, Ankara, İzmir dahil eksiksiz) …
  "İstanbul": ["Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kâğıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu"],
  // …
}

export function getDistricts(city: string): string[] {
  return TR_DISTRICTS[city] ?? []
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini gör**

Run: `bun test src/lib/tr-districts.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: typecheck**

Run: `bun run typecheck`
Expected: hata yok

- [ ] **Step 6: Commit**

```bash
git add src/lib/tr-districts.ts src/lib/tr-districts.test.ts
git commit -m "feat(geo): TR il→ilçe veri seti + getDistricts (cascade dropdown için)"
```

---

### Task 2: `CityDistrictFields` component

**Files:**
- Create: `src/components/app/forms/city-district-fields.tsx`

**Interfaces:**
- Consumes: `TR_CITIES` (tr-cities.ts), `getDistricts` (Task 1), `@/components/ui/combobox`, `@/components/ui/label`.
- Produces: `export function CityDistrictFields(props)` — props: `city: string`, `district: string`, `onCityChange: (city: string) => void`, `onDistrictChange: (district: string) => void`, `cityError?: string`, `districtError?: string`, `className?: string`. Davranış: İl değişince component `onDistrictChange("")` çağırır (cascade reset). İlçe `city` boşken disabled. Kayıtlı değer kanonik listede yoksa listeye eklenip gösterilir (legacy güvenliği).

- [ ] **Step 1: Component'i yaz** — `src/components/app/forms/city-district-fields.tsx`

```tsx
"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { TR_CITIES } from "@/lib/tr-cities"
import { getDistricts } from "@/lib/tr-districts"

function StringCombobox({
  items,
  value,
  placeholder,
  disabled,
  onValueChange,
}: {
  items: string[]
  value: string
  placeholder: string
  disabled?: boolean
  onValueChange: (value: string) => void
}) {
  return (
    <Combobox
      items={items}
      value={value || null}
      itemToStringValue={(s: string) => s}
      onValueChange={(v: string | null) => onValueChange(v ?? "")}
    >
      <ComboboxInput placeholder={placeholder} disabled={disabled} className="w-full" />
      <ComboboxContent>
        <ComboboxEmpty className="py-2 text-sm text-muted-foreground">Sonuç yok</ComboboxEmpty>
        <ComboboxList>
          {(s: string) => (
            <ComboboxItem key={s} value={s}>
              {s}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export function CityDistrictFields({
  city,
  district,
  onCityChange,
  onDistrictChange,
  cityError,
  districtError,
  className,
}: {
  city: string
  district: string
  onCityChange: (city: string) => void
  onDistrictChange: (district: string) => void
  cityError?: string
  districtError?: string
  className?: string
}) {
  // Legacy güvenliği: kayıtlı serbest-metin değer kanonik listede yoksa yine de göster.
  const cityItems =
    city && !TR_CITIES.includes(city as (typeof TR_CITIES)[number]) ? [city, ...TR_CITIES] : [...TR_CITIES]
  const baseDistricts = getDistricts(city)
  const districtItems =
    district && !baseDistricts.includes(district) ? [district, ...baseDistricts] : baseDistricts

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", className)}>
      <div className="space-y-1.5">
        <Label>İl</Label>
        <StringCombobox
          items={cityItems}
          value={city}
          placeholder="İl seçin"
          onValueChange={(v) => {
            onCityChange(v)
            onDistrictChange("") // cascade reset — yalnız kullanıcı değişiminde
          }}
        />
        {cityError && <p className="text-sm text-destructive">{cityError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>İlçe</Label>
        <StringCombobox
          items={districtItems}
          value={district}
          placeholder={city ? "İlçe seçin" : "Önce il seçin"}
          disabled={!city}
          onValueChange={(v) => onDistrictChange(v)}
        />
        {districtError && <p className="text-sm text-destructive">{districtError}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: typecheck + lint**

Run: `bun run typecheck && bun run lint src/components/app/forms/city-district-fields.tsx`
Expected: hata yok.
> Base UI Combobox `value`/`onValueChange`/`items`/`itemToStringValue` prop tiplerini derleyici doğrular. Tip uyuşmazlığı çıkarsa `customer-search-or-create.tsx`'teki mevcut Combobox kullanımını referans al (aynı `@/components/ui/combobox`).

- [ ] **Step 3: Commit**

```bash
git add src/components/app/forms/city-district-fields.tsx
git commit -m "feat(forms): CityDistrictFields — il→ilçe cascade Combobox (ortak component)"
```

---

### Task 3: `TaxIdentityFields` component

**Files:**
- Create: `src/components/app/forms/tax-identity-fields.tsx`

**Interfaces:**
- Consumes: `@/components/ui/input`, `@/components/ui/label`, `cn`.
- Produces: `export function TaxIdentityFields(props)` — props: `identityNumber: string`, `taxNumber: string`, `taxOffice: string`, `onIdentityChange: (v: string) => void`, `onTaxNumberChange: (v: string) => void`, `onTaxOfficeChange: (v: string) => void`, `errors?: { identityNumber?: string; taxNumber?: string; taxOffice?: string }`, `showHeading?: boolean` (default `true`), `className?: string`. `showHeading` açıkken "Vergi / Kimlik Bilgileri" + "Fatura ve resmi kayıtlar için" başlığını render eder. TC/Vergi No sayısal filtrelenir; her zaman üç alan.

- [ ] **Step 1: Component'i yaz** — `src/components/app/forms/tax-identity-fields.tsx`

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function TaxIdentityFields({
  identityNumber,
  taxNumber,
  taxOffice,
  onIdentityChange,
  onTaxNumberChange,
  onTaxOfficeChange,
  errors,
  showHeading = true,
  className,
}: {
  identityNumber: string
  taxNumber: string
  taxOffice: string
  onIdentityChange: (v: string) => void
  onTaxNumberChange: (v: string) => void
  onTaxOfficeChange: (v: string) => void
  errors?: { identityNumber?: string; taxNumber?: string; taxOffice?: string }
  showHeading?: boolean
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {showHeading && (
        <header>
          <h3 className="text-sm font-semibold text-foreground">Vergi / Kimlik Bilgileri</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Fatura ve resmi kayıtlar için</p>
        </header>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>TC Kimlik No</Label>
          <Input
            value={identityNumber}
            onChange={(e) => onIdentityChange(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={11}
            placeholder="12345678901"
          />
          {errors?.identityNumber && <p className="text-sm text-destructive">{errors.identityNumber}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Vergi No</Label>
          <Input
            value={taxNumber}
            onChange={(e) => onTaxNumberChange(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            maxLength={10}
            placeholder="1234567890"
          />
          {errors?.taxNumber && <p className="text-sm text-destructive">{errors.taxNumber}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Vergi Dairesi</Label>
          <Input value={taxOffice} onChange={(e) => onTaxOfficeChange(e.target.value)} placeholder="Kadıköy VD" />
          {errors?.taxOffice && <p className="text-sm text-destructive">{errors.taxOffice}</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: typecheck + lint**

Run: `bun run typecheck && bun run lint src/components/app/forms/tax-identity-fields.tsx`
Expected: hata yok.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/forms/tax-identity-fields.tsx
git commit -m "feat(forms): TaxIdentityFields — TC/Vergi No/Vergi Dairesi (başlıklı ortak component)"
```

---

### Task 4: `customer-create-form.tsx`'e bağla (`/customers/new` + düzenleme)

**Files:**
- Modify: `src/components/app/customer-create-form.tsx`

**Interfaces:**
- Consumes: `CityDistrictFields` (Task 2), `TaxIdentityFields` (Task 3). RHF alanları: `city`,`district`,`identityNumber`,`taxNumber`,`taxOffice` (mevcut `CustomerFormValues`).

- [ ] **Step 1: Import ekle** (dosya başındaki import bloğuna)

```tsx
import { CityDistrictFields } from "@/components/app/forms/city-district-fields"
import { TaxIdentityFields } from "@/components/app/forms/tax-identity-fields"
```

- [ ] **Step 2: İl/İlçe FormField'larını değiştir — BİREYSEL dal**

`type === "individual"` bloğunda `name="city"` ve `name="district"` iki ayrı `FormField`'ı sil, yerine tek blok koy (Adres FormField'ı olduğu gibi kalır):

```tsx
<div className="sm:col-span-2">
  <CityDistrictFields
    city={form.watch("city")}
    district={form.watch("district")}
    onCityChange={(v) => form.setValue("city", v, { shouldDirty: true })}
    onDistrictChange={(v) => form.setValue("district", v, { shouldDirty: true })}
    cityError={form.formState.errors.city?.message}
    districtError={form.formState.errors.district?.message}
  />
</div>
```

- [ ] **Step 3: İl/İlçe FormField'larını değiştir — KURUMSAL dal**

`type === "corporate"` bloğundaki `name="city"` + `name="district"` iki `FormField`'ı da aynı blokla değiştir (Step 2 ile birebir aynı kod — kurumsal dalda da city/district aynı alanlar).

- [ ] **Step 4: Vergi/Kimlik section'ını değiştir**

"Vergi / Kimlik Bilgileri" `<section>`'ının içindeki `grid ... gap-3` + üç `FormField`'ı (identityNumber/taxNumber/taxOffice) sil, section `<header>`'ı KORU, yerine:

```tsx
<TaxIdentityFields
  showHeading={false}
  identityNumber={form.watch("identityNumber")}
  taxNumber={form.watch("taxNumber")}
  taxOffice={form.watch("taxOffice")}
  onIdentityChange={(v) => form.setValue("identityNumber", v, { shouldDirty: true })}
  onTaxNumberChange={(v) => form.setValue("taxNumber", v, { shouldDirty: true })}
  onTaxOfficeChange={(v) => form.setValue("taxOffice", v, { shouldDirty: true })}
/>
```

(section header zaten "Vergi / Kimlik Bilgileri" gösteriyor → `showHeading={false}`.)

- [ ] **Step 5: Kullanılmayan importları temizle**

`FormControl`/`FormItem`/`FormLabel`/`FormMessage`/`Input`/`Textarea` hâlâ formun geri kalanında (Temel Bilgiler adı/telefon/email/adres, notlar, sidebar) kullanılıyor — SİLME. Sadece gerçekten kullanılmayan kalırsa temizle. `bun run lint` uyarısını rehber al.

- [ ] **Step 6: typecheck + lint**

Run: `bun run typecheck && bun run lint src/components/app/customer-create-form.tsx`
Expected: hata yok.

- [ ] **Step 7: Manuel doğrula (dev)**

Run: `bun run dev` → `http://localhost:3000/customers/new`
- İl "İstanbul" seç → İlçe listesi İstanbul ilçelerini gösterir; "Kadıköy" seç.
- İl'i "Ankara" olarak değiştir → İlçe **sıfırlanır**, liste Ankara ilçeleri olur.
- Vergi/Kimlik: TC/Vergi No/Vergi Dairesi üçü de görünür; TC'ye harf yazılamaz (sayısal).
- Kaydet → müşteri detayına yönlenir, il/ilçe/vergi kaydı doğru.

- [ ] **Step 8: Commit**

```bash
git add src/components/app/customer-create-form.tsx
git commit -m "refactor(customers): /customers/new il/ilçe cascade + ortak Vergi/Kimlik component'i"
```

---

### Task 5: `customer-search-or-create.tsx`'e bağla (inline modal)

**Files:**
- Modify: `src/components/app/customer-search-or-create.tsx`

**Interfaces:**
- Consumes: `CityDistrictFields` (Task 2), `TaxIdentityFields` (Task 3). Mevcut `useState`: `identityNumber`,`taxNumber`,`taxOffice`,`city`,`district`,`address`,`showExtra`.

- [ ] **Step 1: Import ekle**

```tsx
import { CityDistrictFields } from "@/components/app/forms/city-district-fields"
import { TaxIdentityFields } from "@/components/app/forms/tax-identity-fields"
```

- [ ] **Step 2: "Ek bilgiler" içeriğini ortak component'lerle değiştir**

`{showExtra && ( ... )}` bloğundaki mevcut `grid grid-cols-2 ...` içeriğini (tipe-koşullu TC/Vergi bloğu + düz İl/İlçe input'ları + Adres) tümüyle şununla değiştir:

```tsx
{showExtra && (
  <div className="space-y-3 rounded-lg border border-border p-3">
    <TaxIdentityFields
      identityNumber={identityNumber}
      taxNumber={taxNumber}
      taxOffice={taxOffice}
      onIdentityChange={setIdentityNumber}
      onTaxNumberChange={setTaxNumber}
      onTaxOfficeChange={setTaxOffice}
    />
    <CityDistrictFields
      city={city}
      district={district}
      onCityChange={setCity}
      onDistrictChange={setDistrict}
    />
    <div className="space-y-1.5">
      <Label>Adres</Label>
      <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Mahalle / Sokak / No" />
    </div>
  </div>
)}
```

(`TaxIdentityFields` kendi başlığını gösterir → showHeading default true. Sayısal filtre component içinde; `setIdentityNumber`/`setTaxNumber` doğrudan bağlanır.)

- [ ] **Step 3: `handleCreate` submit koşulunu düzelt**

Vergi alanlarındaki `type === "individual"` koşulunu KALDIR — her üç alanı dolu olduğunda gönder:

```tsx
// Optional fields — her zaman üçü; dolu olanı gönder (boş alan gönderilmez).
if (identityNumber.trim()) cf.set("identityNumber", identityNumber.trim())
if (taxNumber.trim()) cf.set("taxNumber", taxNumber.trim())
if (taxOffice.trim()) cf.set("taxOffice", taxOffice.trim())
if (city.trim()) cf.set("city", city.trim())
if (district.trim()) cf.set("district", district.trim())
if (address.trim()) cf.set("address", address.trim())
```

- [ ] **Step 4: Kullanılmayan importları temizle**

Artık İl/İlçe için `Input` doğrudan kullanılmıyor olabilir ama `Input` isim/telefon için hâlâ gerekli → SİLME. `Textarea` adres için hâlâ gerekli. `bun run lint` ile gerçekten kullanılmayan varsa temizle.

- [ ] **Step 5: typecheck + lint**

Run: `bun run typecheck && bun run lint src/components/app/customer-search-or-create.tsx`
Expected: hata yok.

- [ ] **Step 6: Manuel doğrula (dev)**

`http://localhost:3000/orders/new` → yeni araç modalı → müşteri "Yeni müşteri" → "Ek bilgiler (opsiyonel)" aç:
- "Vergi / Kimlik Bilgileri" başlığı + üç alan görünür (tip fark etmeksizin).
- İl→İlçe cascade çalışır (İstanbul → Kadıköy); il değişince ilçe sıfırlanır.
- Müşteriyi oluştur → seçili gelir; oluşan müşteri detayında il/ilçe/vergi doğru.

- [ ] **Step 7: Commit**

```bash
git add src/components/app/customer-search-or-create.tsx
git commit -m "refactor(intake): inline müşteri formu ortak Vergi/Kimlik + il/ilçe cascade component'lerine geçti"
```

---

### Task 6: Bütünsel doğrulama

**Files:** yok (yalnız doğrulama)

- [ ] **Step 1: Tüm testler**

Run: `bun test`
Expected: mevcut + yeni `tr-districts` testleri PASS.

- [ ] **Step 2: typecheck (tam)**

Run: `bun run typecheck`
Expected: hata yok.

- [ ] **Step 3: lint (tam)**

Run: `bun run lint`
Expected: yeni hata yok.

- [ ] **Step 4: build**

Run: `bun run build`
Expected: başarılı (değişiklik anlamlı olduğundan build zorunlu).

- [ ] **Step 5: UI QA (opsiyonel ama önerilir)**

`bakimx-ui-qa` skill checklist'i ile iki akışı gözden geçir (mobil genişlikte de): `/customers/new` ve iş emri inline modal — cascade, legacy değer korunması, h-9 yükseklik, dropdown mobil dokunuş.

---

## Notlar
- İlçe veri doğruluğu birincil risk → Task 1 testi sözleşme; büyükşehir ilçe sayıları eksiksiz olmalı.
- Base UI Combobox default filtreleme (yazınca daralma) beklenir; `filter` prop'u VERİLMEZ (customer-search'teki `filter={() => true}` aramayı kapatmak içindi, burada istemiyoruz).
- Cascade reset component içinde (`onCityChange` → `onDistrictChange("")`) — mount'ta tetiklenmez, mevcut kayıt il/ilçesi korunur.
