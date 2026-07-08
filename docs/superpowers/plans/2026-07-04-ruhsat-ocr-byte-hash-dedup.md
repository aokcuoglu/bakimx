# Ruhsat OCR byte-hash dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aynı ruhsat fotoğrafı ikinci kez okutulduğunda OCR provider'ını hiç çalıştırmadan sonucu önceki taramadan (byte-hash cache) döndürmek.

**Architecture:** Sunucu tarafında, gelen görselin ham byte'larından SHA-256 alınır. `POST /api/smart-capture/ocr` içinde, provider mock değilse `OcrLog` içinde `workshopId + imageHash + ocrProvider` ile önceki başarılı bir tarama aranır; bulunursa provider çağrısı atlanır ve extraction cache'ten yeniden kurulur (yine de her tarama kendi audit satırını alır). Client değişmez.

**Tech Stack:** Next.js App Router (route handler), Prisma (Postgres, `OcrLog`), Node yerleşik `crypto`, `bun test` (saf lib testleri).

## Global Constraints

- Tenant izolasyonu: her `OcrLog` sorgusu `workshopId = user.workshopId` filtreli olmalı; `workshopId` `requireAuth()`'tan gelir, client'tan asla alınmaz.
- "Mock asla cache'lenmez": provider `mock` iken cache'e bakılmaz ve `imageHash` yazılmaz.
- Şema değişikliği additive + nullable olmalı; backfill yok. Prisma `migrate dev` kullanılır (db push değil).
- Şema değişince **dev server restart şart** (`src/lib/db.ts` Prisma singleton eski client'ı tutar).
- Yeni npm/bun bağımlılığı eklenmez (`crypto` yerleşik).
- TypeScript strict; `any` yok.
- Yerel DB OrbStack ile çalışır: migrate/typecheck öncesi `docker compose -f docker-compose.local.yml up -d` gerekebilir (Prisma `localhost:5432`'ye bağlanamıyorsa infra kapalıdır).

---

### Task 1: `OcrLog`'a `imageHash` kolonu + index (schema + migration)

**Files:**
- Modify: `prisma/schema.prisma` (`model OcrLog`, ~satır 1047-1068)
- Create: `prisma/migrations/<timestamp>_add_ocrlog_image_hash/migration.sql` (Prisma üretir)

**Interfaces:**
- Produces: `OcrLog.imageHash: string | null` alanı ve `@@index([workshopId, imageHash])`. Task 3 bu alan üzerinden lookup ve write yapar.

- [ ] **Step 1: Şemaya kolon + index ekle**

`prisma/schema.prisma` içinde `model OcrLog` bloğunu düzenle. `updatedAt` satırından sonra kolonu, mevcut `@@index([workshopId])` satırının yanına yeni index'i ekle:

```prisma
model OcrLog {
  id             String   @id @default(cuid())
  workshopId     String
  workshop       Workshop @relation(fields: [workshopId], references: [id])
  /// OCR provider name: "mock", "deepseek", "openai", or "tesseract"
  ocrProvider    String
  /// Raw OCR text — sensitive, never exposed via public API
  rawText        String?
  /// JSON of extracted fields before user confirmation
  extractedJson  String?
  /// JSON of user-confirmed fields
  confirmedJson  String?
  confirmedAt    DateTime?
  userId         String?
  customerId     String?
  vehicleId      String?
  serviceOrderId String?
  /// SHA-256 (hex) of the raw uploaded image bytes — byte-hash dedup cache key.
  /// Null on legacy rows and on mock-provider scans (never cached).
  imageHash      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([workshopId])
  @@index([workshopId, imageHash])
```

> Not: Mevcut blokta `@@index([workshopId])` sonrası kapanış `}` ve olası başka satırlar var — sadece kolonu ve yeni `@@index` satırını ekle, bloğun geri kalanını olduğu gibi bırak.

- [ ] **Step 2: Yerel DB ayakta mı doğrula**

Run: `docker compose -f docker-compose.local.yml up -d`
Expected: Postgres + MinIO container'ları `Running` / `Started`. (Zaten ayaktaysa no-op.)

- [ ] **Step 3: Migration üret ve uygula**

Run: `bunx prisma migrate dev --name add_ocrlog_image_hash`
Expected: Yeni migration klasörü oluşur; `migration.sql` yalnızca `ALTER TABLE "OcrLog" ADD COLUMN "imageHash" TEXT;` ve `CREATE INDEX "OcrLog_workshopId_imageHash_idx" ON "OcrLog"("workshopId", "imageHash");` içerir. Prisma Client yeniden generate edilir, çıktı `migrate` başarısı bildirir.

- [ ] **Step 4: Üretilen migration'ı doğrula**

Run: `cat prisma/migrations/*add_ocrlog_image_hash/migration.sql`
Expected: Yalnız ADD COLUMN + CREATE INDEX (DROP/backfill yok).

- [ ] **Step 5: Typecheck (yeni alanın client'a yansıdığını doğrula)**

Run: `bunx tsc --noEmit`
Expected: Hata yok. (Prisma Client tipinde `OcrLog.imageHash?: string | null` görünür.)

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(ocr): OcrLog'a imageHash kolonu + index (byte-hash dedup)"
```

---

### Task 2: Saf hash yardımcı fonksiyonu `hashImageBuffer`

**Files:**
- Create: `src/lib/ocr/image-hash.ts`
- Test: `src/lib/ocr/image-hash.test.ts`

**Interfaces:**
- Produces: `hashImageBuffer(buffer: Buffer): string` — ham byte'ların SHA-256'sını lowercase hex olarak döndürür. Task 3 bunu `imageBuffer` üzerinde çağırır.

- [ ] **Step 1: Failing test yaz**

`src/lib/ocr/image-hash.test.ts`:

```ts
import { test, expect } from "bun:test"
import { hashImageBuffer } from "./image-hash"

test("hashImageBuffer: bilinen SHA-256 vektörü (lowercase hex)", () => {
  // echo -n "abc" | sha256sum
  const digest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  expect(hashImageBuffer(Buffer.from("abc"))).toBe(digest)
})

test("hashImageBuffer: aynı byte'lar → aynı hash (deterministik)", () => {
  const a = Buffer.from([0x01, 0x02, 0x03, 0xff])
  const b = Buffer.from([0x01, 0x02, 0x03, 0xff])
  expect(hashImageBuffer(a)).toBe(hashImageBuffer(b))
})

test("hashImageBuffer: farklı byte'lar → farklı hash", () => {
  expect(hashImageBuffer(Buffer.from("abc"))).not.toBe(hashImageBuffer(Buffer.from("abd")))
})

test("hashImageBuffer: 64 karakter hex döndürür", () => {
  expect(hashImageBuffer(Buffer.from("anything"))).toMatch(/^[0-9a-f]{64}$/)
})
```

- [ ] **Step 2: Test'i çalıştır, başarısız olduğunu doğrula**

Run: `bun test src/lib/ocr/image-hash.test.ts`
Expected: FAIL — "Cannot find module './image-hash'" veya `hashImageBuffer is not a function`.

- [ ] **Step 3: Minimal implementasyon**

`src/lib/ocr/image-hash.ts`:

```ts
import { createHash } from "crypto"

/**
 * Ham görsel byte'larının SHA-256'sı (lowercase hex).
 * Byte-hash dedup cache anahtarı: aynı upload → aynı hash.
 * Normalize ÖNCESİ ham buffer üzerinde çağrılır, normalize parametrelerinden bağımsızdır.
 */
export function hashImageBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}
```

- [ ] **Step 4: Test'i çalıştır, geçtiğini doğrula**

Run: `bun test src/lib/ocr/image-hash.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ocr/image-hash.ts src/lib/ocr/image-hash.test.ts
git commit -m "feat(ocr): hashImageBuffer saf yardımcısı (SHA-256 byte-hash)"
```

---

### Task 3: Route'a cache lookup + branch (`/api/smart-capture/ocr`)

**Files:**
- Modify: `src/app/api/smart-capture/ocr/route.ts`

**Interfaces:**
- Consumes: `hashImageBuffer(buffer: Buffer): string` (Task 2); `OcrLog.imageHash` (Task 1); mevcut `getOcrProvider()`, `normalizeRegistrationImage()`, `prisma`, `AuditLogAction`.
- Produces: Davranış değişikliği — yanıt şekli (`{ result, ocrLogId, provider, previewDataUrl }`) aynı kalır. Client değişmez.

Bu task bir route entegrasyonudur; repo'da route seviyesi test altyapısı yok, doğrulama **manuel QA** (Step 6-9) ile yapılır.

- [ ] **Step 1: Import ekle**

`src/app/api/smart-capture/ocr/route.ts` en üstteki import bloğuna ekle (mevcut `getOcrProvider` importunun altına):

```ts
import { hashImageBuffer } from "@/lib/ocr/image-hash"
```

- [ ] **Step 2: Hash + provider + cache lookup'u normalize ÖNCESİNE taşı**

Mevcut kodda şu blok var (imageBuffer iki dalda da hazırlandıktan sonra):

```ts
    // Vision OCR için rengi koru (gri tonlama yalnız Tesseract/plaka içindir).
    const normalizedImage = await normalizeRegistrationImage(imageBuffer, mimeType, { grayscale: false })
    const provider = await getOcrProvider()
    const result = await provider.extractRegistration(
      normalizedImage.buffer,
      normalizedImage.mimeType
    )
```

Bunu aşağıdakiyle **değiştir**. `provider` ve `imageHash` normalize'den önce hesaplanır; mock değilse cache'e bakılır; normalize her hâlde yapılır (preview için); cache hit'te provider çağrısı atlanır:

```ts
    const imageHash = hashImageBuffer(imageBuffer)
    const provider = await getOcrProvider()

    // Byte-hash dedup: aynı görsel daha önce (aynı provider ile) okunduysa
    // provider'ı hiç çağırmadan cache'ten dön. Mock asla cache'lenmez.
    const cachedLog =
      provider.name === "mock"
        ? null
        : await prisma.ocrLog.findFirst({
            where: {
              workshopId: user.workshopId,
              imageHash,
              ocrProvider: provider.name,
              extractedJson: { not: null },
            },
            orderBy: { createdAt: "desc" },
          })

    // Vision OCR için rengi koru (gri tonlama yalnız Tesseract/plaka içindir).
    // Preview UI için cache hit'te de normalize yaparız (ucuz kısım); yalnız OCR atlanır.
    const normalizedImage = await normalizeRegistrationImage(imageBuffer, mimeType, { grayscale: false })
```

- [ ] **Step 3: Cache-hit dalını ekle (yeni audit satırı + erken dönüş)**

Step 2'de eklenen `normalizedImage` satırından hemen sonra, mevcut `const result = ...` (artık silinmiş) yerine cache-hit dalını ekle. Mevcut miss yolu (provider.extract + OcrLog.create) bundan sonra gelir. Cache-hit bloğu:

```ts
    if (cachedLog) {
      // Extraction'ı önceki satırdan aynen al; bu tarama için YENİ bir OcrLog aç
      // (her taramanın kendi confirmedJson slotu olmalı, confirm akışı bozulmasın).
      const cachedFields = JSON.parse(cachedLog.extractedJson as string) as Record<
        string,
        { value: string; confidence?: number }
      >

      const cachedOcrLog = await prisma.ocrLog.create({
        data: {
          workshopId: user.workshopId,
          ocrProvider: provider.name,
          rawText: cachedLog.rawText,
          extractedJson: cachedLog.extractedJson,
          imageHash,
          userId: user.id,
        },
      })

      await AuditLogAction(
        user.workshopId,
        user.id,
        "OcrLog",
        cachedOcrLog.id,
        "ocr_capture",
        JSON.stringify({ provider: provider.name, cacheHit: true, sourceOcrLogId: cachedLog.id })
      )

      return NextResponse.json({
        result: { ...cachedFields, provider: provider.name },
        ocrLogId: cachedOcrLog.id,
        provider: provider.name,
        previewDataUrl: normalizedImage.previewDataUrl,
      })
    }

    const result = await provider.extractRegistration(
      normalizedImage.buffer,
      normalizedImage.mimeType
    )
```

- [ ] **Step 4: Miss yolunda `imageHash`'i yaz (mock hariç)**

Mevcut `prisma.ocrLog.create` çağrısındaki `data` objesine `imageHash` ekle. Spec'in "mock asla cache'lenmez / imageHash yazılmaz" kuralı için mock'ta `null` yaz (mock'ta lookup zaten yapılmıyor, ama satır da cache'lenebilir görünmesin):

```ts
    const ocrLog = await prisma.ocrLog.create({
      data: {
        workshopId: user.workshopId,
        ocrProvider: provider.name,
        rawText: result.rawText,
        extractedJson,
        imageHash: provider.name === "mock" ? null : imageHash,
        userId: user.id,
      },
    })
```

- [ ] **Step 5: Typecheck + lint**

Run: `bunx tsc --noEmit && bunx next lint --file src/app/api/smart-capture/ocr/route.ts`
Expected: Hata yok. (`extractedJson: { not: null }` filtresi ve `cachedLog.extractedJson as string` cast'i strict'te geçer; `cachedFields` tipi client'ın okuduğu `Record<string, {value, confidence?}>` ile uyumlu.)

- [ ] **Step 6: Manuel QA — cache miss (ilk tarama)**

Dev server'ı restart et (şema değişti): `bun dev`. Bir workshop'ta oturum aç, Yeni araç modalını aç, bir ruhsat fotoğrafı okut.
Expected: Alanlar dolar. Sunucu logunda provider çalışır (Paddle sidecar isteği / Anthropic çağrısı). DB'de `OcrLog` satırında `imageHash` dolu.

- [ ] **Step 7: Manuel QA — cache hit (aynı dosya tekrar)**

Aynı dosyayı tekrar okut.
Expected: Alanlar aynı gelir; yanıt anında döner; sunucu logunda **provider çağrısı yok**. DB'de yeni bir `OcrLog` satırı (`imageHash` aynı, aynı `extractedJson`); AuditLog metadata `cacheHit: true` + `sourceOcrLogId`.

- [ ] **Step 8: Manuel QA — farklı ruhsat + confirm akışı**

Farklı bir ruhsat okut (normal OCR çalışmalı, miss). Ardından `smart-capture-registration` akışında bir cache-hit sonrası "onayla" adımını yürüt.
Expected: Farklı ruhsat OCR'dan geçer. Confirm, cache-hit'in döndürdüğü yeni `ocrLogId` üzerinden çalışır; `confirmedJson`/`confirmedAt` doğru satıra yazılır (eski satır ezilmez).

- [ ] **Step 9: Manuel QA — mock cache yok**

`.env` (veya shell) `OCR_PROVIDER=mock` ile dev server restart, aynı fotoğrafı iki kez okut.
Expected: Her seferinde mock sonucu döner; DB satırlarında `imageHash` **null**; ikinci okutmada da cache lookup yapılmaz (mock dalı). QA sonrası `OCR_PROVIDER`'ı eski değerine geri al.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/smart-capture/ocr/route.ts
git commit -m "feat(ocr): aynı ruhsat byte-hash cache — mükerrer OCR çağrısını atla

Aynı görsel byte'ları (workshop+hash+provider) daha önce okunduysa provider
hiç çağrılmadan extraction cache'ten dönülür. Mock hariç. Cache-hit'te her
tarama kendi OcrLog satırını alır (confirm akışı bozulmaz)."
```

---

## Self-Review

**1. Spec coverage:**
- Byte-hash, sadece aynı kare → Task 2 (hash) + Task 3 (lookup). ✓
- Sunucu tarafı, mevcut endpoint, client değişmez → Task 3. ✓
- Normalize öncesi ham byte hash → Task 3 Step 2. ✓
- Provider anahtarın parçası (`ocrProvider: provider.name`) → Task 3 Step 2 where. ✓
- Mock cache dışı → Task 3 Step 2 lookup mock'ta atlanır (`provider.name === "mock" ? null : ...`) + Step 4 mock'ta `imageHash` `null` yazılır. Spec'in "mock asla cache'lenmez / imageHash yazılmaz" kuralı tam karşılanır. ✓
- Cache-hit'te yeni OcrLog satırı → Task 3 Step 3. ✓
- Şema: imageHash + index, additive migration → Task 1. ✓
- Manuel QA (5 senaryo) → Task 3 Step 6-9. ✓

**2. Placeholder scan:** Tüm kod blokları tam, TODO/TBD yok. ✓

**3. Type consistency:** `hashImageBuffer(buffer: Buffer): string` her yerde aynı. `imageHash` alanı, `ocrProvider`, `extractedJson` Prisma model adlarıyla eşleşiyor. Response şekli mevcut miss yolu ile birebir. ✓
