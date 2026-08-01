import type { StorageProvider } from "./types"

export class MockStorageProvider implements StorageProvider {
  private store = new Map<string, string>()

  async upload(file: File, path: string): Promise<{ url: string; key: string }> {
    const key = path || `mock/${Date.now()}-${file.name}`
    // `FileReader` bir tarayıcı API'sidir; yükleme sunucu tarafında çalıştığı için
    // burada yoktur (kullanılırsa "FileReader is not defined" ile 400 döner).
    // Node runtime'ında dosya baytları `arrayBuffer()` ile okunur.
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64")
    const dataUrl = `data:${file.type || "application/octet-stream"};base64,${base64}`
    this.store.set(key, dataUrl)
    return { url: dataUrl, key }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async getSignedUrl(key: string): Promise<string> {
    return this.store.get(key) || ""
  }
}

let _mockInstance: MockStorageProvider | null = null

export function getMockStorageProvider(): MockStorageProvider {
  if (!_mockInstance) {
    _mockInstance = new MockStorageProvider()
  }
  return _mockInstance
}