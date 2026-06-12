import convertHeic from "heic-convert"

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"])

export type NormalizedRegistrationImage = {
  buffer: Buffer
  mimeType: string
  previewDataUrl?: string
}

export async function normalizeRegistrationImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<NormalizedRegistrationImage> {
  if (!HEIC_MIME_TYPES.has(mimeType)) {
    return { buffer: imageBuffer, mimeType }
  }

  try {
    const converted = await convertHeic({
      buffer: imageBuffer,
      format: "JPEG",
      quality: 0.9,
    })
    const jpegBuffer = Buffer.from(converted)

    return {
      buffer: jpegBuffer,
      mimeType: "image/jpeg",
      previewDataUrl: `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`,
    }
  } catch (error) {
    console.error("[HEIC CONVERSION ERROR]", error)
    throw new Error(
      "HEIC fotoğrafı dönüştürülemedi. Lütfen fotoğrafı yeniden seçin veya JPEG olarak paylaşın."
    )
  }
}

