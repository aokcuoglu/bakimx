import { normalizePlate } from "@/lib/format"

// Türk plakası: 2 hane il kodu (01–81) + 1-3 harf + 2-4 hane.
// Harf grubunda Türkçe karakterlere de izin veriyoruz; OCR bazen O→Ö gibi
// okuyabilir, normalizePlate çıktıyı yine de büyütüp boşlukları atar.
const PLATE_RE = /(\d{2})\s*([A-ZÇĞİÖŞÜ]{1,3})\s*(\d{2,4})/

/**
 * OCR ham metninden Türk plakasını ayıklar ve depolanan biçimle eşleşecek
 * şekilde normalleştirir (boşluksuz, büyük harf). Bulamazsa null döner.
 *
 * Plaka tek satırdır; OCR'ın satır sonlarını/fazla boşlukları tek boşluğa
 * indirip mavi "TR" şeridi gibi gürültüyü tolere ederiz.
 */
export function parsePlateFromText(rawText: string): string | null {
  if (!rawText) return null
  const flat = rawText.replace(/\s+/g, " ").toUpperCase()
  const match = flat.match(PLATE_RE)
  if (!match) return null

  const cityCode = Number(match[1])
  if (cityCode < 1 || cityCode > 81) return null

  return normalizePlate(`${match[1]}${match[2]}${match[3]}`)
}
