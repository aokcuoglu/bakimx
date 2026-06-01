import type { StorageProvider } from "./types"
import { getMockStorageProvider } from "./mock-storage-provider"

let _provider: StorageProvider | null = null

export async function getStorageProvider(): Promise<StorageProvider> {
  if (_provider) return _provider

  const provider = process.env.STORAGE_PROVIDER || "mock"

  if (provider === "supabase") {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "bakimx-media"

    if (!url || !key) {
      throw new Error(
        "Supabase yapılandırması eksik. SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenlerini ayarlayınız."
      )
    }

    const { createClient } = await import("@supabase/supabase-js")
    const client = createClient(url, key, {
      auth: { persistSession: false },
    })
    const { SupabaseStorageProvider } = await import("./supabase-storage-provider")
    _provider = new SupabaseStorageProvider(client, bucket)
    return _provider
  }

  if (provider === "s3") {
    const { S3StorageProvider } = await import("./s3-storage-provider")
    _provider = new S3StorageProvider()
    return _provider
  }

  _provider = getMockStorageProvider()
  return _provider
}

export function resetStorageProvider(): void {
  _provider = null
}