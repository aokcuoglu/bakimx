import { NextResponse } from "next/server"
import { PSM } from "tesseract.js"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { apiErrorResponse } from "@/lib/api-errors"
import { AuditLogAction } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { normalizeRegistrationImage } from "@/lib/ocr/normalize-registration-image"
import { parseOcrImageRequest } from "@/lib/ocr/parse-image-request"
import { parsePlateFromText } from "@/lib/ocr/plate"
import { matchCatalogBrand } from "@/lib/ocr/vehicle-brand"
import { getOcrProvider } from "@/lib/ocr/provider"
import { extractRegistrationText } from "@/lib/ocr/tesseract-text-extractor"
import { assertFeature } from "@/lib/plan"
import { assertWritableOr403 } from "@/lib/plan-guard"

// Vision çağrısı / yerel OCR birkaç saniye sürebilir; Next'in varsayılan süresini
// gevşet (proxy timeout ~60s'in altında kalır).
export const maxDuration = 60

const UNREADABLE_MESSAGE =
  "Plaka okunamadı. Aracın önünü, plaka net görünecek şekilde biraz daha yakından çekin."

/**
 * Araç fotoğrafından plakayı okur. Kare artık aracın önünün tamamıdır (plaka
 * çerçevesine kırpılmış değil), yani önce plakanın yeri bulunmalı:
 *
 * - Aktif OCR sağlayıcısı `extractPlate` destekliyorsa (prod/dev: Claude Vision)
 *   plakayı o bulur ve okur.
 * - Desteklemiyorsa yerel Tesseract + plaka regex'ine düşülür; bu yol tam araç
 *   fotoğrafında zayıftır ama plakaya yakın çekilmiş karede çalışır.
 *
 * Okunan ham metin her durumda `parsePlateFromText` ile doğrulanır: istemciye
 * yalnız geçerli bir TR plakası gider.
 *
 * Aynı Vision çağrısı aracın markasını da tanır (ek çağrı/maliyet yok). Marka
 * katalogdaki yazımına çevrilir ki seçici modelleri yükleyebilsin; yalnız plaka
 * da okunduysa döner (422'de marka yok — Tesseract yedeğinde hiç yok).
 */
export async function POST(request: Request) {
  try {
    const { user, workshop } = await getCurrentUserWithWorkshop()
    const locked = assertWritableOr403(workshop)
    if (locked) return locked
    assertFeature(workshop, "ocrIntake")

    const parsed = await parseOcrImageRequest(request)
    if (parsed instanceof NextResponse) return parsed
    const normalized = await normalizeRegistrationImage(parsed.imageBuffer, parsed.mimeType)

    const provider = await getOcrProvider()
    let plate: string | null = null
    let brand: string | null = null

    if (typeof provider.extractPlate === "function") {
      const t0 = Date.now()
      const result = await provider.extractPlate(normalized.buffer, normalized.mimeType)
      plate = parsePlateFromText(result.rawPlate)
      if (plate && result.rawBrand.trim()) {
        // Marka kataloğu atölyeye ait değil, ortak referans tablosu.
        const catalog = await prisma.vehicleBrand.findMany({ select: { name: true } })
        brand = matchCatalogBrand(result.rawBrand, catalog.map((b) => b.name))
      }
      console.log(
        `[PLATE SCAN] provider=${provider.name} ${Date.now() - t0}ms plate=${plate ?? "—"} brand=${brand ?? "—"}`
      )

      if (plate) {
        // Sağlayıcı çağrısı ücretli: ruhsat/şase okumalarıyla aynı kayıt + denetim izi.
        const ocrLog = await prisma.ocrLog.create({
          data: {
            workshopId: user.workshopId,
            ocrProvider: provider.name,
            extractedJson: JSON.stringify({ plate, confident: result.confident, brand }),
            userId: user.id,
          },
        })
        await AuditLogAction(
          user.workshopId,
          user.id,
          "OcrLog",
          ocrLog.id,
          "ocr_capture",
          JSON.stringify({ provider: provider.name, kind: "plate" })
        )
      }
    } else {
      // Yerel yedek: önce SINGLE_LINE, bulamazsak SINGLE_BLOCK. rotateAuto kapalı
      // (OCR'ı ~2 kat yavaşlatıp zaman aşımına sokuyordu).
      for (const psm of [PSM.SINGLE_LINE, PSM.SINGLE_BLOCK]) {
        const t0 = Date.now()
        try {
          const text = await extractRegistrationText(normalized.buffer, psm, false)
          plate = parsePlateFromText(text)
          console.log(`[PLATE SCAN] tesseract psm=${psm} ${Date.now() - t0}ms plate=${plate ?? "—"}`)
          if (plate) break
        } catch (e) {
          console.log(`[PLATE SCAN] tesseract psm=${psm} ${Date.now() - t0}ms err=${e instanceof Error ? e.message : e}`)
        }
      }
    }

    if (!plate) {
      return NextResponse.json({ error: UNREADABLE_MESSAGE }, { status: 422 })
    }

    return NextResponse.json(brand ? { plate, brand } : { plate })
  } catch (err) {
    const response = apiErrorResponse(err)
    if (response.status >= 500) console.error("[PLATE SCAN ERROR]", err)
    return response
  }
}
