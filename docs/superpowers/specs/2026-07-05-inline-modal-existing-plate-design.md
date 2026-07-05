# Tasarım: InlineCreateModal — mevcut plaka çakışmasını seçime dönüştür

**Tarih:** 2026-07-05
**Durum:** Onaylandı (tasarım)
**Kapsam:** `src/components/app/inline-create-modal.tsx` (tek dosya)

## Problem

İş emri/teklif oluştururken `CustomerVehiclePicker`'daki "Ruhsat tara — yeni
müşteri & araç" kartı `InlineCreateModal`'ı açıyor. Kullanıcı ruhsatı okuturken o
aracın sistemde kayıtlı olup olmadığını bilmiyor. Plaka DB'de zaten varsa,
kullanıcı tüm formu doldurup "Oluştur"a bastıktan sonra `createVehicleAction`
Prisma unique-constraint hatasını yakalayıp şu çıkmaz-sokak mesajını dönüyor:

> "Bu plaka ile kayıtlı bir araç zaten var. Lütfen mevcut aracı düzenleyin veya
> farklı bir plaka girin."

Sistem plakadan aracı zaten tanıyor (plaka workshop içinde unique) ama seçtirmek
yerine kullanıcıyı akıştan koparıyor. Kullanıcının istediği farklı plaka girmek
değil — o araç için iş emri açmak, yani mevcut aracı **seçmek**.

## Hedef davranış

Plaka DB'de bulunduğunda hata basmak yerine mevcut aracı bulup tek tıkla seçime
çevirmek. Tespit hem erken (plaka dolar dolmaz) hem de submit anında (güvenlik
ağı) çalışır.

## Kararlar

- **Tespit anı:** Erken (plaka değişince, debounce'lu) **+** submit güvenlik ağı.
- **Eşleşme aksiyonu:** Araç DB'deki **gerçek sahibiyle** seçilir. Plaka tek bir
  aracı ve sahibini işaret eder; ekranda seçili/seed'lenmiş müşteri farklı olsa
  bile bulunan aracın gerçek sahibi esas alınır.
- **Yaklaşım:** Mevcut `/api/search/customer-vehicle` endpoint'i yeniden
  kullanılır (yeni backend yok). Seçim mevcut `onCreated` callback'i üzerinden
  yapılır (yeni prop yok).

## Mimari

Değişiklik tamamen `inline-create-modal.tsx` içinde. Aşağıdaki bileşenlere
**dokunulmaz:** `createVehicleAction`, `/api/vehicles`, `/api/search/customer-vehicle`,
`CustomerVehiclePicker.onModalCreated`.

### 1. Tespit

Yeni state:

```ts
existingMatch: { vehicleId: string; customerId: string; label: string; sublabel: string } | null
checkingPlate: boolean
```

- `fields.plate` değişince `useEffect` + ~400ms debounce.
- `normalizePlate(fields.plate)` sonucu min uzunlukta değilse (< 5 kabaca) atla,
  `existingMatch = null`.
- `GET /api/search/customer-vehicle?q=<normalize edilmiş plaka>` çağrılır.
- Dönen `results` içinden `kind === "vehicle"` olan ve `normalizePlate(r.plate)`
  === aranan plaka olan **birebir** eşleşme seçilir (contains araması geniş
  döndüğü için client'ta kesin filtre şart).
- Bulunursa `existingMatch` set edilir. Bulunmazsa `null`.
- İstek yarışlarına karşı effect cleanup'ında `active` bayrağı kullanılır
  (picker'daki mevcut desenle aynı).
- Modal her açılışta (`justOpened` reset bloğu) `existingMatch = null`,
  `checkingPlate = false`.

**Doğrulanan `UnifiedResult` (vehicle) şekli:** `{ vehicleId, customerId, plate,
label ("PLAKA — Marka Model"), sublabel ("Sahip: <ad>") }`. Marka/model **ayrı
alan olarak yok** — `label`/`sublabel` içine gömülü. Dolayısıyla:
- `existingMatch` alanları: `vehicleId`, `customerId`, `label` (hazır), `sublabel`
  (hazır) tutulur. Karta bu ikisi doğrudan basılır; ayrıca parse gerekmez.
- `ownerName` (onCreated'ın `customerName`'i için) `sublabel`'dan "Sahip: "
  önekini soyarak türetilir.

### 2. Eşleşme kartı

Plaka input'unun hemen altında (primary alanlar bloğu içinde), `existingMatch`
doluyken görünür:

```
⚠️ Bu plaka zaten kayıtlı: <label>
   <sublabel: Sahip: X>
   [Bu aracı seç]
```

- `warning` tonlu, mevcut `border-warning/…` sınıf paletiyle uyumlu.
- Kart metni doğrudan `existingMatch.label` ve `existingMatch.sublabel`'dan gelir.
- "Bu aracı seç" → mevcut `onCreated` çağrılır. `InlineCreateResult.plate`/`brand`/
  `model` yalnızca picker'ın seçim etiketini besler; ayrı marka/model olmadığından
  `label`'ın `" — "` sonrası kuyruğu `brand` olarak geçilir, `model` boş bırakılır
  (picker etiketi `PLAKA — Marka Model` olarak doğru render eder). `customerName`
  = `ownerName`. Ardından `onOpenChange(false)`.
- Picker'ın `onModalCreated`'ı bunu araç seçimi olarak işler; iş emri akışı
  kesintisiz devam eder.

### 3. Submit güvenlik ağı

`handleCreate` içinde POST'tan önce:

- `existingMatch` doluysa POST atlanır, kart vurgulanır (gerekirse scroll/focus)
  ve fonksiyon durur. Ham "zaten var" hatası kullanıcıya hiç ulaşmaz.
- Erken tespit herhangi bir sebeple kaçırırsa ve API yine de unique-constraint
  hatası dönerse, o mesaj son çare olarak **değiştirilmeden** kalır.

## Veri akışı

```
Kullanıcı ruhsat tarar / plaka yazar
        │
        ▼
fields.plate değişir ──debounce 400ms──► GET /api/search/customer-vehicle?q=plaka
        │                                          │
        │                                birebir plaka eşit filtre
        ▼                                          ▼
   eşleşme yok                              existingMatch set
        │                                          │
   normal oluştur akışı              ┌─────────────┴─────────────┐
        │                            ▼                           ▼
   POST /api/vehicles         "Bu aracı seç"              "Oluştur" (güvenlik ağı)
        │                            │                           │
        ▼                            ▼                     existingMatch dolu → POST'u durdur,
   onCreated(yeni)      onCreated(mevcut ids) + kapat            kartı göster
```

## Riskler

- **Yanlış eşleşme:** Arama endpoint'i `contains` yapıyor; client'ta birebir
  normalize-plaka eşitliği zorunlu, aksi halde "34 MYL 739" için "34 MYL 7391"
  de eşleşir.
- **Çifte tetikleme:** OCR plakayı set ederken aynı anda debounce tetiklenebilir;
  tek effect + cleanup ile idempotent tutulur.
- **OCR owner-seed çakışması:** Kart görünürken kullanıcı "seç" derse OCR'ın
  `ownerSeed`/`autoCreate` müşteri-oluşturma akışı tümüyle atlanır (istenen
  davranış — mevcut aracın gerçek sahibi kullanılır).

## Test / Manuel QA

1. İş emri akışında picker → "Ruhsat tara" → DB'de **kayıtlı** plakalı ruhsat
   okut → kart çıkmalı, "Bu aracı seç" araç seçmeli, akış devam etmeli.
2. Aynı senaryoda plakayı **elle** yaz (OCR'sız) → kart yine çıkmalı.
3. DB'de **olmayan** plaka → kart çıkmamalı, normal oluşturma çalışmalı.
4. Kart görünürken yine de "Oluştur"a bas → ham hata yerine kart vurgulanmalı.
5. Kartlı plakayı silip farklı plaka yaz → kart kaybolmalı.
6. Bulunan aracın sahibi ekrandaki seed müşteriden farklıyken "seç" → gerçek
   sahiple seçilmeli.

## Kapsam dışı

- Tam sayfa `/vehicles/new` (`VehicleCreateForm`) aynı çıkmaza sahip ama orada
  "seç" hedefi yok; ayrı ve daha küçük bir iş (hatayı mevcut araca link'e
  çevirmek). Bu spec'e dahil değil.
