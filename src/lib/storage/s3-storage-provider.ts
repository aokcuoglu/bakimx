/**
 * S3-compatible Storage provider placeholder.
 *
 * TODO: Implement when S3-compatible storage is configured.
 *
 * Required env vars:
 *   - S3_ENDPOINT (optional, for S3-compatible services)
 *   - S3_REGION
 *   - S3_ACCESS_KEY_ID
 *   - S3_SECRET_ACCESS_KEY
 *   - S3_BUCKET_NAME
 *
 * This file should NOT be imported until S3 is configured.
 * The getStorageProvider() factory in storage-provider.ts should be
 * updated to check STORAGE_PROVIDER env var and return this provider.
 */

import type { StorageProvider } from "./types"

export class S3StorageProvider implements StorageProvider {
  async upload(_file: File, _path: string): Promise<{ url: string; key: string }> {
    throw new Error("S3StorageProvider not yet implemented. Configure S3 env vars and implement this provider.")
  }

  async delete(_key: string): Promise<void> {
    throw new Error("S3StorageProvider not yet implemented.")
  }

  async getSignedUrl(_key: string, _expiresIn?: number): Promise<string> {
    throw new Error("S3StorageProvider not yet implemented.")
  }
}