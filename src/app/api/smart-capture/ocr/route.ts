import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getOcrProvider } from "@/lib/ocr/provider"
import { normalizeRegistrationImage } from "@/lib/ocr/normalize-registration-image"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { MAX_IMAGE_SIZE_BYTES, MAX_BODY_SIZE_BYTES, SUPPORTED_IMAGE_MIME_TYPES } from "@/lib/ocr/types"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

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
      const arrayBuffer = await file.arrayBuffer()
      imageBuffer = Buffer.from(arrayBuffer)
    } else {
      const body = await request.json()
      const { imageDataUrl, mimeType: bodyMimeType } = body

      if (!imageDataUrl || !bodyMimeType) {
        return NextResponse.json(
          { error: "Görsel verisi ve MIME tipi zorunludur" },
          { status: 400 }
        )
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
        return NextResponse.json(
          { error: "Geçersiz görsel formatı. Geçerli bir data URL gönderin." },
          { status: 400 }
        )
      }

      imageBuffer = Buffer.from(base64Match[1], "base64")
      if (imageBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `Görsel ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB'dan küçük olmalıdır.` },
          { status: 413 }
        )
      }
    }

    // Vision OCR için rengi koru (gri tonlama yalnız Tesseract/plaka içindir).
    const normalizedImage = await normalizeRegistrationImage(imageBuffer, mimeType, { grayscale: false })
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
      commercialName: result.commercialName,
      fuelType: result.fuelType,
      engineDisplacement: result.engineDisplacement,
      enginePower: result.enginePower,
      inspectionValidUntil: result.inspectionValidUntil,
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

    await AuditLogAction(
      user.workshopId,
      user.id,
      "OcrLog",
      ocrLog.id,
      "ocr_capture",
      JSON.stringify({ provider: provider.name })
    )

    const { rawText: _, ...publicResult } = result

    return NextResponse.json({
      result: publicResult,
      ocrLogId: ocrLog.id,
      provider: provider.name,
      previewDataUrl: normalizedImage.previewDataUrl,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu"
    console.error("[OCR ERROR]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}