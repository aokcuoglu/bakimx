/**
 * Teknisyen paneli ↔ iş emri karşılıklı geçiş linkleri (BAK-23).
 *
 * Aynı iş emrinin iki görünümü var: teknisyen görünümü (kontrol listesi,
 * işçilik, parça talebi) ve iş emri görünümü (fiyat, tahsilat, kanıt, geçmiş).
 * İkisi arasında link yoktu; kullanıcı her seferinde kenar çubuğundan diğer
 * listeye gidip aynı işi yeniden aramak zorunda kalıyordu.
 *
 * `/technician/orders/[id]` sorgusu `assignedTechnicianId: { not: null }`
 * şartı taşır — atanmamış iş emrinde sayfa `notFound()` döner. Bu yüzden ters
 * yöndeki link yalnız atama varken gösterilmelidir; kural burada tek yerde
 * durur ki çağıran her ekran aynı kararı versin.
 */

export function workOrderPath(orderId: string): string {
  return `/orders/${orderId}`
}

export function technicianOrderPath(orderId: string): string {
  return `/technician/orders/${orderId}`
}

export function canOpenTechnicianView(assignedTechnicianId: string | null | undefined): boolean {
  return Boolean(assignedTechnicianId)
}
