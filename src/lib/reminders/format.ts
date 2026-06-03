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

export function daysUntil(date: string | Date): number | null {
  const d = typeof date === "string" ? new Date(date) : date
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  return diff
}

export function kmUntil(dueMileage: number, currentMileage?: number | null): number | null {
  if (currentMileage == null) return null
  return Math.max(0, dueMileage - currentMileage)
}
