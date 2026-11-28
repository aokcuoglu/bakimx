// Saf (veritabanı bağımsız): scripts/ de içe aktarabilsin diye account.ts'ten ayrıldı.

/** Hesap atölyesi: en eski `createdAt`; eşitlikte en küçük id. */
export function pickAccountWorkshopId(rows: readonly { id: string; createdAt: Date }[]): string {
  if (rows.length === 0) throw new Error("Hesap atölyesi seçilemedi: atölye yok.")
  let best = rows[0]
  for (const r of rows) {
    const dt = r.createdAt.getTime() - best.createdAt.getTime()
    if (dt < 0 || (dt === 0 && r.id < best.id)) best = r
  }
  return best.id
}
