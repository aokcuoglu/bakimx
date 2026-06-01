import type { StorageProvider } from "./types"

export class MockStorageProvider implements StorageProvider {
  private store = new Map<string, string>()

  async upload(file: File, path: string): Promise<{ url: string; key: string }> {
    const key = path || `mock/${Date.now()}-${file.name}`
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
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