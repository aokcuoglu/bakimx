# Parça Kutusu OCR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Dışarıdan Parça Alımı" modalındaki parça kutusu fotoğrafından parça adı, marka ve tüm parça numaralarını OCR ile çıkarıp forma öneri olarak sunmak.

**Architecture:** Mevcut ruhsat OCR altyapısı (`src/lib/ocr/` provider soyutlaması + `smart-capture/ocr` route deseni + `OcrLog` dedup) yeniden kullanılır. `OcrProvider` arayüzüne opsiyonel `extractPartBox` eklenir; yalnız Anthropic (prod) ve Mock (dev) uygular. Yeni `/api/parts/ocr` route'u; istemci fotoğraf seçilince otomatik çağırır ve dönen öneriyi modalda gösterir. OCR yalnız öneri üretir — hiçbir alanı ezmez, mevcut fotoğraf yükleme akışını değiştirmez.

**Tech Stack:** Next.js (App Router), TypeScript (strict), `@anthropic-ai/sdk` (tool-use), zod, Prisma (`OcrLog`), Base UI/shadcn bileşenleri, `bun test`.

## Global Constraints

- **TypeScript strict**; `any` kullanma.
- **Tenant izolasyonu**: route `getCurrentUserWithWorkshop()` ile `workshopId` türetir; istemci parametresine güvenilmez. `OcrLog.workshopId` buradan gelir.
- **Şema/migration YOK, DB değişikliği YOK.** `OcrLog` mevcut haliyle kullanılır.
- **Mobile-first**; öneri kartı dar ekranda taşmamalı.
- **UI**: yalnız Base UI/shadcn (`Button`, `Input`, `Badge`) + `BrandSpinner` (skeleton değil).
- **UI metinleri Türkçe.** Chat yanıtları Türkçe.
- **Provider abstraction'a dokunma**: `extractPartBox` opsiyonel; paddle/openai/hybrid/tesseract'a eklenmez.
- Test runner: `bun test`, import `from "bun:test"`.

---

### Task 1: Part-box tipleri + saf sonuç yardımcıları

**Files:**
- Modify: `src/lib/ocr/types.ts`
- Create: `src/lib/ocr/part-box-result.ts`
- Test: `src/lib/ocr/part-box-result.test.ts`

**Interfaces:**
- Produces:
  - `interface PartNumberSuggestion { value: string; label: string; confidence?: number }`
  - `interface PartBoxOcrResult { partName: OcrFieldConfidence; brand: OcrFieldConfidence; partNumbers: PartNumberSuggestion[]; rawText: string; provider: OcrProviderName }`
  - `OcrProvider.extractPartBox?(imageBuffer: Buffer, mimeType: string): Promise<PartBoxOcrResult>` (opsiyonel)
  - `PartBoxFieldsSchema` (zod), `type PartBoxFields`
  - `normalizePartNumbers(items): PartNumberSuggestion[]` — trim + uppercase value, boşları at, value bazında tekilleştir, confidence taşı
  - `toPartBoxResult(fields: PartBoxFields, provider: OcrProviderName): PartBoxOcrResult`
  - `partNameWithBrand(name: string, brand: string): string`

- [ ] **Step 1: `types.ts`'e part-box tipleri ekle**

`src/lib/ocr/types.ts` sonuna ekle (dosyanın mevcut içeriğini KORU):

```ts
export interface PartNumberSuggestion {
  value: string
  label: string
  confidence?: number
}

export interface PartBoxOcrResult {
  partName: OcrFieldConfidence
  brand: OcrFieldConfidence
  partNumbers: PartNumberSuggestion[]
  rawText: string
  provider: OcrProviderName
}
```

Ve mevcut `OcrProvider` arayüzüne opsiyonel metodu ekle:

```ts
export interface OcrProvider {
  readonly name: OcrProviderName
  extractRegistration(imageBuffer: Buffer, mimeType: string): Promise<RegistrationOcrResult>
  extractPartBox?(imageBuffer: Buffer, mimeType: string): Promise<PartBoxOcrResult>
}
```

- [ ] **Step 2: Başarısız testi yaz**

`src/lib/ocr/part-box-result.test.ts`:

```ts
import { test, expect } from "bun:test"
import { normalizePartNumbers, partNameWithBrand, toPartBoxResult, PartBoxFieldsSchema } from "./part-box-result"

test("normalizePartNumbers: trim + uppercase + tekilleştir", () => {
  const out = normalizePartNumbers([
    { value: " sto-539 ", label: "SETA CODE" },
    { value: "sto-539", label: "SETA CODE" }, // dup (case/space farkı)
    { value: "04152-yzza6", label: "OEM NO", confidence: 0.8 },
    { value: "  ", label: "boş" }, // atılır
  ])
  expect(out).toEqual([
    { value: "STO-539", label: "SETA CODE", confidence: undefined },
    { value: "04152-YZZA6", label: "OEM NO", confidence: 0.8 },
  ])
})

test("partNameWithBrand: marka adı sonuna eklenir", () => {
  expect(partNameWithBrand("Yağ filtresi", "SETA")).toBe("Yağ filtresi — SETA")
})

test("partNameWithBrand: marka boşsa ad aynen döner", () => {
  expect(partNameWithBrand("Yağ filtresi", "  ")).toBe("Yağ filtresi")
})

test("partNameWithBrand: marka zaten ad içindeyse tekrarlamaz", () => {
  expect(partNameWithBrand("SETA Yağ filtresi", "seta")).toBe("SETA Yağ filtresi")
})

test("toPartBoxResult: uncertainFields düşük güven verir, numaraları normalize eder", () => {
  const fields = PartBoxFieldsSchema.parse({
    partName: " Yağ filtresi ",
    brand: "SETA",
    partNumbers: [{ value: "hu 6006 z", label: "MANN NO", confidence: 0.6 }],
    uncertainFields: ["brand"],
  })
  const r = toPartBoxResult(fields, "mock")
  expect(r.partName).toEqual({ value: "Yağ filtresi", confidence: 0.9 })
  expect(r.brand).toEqual({ value: "SETA", confidence: 0.5 })
  expect(r.partNumbers).toEqual([{ value: "HU 6006 Z", label: "MANN NO", confidence: 0.6 }])
  expect(r.provider).toBe("mock")
})
```

- [ ] **Step 3: Testi çalıştır, başarısız olduğunu doğrula**

Run: `bun test src/lib/ocr/part-box-result.test.ts`
Expected: FAIL — `Cannot find module './part-box-result'`

- [ ] **Step 4: `part-box-result.ts`'i yaz**

`src/lib/ocr/part-box-result.ts`:

```ts
import { z } from "zod"
import type { PartBoxOcrResult, PartNumberSuggestion, OcrProviderName } from "./types"

export const PartNumberSuggestionSchema = z.object({
  value: z.string().default(""),
  label: z.string().default(""),
  confidence: z.number().min(0).max(1).optional(),
})

export const PartBoxFieldsSchema = z.object({
  partName: z.string().default(""),
  brand: z.string().default(""),
  partNumbers: z.array(PartNumberSuggestionSchema).default([]),
  // Modelin emin olmadığı alan adları ("partName" / "brand") — düşük güven uyarısı için.
  uncertainFields: z.array(z.string()).default([]),
})

export type PartBoxFields = z.infer<typeof PartBoxFieldsSchema>

// Parça numaralarını normalize et: trim + uppercase value, boşları at, value bazında tekilleştir.
export function normalizePartNumbers(
  items: { value: string; label: string; confidence?: number }[]
): PartNumberSuggestion[] {
  const seen = new Set<string>()
  const out: PartNumberSuggestion[] = []
  for (const it of items) {
    const value = it.value.trim().toUpperCase()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push({ value, label: it.label.trim(), confidence: it.confidence })
  }
  return out
}

// "Yağ filtresi" + "SETA" → "Yağ filtresi — SETA". Marka boşsa/ad içinde geçiyorsa adı aynen bırakır.
export function partNameWithBrand(name: string, brand: string): string {
  const n = name.trim()
  const b = brand.trim()
  if (!b) return n
  if (!n) return b
  if (n.toLocaleLowerCase("tr").includes(b.toLocaleLowerCase("tr"))) return n
  return `${n} — ${b}`
}

export function toPartBoxResult(fields: PartBoxFields, provider: OcrProviderName): PartBoxOcrResult {
  const uncertain = new Set(fields.uncertainFields)
  return {
    partName: { value: fields.partName.trim(), confidence: uncertain.has("partName") ? 0.5 : 0.9 },
    brand: { value: fields.brand.trim(), confidence: uncertain.has("brand") ? 0.5 : 0.9 },
    partNumbers: normalizePartNumbers(fields.partNumbers),
    rawText: "",
    provider,
  }
}
```

- [ ] **Step 5: Testi çalıştır, geçtiğini doğrula**

Run: `bun test src/lib/ocr/part-box-result.test.ts`
Expected: PASS (5 test)

- [ ] **Step 6: Commit**

```bash
git add src/lib/ocr/types.ts src/lib/ocr/part-box-result.ts src/lib/ocr/part-box-result.test.ts
git commit -m "feat(ocr): parça kutusu tipleri + saf sonuç yardımcıları"
```

---

### Task 2: Mock provider `extractPartBox`

**Files:**
- Modify: `src/lib/ocr/mock-ocr-provider.ts`
- Test: `src/lib/ocr/mock-part-box.test.ts`

**Interfaces:**
- Consumes: `PartBoxOcrResult` (Task 1), `MockOcrProvider` (mevcut)
- Produces: `MockOcrProvider.extractPartBox(imageBuffer, mimeType): Promise<PartBoxOcrResult>` — deterministik SETA yağ filtresi verisi

- [ ] **Step 1: Başarısız testi yaz**

`src/lib/ocr/mock-part-box.test.ts`:

```ts
import { test, expect } from "bun:test"
import { getMockOcrProvider } from "./mock-ocr-provider"

test("MockOcrProvider.extractPartBox: deterministik SETA verisi döner", async () => {
  const provider = getMockOcrProvider()
  const result = await provider.extractPartBox(Buffer.from("x"), "image/jpeg")
  expect(result.provider).toBe("mock")
  expect(result.partName.value).toBe("Yağ filtresi")
  expect(result.brand.value).toBe("SETA")
  expect(result.partNumbers.map((p) => p.value)).toEqual(["STO-539", "04152-YZZA6", "HU 6006 Z"])
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `bun test src/lib/ocr/mock-part-box.test.ts`
Expected: FAIL — `provider.extractPartBox is not a function`

- [ ] **Step 3: Mock provider'a `extractPartBox` ekle**

`src/lib/ocr/mock-ocr-provider.ts` — import satırına `PartBoxOcrResult` ekle:

```ts
import type { OcrProvider, RegistrationOcrResult, OcrFieldConfidence, PartBoxOcrResult } from "./types"
```

`MOCK_REGISTRATION_DATA` sabitinden sonra ekle:

```ts
const MOCK_PARTBOX_DATA: Omit<PartBoxOcrResult, "provider"> = {
  partName: field("Yağ filtresi", 0.9),
  brand: field("SETA", 0.88),
  partNumbers: [
    { value: "STO-539", label: "SETA CODE", confidence: 0.9 },
    { value: "04152-YZZA6", label: "OEM NO", confidence: 0.86 },
    { value: "HU 6006 Z", label: "MANN NO", confidence: 0.6 },
  ],
  rawText: "",
}
```

`MockOcrProvider` sınıfının içine, `extractRegistration`'dan sonra ekle:

```ts
  async extractPartBox(_imageBuffer: Buffer, _mimeType: string): Promise<PartBoxOcrResult> {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    return { ...MOCK_PARTBOX_DATA, provider: "mock" }
  }
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

Run: `bun test src/lib/ocr/mock-part-box.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ocr/mock-ocr-provider.ts src/lib/ocr/mock-part-box.test.ts
git commit -m "feat(ocr): mock provider parça kutusu verisi"
```

---

### Task 3: Anthropic provider `extractPartBox`

**Files:**
- Modify: `src/lib/ocr/anthropic-ocr-provider.ts`

**Interfaces:**
- Consumes: `PartBoxFieldsSchema`, `toPartBoxResult` (Task 1)
- Produces: `AnthropicOcrProvider.extractPartBox(imageBuffer, mimeType): Promise<PartBoxOcrResult>` — Claude Vision tool-use

> Not: Bu metot canlı Anthropic API'ye bağlanır; birim testi yerine typecheck + manuel QA (Task 6) ile doğrulanır. Codebase route/provider'larında ağ çağıran metotlar için birim testi yok (yalnız saf yardımcılar test edilir).

- [ ] **Step 1: Import satırlarını genişlet**

`src/lib/ocr/anthropic-ocr-provider.ts` üst importları:

```ts
import type { OcrProvider, RegistrationOcrResult, OcrFieldConfidence, PartBoxOcrResult } from "./types"
import { RegistrationFieldsSchema, toRegistrationResult } from "./registration-result"
import { PartBoxFieldsSchema, toPartBoxResult } from "./part-box-result"
import { z } from "zod"
```

- [ ] **Step 2: Part-box tool sabitlerini ekle**

`SUPPORTED_MEDIA_TYPES` sabitinden hemen önce (dosya üst seviyesinde) ekle:

```ts
const PARTBOX_TOOL_NAME = "kaydet_parca_kutusu_alanlari"

const PARTBOX_TOOL_INPUT_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    partName: {
      type: "string",
      description:
        "Parçanın Türkçe adı/tipi, ör. 'Yağ filtresi', 'Ön fren balatası'. Kutuda İngilizce yazıyorsa " +
        "(OIL FILTER) Türkçe'ye çevir. Emin değilsen kutudaki orijinal ifadeyi bırak.",
    },
    brand: { type: "string", description: "Üretici/marka adı, ör. SETA, BOSCH, MANN. Yoksa boş bırak." },
    partNumbers: {
      type: "array",
      description:
        "Kutu üzerinde okunan TÜM parça/kod numaraları. Her numara ayrı bir öğe. " +
        "OEM NO, marka kodu (ör. SETA CODE), çapraz referanslar (MANN NO, BOSCH NO) ayrı ayrı listelenir.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          value: { type: "string", description: "Numaranın kendisi, ör. 04152-YZZA6" },
          label: { type: "string", description: "Numaranın kaynağı/etiketi, ör. OEM NO, SETA CODE, MANN NO" },
          confidence: { type: "number", description: "0-1 arası okuma güveni (opsiyonel)" },
        },
        required: ["value", "label"],
      },
    },
    uncertainFields: {
      type: "array",
      description: "Emin olmadığın alan adları ('partName' / 'brand'). Netse boş bırak.",
      items: { type: "string", enum: ["partName", "brand"] },
    },
  },
  required: ["partName", "brand", "partNumbers", "uncertainFields"],
}

const PARTBOX_SYSTEM_PROMPT =
  "Sen bir otomotiv yedek parça kutusu okuma uzmanısın. Görseldeki parçanın adını/tipini, marka " +
  "adını ve kutu üzerindeki TÜM kod/numara alanlarını (OEM NO, marka kodu, MANN/BOSCH gibi çapraz " +
  "referanslar) çıkar. Bilgi UYDURMA; okunamayan alanı boş bırak. Her numarayı, kaynağını belirten " +
  "bir etiketle (label) birlikte ayrı öğe olarak ver. Parça adını Türkçe yaz; emin değilsen kutudaki " +
  `orijinal ifadeyi koru. Sonucu yalnızca ${PARTBOX_TOOL_NAME} aracını çağırarak döndür.`
```

- [ ] **Step 3: `extractPartBox` metodunu ekle**

`AnthropicOcrProvider` sınıfının içine, `extractRegistration`'dan sonra ekle:

```ts
  async extractPartBox(imageBuffer: Buffer, mimeType: string): Promise<PartBoxOcrResult> {
    const mediaType = SUPPORTED_MEDIA_TYPES.has(mimeType) ? mimeType : "image/jpeg"

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: PARTBOX_SYSTEM_PROMPT,
      tools: [
        {
          name: PARTBOX_TOOL_NAME,
          description: "Parça kutusundan çıkarılan alanları yapılandırılmış olarak kaydet.",
          input_schema: PARTBOX_TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: PARTBOX_TOOL_NAME },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageBuffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: "Bu parça kutusundaki parça adını, markayı ve tüm numaraları çıkar.",
            },
          ],
        },
      ],
    })

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === PARTBOX_TOOL_NAME
    )
    if (!toolUse) {
      throw new Error("Claude parça kutusu alanlarını oluşturamadı. Lütfen daha net bir fotoğrafla tekrar deneyin.")
    }

    const fields = PartBoxFieldsSchema.parse(toolUse.input)
    return toPartBoxResult(fields, "anthropic")
  }
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck` (veya `npx tsc --noEmit`)
Expected: Hata yok.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ocr/anthropic-ocr-provider.ts
git commit -m "feat(ocr): Anthropic provider parça kutusu çıkarımı"
```

---

### Task 4: `/api/parts/ocr` route'u

**Files:**
- Create: `src/app/api/parts/ocr/route.ts`

**Interfaces:**
- Consumes: `getOcrProvider()`, `provider.extractPartBox` (Task 2/3), `hashImageBuffer`, `normalizeRegistrationImage`, `PartBoxOcrResult`
- Produces: `POST /api/parts/ocr` — multipart `image` (veya JSON `{ imageDataUrl, mimeType }`) alır, `{ result: { partName, brand, partNumbers, provider }, ocrLogId, provider }` döner. `rawText` istemciye dönmez.

> Not: Route birim testi yok (codebase route'larında test yok — bkz. `smart-capture/ocr`). Doğrulama: typecheck + manuel QA (Task 6). Route, `smart-capture/ocr/route.ts` desenini bilerek yakından takip eder (aynı auth/limit/dedup davranışı).

- [ ] **Step 1: Route dosyasını oluştur**

`src/app/api/parts/ocr/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { assertWritableOr403 } from "@/lib/plan-guard"
import { getOcrProvider } from "@/lib/ocr/provider"
import { hashImageBuffer } from "@/lib/ocr/image-hash"
import { normalizeRegistrationImage } from "@/lib/ocr/normalize-registration-image"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { MAX_IMAGE_SIZE_BYTES, MAX_BODY_SIZE_BYTES, SUPPORTED_IMAGE_MIME_TYPES } from "@/lib/ocr/types"

// Part-box dedup'ı ruhsat dedup'ından ayrı tutmak için imageHash'e namespace öneki koyulur:
// aynı görsel iki akışa da yüklenirse cache'ler karışmaz (part-box JSON'u ruhsat JSON'una benzemez).
const PARTBOX_HASH_PREFIX = "partbox:"

export async function POST(request: Request) {
  try {
    const { user, workshop } = await getCurrentUserWithWorkshop()
    const locked = assertWritableOr403(workshop)
    if (locked) return locked

    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > MAX_BODY_SIZE_BYTES) {
      return NextResponse.json(
        { error: `İstek gövdesi çok büyük. Görsel ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB'dan küçük olmalıdır.` },
        { status: 413 }
      )
    }

    const contentType = request.headers.get("content-type") || ""
    let imageBuffer: Buffer
    let mimeType: string

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("image")
      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { error: "Görsel dosyası zorunludur. 'image' alanıyla multipart/form-data gönderin." },
          { status: 400 }
        )
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `Görsel ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB'dan küçük olmalıdır.` },
          { status: 413 }
        )
      }
      mimeType = file.type || "image/jpeg"
      if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
        if (/\.hei[cf]$/i.test(file.name)) {
          mimeType = "image/heic"
        } else {
          return NextResponse.json(
            { error: "Desteklenmeyen görsel biçimi. JPEG, PNG, WebP veya HEIC yükleyin." },
            { status: 400 }
          )
        }
      }
      imageBuffer = Buffer.from(await file.arrayBuffer())
    } else {
      const body = await request.json()
      const { imageDataUrl, mimeType: bodyMimeType } = body
      if (!imageDataUrl || !bodyMimeType) {
        return NextResponse.json({ error: "Görsel verisi ve MIME tipi zorunludur" }, { status: 400 })
      }
      mimeType = bodyMimeType
      if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
        return NextResponse.json(
          { error: "Desteklenmeyen görsel biçimi. JPEG, PNG, WebP veya HEIC yükleyin." },
          { status: 400 }
        )
      }
      const base64Match = imageDataUrl.match(/^data:[^;]+;base64,(.+)$/)
      if (!base64Match) {
        return NextResponse.json({ error: "Geçersiz görsel formatı. Geçerli bir data URL gönderin." }, { status: 400 })
      }
      imageBuffer = Buffer.from(base64Match[1], "base64")
      if (imageBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `Görsel ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB'dan küçük olmalıdır.` },
          { status: 413 }
        )
      }
    }

    const provider = await getOcrProvider()
    if (typeof provider.extractPartBox !== "function") {
      return NextResponse.json(
        { error: "Aktif OCR sağlayıcısı parça kutusu okumayı desteklemiyor." },
        { status: 400 }
      )
    }

    const imageHash = PARTBOX_HASH_PREFIX + hashImageBuffer(imageBuffer)

    // Byte-hash dedup: aynı kutu görseli daha önce (aynı provider ile) okunduysa provider'ı çağırma.
    // Mock asla cache'lenmez.
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

    if (cachedLog) {
      const cachedFields = JSON.parse(cachedLog.extractedJson as string) as Record<string, unknown>
      const cachedOcrLog = await prisma.ocrLog.create({
        data: {
          workshopId: user.workshopId,
          ocrProvider: provider.name,
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
        JSON.stringify({ provider: provider.name, kind: "partbox", cacheHit: true, sourceOcrLogId: cachedLog.id })
      )
      return NextResponse.json({
        result: { ...cachedFields, provider: provider.name },
        ocrLogId: cachedOcrLog.id,
        provider: provider.name,
      })
    }

    // Kutu görselinde renk bilgi taşır (mavi zemin/logo) → grayscale KAPALI (vision modu).
    const normalizedImage = await normalizeRegistrationImage(imageBuffer, mimeType, { grayscale: false })

    const result = await provider.extractPartBox(normalizedImage.buffer, normalizedImage.mimeType)

    const extractedJson = JSON.stringify({
      partName: result.partName,
      brand: result.brand,
      partNumbers: result.partNumbers,
    })

    const ocrLog = await prisma.ocrLog.create({
      data: {
        workshopId: user.workshopId,
        ocrProvider: provider.name,
        extractedJson,
        imageHash: provider.name === "mock" ? null : imageHash,
        userId: user.id,
      },
    })

    await AuditLogAction(
      user.workshopId,
      user.id,
      "OcrLog",
      ocrLog.id,
      "ocr_capture",
      JSON.stringify({ provider: provider.name, kind: "partbox" })
    )

    return NextResponse.json({
      result: {
        partName: result.partName,
        brand: result.brand,
        partNumbers: result.partNumbers,
        provider: result.provider,
      },
      ocrLogId: ocrLog.id,
      provider: provider.name,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu"
    console.error("[PART OCR ERROR]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: Hata yok.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/parts/ocr/route.ts
git commit -m "feat(ocr): /api/parts/ocr route + dedup + OcrLog"
```

---

### Task 5: `AddPurchaseButton` öneri UI'ı

**Files:**
- Modify: `src/components/app/technician-order-detail.tsx` (`AddPurchaseButton`, ~882-1128)

**Interfaces:**
- Consumes: `POST /api/parts/ocr` (Task 4), `partNameWithBrand` (Task 1), `PartBoxOcrResult` tipi, `BrandSpinner`
- Produces: (UI davranışı) fotoğraf seçilince otomatik OCR, öneri çipleri.

> Not: UI birim testi yok (codebase deseni); doğrulama typecheck + lint + dev mock manuel QA (Task 6).

- [ ] **Step 1: Import'ları ekle**

`technician-order-detail.tsx` importlarına ekle (mevcut importları koru):

```ts
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { partNameWithBrand } from "@/lib/ocr/part-box-result"
import type { PartBoxOcrResult, PartNumberSuggestion } from "@/lib/ocr/types"
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/ocr/types"
```

> Not: Öneri çipleri, bu bileşendeki mevcut desenle (ör. "Parça Aldım" tetikleyicisi ve "Fotoğraf çek / seç" dropzone'u zaten ham `<button className="...">` kullanıyor) uyumlu olsun diye ham `<button>` olarak yazılır — `Badge` tıklanabilir değil, ekstra import gerekmez.

- [ ] **Step 2: OCR state'ini ekle**

`AddPurchaseButton` içinde, `fileInputRef` satırından sonra:

```ts
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<Pick<PartBoxOcrResult, "partName" | "brand" | "partNumbers"> | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
```

- [ ] **Step 3: `resetForm`'a OCR temizliğini ekle**

`resetForm` içindeki `setError(null)` satırından sonra:

```ts
    setOcrLoading(false)
    setOcrResult(null)
    setOcrError(null)
```

- [ ] **Step 4: `onPickFile`'da otomatik OCR tetikle**

Mevcut `onPickFile`'ı şununla değiştir:

```ts
  function onPickFile(f: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
    setOcrResult(null)
    setOcrError(null)
    if (f) void runPartBoxOcr(f)
  }

  async function runPartBoxOcr(f: File) {
    setOcrLoading(true)
    setOcrError(null)
    try {
      const fd = new FormData()
      fd.set("image", f)
      const res = await fetch("/api/parts/ocr", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setOcrError(data?.error || "Kutu okunamadı, alanları elle girebilirsiniz.")
        return
      }
      setOcrResult({
        partName: data.result.partName,
        brand: data.result.brand,
        partNumbers: data.result.partNumbers ?? [],
      })
    } catch {
      setOcrError("Kutu okunamadı, alanları elle girebilirsiniz.")
    } finally {
      setOcrLoading(false)
    }
  }
```

- [ ] **Step 5: Öneri UI'ını render et**

"Parça kutusu fotoğrafı" `<div className="space-y-1">` bloğunun KAPANIŞ `</div>`'inden hemen sonra (yani foto bloğunun altına), hâlâ dış `<div className="space-y-3 py-1">` içinde kalacak şekilde ekle:

```tsx
          {ocrLoading && (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 py-6">
              <BrandSpinner size={36} label="Kutu okunuyor…" />
            </div>
          )}

          {ocrError && !ocrLoading && (
            <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
              {ocrError}
            </p>
          )}

          {ocrResult && !ocrLoading && (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
              <p className="text-xs font-medium text-primary">Kutudan okunan öneriler</p>

              {ocrResult.partName.value && (
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Parça adı</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setName(ocrResult.partName.value)}
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:border-primary hover:text-primary touch-manipulation"
                    >
                      {ocrResult.partName.value}
                    </button>
                    {ocrResult.brand.value && (
                      <button
                        type="button"
                        onClick={() => setName(partNameWithBrand(ocrResult.partName.value, ocrResult.brand.value))}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:border-primary hover:text-primary touch-manipulation"
                      >
                        {partNameWithBrand(ocrResult.partName.value, ocrResult.brand.value)}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {ocrResult.partNumbers.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Parça no (birini seçin)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ocrResult.partNumbers.map((pn: PartNumberSuggestion) => {
                      const low = pn.confidence != null && pn.confidence < LOW_CONFIDENCE_THRESHOLD
                      return (
                        <button
                          key={pn.value}
                          type="button"
                          onClick={() => setSku(pn.value)}
                          className={
                            "rounded-full border px-2.5 py-1 text-xs touch-manipulation hover:border-primary hover:text-primary " +
                            (low ? "border-amber-300 bg-amber-50 text-amber-700" : "border-border bg-background")
                          }
                          title={low ? "Düşük okuma güveni — kontrol edin" : undefined}
                        >
                          <span className="text-muted-foreground">{pn.label}</span>
                          <span className="mx-1 text-border">·</span>
                          {pn.value}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
```

- [ ] **Step 6: Lint + Typecheck**

Run: `bun run lint && bun run typecheck`
Expected: Hata yok. (Kullanılmayan `Badge` import'u eklendiyse ya kullan ya kaldır.)

- [ ] **Step 7: Commit**

```bash
git add src/components/app/technician-order-detail.tsx
git commit -m "feat(ocr): Parça Aldım modalına kutu OCR öneri UI"
```

---

### Task 6: Doğrulama + manuel QA

**Files:** (yok — yalnız doğrulama)

- [ ] **Step 1: Tüm testler**

Run: `bun test src/lib/ocr/`
Expected: Task 1 + Task 2 testleri PASS.

- [ ] **Step 2: Lint + typecheck + build**

Run: `bun run lint && bun run typecheck && bun run build`
Expected: Hata yok.

- [ ] **Step 3: Dev'de manuel QA (mock provider)**

`.env.local` içinde `OCR_PROVIDER` boş/`mock` iken `bun run dev` (DB tüneli açık — bkz. `bun run db:tunnel`):
1. Bir iş emri aç → Teknisyen Paneli → "Parça Aldım".
2. "Parça kutusu fotoğrafı" → herhangi bir resim seç.
3. `BrandSpinner` + "Kutu okunuyor…" görünmeli; ~1.2sn sonra öneri kartı SETA verisiyle açılmalı.
4. "Yağ filtresi" çipine tıkla → "Parça adı" dolmalı. "Yağ filtresi — SETA" çipine tıkla → marka birleşmiş yazmalı.
5. `OEM NO · 04152-YZZA6` çipine tıkla → "Parça no / OEM" dolmalı. `MANN NO · HU 6006 Z` çipi soluk (amber, düşük güven) görünmeli.
6. Elle "Parça adı" yaz → çip önerisi bunu ezmemeli (yalnız tıklayınca değişir).
7. Mobil genişlikte (DevTools 390px) çip kartı taşmamalı (wrap etmeli).
8. "Kalem Olarak Ekle" → kalem eklenmeli, sonra `PurchaseDetailDialog`'da fotoğraf eskisi gibi görünmeli (yükleme akışı bozulmadı).

- [ ] **Step 4: (Opsiyonel) gerçek Anthropic doğrulaması**

`.env.local`'de `OCR_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` + `OCR_MODEL=claude-sonnet-5` ile örnek SETA kutusu fotoğrafını dene; `STO-539 / 04152-YZZA6 / HU 6006 Z` numaralarının doğru etiketlerle geldiğini doğrula.

- [ ] **Step 5: Branch'i tamamla**

`superpowers:finishing-a-development-branch` skill'i ile merge/PR seçeneklerini sun.

---

## Self-Review Notu

- **Spec kapsamı**: provider katmanı (Task 1-3), route + dedup/OcrLog (Task 4), öneri UI (Task 5), güvenlik/tenant izolasyonu (Task 4 auth), test (Task 1-2 + Task 6). Marka için şema kolonu yok — `partNameWithBrand` ile birleştirme (Task 1/5). Tümü karşılandı.
- **Şema değişikliği yok** — `OcrLog` mevcut kolonlarıyla (`imageHash` öneki dahil) kullanılır.
- **Tip tutarlılığı**: `PartBoxOcrResult` / `PartNumberSuggestion` Task 1'de tanımlanır, Task 2-5'te aynı isimle tüketilir. `extractPartBox` imzası Task 1 (interface) = Task 2/3 (impl) = Task 4 (çağrı).
