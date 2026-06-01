export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024

export const STORAGE_PATH_PREFIX = "workshops"

export interface StorageUploadResult {
  url: string
  key: string
}

export interface StorageProvider {
  upload(file: File, path: string): Promise<StorageUploadResult>
  delete(key: string): Promise<void>
  getSignedUrl(key: string, expiresIn?: number): Promise<string>
}

export interface UploadValidation {
  valid: boolean
  error: string | null
}

export function validateUploadFile(file: File): UploadValidation {
  if (!file) {
    return { valid: false, error: "Dosya bulunamadı" }
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    if (file.type === "image/heic" || file.type === "image/heif") {
      return { valid: false, error: "HEIC formatı desteklenmemektedir. Lütfen JPEG, PNG veya WebP formatında yükleyiniz." }
    }
    return { valid: false, error: `Desteklenmeyen dosya tipi: ${file.type}. İzin verilen tipler: JPEG, PNG, WebP.` }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return { valid: false, error: `Dosya boyutu (${sizeMB} MB) çok büyük. Maksimum 8 MB olmalıdır.` }
  }

  return { valid: true, error: null }
}

export function buildStoragePath(workshopId: string, intakeFormId: string, photoType: string, photoId: string, fileName: string): string {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
  const baseName = safeName || "photo"
  return `${STORAGE_PATH_PREFIX}/${workshopId}/intakes/${intakeFormId}/${photoType}/${photoId}-${baseName}`
}