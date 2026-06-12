import { SUPPORTED_IMAGE_MIME_TYPES, MAX_IMAGE_SIZE_BYTES } from "./types"

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"])

function isHeic(file: File): boolean {
  return HEIC_MIME_TYPES.has(file.type.toLowerCase()) || /\.hei[cf]$/i.test(file.name)
}

export async function prepareRegistrationImage(file: File): Promise<File> {
  const preparedFile =
    isHeic(file) && !HEIC_MIME_TYPES.has(file.type.toLowerCase())
      ? new File([file], file.name, { type: "image/heic" })
      : file

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(preparedFile.type)) {
    throw new Error("Lütfen JPEG, PNG, WebP veya HEIC biçiminde bir görsel seçin.")
  }
  if (preparedFile.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Görsel ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB'dan küçük olmalıdır.`)
  }

  return preparedFile
}