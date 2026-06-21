# BakimX Ruhsat OCR (Python)

BakimX web uygulamasındaki `src/app/app/smart-capture/registration` sayfasının
OCR akışının Python portu. **DeepSeek/LLM kullanmaz** — Tesseract ham metnini
regex ile yapısal alanlara çevirir. Maliyet sıfır, çevrimdışı çalışır.

## Kurulum

### 1. Tesseract (sistem)

```bash
brew install tesseract tesseract-lang
```

`tur` ve `eng` dil paketlerinin geldiğini doğrulayın:

```bash
tesseract --list-langs | grep -E "^(tur|eng)$"
```

### 2. Python bağımlılıkları

Proje kökünde:

```bash
pip install -r scripts/requirements.txt
```

## Kullanım

```bash
# JSON çıktı (varsayılan)
python scripts/registration_ocr.py --image ./ruhsat.jpg

# Okunabilir text çıktı + ham OCR metni
python scripts/registration_ocr.py --image ./ruhsat.jpg --output text

# HEIC desteği için pillow-heif gerekir (requirements.txt'te var)
python scripts/registration_ocr.py --image ./ruhsat.heic
```

## Çıktı alanları

`plate, vin, ownerName, ownerSurname, brand, model, vehicleType, modelYear,
engineNo, registrationDate, rawText, provider`

- `plate`, `vin`, `engineNo` → büyük harfe çevrilir
- `modelYear` → regex parser boş bıraktıysa Tesseract ham metninden
  `D.4 / MODEL YILI` etiketi yakınındaki `(19|20)\d{2}` regex ile düzeltilir
- `rawText` → Tesseract çıktısı (trim'li)
- `provider` → `tesseract-regex` (LLM kullanılmadığını belirtir)

## Regex parser stratejisi

Türk ruhsat etiket kodları ve eşlenen alanlar:

| Etiket            | Alan              |
| ----------------- | ----------------- |
| `D.1 MARKASI`     | `brand`           |
| `D.3 TİCARİ ADI`  | `model`           |
| `D.5 CİNSİ`       | `vehicleType`     |
| `D.4 MODEL YILI`  | `modelYear`       |
| `P.5 MOTOR NO`    | `engineNo`        |
| `E ŞASE NO`       | `vin`             |
| `C.1.2 ADI`       | `ownerName`       |
| `C.1.1 SOYADI`    | `ownerSurname`    |
| `I TESCİL TARİHİ` | `registrationDate`|
| Plaka regex       | `plate`           |

**Değer çıkarma:**
1. Satırları listele, boş satırları atla
2. Her etiket için: regex ile eşleşen satırı bul
3. Aynı satırda etiket sonrası değer varsa al
4. Değer boşsa, sonraki non-empty satırı değer al (etiket satırı değilse)
5. Etiket bulunamazsa alan = `""`

Plaka tüm metinde `\b\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}\b` ile aranır.

## Karşılık gelen TS dosyaları

| Python fonksiyonu          | TS kaynak                          |
| -------------------------- | ---------------------------------- |
| `prepare_image`            | `prepare-registration-image.ts` + `normalize-registration-image.ts` |
| `extract_text`             | `tesseract-text-extractor.ts`      |
| `parse_fields_regex`       | `deepseek-ocr-provider.ts` (yerine regex) |
| `reconcile_fields`         | `deepseek-ocr-provider.ts` `reconcileFields` |
| `extract_model_year`       | `deepseek-ocr-provider.ts` `extractModelYear` |
| `to_result`               | `registration-result.ts` `toRegistrationResult` |
| `RegistrationFields`       | `RegistrationFieldsSchema` (zod)    |

## Template tabanlı bölgesel OCR

Düşük kaliteli görsellerde tüm sayfa OCR + regex yetersiz kalıyorsa,
template yaklaşımı ile her alan ayrı ayrı okunur:

### 1. Referans görselde alanları işaretle

```bash
python scripts/define_regions.py --image ./referans_ruhsat.jpg --output ./template.json
```

- Görsel açılır, her alan için sırayla kutu çizersin
- `n` → sonraki alan, `r` → yeniden çiz, `s` → kaydet, `q` → çık
- Çıktı: `template.json` (koordinatlar + PSM ayarları)

### 2. Yeni görseli template ile oku

```bash
python scripts/region_ocr.py --image ./yeni_ruhsat.jpg --template ./template.json
```

- ORB feature matching ile yeni görseli referansa hizalar
- Her bölgeyi kırpıp ayrı ayrı OCR okur (PSM 7 SINGLE_LINE)
- Çıktı: her alan için `{ raw, text, confidence }`

### gereksinimler

```bash
pip install -r scripts/requirements.txt   # opencv-python dahil
```

### Hizalama başarısız olursa

`--no-align` ile raw kırp kullanılır (görsel aynı açıdaysa işe yarar).

## Notlar

- DB kaydı (`/api/smart-capture/confirm`) hariç — bu script sadece OCR çıktısı üretir.
- `OcrFieldConfidence` (alan başına güven skoru) hariç — Tesseract/regex
  confidence üretmez.