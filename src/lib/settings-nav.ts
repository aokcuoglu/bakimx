import type { GatedFeature } from "@/lib/plan"
import type { LucideIcon } from "lucide-react"
import type { Crumb, LinkCrumb } from "@/lib/navigation/page-headers"
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
  matchPrefix?: string
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
  { href: "/settings/referrals", label: "Referanslar", icon: UserRoundPlus, manageOnly: true },
]

/** Workspace settings — hidden from technician-restricted roles in the shell. */
export const WORKSPACE_SETTINGS_ITEMS: SettingsNavItem[] = [
  { href: "/settings/general", label: "Genel", icon: Building2 },
  { href: "/settings/branding", label: "Marka", icon: Palette },
  { href: "/settings/communication", label: "İletişim", icon: MessageSquare, feature: "communications" },
  { href: "/settings/working-hours", label: "Çalışma saatleri", icon: Clock },
  { href: "/settings/appointment-rules", label: "Randevu", icon: CalendarClock, feature: "appointments" },
  { href: "/settings/pdf-templates", label: "PDF", icon: FileText },
  { href: "/settings/members-and-teams/members", matchPrefix: "/settings/members-and-teams", label: "Üyeler ve ekipler", icon: Users, feature: "team" },
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
  team: "/settings/members-and-teams/members",
  security: "/settings/security",
}

export function isSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/")
}

export function matchesSettingsNavItem(item: SettingsNavItem, pathname: string): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`) ||
    Boolean(item.matchPrefix && (pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`)))
}

/** Paths technicians may open under /settings (deny-by-default elsewhere). */
export const TECHNICIAN_SETTINGS_ALLOWED_PREFIXES = ["/settings/account", "/settings/profile"] as const

export function isTechnicianAllowedSettingsPath(pathname: string): boolean {
  return TECHNICIAN_SETTINGS_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

type SettingsSubPage = {
  prefix: string
  parent: LinkCrumb
  /** Yoksa sayfa bir kayıttır (ekip): yaprak `recordTitle` ile gelir. */
  label?: string
}

/** Menüde olmayan Ayarlar alt sayfaları; üst halka menü öğesidir. */
const SETTINGS_SUBPAGES: SettingsSubPage[] = [
  { prefix: "/settings/billing/record-usage", label: "Kullanımlar", parent: { label: "Faturalandırma", href: "/settings/billing" } },
  { prefix: "/settings/billing/automation-credit-usage", label: "Krediler", parent: { label: "Faturalandırma", href: "/settings/billing" } },
  { prefix: "/settings/members-and-teams/teams/", parent: { label: "Üyeler ve ekipler", href: "/settings/members-and-teams/teams" } },
]

/**
 * Ayarlar sayfa yolu (#856): `Ayarlar › <grup> › <sayfa>`. Grup ve sayfa adı
 * `SETTINGS_NAV_GROUPS`tan türetilir. `/settings` bir hub değildir (yönlendirir),
 * bu yüzden "Ayarlar" ve grup halkaları bağlantısızdır. Bilinmeyen yol → boş zincir.
 */
export function buildSettingsTrail(
  pathname: string,
  opts: { recordTitle?: string } = {},
): { crumbs: Crumb[]; back: LinkCrumb | null } {
  const sub = SETTINGS_SUBPAGES.find((s) => pathname === s.prefix || pathname.startsWith(s.prefix.endsWith("/") ? s.prefix : `${s.prefix}/`))
  for (const group of SETTINGS_NAV_GROUPS) {
    const item = group.items.find((candidate) => matchesSettingsNavItem(candidate, pathname))
    if (!item) continue
    const head: Crumb[] = [{ label: "Ayarlar" }, { label: group.label }]
    if (!sub) return { crumbs: [...head, { label: item.label }], back: null }
    const tail: Crumb[] = sub.label ? [{ label: sub.label }] : opts.recordTitle ? [{ label: opts.recordTitle }] : []
    // Üst halka bir menü öğesidir: ekip kaydında bir üst "Üyeler ve ekipler" tek halkadır.
    const parentIsItem = item.label === sub.parent.label
    const middle: Crumb[] = parentIsItem ? [sub.parent] : [{ label: item.label, href: item.href }, sub.parent]
    const crumbs = [...head, ...middle, ...tail]
    // Yaprak yokken (kayıt adı gelmedi) zincir üst bağlantıda biter.
    return { crumbs, back: sub.parent }
  }
  return { crumbs: [], back: null }
}
