import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getOcrProvider } from "@/lib/ocr/provider"
import { normalizeRegistrationImage } from "@/lib/ocr/normalize-registration-image"
import { prisma } from "@/lib/db"

const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const MAX_BODY_SIZE = 12 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "İstek gövdesi çok büyük. Görsel 8 MB'dan küçük olmalıdır." },
        { status: 413 }
      )
    }

    const body = await request.json()
    const { imageDataUrl, mimeType } = body

    if (!imageDataUrl || !mimeType) {
      return NextResponse.json(
        { error: "Görsel verisi ve MIME tipi zorunludur" },
        { status: 400 }
      )
    }

    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: "Desteklenmeyen görsel biçimi. JPEG, PNG veya WebP yükleyin." },
        { status: 400 }
      )
    }

    const base64Match = imageDataUrl.match(/^data:[^;]+;base64,(.+)$/)
    if (!base64Match) {
      return NextResponse.json(
        { error: "Geçersiz görsel formatı" },
        { status: 400 }
      )
    }

    const imageBuffer = Buffer.from(base64Match[1], "base64")
    if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "Görsel 8 MB'dan küçük olmalıdır" },
        { status: 413 }
      )
    }

    const normalizedImage = await normalizeRegistrationImage(imageBuffer, mimeType)
    const provider = await getOcrProvider()
    const result = await provider.extractRegistration(
      normalizedImage.buffer,
      normalizedImage.mimeType
    )

    const extractedJson = JSON.stringify({
      plate: result.plate,
      vin: result.vin,
      ownerName: result.ownerName,
      ownerSurname: result.ownerSurname,
      brand: result.brand,
      model: result.model,
      vehicleType: result.vehicleType,
      modelYear: result.modelYear,
      engineNo: result.engineNo,
      registrationDate: result.registrationDate,
    })

    const ocrLog = await prisma.ocrLog.create({
      data: {
        workshopId: user.workshopId,
        ocrProvider: provider.name,
        rawText: result.rawText,
        extractedJson,
        userId: user.id,
      },
    })

    return NextResponse.json({
      result,
      ocrLogId: ocrLog.id,
      previewDataUrl: normalizedImage.previewDataUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu"
    console.error("[OCR ERROR]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
