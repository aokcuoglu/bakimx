export const CREATE_OPTIONS = [
  {
    id: "order",
    title: "İş Emri",
    description: "Araç kabulünü başlat ve yapılacak işleri kaydet.",
    href: "/orders/new",
  },
  {
    id: "quote",
    title: "Teklif",
    description: "Müşteriye fiyat ve iş kapsamı hazırla.",
    href: "/quotes/new",
  },
  {
    id: "appointment",
    title: "Randevu",
    description: "Servis için tarih ve saat planla.",
    href: "/appointments/new",
  },
  {
    id: "reminder",
    title: "Hatırlatma",
    description: "Yaklaşan bakım için takip kaydı oluştur.",
    href: "/reminders/new",
  },
] as const

