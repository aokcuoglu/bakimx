# Picker Mod-Geçişli Yeniden Tasarım (Faz 2.1) — Tasarım (Spec)

- **Tarih:** 2026-06-24
- **Durum:** Tasarım onaylandı — uygulama planı bekleniyor
- **Kapsam:** `CustomerVehiclePicker` ve `InlineCreateModal`'ın mobil-öncelikli yeniden tasarımı (kullanıcı geri bildirimi). Faz 2'nin (birleşik picker, commit `846b5dd`, PR #5) bir rafinajı → "Faz 2.1".
- **İlgili:** `docs/superpowers/specs/2026-06-23-birlesik-is-emri-akisi-design.md` §4.2; PR #5.

---

## 1. Bağlam ve mevcut durum

Faz 2'de picker tek bir **birleşik arama** kutusu kullanıyor: kullanıcı plaka **veya** ad/telefon yazar, sonuçlar (araç + müşteri) tek listede gelir. Modal tam müşteri formu (Bireysel/Kurumsal + Ad/Soyad/Telefon/E-posta/TC/VIP) + araç alanları içeriyor.

Kullanıcı **mobil-öncelikli** geri bildirimle bunu yeniden tasarlamak istiyor:
- Birleşik arama yerine **plaka/müşteri mod geçişi** (input içinde kişi ikonu).
- Modalda sabit müşteri formu yerine **aratılabilir müşteri** (DB'de ara → varsa seç, yoksa minimal oluştur).
- Marka/Model API-dropdown'ı **ileri faza** ertelenecek.

## 2. Hedef ve kapsam dışı (YAGNI)

### Hedefler
1. Picker'da **plaka modu (varsayılan) ↔ müşteri modu** (kişi ikonu toggle).
2. Mod'a göre arama; sonuç yoksa altta **"Oluştur"**; plaka modunda seçili araçta **"Sahip Değiştir"**.
3. Modalda müşteri = **aratılabilir alan** (search-or-create); yeni müşteri minimal: **Bireysel/Kurumsal + (Ad/Soyad | Şirket adı) + Telefon**.
4. Tekrar kullanılabilir tek bir **`CustomerSearchOrCreate`** birimi (3 yerde: müşteri modu, "Sahip Değiştir", modal sahip alanı).

### Kapsam dışı (şimdilik)
- **Marka/Model API-dropdown** (free-text kalır; ayrı faz).
- Yeni müşteride e-posta/TC-VKN/VIP/adres gibi alanlar (inline'da yok; tam detay "Oluştur ve Düzenle" → `/vehicles/{id}` veya müşteri sayfasından).
- Şema/migrasyon değişikliği (yok).

## 3. Alınan kararlar

| # | Karar |
|---|-------|
| D1 | Birleşik arama → **plaka (varsayılan) / müşteri (ikon)** mod geçişi |
| D2 | Yeni müşteri inline create: **Bireysel/Kurumsal toggle + (Ad/Soyad ya da Şirket adı) + Telefon (zorunlu)** |
| D3 | Marka/Model **free-text** kalır (API-dropdown ayrı faz) |
| D4 | Mod'a göre sonuç filtresi **client-side** (mevcut `/api/search/customer-vehicle` aynen; ekstra API yok) |
| D5 | Sıfır Prisma migrasyonu |

## 4. Tasarım

### 4.1 Picker — mod geçişli arama (`CustomerVehiclePicker`)

Tek `Combobox` input + input'un sağında **kişi ikonu (toggle button)**:
- **Plaka modu (varsayılan, ikon pasif):** placeholder "Plaka ile ara…". Arama sonuçlarından **yalnızca araç (`kind:"vehicle"`)** gösterilir.
- **Müşteri modu (ikon aktif):** placeholder "Müşteri adı/telefon ile ara…". Sonuçlardan **yalnızca müşteri (`kind:"customer"`)** gösterilir.
- Mod değişince `query` + sonuçlar temizlenir; aktif mod ikonun görünümüyle (renk/dolgu) belli olur.

**Plaka modu davranışı:**
- Araç sonucu seç → araç + güncel sahibi seçili (özet kartı). Özet altında **"Sahip Değiştir"** → `CustomerSearchOrCreate` açılır → seçilince `changeVehicleOwnerAction(vehicleId, newCustomerId)` → sahip güncellenir.
- Sonuç yok → Combobox boş-durumunda (popup içinde) **"Oluştur"** + **"Oluştur ve Düzenle"** → modal (araç + sahip). `initialPlate` = yazılan sorgu.

**Müşteri modu davranışı:**
- Müşteri sonucu seç → müşteri seçili; **araçları listelenir** (`GET /api/vehicles?customerId=`) → araç seç veya **"+ yeni araç"** → modal (sahip sabit = bu müşteri).
- Sonuç yok → popup içinde **"Oluştur"** → `CustomerSearchOrCreate`'in create yolu (minimal müşteri) → müşteri seçili → araç adımına geçer.

### 4.2 `CustomerSearchOrCreate` (yeni, tekrar kullanılabilir birim)

Tek sorumluluk: bir müşteri seçtir — DB'de ara, yoksa minimal oluştur.
- Props: `onSelected(customerId: string, label: string)`, opsiyonel `autoFocus`.
- İçi: `Combobox` (müşteri araması, `filter={() => true}`, server sonuçlarından `kind:"customer"`), sonuç yoksa **"Yeni müşteri"** aç → minimal form: **Bireysel/Kurumsal** toggle, (Bireysel: Ad/Soyad · Kurumsal: Şirket adı), **Telefon (zorunlu)** → `POST /api/customers` (FormData) → `{success,id}` → `onSelected(id, ad)`.
- Kullanım: (a) picker müşteri modu, (b) "Sahip Değiştir", (c) modal sahip alanı.

### 4.3 Modal yeniden tasarım (`InlineCreateModal`)

Plaka bulunamayınca = **araç + sahip oluştur**:
- **Sahip alanı (üst):** `CustomerSearchOrCreate` (ara → seç ya da minimal oluştur). *(Müşteri modundan "+ yeni araç" ile gelinmişse: sahip zaten belli → aratılabilir alan yerine sabit "Sahip: <ad>" gösterilir.)*
- **Araç alanları (alt):** Plaka (zorunlu), Yıl, **Marka (zorunlu, free-text)**, **Model (zorunlu, free-text)**.
- Eski sabit Bireysel/Kurumsal + Ad/Soyad/Telefon/E-posta/TC/VIP bloğu **kaldırılır** (yerini sahip alanı alır).
- Aksiyonlar: **"Oluştur"** (seç + kapat) ve **"Oluştur ve Düzenle"** (`/vehicles/{id}`'e gider).
- Akış: sahip seç/oluştur → araç oluştur (`POST /api/vehicles`, `customerId` = seçilen sahip) → `onCreated({customerId, vehicleId, plate, customerName})`.

## 5. Veri / API

- **Arama:** mevcut `GET /api/search/customer-vehicle?q=` aynen kullanılır; sonuçlar picker'da moda göre `kind` ile **client-side filtrelenir** (plaka modu→vehicle, müşteri modu→customer). Ekstra API yok.
- **Sahip değiştir:** mevcut `changeVehicleOwnerAction(vehicleId, newCustomerId)` (Faz 2a).
- **Müşteri oluştur:** mevcut `POST /api/customers` (FormData: `type`, `firstName`/`lastName` ya da `companyName`, `phone`). `customerCreateSchema` bunları zaten destekliyor.
- **Araç oluştur:** mevcut `POST /api/vehicles` (FormData: `customerId`, `plate`, `brand`, `model`, `modelYear`).
- **Müşterinin araçları:** mevcut `GET /api/vehicles?customerId=`.
- **Sıfır şema/migrasyon.**

## 6. Bileşen değişiklikleri (dokunulan dosyalar)

- **Yeni:** `src/components/app/customer-search-or-create.tsx` (`CustomerSearchOrCreate`).
- **Değişen:** `src/components/app/customer-vehicle-picker.tsx` — mod-geçişi + plaka/müşteri modları; "Sahip Değiştir" ve müşteri modu `CustomerSearchOrCreate`'i tüketir.
- **Değişen:** `src/components/app/inline-create-modal.tsx` — sabit müşteri formu → `CustomerSearchOrCreate` (veya sabit sahip) + araç alanları; `InlineCreateResult` korunur ({customerId, vehicleId, plate, brand, model, customerName}).

## 7. Mobil hususları

- Input tam genişlik; kişi-ikonu dokunmatik hedefi ≥40px; mod placeholder'ı net.
- Combobox popup mobilde input genişliğinde; sonuç satırları rahat dokunulur (ikon + başlık + alt-etiket).
- Modal mobilde sığacak (`max-h` + scroll); alanlar tek/iki kolon responsive.
- "Oluştur" / "Sahip Değiştir" butonları popup içinde (alttaki butonların popup tarafından örtülmesi sorunu Faz 2'de yaşandı → aksiyonlar popup içinde).

## 8. Riskler ve azaltma

| Risk | Azaltma |
|------|---------|
| base-ui Combobox'ın `CustomerSearchOrCreate` içinde iç içe/tekrar kullanımı | Tek bileşene izole; her kullanım `onSelected` ile konuşur |
| Mod geçişinde stale sonuç/sorgu | Mod değişince query+results temizle |
| Marka/Model free-text (geçici) | Kabul edilen tradeoff; API-dropdown ayrı faz |
| Modal sahip alanı iki bağlam (aratılabilir / sabit) | Prop ile ayrım (`fixedCustomer?`) |

## 9. Test ve QA

- Saf mantık değişmiyor (mevcut `buildUnifiedResults` testleri korunur). UI: typecheck + lint + build + manuel QA (yerel `:3001`, demo seed).
- Manuel: plaka modu ara/seç/sahip-değiştir; müşteri modu ara/seç/araç-seç/yeni-araç; her iki modda "Oluştur"; modalda Bireysel/Kurumsal + minimal müşteri + araç; mobilde dokunmatik + modal sığması.

## 10. Açık sorular

Kritik açık soru yok (D1–D5 + C-1 kurumsal-inline netleşti). Uygulama ayrıntıları `writing-plans` aşamasında.
