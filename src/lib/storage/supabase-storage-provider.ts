/**
 * Supabase Storage provider placeholder.
 *
 * TODO: Implement when Supabase Storage is configured.
 *
 * Required env vars:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - STORAGE_BUCKET_NAME
 *
 * This file should NOT be imported until Supabase is configured.
 * The getStorageProvider() factory in storage-provider.ts should be
 * updated to check STORAGE_PROVIDER env var and return this provider.
 */

import type { StorageProvider } from "./types"

export class SupabaseStorageProvider implements StorageProvider {
  async upload(_file: File, _path: string): Promise<{ url: string; key: string }> {
    throw new Error("SupabaseStorageProvider not yet implemented. Configure Supabase env vars and implement this provider.")
  }

  async delete(_key: string): Promise<void> {
    throw new Error("SupabaseStorageProvider not yet implemented.")
  }

  async getSignedUrl(_key: string, _expiresIn?: number): Promise<string> {
    throw new Error("SupabaseStorageProvider not yet implemented.")
  }
}