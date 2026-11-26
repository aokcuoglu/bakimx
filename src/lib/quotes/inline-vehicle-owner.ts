/**
 * Satır içi araç diyaloğu girilen plaka zaten kayıtlıysa mevcut aracı gerçek
 * sahibiyle geri verir. Sahip seçili müşteriden farklıysa teklif formu müşteriyi
 * aracın sahibine çevirir (randevu formuyla aynı davranış, #915); sunucu
 * "araç müşteriyle eşleşmeli" kuralını zaten uygular.
 */
export function resolveInlineVehicleOwner<V extends { id: string }>(input: {
  selectedCustomerId: string
  resultCustomerId?: string
  resultCustomerName?: string
  current: V[]
  created: V
}): { switchCustomer: { id: string; label: string } | null; vehicles: V[] } {
  const { selectedCustomerId, resultCustomerId, resultCustomerName, current, created } = input
  if (resultCustomerId && resultCustomerId !== selectedCustomerId) {
    return {
      switchCustomer: { id: resultCustomerId, label: resultCustomerName || "Seçili müşteri" },
      vehicles: [created],
    }
  }
  return {
    switchCustomer: null,
    vehicles: current.some((v) => v.id === created.id) ? current : [created, ...current],
  }
}
