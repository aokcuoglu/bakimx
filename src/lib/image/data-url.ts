/**
 * `data:<mime>;base64,<veri>` dizesini Blob'a çevirir. Kamera tarayıcısının
 * yakaladığı kare (canvas.toDataURL) OCR'a gönderildikten sonra kabul
 * fotoğrafı olarak da yüklenebilsin diye kullanılır. `fetch(dataUrl)` yerine
 * elle çözülür: CSP `connect-src` `data:` şemasını engelleyebilir.
 *
 * Geçersiz girdide `null` döner.
 */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]*)$/.exec(dataUrl)
  if (!match) return null
  try {
    const binary = atob(match[2])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: match[1] })
  } catch {
    return null
  }
}
