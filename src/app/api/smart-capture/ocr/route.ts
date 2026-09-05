import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { assertWritableOr403 } from "@/lib/plan-guard"
import { hasFeature, type PlanTier } from "@/lib/plan"
import { getOcrProvider } from "@/lib/ocr/provider"
import { hashImageBuffer } from "@/lib/ocr/image-hash"
import { normalizeRegistrationImage } from "@/lib/ocr/normalize-registration-image"
import { parseOcrImageRequest } from "@/lib/ocr/parse-image-request"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { grantVehicleHistoryAccess } from "@/lib/vehicle-history/access"

export async function POST(request: Request) {
  try {
    const { user, workshop } = await getCurrentUserWithWorkshop()
    const locked = assertWritableOr403(workshop)
    if (locked) return locked

    if (!hasFeature(workshop.planTier as PlanTier, "ocrIntake")) {
      return NextResponse.json(
        { error: "Bu pakette ruhsat okuma özelliği bulunmuyor. Paketinizi yükseltin." },
        { status: 403 },
      )
    }

    const parsed = await parseOcrImageRequest(request)
    if (parsed instanceof NextResponse) return parsed
    const { imageBuffer, mimeType } = parsed

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

      // Ruhsat bu atölyede okutuldu ⇒ servisler arası geçmiş maskesi kalkar
      // (BAK-77). Cache hit'te de sayılır: kullanıcı yine ruhsatı elinde tutuyor.
      await grantVehicleHistoryAccess({
        workshopId: user.workshopId,
        plate: cachedFields.plate?.value ?? "",
        vin: cachedFields.vin?.value ?? null,
        userId: user.id,
        ocrLogId: cachedOcrLog.id,
      })

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

    const extractedJson = JSON.stringify({
      plate: result.plate,
      vin: result.vin,
      ownerName: result.ownerName,
      ownerSurname: result.ownerSurname,
      identityOrTaxNumber: result.identityOrTaxNumber,
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
      JSON.stringify({ provider: provider.name })
    )

    // Bkz. cache hit dalındaki aynı çağrı (BAK-77).
    await grantVehicleHistoryAccess({
      workshopId: user.workshopId,
      plate: result.plate.value,
      vin: result.vin.value,
      userId: user.id,
      ocrLogId: ocrLog.id,
    })

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
