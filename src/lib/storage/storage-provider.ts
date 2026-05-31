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
 */

import type { StorageProvider } from "./types"
import { getMockStorageProvider } from "./mock-storage-provider"

export function getStorageProvider(): StorageProvider {
  // TODO: Switch based on STORAGE_PROVIDER env var in future
  return getMockStorageProvider()
}
