import { Barlow_Semi_Condensed } from "next/font/google"

/**
 * Genel Bakış KPI rakamlarının display fontu (#815).
 *
 * Uygulamanın geri kalanı sistem fontunda (bkz. docs/design-pattern-esantral.md
 * §Tipografi); bu, yalnız büyük KPI rakamı için bilinçli bir istisna. Barlow
 * otoyol tabelalarından türemiş dar bir grotesk: servis temasına uyar ve dar
 * olduğu için büyük boyda bile kartta yer kaplamaz. Yalnız 700 ağırlığı ve
 * latin alt kümesi yüklenir (etiketler sistem fontunda kalır).
 *
 * `variable` olarak verilir: CSS `var(--font-kpi, var(--font-sans))` ile
 * okur, değişken tanımlı değilse sistem fontuna düşer.
 */
export const kpiNumeralFont = Barlow_Semi_Condensed({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-kpi",
  display: "swap",
})
