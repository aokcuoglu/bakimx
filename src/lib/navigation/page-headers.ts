import type { LucideIcon } from "lucide-react"
import { BarChart3, Plus, Wallet } from "lucide-react"
import type { UserRole } from "@prisma/client"
import { newIntakeHref } from "@/lib/intake/entry-links"
import type { GatedFeature } from "@/lib/plan"
import { actorCan, type Permission } from "@/lib/roles"
import { isRouteAllowedForTechnician, isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import { NAV_GROUPS, type NavGroup, type NavItem } from "./app-nav"

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
export type LinkCrumb = Crumb & { href: string }

/**
 * Menü dışı alt sayfa (#855). `parent` = menü yolu ya da başka bir alt sayfa
 * deseni. `title` yoksa detay sayfasıdır: başlığı ve son halkayı sayfa
 * `recordTitle` ile verir.
 */
export type SubPageHeaderConfig = {
  parent: string
  /** Sabit başlık; yoksa kayıt adı (`recordTitle`). */
  title?: string
  /** Son halka başlıktan farklıysa (ör. "Düzenle"). */
  crumb?: string
  /** Bu sayfa başka bir alt sayfanın üstüyse telefondaki geri etiketi (yükleme anında da bilinir). */
  backLabel?: string
  description?: string
  dynamicSubtitle?: boolean
}

export type PageHeaderActor = { role: UserRole; teamPermissions?: readonly string[] | null }

export type ResolvedPageHeader = {
  /**
   * Kök → bu sayfa. Son halka href'siz = bu sayfa. Kayıt adı henüz yokken
   * zincir bilinen son bağlantıda biter.
   */
  crumbs: Crumb[]
  title: string
  /** "record": başlık kayıt adıdır (tek satır, taşarsa üç nokta; boşken yer ayrılır). */
  titleMode?: "static" | "record"
  /** Telefonda breadcrumb yerine geri bağlantısı; menü sayfalarında null. */
  back?: LinkCrumb | null
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

/**
 * Servis alt sayfaları (#855). Anahtar Next klasör sözdizimindedir
 * (`src/app/(app)/<anahtar>/page.tsx`); `[id]` tek bir boş olmayan segmente
 * uyar. Düğme yok: kayıt düğmeleri bu dilimde içerikte kalır.
 */
export const SUB_PAGE_HEADERS: Readonly<Record<string, SubPageHeaderConfig>> = {
  "/customers/new": {
    parent: "/customers",
    title: "Yeni Müşteri",
    description: "Bireysel veya kurumsal müşteri bilgilerini girin",
  },
  "/customers/[id]": { parent: "/customers" },
  "/vehicles/new": { parent: "/vehicles", title: "Yeni Araç", description: "Araç bilgilerini eksiksiz girin" },
  "/vehicles/[id]": { parent: "/vehicles", backLabel: "Araç Detayı" },
  "/vehicles/[id]/edit": { parent: "/vehicles/[id]", title: "Aracı Düzenle", crumb: "Düzenle" },
  "/quotes/new": { parent: "/quotes", title: "Yeni Teklif" },
  "/quotes/[id]": { parent: "/quotes" },
  "/appointments/new": {
    parent: "/appointments",
    title: "Yeni Randevu",
    description: "Müşteriniz için yeni bir servis randevusu oluşturun.",
  },
  "/appointments/[id]": { parent: "/appointments" },
  "/reminders/new": {
    parent: "/reminders",
    title: "Yeni Hatırlatma",
    description: "Müşteriniz için yeni bir bakım hatırlatması oluşturun.",
  },
  "/reminders/[id]": { parent: "/reminders", backLabel: "Hatırlatma Detayı" },
  "/reminders/[id]/edit": {
    parent: "/reminders/[id]",
    title: "Hatırlatmayı Düzenle",
    crumb: "Düzenle",
    dynamicSubtitle: true,
  },
}

/**
 * Dinamik bir desenin yakalayacağı ama Next'in kendi sayfasını sunduğu statik
 * kardeşler (`/customers/[id]` ↔ `/customers/balances`). Kendi başlığını
 * çizdikleri için çerçeveye girmezler.
 */
export const UNFRAMED_STATIC_ROUTES: ReadonlySet<string> = new Set(["/customers/balances"])

const isDynamicSegment = (segment: string) => segment.startsWith("[") && segment.endsWith("]")

export function matchSubPage(pathname: string): { pattern: string } | null {
  if (UNFRAMED_STATIC_ROUTES.has(pathname)) return null
  if (Object.hasOwn(SUB_PAGE_HEADERS, pathname)) return { pattern: pathname }
  const segments = pathname.split("/")
  for (const pattern of Object.keys(SUB_PAGE_HEADERS)) {
    const parts = pattern.split("/")
    if (parts.length !== segments.length) continue
    const matches = parts.every((part, i) =>
      isDynamicSegment(part) ? segments[i] !== "" : part === segments[i],
    )
    if (matches) return { pattern }
  }
  return null
}

export function hasPageHeader(pathname: string): boolean {
  return Object.hasOwn(PAGE_HEADERS, pathname) || matchSubPage(pathname) !== null
}

type MenuEntry = { group: NavGroup; item: NavItem; child?: NavItem }

function findMenuEntry(href: string): MenuEntry | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === href) return { group, item }
      const child = item.children?.find((c) => c.href === href)
      if (child) return { group, item, child }
    }
  }
  return null
}

function menuTitle(href: string, entry: MenuEntry): string {
  return PAGE_HEADERS[href]?.title ?? (entry.child ?? entry.item).label
}

/** Menü sayfasının halkaları; üst olarak kullanılırken sayfa halkası bağlantıdır. */
function menuCrumbs(href: string, entry: MenuEntry, asParent: boolean): Crumb[] {
  const { group, item, child } = entry
  const title = menuTitle(href, entry)
  const page: Crumb = asParent ? { label: title, href } : { label: title }
  return child
    ? [{ label: group.label }, { label: item.label, href: item.href }, page]
    : [{ label: group.label }, page]
}

/** Desenin karşılığı olan somut yol: `/vehicles/v1/edit` + `/vehicles/[id]` → `/vehicles/v1`. */
function concretePath(pathname: string, pattern: string): string {
  return pathname.split("/").slice(0, pattern.split("/").length).join("/")
}

/**
 * `key`'e kadar (dahil) bağlantılı halkalar. `complete: false` → kayıt adı
 * henüz yok, zincir bilinen son bağlantıda kesildi.
 */
function parentChain(
  key: string,
  pathname: string,
  recordTitle: string | undefined,
): { crumbs: Crumb[]; complete: boolean } {
  const menu = findMenuEntry(key)
  if (menu && Object.hasOwn(PAGE_HEADERS, key)) return { crumbs: menuCrumbs(key, menu, true), complete: true }
  const config = SUB_PAGE_HEADERS[key]
  if (!config) return { crumbs: [], complete: false }
  const above = parentChain(config.parent, pathname, recordTitle)
  const label = config.title ? (config.crumb ?? config.title) : recordTitle
  if (!above.complete || !label) return { crumbs: above.crumbs, complete: false }
  return { crumbs: [...above.crumbs, { label, href: concretePath(pathname, key) }], complete: true }
}

function backLink(parent: string, pathname: string): LinkCrumb | null {
  const menu = findMenuEntry(parent)
  if (menu && Object.hasOwn(PAGE_HEADERS, parent)) return { label: menuTitle(parent, menu), href: parent }
  const config = SUB_PAGE_HEADERS[parent]
  const label = config?.backLabel ?? config?.title
  return label ? { label, href: concretePath(pathname, parent) } : null
}

/** Teknisyen kısıtlı rolünün açamadığı üst sayfa yerine ulaşabildiği ana sayfa (#883). */
const TECHNICIAN_HOME: LinkCrumb = { label: "Teknisyen Paneli", href: "/technician" }

function resolveSubPageHeader(
  pathname: string,
  pattern: string,
  recordTitle: string | undefined,
  actor: PageHeaderActor | null,
): ResolvedPageHeader {
  const config = SUB_PAGE_HEADERS[pattern]
  const leaf = config.title ? (config.crumb ?? config.title) : recordTitle
  const parentUnreachable =
    actor !== null &&
    isTechnicianRestrictedRole(actor.role) &&
    !isRouteAllowedForTechnician(concretePath(pathname, config.parent))
  const chain = parentUnreachable
    ? { crumbs: [TECHNICIAN_HOME], complete: true }
    : parentChain(config.parent, pathname, config.title ? recordTitle : undefined)
  const crumbs = chain.complete && leaf ? [...chain.crumbs, { label: leaf }] : chain.crumbs
  return {
    crumbs,
    title: config.title ?? recordTitle ?? "",
    titleMode: config.title ? "static" : "record",
    back: parentUnreachable ? TECHNICIAN_HOME : backLink(config.parent, pathname),
    description: config.description,
    dynamicSubtitle: config.dynamicSubtitle ?? false,
    secondaryActions: [],
  }
}

export function resolvePageHeader(
  pathname: string,
  ctx: { enabledFeatures: readonly GatedFeature[]; actor: PageHeaderActor | null },
  page?: { recordTitle?: string },
): ResolvedPageHeader | null {
  if (!Object.hasOwn(PAGE_HEADERS, pathname)) {
    const sub = matchSubPage(pathname)
    return sub ? resolveSubPageHeader(pathname, sub.pattern, page?.recordTitle || undefined, ctx.actor) : null
  }
  const config = PAGE_HEADERS[pathname]
  const entry = findMenuEntry(pathname)
  if (!entry) return null
  const routeFeature = entry.child?.feature ?? entry.item.feature
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
    crumbs: menuCrumbs(pathname, entry, false),
    title: menuTitle(pathname, entry),
    titleMode: "static",
    back: null,
    description: config.description,
    dynamicSubtitle: config.dynamicSubtitle ?? false,
    primaryAction,
    secondaryActions: actions.filter((a) => a !== primaryAction),
    tourId: config.tourId,
  }
}
