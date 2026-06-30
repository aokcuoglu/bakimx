import Image from "next/image"

/**
 * BakimX logo variant'ları (logo kullanım rehberine göre).
 *
 * - `primary-light`: Beyaz / açık gri arka plan — web sitesi header, landing,
 *   teklif, sunum, PDF.
 * - `primary-dark`: Lacivert / siyah / fotoğraf üstü koyu alanlar — login sol
 *   paneli, dark mode, sunum kapağı.
 * - `icon-light`: Açık arka planda yalnız sembol — favicon, LinkedIn profil
 *   görseli, app icon, dar sidebar (40px altı kullanım).
 * - `icon-dark`: Koyu arka planda yalnız sembol — dark sidebar, koyu mobil
 *   header, login ekranı (40px altı kullanım).
 */
export type BrandLogoVariant =
  | "primary-light"
  | "primary-dark"
  | "icon-light"
  | "icon-dark"

/**
 * Logo boyutları (height px).
 *
 * Rehber kuralı: 40px altında yalnızca icon kullanılmalıdır. Bu nedenle
 * `xs`, `sm` ve `md` (hepsi 40px altı) otomatik olarak ilgili icon
 * variant'ına düşürülür; yalnızca `lg` (40px) primary variant'larını korur.
 */
export type BrandLogoSize = "xs" | "sm" | "md" | "lg"

export const BRAND_LOGOS: Record<
  BrandLogoVariant,
  { src: string; width: number; height: number }
> = {
  "primary-light": {
    src: "/01-bakimx-primary-light.svg",
    width: 1087,
    height: 211,
  },
  "primary-dark": {
    src: "/02-bakimx-primary-dark.svg",
    width: 754,
    height: 147,
  },
  "icon-light": {
    src: "/03-bakimx-icon-light.svg",
    width: 303,
    height: 190,
  },
  "icon-dark": {
    src: "/04-bakimx-icon-dark.svg",
    width: 303,
    height: 190,
  },
}

const HEIGHT_BY_SIZE: Record<BrandLogoSize, number> = {
  xs: 16,
  sm: 20,
  md: 26,
  lg: 32,
}

/**
 * 40px altı kullanımlar için primary -> icon eşlemesi.
 * Rehber: "40 px altındaki kullanımlarda yalnızca icon tercih edilmelidir."
 */
const ICON_FOR_VARIANT: Record<
  BrandLogoVariant,
  "icon-light" | "icon-dark"
> = {
  "primary-light": "icon-light",
  "primary-dark": "icon-dark",
  "icon-light": "icon-light",
  "icon-dark": "icon-dark",
}

/** Primary variant'ların bu px altında icon'a düşürülüp düşürülmeyeceği.
 *  (Rehber 40px referansından, genel logo küçültmesiyle birlikte 32px'e
 *  çekildi; `lg` primary wordmark'ı bu eşikte korunur.) */
const PRIMARY_THRESHOLD = 32

type BrandLogoProps = {
  /** Logo variant'ı. Default `primary-light`. 40px altı boyutlarda otomatik
   *  ilgili icon variant'ına düşürülür. */
  variant?: BrandLogoVariant
  size?: BrandLogoSize
  /** Override için manuel yükseklik (px). Verilirse `size` prop'u göz ardı
   *  edilir ama 40px altı otomatik icon düşüşü yine geçerlidir. */
  height?: number
  /** Açık alan (clear-space): logo çevresine X kolu kalınlığı kadar (~%8)
   *  padding ekler. Rehber kuralı: "Logonun çevresinde en az ikonun X kolu
   *  kalınlığı kadar boşluk bırakılmalıdır." Default `false`. */
  clearSpace?: boolean
  priority?: boolean
  /** Erişilebilir alt metin. Default `BakimX`. Rehber kuralı: marka adı
   *  her zaman `BakimX` yazımında olmalıdır — override ederken farklı
   *  büyük/küçük harf kullanmayın ("Bakimx", "BAKIMX", "bakimx" YASAK). */
  alt?: string
  className?: string
  imgClassName?: string
}

export function BrandLogo({
  variant = "primary-light",
  size = "md",
  height,
  clearSpace = false,
  priority = false,
  alt = "BakimX",
  className,
  imgClassName,
}: BrandLogoProps) {
  const targetHeight = height ?? HEIGHT_BY_SIZE[size]

  // Rehber: 40px altında yalnızca icon. Primary variant'ları otomatik düşür,
  // icon-* variant'larını koru.
  const resolvedVariant: BrandLogoVariant =
    targetHeight < PRIMARY_THRESHOLD ? ICON_FOR_VARIANT[variant] : variant

  const { src, width: intrinsicWidth, height: intrinsicHeight } =
    BRAND_LOGOS[resolvedVariant]

  const padding = clearSpace ? Math.round(targetHeight * 0.08) : 0

  return (
    <span
      className={`inline-flex items-center justify-center ${className ?? ""}`}
      style={{ height: targetHeight + padding * 2, padding }}
    >
      <Image
        src={src}
        alt={alt}
        width={intrinsicWidth}
        height={intrinsicHeight}
        priority={priority}
        // Logolar vektör SVG; optimize edilmeye gerek yok ve Next optimizer'ı SVG'yi
        // reddeder (/_next/image 400). unoptimized ile ham /public dosyası doğrudan
        // servis edilir (middleware kök .svg'leri muaf tuttuğu için 200 döner).
        unoptimized
        className={`object-contain ${imgClassName ?? ""}`}
        style={{ width: "auto", height: targetHeight }}
      />
    </span>
  )
}