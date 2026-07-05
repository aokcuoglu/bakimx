import convertHeic from "heic-convert"
import sharp from "sharp"
import { MAX_IMAGE_SIZE_BYTES } from "./types"

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"])

// OCR sidecar'a giden görselin boyutu. CPU inference maliyeti ~piksel sayısıyla
// orantılı, yani en uzun kenar ana hız kolu. 1280px ruhsat metnini okunur tutar
// ama piksel sayısını eski 2000px'e göre ~2.4x azaltır. Küçük alanlar (VIN / motor
// no) yanlış okunmaya başlarsa 1600'e doğru artır.
const OCR_MAX_EDGE = 1280
const OCR_JPEG_QUALITY = 80

export type NormalizedRegistrationImage = {
  buffer: Buffer
  mimeType: string
  previewDataUrl?: string
}

export type NormalizeOptions = {
  /**
   * true (varsayılan): gri tonlama + kontrast + keskinleştirme — Tesseract (plaka) için.
   * false: rengi korur, hafif işler — Claude Vision ruhsat okuması için (mavi zemin,
   * renkli alanlar ve damgalar bilgi taşır).
   */
  grayscale?: boolean
}

async function preprocessImage(
  buffer: Buffer,
  mimeType: string,
  grayscale: boolean
): Promise<{ buffer: Buffer; mimeType: string }> {
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

  // Sharp pipeline:
  // rotate   → EXIF orientation düzeltme
  // resize   → en uzun kenar OCR_MAX_EDGE; küçük fotoyu büyütme (withoutEnlargement)
  // grayscale/normalize/sharpen → yalnız Tesseract (plaka) modunda; vision modunda renk korunur.
  try {
    let pipeline = sharp(buffer)
      .rotate()
      .resize({
        width: OCR_MAX_EDGE,
        height: OCR_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
    if (grayscale) {
      pipeline = pipeline.grayscale().normalize().sharpen()
    }
    const processed = await pipeline.jpeg({ quality: OCR_JPEG_QUALITY }).toBuffer()

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
  mimeType: string,
  options: NormalizeOptions = {}
): Promise<NormalizedRegistrationImage> {
  const { grayscale = true } = options
  const { buffer, mimeType: outMime } = await preprocessImage(imageBuffer, mimeType, grayscale)

  return {
    buffer,
    mimeType: outMime,
    previewDataUrl: `data:${outMime};base64,${buffer.toString("base64")}`,
  }
}
