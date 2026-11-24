import { detectPlate, PLATE_COUNTRY_NAMES } from "@/lib/plate/country"
import styles from "./plate.module.css"

export type PlateSize = "sm" | "md" | "lg"

/**
 * Çerçeveli plaka rozeti — uygulamada rozet olarak plaka gösteren her yer bunu
 * kullanır (#818). Ülke çağıran taraftan gelmez; saklanan plakadan tahmin edilir
 * (`detectPlate`). TR plakası yazısız mavi bantla çizilir; yabancı plakanın
 * bandında ülke kodu yazar ve ekran okuyucu ülke adını okur.
 *
 * `data-plate-country` stilin ve dışarıdaki hizalama seçicisinin
 * (`surface.module.css` → `.rowStart`) bağlandığı niteliktir; kaldırma.
 */
export function Plate({ plate, size = "md" }: { plate: string; size?: PlateSize }) {
  const { country, text } = detectPlate(plate)
  const foreign = country !== "TR"

  return (
    <span className={styles.plate} data-plate-country={country} data-size={size === "md" ? undefined : size}>
      <span className={styles.band} aria-hidden="true">
        {foreign ? country : null}
      </span>
      {foreign && <span className="sr-only">{PLATE_COUNTRY_NAMES[country]} plakası </span>}
      {text}
    </span>
  )
}
