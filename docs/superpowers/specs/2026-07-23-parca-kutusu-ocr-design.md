# Parça Kutusu OCR — Tasarım Dökümanı

**Tarih:** 2026-07-23
**Durum:** Onaylandı (brainstorming), implementation planı bekliyor
**Kapsam:** "Dışarıdan Parça Alımı" (Parça Aldım) modalındaki "Parça kutusu fotoğrafı" için OCR — teknisyen kutuyu okuttuğunda parça adı, marka ve parça numaralarını çıkarıp forma öneri olarak doldurur.

## Amaç

Teknisyen dışarıdan aldığı parçanın kutusunu fotoğrafladığında; parça adı, marka ve kutu üzerindeki tüm parça numaralarını (OEM no, marka kodu, MANN/Bosch gibi çapraz referanslar) otomatik okuyup `AddPurchaseButton` formuna **öneri** olarak sunmak. Öneriler hiçbir alanı zorla ezmez; kullanıcı hangisini kullanacağını seçer.

Referans kutu (SETA yağ filtresi): `OIL FILTER`, marka `SETA`, `SETA CODE: STO-539`, `OEM NO: 04152-YZZA6`, `MANN NO: HU 6006 Z`.

## Mimari Genel Bakış

Ruhsat OCR altyapısı (`src/lib/ocr/` + `smart-capture/ocr` deseni) yeniden kullanılır; paralel bir "part box" yolu açılır.

- **Provider katmanı** (`src/lib/ocr/`): `OcrProvider` arayüzüne **opsiyonel** `extractPartBox(buffer, mimeType)` eklenir. Yalnızca **Anthropic** (prod) ve **Mock** (dev) uygular. Diğer provider'lar (paddle/openai/hybrid/tesseract) uygulamaz → route "desteklenmiyor" döner. 4 provider'a dokunmadan minimal değişiklik.
- **Yeni API route** `src/app/api/parts/ocr/route.ts`: `smart-capture/ocr/route.ts` desenini taklit eder — boyut/MIME limiti, SHA-256 `hashImageBuffer` + `OcrLog` dedup cache, `extractPartBox()` çağrısı, `OcrLog` kaydı. `rawText` istemciye dönmez.
- **İstemci** (`AddPurchaseButton`, `technician-order-detail.tsx`): fotoğraf seçilince mevcut `file` bu route'a POST edilir; dönen öneri listesi modalda gösterilir. Fotoğraf yine normal submit'te (`addPurchaseItemAction`) yüklenir — mevcut akış bozulmaz.

**Şema/migration yok, DB değişikliği yok.** `OcrLog` mevcut haliyle kullanılır.

## Claude Çıkarım Şeması (tool-use)

Anthropic provider'da strict tool-use (`extractRegistration` deseni). Yeni tool `kaydet_parca_kutusu_alanlari`, zod ile doğrulanan çıktı:

```ts
type PartNumberSuggestion = {
  value: string;      // "STO-539", "04152-YZZA6", "HU 6006 Z"
  label: string;      // "SETA CODE", "OEM NO", "MANN NO"
  confidence?: number;
};

type PartBoxOcrResult = {
  partName: OcrFieldConfidence;      // "OIL FILTER" → Türkçe: "Yağ filtresi"
  brand: OcrFieldConfidence;         // "SETA"
  partNumbers: PartNumberSuggestion[]; // kutudaki her kod ayrı öğe
  rawText: string;
  provider: OcrProviderName;
};
```

- `partName`: kutudaki İngilizce/parça tipini Türkçe'ye çevirir ("Örn. Ön fren balatası" tonunda). **Emin değilse orijinali bırakır.**
- `partNumbers`: kutuda okunan **her** kod ayrı öğe; `label` kaynağı belirtir. Kullanıcı birini "Parça no / OEM" alanına seçer.
- `brand`: marka adı. **Formda marka alanı yok → şemaya/DB'ye kolon eklenmez.** Marka öneri olarak gösterilir; seçilirse "Parça adı"na birleştirilir (örn. "Yağ filtresi — SETA").

`PartBoxOcrResult` tipi `types.ts`'e eklenir. Mock provider bu şemayla deterministik SETA yağ filtresi verisi döndürür (dev'de API anahtarsız çalışır).

## İstemci UI — Öneri Listesi

`AddPurchaseButton` içinde, "Parça kutusu fotoğrafı" bölümünün altına:

- **Fotoğraf seçilir seçilmez**: mevcut `file` `/api/parts/ocr`'a POST edilir. `BrandSpinner` (dual gears; skeleton değil) + "Kutu okunuyor…".
- **Sonuç gelince** öneri kartı:
  - **Parça adı önerisi**: tek tık ile "Parça adı" alanına yazar; marka ekli varyant çip olarak ("Yağ filtresi — SETA").
  - **Parça no önerileri**: her numara bir çip → `label · value` (örn. `OEM NO · 04152-YZZA6`). Tıklanınca "Parça no / OEM" alanına yazar. Düşük güvenli (`confidence < eşik`) çipler soluk/uyarı tonunda.
  - Alanlar kilitli değil; kullanıcı çipleri yok sayıp elle yazabilir.
- **Hata/okunamadı**: sessiz düşüş — "Kutu okunamadı, alanları elle girebilirsiniz". Form normal çalışır.
- Shadcn/Base UI bileşenleri (custom UI yok); çipler mevcut `Badge`/`Button` desenleri.

**OCR yalnızca öneri üretir** — hiçbir alanı zorla ezmez, submit akışını değiştirmez.

## Hata Yönetimi, Güvenlik, İzolasyon

- Route `requireAuth()` ile `workshopId` türetir; `OcrLog.workshopId` buradan gelir, istemci parametresine güvenilmez (tenant izolasyonu).
- Dedup cache sorgusu `workshopId + imageHash + ocrProvider` ile scope'lu; cache-hit yeni bir `OcrLog` satırı yazar (ruhsat deseni), mock asla cache'lenmez.
- Boyut/MIME limitleri `smart-capture/ocr` ile aynı (`MAX_IMAGE_SIZE_BYTES`, `SUPPORTED_IMAGE_MIME_TYPES`).
- Provider `extractPartBox` desteklemiyorsa → 400; istemci sessizce elle-giriş moduna düşer.
- Anthropic hatası/timeout → 502; istemcide "okunamadı" uyarısı, form çalışır.

## Test

- **Birim:** `PartBoxOcrResult` zod şema doğrulama; mock provider deterministik çıktı; marka→parça-adı birleştirme yardımcısı.
- **Route:** auth zorunluluğu; tenant scope; dedup cache-hit yeni `OcrLog` yazması; desteklenmeyen provider 400.
- Mevcut test altyapısına uyulur (plan aşamasında netleştirilir).

## Dokunulacak Dosyalar

| Dosya | Değişiklik |
|---|---|
| `src/lib/ocr/types.ts` | `PartBoxOcrResult`, `PartNumberSuggestion`, opsiyonel `extractPartBox` |
| `src/lib/ocr/anthropic-ocr-provider.ts` | `extractPartBox` (tool-use `kaydet_parca_kutusu_alanlari`) |
| `src/lib/ocr/mock-ocr-provider.ts` | Mock part-box verisi |
| `src/lib/ocr/part-box-result.ts` *(yeni)* | zod şema + normalize |
| `src/app/api/parts/ocr/route.ts` *(yeni)* | OCR route + dedup + OcrLog |
| `src/components/app/technician-order-detail.tsx` | `AddPurchaseButton`'a öneri UI |

## Risk Alanları

1. **Anthropic maliyeti** — SHA-256 dedup ile azaltıldı.
2. **Çok-numaralı kutularda yanlış etiketleme** — kullanıcı seçtiği için düşük risk.
3. **İngilizce→Türkçe çeviri tutarlılığı** — "emin değilse orijinali bırak" ile sınırlı.

## Manuel QA Adımları

1. Dev'de (mock provider) "Parça Aldım" → fotoğraf seç → öneri kartının SETA verisiyle açıldığını doğrula.
2. Çip tıklamalarının doğru alanlara yazdığını, elle düzenlemeyi ezmediğini doğrula.
3. Marka çipinin "Parça adı"na birleştiğini doğrula.
4. Mobilde (mobile-first) öneri kartının taşmadığını doğrula.
5. Submit sonrası fotoğrafın `PurchaseDetailDialog`'da eskisi gibi göründüğünü doğrula (yükleme akışı bozulmadı).
