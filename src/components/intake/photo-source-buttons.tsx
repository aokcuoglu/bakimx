"use client"

import { Camera, Images, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Fotoğraf kaynağı düğmeleri (#899) — araç kabulü detayındaki Fotoğraf Ekle
 * diyaloğu ile kabul sihirbazı / hasar ekleme (`PhotoAnnotate`) ortak kullanır.
 *
 * - Dokunmatik cihaz: **Kamera** + **Galeri**. Kamera girdisindeki `capture`
 *   telefonda arka kamerayı doğrudan açar; Galeri çoklu seçimlidir.
 * - Fare kullanılan cihaz (`pointer: fine`, PC): tarayıcı `capture`'ı yok sayar,
 *   iki düğme aynı dosya seçiciyi açardı. Orada tek **Dosyadan seç** görünür ve
 *   çoklu seçimli girdiyi açar.
 *
 * Ayrım CSS medya sorgusuyla yapılır: sunucu ve istemci aynı HTML'i üretir,
 * hidrasyon farkı olmaz. İşaretçi bilgisi olmayan cihaz dokunmatik düzeni görür.
 * Etiketler kısa kalır (#886): telefonda diyalog içeriği ~326px, iki sütunda
 * "Galeriden seç" 44px düğmeye sığmayıp kenara taşıyordu.
 */
export function PhotoSourceButtons({
  onCamera,
  onFiles,
  disabled,
}: {
  /** `capture` girdisini açar (telefonda kamera). */
  onCamera: () => void
  /** Çoklu seçimli, `capture`'sız girdiyi açar (galeri / dosya). */
  onFiles: () => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 pointer-fine:hidden">
        <Button type="button" variant="outline" disabled={disabled} onClick={onCamera}>
          <Camera /> Kamera
        </Button>
        <Button type="button" variant="outline" disabled={disabled} onClick={onFiles}>
          <Images /> Galeri
        </Button>
      </div>
      <div className="hidden pointer-fine:grid">
        <Button type="button" variant="outline" disabled={disabled} onClick={onFiles}>
          <Upload /> Dosyadan seç
        </Button>
      </div>
    </div>
  )
}
