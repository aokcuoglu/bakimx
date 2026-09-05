/**
 * Kanıt fotoğraflarını yüklemeden önce tarayıcıda küçültür.
 *
 * Uzun kenarı sınırlar, JPEG'e çevirir, hedef boyuta inene kadar kaliteyi
 * düşürür. EXIF yönü `createImageBitmap` + `imageOrientation: "from-image"`
 * ile düzeltilir (destekleyen tarayıcılarda).
 */

import { fitDimensions } from "@/lib/image/fit-dimensions"
import {
  COMPRESS_JPEG_QUALITY,
  COMPRESS_MAX_EDGE,
  COMPRESS_TARGET_BYTES,
  MAX_FILE_SIZE_BYTES,
  MAX_RAW_INPUT_BYTES,
  maxFileSizeLabelMb,
} from "@/lib/photos/limits"

export type CompressImageResult =
  | { ok: true; file: File; skipped: boolean }
  | { ok: false; error: string }

const OUTPUT_TYPE = "image/jpeg"

function baseName(fileName: string): string {
  const trimmed = fileName.trim() || "photo"
  const withoutExt = trimmed.replace(/\.[^.]+$/, "")
  return (withoutExt || "photo").slice(0, 80)
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    // Eski motorlar imageOrientation'ı tanımaz; yön düzeltmesiz dene.
    return await createImageBitmap(file)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), OUTPUT_TYPE, quality)
  })
}

/**
 * Dosyayı kanıt yüklemesi için hazırlar. Zaten küçük ve JPEG ise yeniden
 * kodlamadan geçirir; aksi halde yeniden boyutlandırıp sıkıştırır.
 */
export async function compressImageForUpload(file: File): Promise<CompressImageResult> {
  if (!file || file.size <= 0) {
    return { ok: false, error: "Dosya bulunamadı" }
  }

  if (file.size > MAX_RAW_INPUT_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return {
      ok: false,
      error: `Dosya çok büyük (${sizeMB} MB). En fazla ${Math.round(MAX_RAW_INPUT_BYTES / (1024 * 1024))} MB seçebilirsiniz.`,
    }
  }

  if (!file.type.startsWith("image/")) {
    return { ok: false, error: `Desteklenmeyen dosya tipi: ${file.type || "bilinmiyor"}` }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await loadBitmap(file)
  } catch {
    return { ok: false, error: "Görsel okunamadı. Lütfen JPEG, PNG veya WebP deneyin." }
  }

  try {
    const { w, h } = fitDimensions(bitmap.width, bitmap.height, COMPRESS_MAX_EDGE)
    const needsResize = w !== bitmap.width || h !== bitmap.height
    const alreadySmallJpeg =
      file.type === OUTPUT_TYPE && file.size <= COMPRESS_TARGET_BYTES && !needsResize

    if (alreadySmallJpeg) {
      return { ok: true, file, skipped: true }
    }

    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, w)
    canvas.height = Math.max(1, h)
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      return { ok: false, error: "Görsel işlenemedi (canvas desteklenmiyor)" }
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    let quality = COMPRESS_JPEG_QUALITY
    let blob = await canvasToBlob(canvas, quality)
    while (blob && blob.size > COMPRESS_TARGET_BYTES && quality > 0.5) {
      quality = Math.round((quality - 0.1) * 10) / 10
      blob = await canvasToBlob(canvas, quality)
    }

    if (!blob) {
      return { ok: false, error: "Görsel sıkıştırılamadı" }
    }

    if (blob.size > MAX_FILE_SIZE_BYTES) {
      return {
        ok: false,
        error: `Sıkıştırma sonrası dosya hâlâ çok büyük. Maksimum ${maxFileSizeLabelMb()} MB olmalıdır.`,
      }
    }

    const out = new File([blob], `${baseName(file.name)}.jpg`, {
      type: OUTPUT_TYPE,
      lastModified: Date.now(),
    })
    return { ok: true, file: out, skipped: false }
  } finally {
    bitmap.close()
  }
}

/** Birden fazla dosyayı sırayla hazırlar; hatalı olanları ayrı listeler. */
export async function compressImagesForUpload(files: readonly File[]): Promise<{
  accepted: File[]
  failures: { name: string; error: string }[]
}> {
  const accepted: File[] = []
  const failures: { name: string; error: string }[] = []
  for (const file of files) {
    const result = await compressImageForUpload(file)
    if (result.ok) accepted.push(result.file)
    else failures.push({ name: file.name, error: result.error })
  }
  return { accepted, failures }
}
