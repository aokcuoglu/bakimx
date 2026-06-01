/**
 * Unified storage provider factory.
 *
 * Currently returns the MockStorageProvider for local development.
 * In production, swap this to return a real provider based on env vars.
 *
 * TODO: Implement real providers and switch based on environment:
 *   - If STORAGE_PROVIDER=supabase → use SupabaseStorageProvider
 *   - If STORAGE_PROVIDER=s3 → use S3StorageProvider
 *   - Default: MockStorageProvider (safe, no external deps)
 *
 * Public output page handles missing photo fileUrl gracefully with
 * "Fotoğraf önizlemesi depolama entegrasyonu sonrası gösterilecektir."
 */

import type { StorageProvider } from "./types"
import { getMockStorageProvider } from "./mock-storage-provider"

export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER

  if (provider === "supabase") {
    throw new Error(
      "SupabaseStorageProvider not yet implemented. Set STORAGE_PROVIDER to undefined or remove it to use MockStorageProvider."
    )
  }

  if (provider === "s3") {
    throw new Error(
      "S3StorageProvider not yet implemented. Set STORAGE_PROVIDER to undefined or remove it to use MockStorageProvider."
    )
  }

  return getMockStorageProvider()
}