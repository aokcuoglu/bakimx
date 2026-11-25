import type { LucideIcon } from "lucide-react"
import { BarChart3, Plus, Wallet } from "lucide-react"
import type { UserRole } from "@prisma/client"
import { newIntakeHref } from "@/lib/intake/entry-links"
import type { GatedFeature } from "@/lib/plan"
import { actorCan, type Permission } from "@/lib/roles"
import { NAV_GROUPS } from "./app-nav"

export type PageAction = {
  label: string
  href: string
  icon: LucideIcon
  primary?: boolean
  feature?: GatedFeature
  permission?: Permission
  /** Ürün turu çapası (data-tour). */
  tourId?: string
}

export type PageHeaderConfig = {
  /** Yoksa menü etiketi. */
  title?: string
  /** Sabit açıklama satırı (yükleme ekranında da görünür). */
  description?: string
  /** Sayfa `subtitle` verir; yükleme ekranı satırın yerini boş ayırır. */
  dynamicSubtitle?: boolean
  actions?: readonly PageAction[]
  /** Başlık kökünün data-tour değeri. */
  tourId?: string
}

export type Crumb = { label: string; href?: string }

export type PageHeaderActor = { role: UserRole; teamPermissions?: readonly string[] | null }

export type ResolvedPageHeader = {
  /** Son halka = bu sayfa, href'siz. */
  crumbs: Crumb[]
  title: string
  description?: string
  dynamicSubtitle: boolean
  primaryAction?: PageAction
  secondaryActions: PageAction[]
  tourId?: string
}

/** Kabul, açıldığı sayfaya döner (#842): `back` geri bağlantısını belirler. */
const newIntakeFrom = (back: string): PageAction => ({
  label: "Yeni Araç Kabul",
  href: newIntakeHref({ back }),
  icon: Plus,
  primary: true,
  permission: "records.create",
})

const newPayment: PageAction = {
  label: "Yeni Tahsilat",
  href: "/cashbox/payments/new",
  icon: Plus,
  primary: true,
  permission: "cashbox.manage",
}

export const PAGE_HEADERS: Readonly<Record<string, PageHeaderConfig>> = {
  "/dashboard": {
    dynamicSubtitle: true,
    tourId: "welcome-banner",
    actions: [{ ...newIntakeFrom("/dashboard"), tourId: "welcome-cta" }],
  },
  "/orders": { actions: [newIntakeFrom("/orders")] },
  "/customers": {
    dynamicSubtitle: true,
    actions: [
      { label: "Yeni Müşteri", href: "/customers/new", icon: Plus, primary: true, permission: "records.create" },
      { label: "Bakiye Özeti", href: "/customers/balances", icon: Wallet },
    ],
  },
  "/vehicles": {
    dynamicSubtitle: true,
    actions: [{ label: "Yeni Araç", href: "/vehicles/new", icon: Plus, primary: true, permission: "records.create" }],
  },
  "/quotes": {
    dynamicSubtitle: true,
    actions: [{ label: "Yeni Teklif", href: "/quotes/new", icon: Plus, primary: true, permission: "records.create" }],
  },
  "/appointments": {
    description: "Servis randevularını planlayın ve yönetin",
    actions: [{ label: "Yeni Randevu", href: "/appointments/new", icon: Plus, primary: true, permission: "records.create" }],
  },
  "/calendar": { description: "Randevular, teslimatlar ve bakım hatırlatmaları" },
  "/reminders": {
    actions: [{ label: "Yeni Hatırlatma", href: "/reminders/new", icon: Plus, primary: true, permission: "records.create" }],
  },
  "/smart-capture/registration": {
    description: "Araç ruhsat fotoğrafını yükleyin veya çekin, sistem otomatik okusun",
  },
  "/parts": {},
  "/purchases": { description: "Teknisyenlerin araç kabulüne dışarıdan aldığı parçalar" },
  "/bakimx-orders": { description: "BakımX kataloğundan istediğiniz ürünler ve talebin durumu" },
  "/suppliers": {
    actions: [{ label: "Yeni Tedarikçi", href: "/suppliers/new", icon: Plus, primary: true, permission: "catalog.manage" }],
  },
  "/cashbox": {
    description: "Tahsilat ve alacak takibi",
    actions: [newPayment, { label: "Yaşlandırma", href: "/cashbox/aging", icon: BarChart3 }],
  },
  "/cashbox/payments": { dynamicSubtitle: true, actions: [newPayment] },
  "/cashbox/aging": {
    title: "Yaşlandırma Raporu",
    description: "Müşteri alacaklarının vade gruplarına göre dağılımı",
  },
  "/analytics": {
    description: "Atölyenizin operasyonel sağlığını ve performans metriklerini izleyin.",
  },
  "/reports": {},
  "/communications": {
    description: "Müşterilerinize ve hesabınıza gönderilen SMS, WhatsApp ve e-posta kayıtları",
  },
}

export function hasPageHeader(pathname: string): boolean {
  return Object.hasOwn(PAGE_HEADERS, pathname)
}

export function resolvePageHeader(
  pathname: string,
  ctx: { enabledFeatures: readonly GatedFeature[]; actor: PageHeaderActor | null },
): ResolvedPageHeader | null {
  if (!hasPageHeader(pathname)) return null
  const config = PAGE_HEADERS[pathname]

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const child = item.href === pathname ? undefined : item.children?.find((c) => c.href === pathname)
      if (item.href !== pathname && !child) continue
      const entry = child ?? item
      const title = config.title ?? entry.label
      const crumbs: Crumb[] = child
        ? [{ label: group.label }, { label: item.label, href: item.href }, { label: title }]
        : [{ label: group.label }, { label: title }]
      const routeFeature = child?.feature ?? item.feature
      const featureOpen = !routeFeature || ctx.enabledFeatures.includes(routeFeature)
      const actions = featureOpen
        ? (config.actions ?? []).filter(
            (a) =>
              (!a.feature || ctx.enabledFeatures.includes(a.feature)) &&
              (!a.permission || (ctx.actor !== null && actorCan(ctx.actor, a.permission))),
          )
        : []
      const primaryAction = actions.find((a) => a.primary)
      return {
        crumbs,
        title,
        description: config.description,
        dynamicSubtitle: config.dynamicSubtitle ?? false,
        primaryAction,
        secondaryActions: actions.filter((a) => a !== primaryAction),
        tourId: config.tourId,
      }
    }
  }
  return null
}
