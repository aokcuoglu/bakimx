const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"])
const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  ...HEIC_MIME_TYPES,
])

function isHeic(file: File): boolean {
  return HEIC_MIME_TYPES.has(file.type.toLowerCase()) || /\.hei[cf]$/i.test(file.name)
}

export async function prepareRegistrationImage(file: File): Promise<File> {
  const preparedFile =
    isHeic(file) && !HEIC_MIME_TYPES.has(file.type.toLowerCase())
      ? new File([file], file.name, { type: "image/heic" })
      : file

  if (!SUPPORTED_IMAGE_TYPES.has(preparedFile.type)) {
    throw new Error("Lütfen JPEG, PNG, WebP veya HEIC biçiminde bir görsel seçin.")
  }
  if (preparedFile.size > MAX_IMAGE_SIZE) {
    throw new Error("Görsel 8 MB'dan küçük olmalıdır.")
  }

  return preparedFile
}
