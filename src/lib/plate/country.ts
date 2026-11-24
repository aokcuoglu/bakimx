import { normalizePlate } from "@/lib/format"

/**
 * Plakanın ülkesini, SAKLANAN sıkıştırılmış metinden (`normalizePlate`: boşluk ve
 * tire yok) tahmin eder (#818). Ülke veritabanında tutulmaz; varsayılan ve yedek
 * TR'dir. Tasarım: docs/superpowers/specs/2026-11-24-plate-component-design.md
 *
 * Sıra bilinçli — ilk eşleşen kazanır:
 *   1. Belçika (`[12]` + 3 harf + 3 rakam). Sıfırı düşmüş bir Adana/Adıyaman
 *      plakasının (`1ABC123`) "B" görünmesi kabul edilen risktir.
 *   2. TR geniş tutulur: 1–2 rakamla başlayan her harf+rakam dizisi TR'dir —
 *      başındaki sıfırı düşmüş (`6BD123` = Ankara) ya da aralık dışı il kodu
 *      (`91BD12`) dahil. Yanlış yazılmış bir TR plakası yabancı rozetle görünmesin
 *      (#818 incelemesi: bunlar önce Hollanda'ya düşüyordu). Harf kümesi OCR'ın
 *      sakladığı Türkçe harfleri de kapsar (`lib/ocr/plate.ts`).
 *   3. Kendine özgü dizilişi olanlar (BG, UK, NL).
 *   4. En geniş yabancı desen en son: Almanya (harf + rakam). İsveç, Polonya,
 *      İsviçre plakaları da buna uyar ve "D" görünebilir — sıklık düşük, kabul.
 * Fransa/İtalya ve Avusturya başka ülkelerle aynı dizilişi paylaştığı için hiç
 * tanınmaz; onlar ve tanınmayan her şey TR bandıyla, olduğu gibi gösterilir.
 */

export type PlateCountry = "TR" | "D" | "NL" | "B" | "BG" | "UK"

export type PlateInfo = { country: PlateCountry; text: string }

export const PLATE_COUNTRY_NAMES: Record<PlateCountry, string> = {
  TR: "Türkiye",
  D: "Almanya",
  NL: "Hollanda",
  B: "Belçika",
  BG: "Bulgaristan",
  UK: "İngiltere",
}

/** Bir desen ve eşleşen grupları gösterim metnine çeviren biçimleyici. */
type Rule = { country: PlateCountry; re: RegExp; format: (g: string[]) => string }

const spaced = (g: string[]) => g.join(" ")
const dashed = (g: string[]) => g.join("-")

/** Bulgaristan il kodları (Latin yazımıyla). */
const BG_REGIONS = "A|B|BH|BP|BT|C|CA|CB|CC|CH|CM|CO|CT|E|EB|EH|H|K|KH|M|OB|P|PA|PB|PK|PP|T|TX|X|Y"
/** Bulgar plakasının son iki harfi yalnız Kiril ile ortak Latin harflerdir. */
const BG_SERIES = "[ABEHKMOPCTXY]"

/** Hollanda plakaları (sidecode 4'ten beri) yalnız bu ünsüzleri kullanır. */
const L = "[BDFGHJKLNPRSTVXZ]"

/**
 * Hollanda sidecode'ları (`9` rakam, `X` harf). Bilerek olmayanlar:
 *   - 1 (`XX-99-99`) ve 5 (`XX-XX-99`): tümü harf→rakam, Almanya deseniyle aynı.
 *   - 3 (`99-XX-99`), 7 (`99-XXX-9`), 8 (`9-XXX-99`), 13 (`9-XX-999`): 1–2 rakam
 *     + harf + rakam — TR kuralı bunları önce alır (sıfırı düşmüş TR plakası).
 *     2008–2015 Hollanda plakaları bu yüzden TR görünür; yön bilinçli.
 */
const NL_SIDECODES = [
  ["\\d{2}", "\\d{2}", `${L}{2}`], //  2: 99-99-XX
  [`${L}{2}`, "\\d{2}", `${L}{2}`], //  4: XX-99-XX
  ["\\d{2}", `${L}{2}`, `${L}{2}`], //  6: 99-XX-XX
  [`${L}{2}`, "\\d{3}", L], //  9: XX-999-X
  [L, "\\d{3}", `${L}{2}`], // 10: X-999-XX
  [`${L}{3}`, "\\d{2}", L], // 11: XXX-99-X
  [L, "\\d{2}", `${L}{3}`], // 12: X-99-XXX
  ["\\d{3}", `${L}{2}`, "\\d"], // 14: 999-XX-9
]

const RULES: Rule[] = [
  { country: "B", re: /^([12])([A-Z]{3})(\d{3})$/, format: dashed },
  { country: "TR", re: /^(\d{1,2})([A-ZÇĞİÖŞÜ]{1,3})(\d{1,5})$/, format: spaced },
  { country: "BG", re: new RegExp(`^(${BG_REGIONS})(\\d{4})(${BG_SERIES}{2})$`), format: spaced },
  { country: "UK", re: /^([A-Z]{2}\d{2})([A-Z]{3})$/, format: spaced },
  ...NL_SIDECODES.map(
    (parts): Rule => ({ country: "NL", re: new RegExp(`^${parts.map((p) => `(${p})`).join("")}$`), format: dashed })
  ),
  // Almanya: en fazla 8 harf+rakam; sonda isteğe bağlı E (elektrikli) / H (klasik).
  { country: "D", re: /^(?=[A-ZÖÜ\d]{3,8}[EH]?$)([A-ZÖÜ]{2,5})(\d{1,4}[EH]?)$/, format: spaced },
]

export function detectPlate(plate: string): PlateInfo {
  const compact = normalizePlate(plate)
  for (const rule of RULES) {
    const match = compact.match(rule.re)
    if (match) return { country: rule.country, text: rule.format(match.slice(1)) }
  }
  return { country: "TR", text: plate.trim().toUpperCase() }
}
