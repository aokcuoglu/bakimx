export type PhotoSrcInput = { id: string; fileUrl: string | null }

/**
 * Kimliği doğrulanmış (personel) ekranlarında bir fotoğrafın görüntülenebilir kaynağı.
 *
 * `VehiclePhoto.fileUrl` bir SERVİS ADRESİ DEĞİLDİR: S3/R2 sağlayıcısında yalnızca
 * saklanan nesnenin referansıdır (bkz. `src/lib/storage/s3-storage-provider.ts`
 * `getPublicUrl`) ve kova özel olduğu için doğrudan `<img src>`/bağlantı olarak
 * kullanılırsa 403 döner. Bayt'lar aynı kaynaklı, oturum doğrulayan
 * `/api/photos?id=` proxy'sinden okunmalıdır. Mock sağlayıcıda `fileUrl` bir
 * `data:` URL'i olduğu için doğrudan kullanılabilir — yerelde çalışıp üretimde
 * kırılan fark buradan gelir.
 *
 * Dosyası olmayan kayıtlar için `null` döner (çağıran taraf yer tutucu gösterir).
 */
export function resolvePhotoSrc(photo: PhotoSrcInput): string | null {
  if (!photo.fileUrl) return null
  if (photo.fileUrl.startsWith("data:")) return photo.fileUrl
  return `/api/photos?id=${encodeURIComponent(photo.id)}`
}
