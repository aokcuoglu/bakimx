import convertHeic from "heic-convert"
import sharp from "sharp"
import { MAX_IMAGE_SIZE_BYTES } from "./types"

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"])

export type NormalizedRegistrationImage = {
  buffer: Buffer
  mimeType: string
  previewDataUrl?: string
}

async function preprocessImage(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (HEIC_MIME_TYPES.has(mimeType)) {
    try {
      const converted = await convertHeic({
        buffer,
        format: "JPEG",
        quality: 0.9,
      })
      buffer = Buffer.from(converted)
      mimeType = "image/jpeg"
    } catch (error) {
      if (error instanceof Error && error.message.includes("MB sınırını aşıyor")) {
        throw error
      }
      console.error("[HEIC CONVERSION ERROR]", error)
      throw new Error(
        "HEIC fotoğrafı dönüştürülemedi. Lütfen fotoğrafı yeniden seçin veya JPEG olarak paylaşın."
      )
    }
  }

  // Tesseract optimizasyonu için sharp pipeline:
  // rotate   → EXIF orientation düzeltme
  // resize   → maksimum 2000px en uzun kenar (küçük fotolar içinse minimum garantisi)
  // grayscale → gri tonlama (Tesseract tek kanalda daha iyi)
  // normalize → kontrast germe
  // sharpen  → keskinleştirme
  try {
    const processed = await sharp(buffer)
      .rotate()
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: false,
      })
      .grayscale()
      .normalize()
      .sharpen()
      .jpeg({ quality: 95 })
      .toBuffer()

    if (processed.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(
        `İşlenmiş görsel ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB sınırını aşıyor. Lütfen daha küçük bir fotoğraf yükleyin.`
      )
    }

    return { buffer: processed, mimeType: "image/jpeg" }
  } catch (error) {
    if (error instanceof Error && error.message.includes("MB sınırını aşıyor")) {
      throw error
    }
    console.error("[SHARP PREPROCESS ERROR]", error)
    // Sharp başarısız olursa ham buffer ile devam et
    return { buffer, mimeType }
  }
}

export async function normalizeRegistrationImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<NormalizedRegistrationImage> {
  const { buffer, mimeType: outMime } = await preprocessImage(imageBuffer, mimeType)

  return {
    buffer,
    mimeType: outMime,
    previewDataUrl: `data:${outMime};base64,${buffer.toString("base64")}`,
  }
}
