# BakımX Ruhsat OCR Sidecar (PaddleOCR)

Türk araç tescil belgesi (ruhsat) fotoğraflarından 15 alanı çıkaran **yerel, ücretsiz,
çevrimdışı** OCR servisi. Next.js uygulaması bunu localhost HTTP ile çağırır
(`src/lib/ocr/paddle-ocr-provider.ts`).

Bu servis **kasıtlı olarak** Next.js Alpine imajından ayrıdır: paddlepaddle + paddleocr
ağır ML bağımlılıklarıdır ve uygulama imajını şişirmemeleri için kendi Python sürecinde
(ileride kendi container'ında) çalışırlar.

## Neden ayrı servis?
- Modeller süreç başında **bir kez** yüklenir, sıcak kalır → her çağrı ~1-2 sn (CPU'da
  inference ~10-12 sn; GPU'da çok daha hızlı).
- Next imajı ince kalır; prod'da ayrı container olarak deploy edilebilir.

## Kurulum (dev, macOS — Docker yok)

```bash
cd ocr-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> Not: `tesseract` gerekmez. İlk çalıştırmada PaddleOCR model dosyalarını
> `~/.paddlex/official_models` altına indirir (bir kerelik).

## Çalıştırma

```bash
# ocr-service/ içinde, .venv aktifken:
uvicorn main:app --host 127.0.0.1 --port 8000
# veya kısayol:
./run.sh
```

Sağlık kontrolü:

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok","ready":true,"engine":"paddleocr","lang":"tr"}
```

## Next.js tarafını bağlama

`.env.local`:

```
OCR_PROVIDER=paddle
# OCR_SERVICE_URL=http://127.0.0.1:8000   # varsayılan, gerekirse değiştir
```

Sonra `/orders/new` → "Ruhsattan Okuma" akışı bu servisi kullanır.

## Sözleşme

`POST /ocr` (multipart, alan adı `image`) →

```json
{
  "fields": { "plate": "34 NDV 215", "vin": "...", ... 15 alan ... },
  "confidence": { "plate": 1.0, ... },
  "rawText": "...",
  "provider": "paddle",
  "boxCount": 77
}
```

`fields` anahtarları Next tarafındaki `RegistrationFieldsSchema` ile birebir aynıdır.

## Prod notu
Prod'da bu servis ayrı bir Python container'ı olarak çalıştırılmalı; `OCR_SERVICE_URL`
o container'a yönlendirilir. Next.js Alpine imajına PaddleOCR **eklenmez**.
