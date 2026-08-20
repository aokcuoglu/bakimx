import { SITE_URL } from "@/lib/seo"

export const LLMS_PUBLIC_PATHS = [
  ["Oto servis programı", "/oto-servis-programi"],
  ["Dijital araç kabul", "/dijital-arac-kabul"],
  ["İş emri programı", "/is-emri-programi"],
  ["Araç kabul formu rehberi", "/rehber/arac-kabul-formu"],
  ["Oto servis iş emri rehberi", "/rehber/oto-servis-is-emri-nasil-hazirlanir"],
  ["Defter, Excel ve oto servis programı karşılaştırması", "/karsilastir/defter-excel-oto-servis-programi"],
] as const

export function buildLlmsTxt(): string {
  const links = LLMS_PUBLIC_PATHS.map(
    ([title, path]) => `- [${title}](${new URL(path, SITE_URL).toString()})`,
  )

  return [
    "# BakimX",
    "",
    "> BakimX'in herkese açık, canonical ürün ve rehber sayfaları.",
    "",
    "## Sayfalar",
    "",
    ...links,
    "",
  ].join("\n")
}
