import type { StorageProvider } from "./types"
import { getMockStorageProvider } from "./mock-storage-provider"

let _provider: StorageProvider | null = null

export async function getStorageProvider(): Promise<StorageProvider> {
  if (_provider) return _provider

  const provider = process.env.STORAGE_PROVIDER || "mock"

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