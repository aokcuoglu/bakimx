import { NextResponse } from "next/server"
import { MAX_IMAGE_SIZE_BYTES, MAX_BODY_SIZE_BYTES, SUPPORTED_IMAGE_MIME_TYPES } from "./types"

export type ParsedOcrImage = { imageBuffer: Buffer; mimeType: string }

// Ortak OCR görsel ayrıştırma: multipart 'image' veya JSON { imageDataUrl, mimeType }.
// Başarıda { imageBuffer, mimeType }, hata durumunda hazır bir NextResponse döner.
export async function parseOcrImageRequest(request: Request): Promise<ParsedOcrImage | NextResponse> {
  const contentLength = request.headers.get("content-length")
  if (contentLength && Number(contentLength) > MAX_BODY_SIZE_BYTES) {
    return NextResponse.json(
      { error: `İstek gövdesi çok büyük. Görsel ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB'dan küçük olmalıdır.` },
      { status: 413 }
    )
  }

  const contentType = request.headers.get("content-type") || ""

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
    let mimeType = file.type || "image/jpeg"
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
    const imageBuffer = Buffer.from(await file.arrayBuffer())
    return { imageBuffer, mimeType }
  }

  const body = await request.json()
  const { imageDataUrl, mimeType: bodyMimeType } = body
  if (!imageDataUrl || !bodyMimeType) {
    return NextResponse.json({ error: "Görsel verisi ve MIME tipi zorunludur" }, { status: 400 })
  }
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(bodyMimeType)) {
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
  return { imageBuffer, mimeType: bodyMimeType }
}
