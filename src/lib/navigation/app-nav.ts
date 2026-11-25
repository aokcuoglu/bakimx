import {
  LayoutDashboard,
  Car,
  Users,
  Wrench as WrenchIcon,
  FileText,
  CalendarClock,
  BellRing,
  Boxes,
  Truck,
  ShoppingCart,
  Wallet,
  BarChart3,
  ScanLine,
  HardHat,
  Activity,
  MessageSquare,
  Calendar,
  Receipt,
  PackageSearch,
} from "lucide-react"
import type { GatedFeature } from "@/lib/plan"

export type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  children?: NavItem[]
  feature?: GatedFeature
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Ana Panel",
    items: [{ href: "/dashboard", label: "Genel Bakış", icon: LayoutDashboard }],
  },
  {
    label: "Servis",
    items: [
      { href: "/orders", label: "Araç Kabulleri", icon: WrenchIcon },
      { href: "/technician", label: "Teknisyen Paneli", icon: HardHat, feature: "team" },
      { href: "/customers", label: "Müşteriler", icon: Users },
      { href: "/vehicles", label: "Araçlar", icon: Car },
      { href: "/quotes", label: "Teklifler", icon: FileText, feature: "quotes" },
      { href: "/appointments", label: "Randevular", icon: CalendarClock, feature: "appointments" },
      { href: "/calendar", label: "Takvim", icon: Calendar, feature: "appointments" },
      { href: "/reminders", label: "Bakım Hatırlatmaları", icon: BellRing, feature: "automatedReminders" },
      { href: "/smart-capture/registration", label: "Ruhsat Okuma", icon: ScanLine, feature: "ocrIntake" },
    ],
  },
  {
    label: "Depo & Finans",
    items: [
      { href: "/parts", label: "Stok / Parçalar", icon: Boxes, feature: "partsInventory" },
      { href: "/purchases", label: "Dış Alımlar", icon: ShoppingCart, feature: "procurement" },
      {
        href: "/bakimx-orders",
        label: "BakımX Siparişleri",
        icon: PackageSearch,
        feature: "procurement",
      },
      { href: "/suppliers", label: "Tedarikçiler", icon: Truck, feature: "procurement" },
      { href: "/cashbox", label: "Kasa", icon: Wallet, children: [
        { href: "/cashbox/payments", label: "Tahsilatlar", icon: Receipt },
        { href: "/cashbox/aging", label: "Yaşlandırma", icon: BarChart3 },
      ], feature: "cashbox" },
    ],
  },
  {
    label: "Analiz",
    items: [
      { href: "/analytics", label: "Operasyonel Analiz", icon: Activity, feature: "analytics" },
      { href: "/reports", label: "Raporlar", icon: BarChart3, feature: "reports" },
    ],
  },
  {
    label: "İletişim",
    items: [
      { href: "/communications", label: "İletişim Kayıtları", icon: MessageSquare, feature: "communications" },
    ],
  },
]
