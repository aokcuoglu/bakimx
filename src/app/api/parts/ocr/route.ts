import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { assertWritableOr403 } from "@/lib/plan-guard"
import { getOcrProvider } from "@/lib/ocr/provider"
import { hashImageBuffer } from "@/lib/ocr/image-hash"
import { normalizeRegistrationImage } from "@/lib/ocr/normalize-registration-image"
import { parseOcrImageRequest } from "@/lib/ocr/parse-image-request"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"

// Part-box dedup'ı ruhsat dedup'ından ayrı tutmak için imageHash'e namespace öneki koyulur:
// aynı görsel iki akışa da yüklenirse cache'ler karışmaz (part-box JSON'u ruhsat JSON'una benzemez).
const PARTBOX_HASH_PREFIX = "partbox:"

export async function POST(request: Request) {
  try {
    const { user, workshop } = await getCurrentUserWithWorkshop()
    const locked = assertWritableOr403(workshop)
    if (locked) return locked

    const parsed = await parseOcrImageRequest(request)
    if (parsed instanceof NextResponse) return parsed
    const { imageBuffer, mimeType } = parsed

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
