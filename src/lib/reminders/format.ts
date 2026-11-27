export function formatReminderStatus(status: string): string {
  const labels: Record<string, string> = {
    upcoming: "Yaklaşan",
    due_soon: "Yaklaşıyor",
    overdue: "Gecikmiş",
    completed: "Tamamlandı",
    postponed: "Ertelendi",
    cancelled: "İptal",
  }
  return labels[status] || status
}

export function formatReminderType(type: string): string {
  const labels: Record<string, string> = {
    periodic_maintenance: "Periyodik Bakım",
    oil_change: "Yağ Bakımı",
    inspection: "Muayene",
    tire_change: "Lastik Değişimi",
    brake_check: "Fren Kontrolü",
    battery_check: "Akü Kontrolü",
    insurance: "Sigorta",
    other: "Diğer",
  }
  return labels[type] || type
}

export function formatChannel(channel: string): string {
  const labels: Record<string, string> = {
    none: "Yok",
    sms: "SMS",
    whatsapp: "WhatsApp",
    phone: "Telefon",
    email: "E-posta",
  }
  return labels[channel] || channel
}

export function kmUntil(dueMileage: number, currentMileage?: number | null): number | null {
  if (currentMileage == null) return null
  return Math.max(0, dueMileage - currentMileage)
}
