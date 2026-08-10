/**
 * Araç formundaki müşteri seçim listesi.
 *
 * Liste sunucudan (atölyeye ait müşteriler) gelir; kullanıcı formu terk etmeden
 * yeni müşteri oluşturabildiği için oluşturulan kayıt istemci tarafında listeye
 * eklenir. Etiket üretimi tek yerde durur ki seçili değer ile listedeki satır
 * asla farklı görünmesin.
 */

export type CustomerLike = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string
  phone: string
}

export type CustomerOption = {
  id: string
  label: string
}

/** Görünen etiket: "AHMET YILMAZ — 0544 515 74 08". Telefon yoksa yalnız ad. */
export function customerOptionLabel(c: CustomerLike): string {
  const name =
    c.type === "corporate"
      ? (c.companyName || "").trim() || "Kurumsal Müşteri"
      : (c.fullName || "").trim() ||
        `${(c.firstName ?? "").trim()} ${(c.lastName ?? "").trim()}`.trim() ||
        "Müşteri"
  const phone = (c.phone || "").trim()
  return phone ? `${name} — ${phone}` : name
}

export function toCustomerOptions(customers: CustomerLike[]): CustomerOption[] {
  return customers.map((c) => ({ id: c.id, label: customerOptionLabel(c) }))
}

/** Yeni oluşturulan müşteriyi listenin başına ekler (zaten varsa liste değişmez). */
export function withCustomerOption(options: CustomerOption[], created: CustomerOption): CustomerOption[] {
  return options.some((o) => o.id === created.id) ? options : [created, ...options]
}

/** Seçili id'nin etiketi; liste dışı/boş değerde null döner. */
export function findCustomerOptionLabel(options: CustomerOption[], id: string | null): string | null {
  if (!id) return null
  return options.find((o) => o.id === id)?.label ?? null
}
