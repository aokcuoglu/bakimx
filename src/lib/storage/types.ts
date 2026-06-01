/**
 * Storage provider abstraction for future Supabase/S3 integration.
 *
 * TODO: When Supabase Storage or S3 is configured:
 *   - Implement SupabaseStorageProvider in lib/storage/supabase-storage-provider.ts
 *   - Implement S3StorageProvider in lib/storage/s3-storage-provider.ts
 *   - Swap MockStorageProvider for real provider in lib/storage/storage-provider.ts
 *
 * Current v0.1.2 uses MockStorageProvider for safe local development.
 * No storage env vars are required to build or run the app.
 *
 * Public output page handles missing photo fileUrl gracefully.
 * Photo previews show "Fotoğraf önizlemesi depolama entegrasyonu sonrası
 * gösterilecektir." when appropriate.
 */

export interface StorageProvider {
  /**
   * Upload a file and return its public/private URL.
   * For mock provider, returns a local data URL.
   */
  upload(file: File, path: string): Promise<{ url: string; key: string }>

  /**
   * Delete a file by its key/path.
   */
  delete(key: string): Promise<void>

  /**
   * Get a signed download URL (for private files).
   * For mock provider, returns the same URL.
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>
}

export interface StorageUploadResult {
  url: string
  key: string
}