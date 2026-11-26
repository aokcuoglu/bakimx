/** Araç başka müşteriye kayıtlıyken form müşteriyi sahibine çevirdiğinde gösterilen bilgi (#915). */
export function ownerSwitchMessage(ownerName?: string): string {
  const name = ownerName?.trim()
  return name
    ? `Bu araç ${name} adına kayıtlı; müşteri güncellendi.`
    : "Bu araç başka bir müşteriye kayıtlı; müşteri güncellendi."
}
