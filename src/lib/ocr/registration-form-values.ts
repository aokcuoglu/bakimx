/**
 * Ruhsat OCR yanıtı (/api/smart-capture/ocr → `result`) ile araç formunun
 * beklediği değerler arasındaki çeviri. Hem `RuhsattanOku` (yükleme alanı) hem
 * tam ekran `RegistrationCameraScanner` aynı çözümlemeyi kullanır.
 */

// Fields the ruhsat OCR can return. Matches /api/smart-capture/ocr → RegistrationOcrResult.
// Claude Vision OCR now also reads the technical fields (D.3 / P.3 / P.1 / P.2 / Z.2).
export type RuhsattanOkuValues = {
  plate: string
  brand: string
  model: string
  vehicleType: string
  modelYear: string
  vin: string
  engineNo: string
  registrationDate: string
  commercialName: string
  fuelType: string
  engineDisplacement: string
  enginePower: string
  inspectionValidUntil: string
}

export type RuhsattanOkuResult = {
  values: RuhsattanOkuValues
  confidence: Record<keyof RuhsattanOkuValues, number | undefined>
  /**
   * Ruhsat sahibi. Kurumsal (yalnız C.1.1 Ticari Ünvan dolu, C.1.2 ADI boş) ise
   * `isCorporate` true olur ve `companyName` dolar; bireysel ise firstName/lastName.
   * `label` her iki durumda gösterime uygun tam ad. Hepsi ipucu, hazır müşteri değil.
   */
  owner: {
    isCorporate: boolean
    firstName: string
    lastName: string
    companyName: string
    label: string
  }
}

/** /api/smart-capture/ocr yanıtındaki `result`: alan adı → okunan değer + güven. */
export type RegistrationOcrFields = Record<string, { value?: string; confidence?: number } | undefined>

/**
 * OCR yanıtını formun beklediği şekle çevirir. Hem bu bileşen hem tam ekran
 * ruhsat kamerası (`RegistrationCameraScanner`) aynı çözümlemeyi kullanır.
 */
export function parseRegistrationOcr(r: RegistrationOcrFields): RuhsattanOkuResult {
  const v = (k: string) => (r[k]?.value || "").trim()
  const values: RuhsattanOkuValues = {
    plate: v("plate").toUpperCase(),
    brand: v("brand"),
    model: v("model"),
    vehicleType: v("vehicleType"),
    modelYear: v("modelYear"),
    vin: v("vin").toUpperCase(),
    engineNo: v("engineNo").toUpperCase(),
    registrationDate: v("registrationDate"),
    commercialName: v("commercialName"),
    fuelType: v("fuelType"),
    engineDisplacement: v("engineDisplacement"),
    enginePower: v("enginePower"),
    inspectionValidUntil: v("inspectionValidUntil"),
  }
  const confidence = Object.fromEntries(
    (Object.keys(values) as (keyof RuhsattanOkuValues)[]).map((k) => [k, r[k]?.confidence]),
  ) as Record<keyof RuhsattanOkuValues, number | undefined>
  // C.1.2 ADI + C.1.1 SOYADI/TİCARİ ÜNVANI. ADI boşsa sahip kurumsaldır → ünvanı şirket adı say.
  const adi = v("ownerName")
  const soyadi = v("ownerSurname")
  const isCorporate = !adi && !!soyadi
  const owner = {
    isCorporate,
    firstName: isCorporate ? "" : adi,
    lastName: isCorporate ? "" : soyadi,
    companyName: isCorporate ? soyadi : "",
    label: isCorporate ? soyadi : [adi, soyadi].filter(Boolean).join(" ").trim(),
  }
  return { values, confidence, owner }
}

/** Okumada en az bir araç alanı ya da sahip adı çıktı mı? Boş okuma = ruhsat değil / bulanık. */
export function hasRegistrationData({ values, owner }: RuhsattanOkuResult): boolean {
  return Object.values(values).some(Boolean) || !!owner.label
}
