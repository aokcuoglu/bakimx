/**
 * Parça talebi KARAR kuralı.
 *
 * Teknisyenin sahadan gönderdiği her talep iki uçtan biriyle kapanmalıdır:
 * ofis ya kaleme ekler (`convertedAt`) ya da reddeder (`status = cancelled`).
 * İkisi de olmamışsa talep hâlâ karar bekliyordur.
 *
 * NEDEN KAPI: teslim/iptal sonrası iş emri kompozisyonu kilitlenir
 * (bkz. `isOrderLocked`) — karara bağlanmamış talep o anda kalıcı olarak askıda
 * kalır. Usta parçayı takmış ama kalem açılmamışsa müşteriye eksik fatura
 * kesilir; parça hiç alınmayacaksa da bu ekranda görünmeye devam eder ve bir
 * sonraki iş emrinde kimse ne olduğunu bilemez. Bu yüzden karar bekleyen talep
 * varken emir "Teslime Hazır"a ve "Teslim Edildi"ye geçemez.
 *
 * Kural sunucu ve arayüzde ayrı ayrı yazılmasın diye tek kaynak burasıdır
 * (fiyat kapısının `pricing-guard.ts` ile aynı deseni).
 */

/** Karar durumu okunabilen en dar talep şekli — Prisma satırı da DTO da uyar. */
export type DecidablePartsRequest = {
  partName: string
  status: string
  convertedAt: Date | string | null
  cancelledAt?: Date | string | null
}

/** Talebe ofis kararı verilmiş mi: kaleme eklendi VEYA iptal edildi. */
export function isPartsRequestDecided(request: DecidablePartsRequest): boolean {
  return request.convertedAt != null || request.status === "cancelled"
}

/** Karar bekleyen talepler, listedeki sıralarını koruyarak. */
export function findUndecidedPartsRequests<T extends DecidablePartsRequest>(
  requests: readonly T[],
): T[] {
  return requests.filter((r) => !isPartsRequestDecided(r))
}

/**
 * İş emri bu duruma geçerken parça kararları tamamlanmış olmalı mı?
 *
 * `cancelled` KAPSAM DIŞI: emir iptal edilirken açık talepler aksiyonun kendisi
 * tarafından toplu iptal edilir (bkz. updateOrderStatusAction) — kullanıcıyı
 * önce tek tek karar vermeye zorlamak iptali kilitlerdi.
 */
export function orderStatusNeedsPartsDecision(status: string): boolean {
  return status === "ready_for_delivery" || status === "delivered"
}

/** İlk iki ismi yazıp kalanı sayan kullanıcıya dönük hata metni. */
export function undecidedPartsRequestsMessage(requests: readonly DecidablePartsRequest[]): string {
  const names = requests.map((r) => r.partName)
  const shown = names.slice(0, 2).join(", ")
  const rest = names.length - 2
  const list = rest > 0 ? `${shown} (+${rest})` : shown
  // "parça/işçilik": aynı kapı BAK-105'ten beri dış işçilik taleplerini de
  // kapsıyor; metin tipi ayırt etmez, isim listesi zaten hangisi olduğunu söyler.
  return `Karar bekleyen parça/işçilik talebi var: ${list}. Her talebi ya kaleme ekleyin ya da iptal edin.`
}
