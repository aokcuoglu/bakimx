/**
 * Teknisyen paneli ↔ iş emri karşılıklı geçiş linkleri (BAK-23).
 *
 * Aynı iş emrinin iki görünümü var: teknisyen görünümü (kontrol listesi,
 * işçilik, parça talebi) ve iş emri görünümü (fiyat, tahsilat, kanıt, geçmiş).
 * İkisi arasında link yoktu; kullanıcı her seferinde kenar çubuğundan diğer
 * listeye gidip aynı işi yeniden aramak zorunda kalıyordu.
 *
 * Teknisyen görünümü atölyedeki atanmamış iş emirlerinde de açılır
 * (BAK-157). Tenant sınırı rota sorgusundaki `workshopId` ile korunur.
 */

export function workOrderPath(orderId: string): string {
  return `/orders/${orderId}`
}

export function technicianOrderPath(orderId: string): string {
  return `/technician/orders/${orderId}`
}

export function canOpenTechnicianView(_assignedTechnicianId: string | null | undefined): boolean {
  return true
}
