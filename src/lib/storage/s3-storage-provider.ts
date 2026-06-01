import type { StorageProvider } from "./types"

export class S3StorageProvider implements StorageProvider {
  async upload(_file: File, _path: string): Promise<{ url: string; key: string }> {
    throw new Error(
      "S3 depolama sağlayıcısı henüz uygulanmadı. STORAGE_PROVIDER=s3 seçildi ancak bu sağlayıcı aktif değildir. Lütfen mock veya supabase kullanınız."
    )
  }

  async delete(_key: string): Promise<void> {
    throw new Error("S3 depolama sağlayıcısı henüz uygulanmadı.")
  }

  async getSignedUrl(_key: string, _expiresIn?: number): Promise<string> {
    throw new Error("S3 depolama sağlayıcısı henüz uygulanmadı.")
  }
}