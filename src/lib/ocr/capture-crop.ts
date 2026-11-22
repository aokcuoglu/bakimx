/** Ekran (CSS piksel) dikdörtgeni — `getBoundingClientRect()` ile aynı alanlar. */
export type ScreenRect = { left: number; top: number; width: number; height: number }

/** `drawImage(video, sx, sy, sWidth, sHeight, …)` için kaynak piksel kırpısı. */
export type SourceCrop = { sx: number; sy: number; sWidth: number; sHeight: number }

/**
 * `object-cover` ile gösterilen bir videoda ekrandaki bir bölgeyi kaynak
 * piksellere çevirir.
 *
 * Cover, kaynağı kutuyu kaplayacak kadar büyütür ve taşan kenarları gizler —
 * dikey telefon ekranında yatay bir kameranın yalnız ortadaki dilimi görünür.
 * Yakalama bu dönüşümü yapmazsa kullanıcının hiç görmediği kenarlar da
 * fotoğrafa girer (önizlemede olmayan kişi çekilen karede çıkar).
 *
 * `region` olarak videonun kendi kutusu verilirse sonuç "ekranda görünen kare"
 * olur; rehber çerçevesi verilirse yalnız çerçeve içi.
 *
 * @param pad Bölgeyi her yönde büyütme oranı (çerçeve hizalama payı).
 */
export function coverRegionToSource(
  source: { width: number; height: number },
  box: ScreenRect,
  region: ScreenRect,
  pad: { x: number; y: number } = { x: 0, y: 0 }
): SourceCrop {
  const srcW = source.width
  const srcH = source.height
  if (srcW <= 0 || srcH <= 0 || box.width <= 0 || box.height <= 0) {
    return { sx: 0, sy: 0, sWidth: Math.max(1, srcW), sHeight: Math.max(1, srcH) }
  }

  const coverScale = Math.max(box.width / srcW, box.height / srcH)
  const offX = (box.width - srcW * coverScale) / 2
  const offY = (box.height - srcH * coverScale) / 2

  let sx = (region.left - box.left - offX) / coverScale
  let sy = (region.top - box.top - offY) / coverScale
  let sWidth = region.width / coverScale
  let sHeight = region.height / coverScale

  const padX = sWidth * pad.x
  const padY = sHeight * pad.y
  sx -= padX
  sy -= padY
  sWidth += padX * 2
  sHeight += padY * 2

  // Kaynak sınırlarına kıstır.
  sx = Math.max(0, Math.min(sx, srcW))
  sy = Math.max(0, Math.min(sy, srcH))
  sWidth = Math.max(1, Math.min(sWidth, srcW - sx))
  sHeight = Math.max(1, Math.min(sHeight, srcH - sy))

  return { sx, sy, sWidth, sHeight }
}
