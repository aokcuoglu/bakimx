import { NextResponse } from "next/server"
import { PSM } from "tesseract.js"
import { requireAuth } from "@/lib/auth"
import { normalizeRegistrationImage } from "@/lib/ocr/normalize-registration-image"
import { extractRegistrationText } from "@/lib/ocr/tesseract-text-extractor"
import { parsePlateFromText } from "@/lib/ocr/plate"
import { MAX_IMAGE_SIZE_BYTES, MAX_BODY_SIZE_BYTES, SUPPORTED_IMAGE_MIME_TYPES } from "@/lib/ocr/types"

// OCR yavaş paylaşımlı VPS CPU'sunda birkaç saniye sürebilir; Next'in varsayılan
// fonksiyon süresini gevşet (proxy timeout ~60s'in altında kalır).
export const maxDuration = 60

/**
 * Plaka fotoğrafından plaka metnini okur (sadece plaka — ruhsat değil).
 * OCR_PROVIDER'dan bağımsız olarak her zaman yerel Tesseract + plaka regex
 * kullanır; prod'da OCR_PROVIDER=mock olsa bile gerçek okuma yapar.
 */
export async function POST(request: Request) {
  try {
    await requireAuth()

    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > MAX_BODY_SIZE_BYTES) {
      return NextResponse.json(
        { error: `İstek gövdesi çok büyük. Görsel ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB'dan küçük olmalıdır.` },
        { status: 413 }
      )
    }

    const body = await request.json()
    const { imageDataUrl, mimeType } = body

    if (!imageDataUrl || !mimeType) {
      return NextResponse.json({ error: "Görsel verisi ve MIME tipi zorunludur" }, { status: 400 })
    }
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

    const imageBuffer = Buffer.from(base64Match[1], "base64")
    if (imageBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Görsel ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB'dan küçük olmalıdır.` },
        { status: 413 }
      )
    }

    const normalized = await normalizeRegistrationImage(imageBuffer, mimeType)

    // Plaka tek satır → önce SINGLE_LINE; bulamazsak SINGLE_BLOCK ile yeniden dene.
    // rotateAuto KAPALI: plaka sabit yatay rehberde hizalanır, döndürme geçişi
    // gereksiz ve OCR'ı ~2 kat yavaşlatıp zaman aşımına sokuyordu.
    let plate: string | null = null
    for (const psm of [PSM.SINGLE_LINE, PSM.SINGLE_BLOCK]) {
      const t0 = Date.now()
      try {
        const text = await extractRegistrationText(normalized.buffer, psm, false)
        plate = parsePlateFromText(text)
        console.log(`[PLATE SCAN] psm=${psm} ${Date.now() - t0}ms plate=${plate ?? "—"}`)
        if (plate) break
      } catch (e) {
        console.log(`[PLATE SCAN] psm=${psm} ${Date.now() - t0}ms err=${e instanceof Error ? e.message : e}`)
      }
    }

    if (!plate) {
      return NextResponse.json(
        { error: "Plaka okunamadı. Plakaya daha yakın, düz bir açıyla net bir kare çekin." },
        { status: 422 }
      )
    }

    return NextResponse.json({ plate })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bir hata oluştu"
    console.error("[PLATE SCAN ERROR]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
