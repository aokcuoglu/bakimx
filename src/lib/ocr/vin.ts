import { isValidVin, normalizeVin } from "@/lib/vin/types"

/**
 * ISO 3779 VIN alfabesinde I, O ve Q YOKTUR — bu üç harf 1/0 rakamlarıyla karışmasın
 * diye standart dışı bırakılmıştır. Dolayısıyla OCR bir VIN içinde bunları okuduysa
 * kesinlikle yanlış okumuştur ve düzeltmesi belirsiz değil, deterministiktir.
 */
const GLYPH_FIXES: Record<string, string> = { I: "1", O: "0", Q: "0" }

/** Düzeltilmiş hâli geçerli bir VIN ise onu, değilse null döner. */
function asVin(candidate: string): string | null {
  const fixed = candidate.replace(/[IOQ]/g, (c) => GLYPH_FIXES[c])
  return isValidVin(fixed) ? normalizeVin(fixed) : null
}

/**
 * OCR ham metninden 17 haneli şase numarasını (VIN) ayıklar; bulamazsa null.
 *
 * Cam altındaki şase plakasında VIN çoğunlukla tek başına durur, ama OCR onu
 * boşluk/tire ile bölebilir ya da yanına "VIN"/"ŞASE NO" gibi bir etiket koyabilir:
 *   1) Tüm alfanümerikler birleştiğinde tam 17 hane ediyorsa → o (bölünmüş VIN).
 *   2) Tam 17 haneli bir jeton (token) varsa → ilki (etiketli satır).
 *
 * 17'den uzun bitişik dizilerde kayan pencere ARANMAZ: VIN alfabesi neredeyse tüm
 * alfanümerikleri kapsadığından böyle bir dizide her pencere "geçerli" görünür ve
 * hangisinin doğru olduğu bilinemez. Yanlış VIN sessizce yanlış araca/parça
 * kataloğuna bağlanır; okunamadı deyip kullanıcıya tekrar çektirmek doğrudur.
 */
export function parseVinFromText(rawText: string | null | undefined): string | null {
  if (!rawText) return null

  const tokens = rawText.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)
  if (tokens.length === 0) return null

  const joined = tokens.join("")
  if (joined.length === 17) {
    const vin = asVin(joined)
    if (vin) return vin
  }

  for (const token of tokens) {
    if (token.length !== 17) continue
    const vin = asVin(token)
    if (vin) return vin
  }

  return null
}
