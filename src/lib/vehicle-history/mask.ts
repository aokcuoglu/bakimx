/**
 * Servisler arası araç geçmişinde (BAK-77) KVKK maskeleme.
 *
 * Maskeleme, kaynak veriyi TAŞIMADAN kırpar: maskeli bir alanın ham hâli hiçbir
 * zaman istemciye gitmez, sunucuda burada kısaltılır. Amaç, aracın başka bir
 * serviste kaydı olduğunu göstermek ama kimliğini vermemek — kullanıcı ruhsatı
 * okutunca alanlar maskesiz döner.
 *
 * Tasarım kuralı: maskeli çıktı **sabit uzunlukta değildir ama uzunluk bilgisi
 * de vermez**. "A*** Y***" gibi bir çıktı ismin kaç harf olduğunu sızdırırdı;
 * bu yüzden her parça tek bir `***` ile temsil edilir.
 */

/** Tamamen gizlenen alanların yerine basılan işaret. */
export const MASK = "***"

function nonEmpty(v: string | null | undefined): string | null {
  const t = (v ?? "").trim()
  return t.length > 0 ? t : null
}

/**
 * Ad/unvan: her kelimenin YALNIZ ilk harfi kalır, kalanı tek `***` olur.
 * "Okan Türkyılmaz" → "O*** T***". Baş harf bırakılır çünkü servis görevlisi
 * müşterinin kendi söylediği adla eşleştirebilsin diye yeterli, tek başına
 * kimliklendirmeye yetmez.
 */
export function maskPersonName(value: string | null | undefined): string {
  const v = nonEmpty(value)
  if (!v) return MASK
  return v
    .split(/\s+/)
    .map((word) => `${[...word][0] ?? ""}${MASK}`)
    .join(" ")
}

/**
 * Telefon: son 2 rakam görünür, önü maskelenir. Müşteri numarasını söylediğinde
 * doğrulamaya yeter, numarayı aramaya yetmez.
 */
export function maskPhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "")
  if (digits.length < 4) return MASK
  return `${MASK} ${digits.slice(-2)}`
}

/** E-posta: yerel kısım ve alan adı ayrı ayrı gizlenir, TLD korunur. */
export function maskEmail(value: string | null | undefined): string | null {
  const v = nonEmpty(value)
  if (!v) return null
  const at = v.lastIndexOf("@")
  if (at <= 0) return MASK
  const domain = v.slice(at + 1)
  const dot = domain.lastIndexOf(".")
  const tld = dot > 0 ? domain.slice(dot) : ""
  return `${MASK}@${MASK}${tld}`
}

/**
 * Şase / motor numarası gibi teknik kimlikler: son 4 karakter görünür.
 * Ruhsattaki VIN ile eşleşme kontrolü yapılabilsin diye kuyruk bırakılır.
 */
export function maskSerial(value: string | null | undefined): string | null {
  const v = nonEmpty(value)
  if (!v) return null
  if (v.length <= 4) return MASK
  return `${MASK}${v.slice(-4)}`
}

/** Serbest metin (şikâyet, not, servis adı): tamamen gizlenir. */
export function maskFreeText(value: string | null | undefined): string | null {
  return nonEmpty(value) ? MASK : null
}
