import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { assertWritableOr403 } from "@/lib/plan-guard"
import { getOcrProvider } from "@/lib/ocr/provider"
import { hashImageBuffer } from "@/lib/ocr/image-hash"
import { normalizeRegistrationImage } from "@/lib/ocr/normalize-registration-image"
import { parseOcrImageRequest } from "@/lib/ocr/parse-image-request"
import { parseVinFromText } from "@/lib/ocr/vin"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { hasWorkshopFeature } from "@/lib/plan"

// Vision çağrısı birkaç saniye sürebilir; Next'in varsayılan süresini gevşet
// (proxy timeout ~60s'in altında kalır).
export const maxDuration = 60

// VIN dedup'ını ruhsat/parça dedup'ından ayırmak için imageHash namespace öneki:
// aynı görsel iki akışa da yüklenirse cache'ler karışmaz.
const VIN_HASH_PREFIX = "vin:"

const UNREADABLE_MESSAGE =
  "Şase numarası okunamadı. 17 hanenin tamamı çerçeveye girecek şekilde, yansımasız ve yakın bir kare çekin."

/**
 * Cam altındaki şase plakası fotoğrafından 17 haneli VIN'i okur (#188).
 * Aktif OCR sağlayıcısı üzerinden çalışır (prod/dev: Claude Vision); okunan ham
 * metin her durumda `parseVinFromText` ile doğrulanır, yani sağlayıcı ne
 * döndürürse döndürsün istemciye yalnız geçerli bir VIN gider.
 */
export async function POST(request: Request) {
  try {
    const { user, workshop } = await getCurrentUserWithWorkshop()
    const locked = assertWritableOr403(workshop)
    if (locked) return locked
    if (!hasWorkshopFeature(workshop, "vinLookup")) {
      return NextResponse.json(
        { error: "VIN okuma bu çalışma alanında kapalı.", code: "feature_locked" },
        { status: 403 },
      )
    }

    const parsed = await parseOcrImageRequest(request)
    if (parsed instanceof NextResponse) return parsed
    const { imageBuffer, mimeType } = parsed

    const provider = await getOcrProvider()
    if (typeof provider.extractVin !== "function") {
      return NextResponse.json(
        { error: "Aktif okuma servisi şase okumayı desteklemiyor." },
        { status: 400 }
      )
    }

    const imageHash = VIN_HASH_PREFIX + hashImageBuffer(imageBuffer)

    // Byte-hash dedup: aynı kare tekrar gönderilirse sağlayıcı çağrılmaz.
    // Mock asla cache'lenmez (bkz. parça/ruhsat akışları).
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
      const cached = JSON.parse(cachedLog.extractedJson as string) as { vin?: string; confident?: boolean }
      const vin = parseVinFromText(cached.vin)
      if (vin) {
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
          JSON.stringify({ provider: provider.name, kind: "vin", cacheHit: true, sourceOcrLogId: cachedLog.id })
        )
        // Güven bilgisi de cache'ten gelir: aynı kare için "bazı haneler net
        // okunamadı" uyarısı ikinci okumada sessizce kaybolmasın.
        return NextResponse.json({ vin, provider: provider.name, confident: cached.confident !== false })
      }
    }

    // Şase plakası tek renk kabartma/lazer kazıma; renk bilgi taşımaz ama vision
    // modelinde gri tonlama + keskinleştirme yansımayı bastırıp kontrastı artırır.
    const normalizedImage = await normalizeRegistrationImage(imageBuffer, mimeType)

    const result = await provider.extractVin(normalizedImage.buffer, normalizedImage.mimeType)
    const vin = parseVinFromText(result.rawVin)

    if (!vin) {
      return NextResponse.json({ error: UNREADABLE_MESSAGE }, { status: 422 })
    }

    const ocrLog = await prisma.ocrLog.create({
      data: {
        workshopId: user.workshopId,
        ocrProvider: provider.name,
        extractedJson: JSON.stringify({ vin, confident: result.confident }),
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
      JSON.stringify({ provider: provider.name, kind: "vin" })
    )

    return NextResponse.json({ vin, provider: provider.name, confident: result.confident })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu"
    console.error("[VIN SCAN ERROR]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
