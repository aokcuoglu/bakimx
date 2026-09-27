import type { GatedFeature } from "@/lib/plan"
import type { LucideIcon } from "lucide-react"
import {
  Bell,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  CalendarClock,
  MessageSquare,
  Palette,
  Shield,
  UserCircle,
  Users,
  Package,
  UserRoundPlus,
} from "lucide-react"

export type SettingsNavItem = {
  href: string
  label: string
  icon: LucideIcon
  feature?: GatedFeature
  /** When true, only owners/managers see the item in nav (content still gated server-side). */
  manageOnly?: boolean
}

export type SettingsNavGroup = {
  label: string
  items: SettingsNavItem[]
}

/** Account (personal) settings — available to technicians too for Profile. */
export const ACCOUNT_SETTINGS_ITEMS: SettingsNavItem[] = [
  { href: "/settings/account", label: "Profil", icon: UserCircle },
  { href: "/settings/referrals", label: "Referanslar", icon: UserRoundPlus },
]

/** Workspace settings — hidden from technician-restricted roles in the shell. */
export const WORKSPACE_SETTINGS_ITEMS: SettingsNavItem[] = [
  { href: "/settings/general", label: "Genel", icon: Building2 },
  { href: "/settings/branding", label: "Marka", icon: Palette },
  { href: "/settings/communication", label: "İletişim", icon: MessageSquare, feature: "communications" },
  { href: "/settings/working-hours", label: "Çalışma saatleri", icon: Clock },
  { href: "/settings/appointment-rules", label: "Randevu", icon: CalendarClock, feature: "appointments" },
  { href: "/settings/pdf-templates", label: "PDF", icon: FileText },
  { href: "/settings/team", label: "Ekip", icon: Users, feature: "team" },
  { href: "/settings/plans", label: "Paketler", icon: Package },
  { href: "/settings/billing", label: "Faturalandırma", icon: CreditCard },
  { href: "/settings/notifications", label: "Bildirimler", icon: Bell, feature: "automatedReminders" },
  { href: "/settings/calendar", label: "Takvim", icon: Calendar, feature: "appointments" },
  { href: "/settings/security", label: "Güvenlik", icon: Shield },
]

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  { label: "Kişisel", items: ACCOUNT_SETTINGS_ITEMS },
  { label: "Çalışma alanı", items: WORKSPACE_SETTINGS_ITEMS },
]

/** Legacy `?tab=` values → path segments under /settings. */
export const SETTINGS_TAB_REDIRECTS: Record<string, string> = {
  profile: "/settings/general",
  branding: "/settings/branding",
  communication: "/settings/communication",
  "working-hours": "/settings/working-hours",
  "appointment-rules": "/settings/appointment-rules",
  "pdf-templates": "/settings/pdf-templates",
  team: "/settings/team",
  security: "/settings/security",
}

export function isSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/")
}

/** Paths technicians may open under /settings (deny-by-default elsewhere). */
export const TECHNICIAN_SETTINGS_ALLOWED_PREFIXES = ["/settings/account", "/settings/profile"] as const

export function isTechnicianAllowedSettingsPath(pathname: string): boolean {
  return TECHNICIAN_SETTINGS_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
