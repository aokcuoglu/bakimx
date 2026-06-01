import type { StorageProvider } from "./types"

type SupabaseClient = import("@supabase/supabase-js").SupabaseClient

export class SupabaseStorageProvider implements StorageProvider {
  private client: SupabaseClient
  private bucket: string

  constructor(client: SupabaseClient, bucket: string) {
    this.client = client
    this.bucket = bucket
  }

  async upload(file: File, path: string): Promise<{ url: string; key: string }> {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      throw new Error(`Supabase yükleme hatası: ${error.message}`)
    }

    return { url: "", key: path }
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .remove([key])

    if (error) {
      throw new Error(`Supabase silme hatası: ${error.message}`)
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(key, expiresIn)

    if (error) {
      throw new Error(`Supabase imzalı URL hatası: ${error.message}`)
    }

    return data?.signedUrl || ""
  }
}