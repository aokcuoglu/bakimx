# Ruhsat OCR byte-hash dedup (cache) — Tasarım

**Tarih:** 2026-07-04
**Durum:** Onaylandı, implementasyona hazır

## Amaç

Aynı ruhsat fotoğrafı ikinci kez okutulduğunda OCR provider'ını (Paddle / Anthropic Vision — akışın pahalı ve yavaş kısmı) **hiç çalıştırmadan** sonucu önceki taramadan döndürmek.

## Kapsam kararı

"Aynı ruhsat" tespiti **yalnızca aynı görsel byte'ları** (aynı fotoğrafın tekrar okutulması) ile sınırlıdır. Byte-hash eşleşmesi kesindir, yanlış-eşleşme (false positive) riski yoktur.

**Kapsam dışı:** "Aynı fiziksel araç ama farklı çekilmiş yeni fotoğraf". Piksel değişir, byte hash tutmaz. Bunu OCR'sız anlamak ya kırılgan perceptual-hash gerektirir ya da OCR'ı çalıştırıp plaka/VIN eşleştirmeyi — ki bu OCR maliyetini azaltmaz, farklı bir problemdir (mükerrer araç kaydı önleme). Bu tasarımın amacı OCR çağrısını atlamaktır, o yüzden byte-hash yeterli ve doğru araçtır.

İsrafın büyük çoğunluğu (modal tekrar açma, çift tıklama, aynı karede tekrar deneme) zaten aynı-kare senaryosudur.

## Mimari

Hash sunucu tarafında alınır ve cache'e sunucu tarafında bakılır. Mevcut `POST /api/smart-capture/ocr` endpoint'i korunur; client tarafında **hiçbir değişiklik yoktur** (yanıt şekli birebir aynı kalır).

### Akış

1. `imageBuffer` oluşur (mevcut kod — hem `multipart/form-data` hem `data URL` yolunda).
2. `imageHash = sha256(imageBuffer)` — normalize **öncesi** ham byte'lardan. Böylece hash, normalize parametrelerinden bağımsız ve aynı upload için deterministiktir. Node yerleşik `crypto` kullanılır; yeni bağımlılık yok.
3. `provider = getOcrProvider()`.
4. **Provider mock değilse** → `OcrLog` içinde ara:
   `workshopId = user.workshopId AND imageHash = hash AND ocrProvider = provider.name AND extractedJson != null`, `createdAt desc` en yeni satır.
   - **Cache hit:** provider **hiç çağrılmaz**. `extractedJson` (ve `rawText`) kaynak satırdan alınıp sonuç objesi yeniden kurulur. Bu tarama için **yeni** bir `OcrLog` satırı yazılır (extraction kopyalanır; audit metadata'ya `cacheHit: true` ve kaynak `ocrLogId` eklenir). Normalize yine yapılır (UI'ın `previewDataUrl`'ü için — ucuz kısım). Yanıt normal döndürülür.
   - **Cache miss:** mevcut yol aynen — provider çalışır, `OcrLog` yazılır, artık `imageHash` kolonu da doldurulur.
5. **Provider mock ise:** cache'e bakılmaz ve `imageHash` yazılmaz. Mevcut "mock asla cache'lenmez" kuralı korunur (mock satırlar da `ocrProvider="mock"` olduğundan yine anahtar dışıdır).

### Neden provider anahtarın parçası

Aynı görsel Paddle ile okunmuşken `OCR_PROVIDER` Anthropic'e çekilirse, eski/düşük-kaliteli sonucu servis etmemek gerekir; farklı provider'da yeniden çalışsın. Anahtara `ocrProvider` eklemek ucuz ve güvenlidir.

### Cache-hit'te neden yeni OcrLog satırı

`POST /api/smart-capture/confirm`, `ocrLogId` ile satırı bulup `confirmedJson`/`confirmedAt` yazıyor. Cache-hit'te mevcut satırı geri döndürüp paylaşırsak, iki ayrı taramanın onayları birbirini ezer. Her tarama kendi satırına sahip olmalı; bu yüzden cache-hit'te de yeni bir satır açılır (extraction kaynaktan kopyalanır). `ruhsattan-oku.tsx` `ocrLogId`'yi zaten kullanmıyor (sadece `data.result`); `smart-capture-registration.tsx` onaylamada kullanıyor — yeni satır her iki tüketiciyi de doğru tutar.

## Şema değişikliği

`OcrLog` modeline:
- `imageHash String?` — SHA-256 hex, nullable.
- `@@index([workshopId, imageHash])`.

**Migration etkisi:** Additive, nullable kolon + index. Backfill yok; mevcut satırlar `null` kalır (asla eşleşmez, sorun değil). Prisma `migrate dev` ile üretilir. **Şema değişince dev server restart şart** (db.ts Prisma singleton eski client'ı tutar).

## Değişen dosyalar

- `prisma/schema.prisma` — `OcrLog`'a `imageHash` kolonu + index, ve yeni migration.
- `src/app/api/smart-capture/ocr/route.ts` — hash hesabı, cache lookup + branch, miss yolunda `imageHash` yazımı, cache-hit'te yeni satır.
- Client: **değişiklik yok**.

## Risk alanları

- **Hash determinizmi:** Aynı foto tekrar seçildiğinde client `prepareRegistrationImage` birebir aynı byte'ları üretmezse cache tutmaz. Bu yalnız *kaçırılmış tasarruftur*, hatalı davranış değil — kabul edilebilir.
- **PII / tenant izolasyonu:** Lookup her zaman `workshopId` filtreli; çapraz-workshop veri sızıntısı yok.
- **Cache-hit yeni satır:** confirm akışı bozulmaz çünkü her taramanın kendi satırı ve `confirmedJson` slotu var.
- **DB büyümesi:** Cache-hit'te ek satır açılır; OcrLog zaten tarama başına bir satır yazıyordu, davranış aynı büyüklükte kalır (görsel byte'ları DB'ye yazılmaz, sadece hash + extraction).

## Manuel QA

1. Bir ruhsatı okut → alanlar dolar (miss; provider çalışır, `imageHash` yazılır).
2. **Aynı** dosyayı tekrar okut → alanlar aynı gelir; sunucu logunda provider çağrısı **olmamalı**, yanıt anında dönmeli (cache hit).
3. Farklı bir ruhsat → normal OCR çalışır (miss).
4. `OCR_PROVIDER=mock` → her seferinde çalışır, cache yok.
5. `OCR_PROVIDER` değiştir (örn. paddle→anthropic), aynı fotoğrafı tekrar okut → yeniden OCR çalışır (provider anahtar farkı).
