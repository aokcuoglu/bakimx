import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTurkishPlate } from "@/components/shared/plate-badge"
import { APPOINTMENT_STATUS, ORDER_STATUS, type AppointmentStatusKey, type OrderStatusKey } from "@/lib/constants"
import styles from "./surface.module.css"

/**
 * Dashboard yüzeyi — e-santral.com/bakimx kalıbının (docs/design-pattern-esantral.md)
 * ilk uygulaması. Yalnız Dashboard'da kullanılır; onaydan sonra paylaşılan
 * bileşenlere taşınacak.
 */

export { styles as surface }

export type Tone = "info" | "warning" | "success" | "destructive" | "neutral"

const toneClass: Record<Tone, string> = {
  info: styles["tone-info"],
  warning: styles["tone-warning"],
  success: styles["tone-success"],
  destructive: styles["tone-destructive"],
  neutral: styles["tone-neutral"],
}

/** Kart dışında gri bölüm başlığı + çerçevesiz beyaz kart. */
export function DashPanel({
  title,
  meta,
  action,
  children,
  bare = false,
  className,
  ...rest
}: {
  title: string
  meta?: ReactNode
  action?: { href: string; label: string }
  children: ReactNode
  /** true → içerik kendi kartlarını çizer (ör. aktivite kartları). */
  bare?: boolean
  className?: string
  "data-tour"?: string
}) {
  return (
    <section aria-label={title} className={cn(styles.panel, className)} {...rest}>
      <div className={styles.panelHead}>
        <h3 className={styles.panelTitle}>
          {title}
          {meta != null && <span className={styles.panelMeta}>{meta}</span>}
        </h3>
        {action && (
          <Link href={action.href} className={styles.panelAction}>
            {action.label}
          </Link>
        )}
      </div>
      {bare ? children : <div className={styles.card}>{children}</div>}
    </section>
  )
}

export function DashEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>
}

/** Satır: [başlangıç] [başlık + alt satır] [son] [›]. href verilirse bağlantıdır. */
export function DashRow({
  href,
  start,
  title,
  sub,
  wide,
  end,
  chevron = Boolean(href),
  wrap = false,
  plain = false,
  stack = false,
}: {
  href?: string
  start?: ReactNode
  title: ReactNode
  sub?: ReactNode
  /** Yalnız md+ genişlikte görünen ek kolon. */
  wide?: ReactNode
  end?: ReactNode
  chevron?: boolean
  /** true → başlık tek satıra kırpılmaz, alt satıra kayar. */
  wrap?: boolean
  /** true → başlık normal ağırlıkta (etiket/değer satırları). */
  plain?: boolean
  /** true → telefonda iki kat: üstte başlangıç (plaka) + son (hap), altta tam genişlik metin. */
  stack?: boolean
}) {
  const content = (
    <>
      {start != null && <span className={styles.rowStart}>{start}</span>}
      <span className={styles.rowMain}>
        <span className={styles.rowTitle} data-wrap={wrap || undefined} data-plain={plain || undefined}>{title}</span>
        {sub != null && <span className={styles.rowSub}>{sub}</span>}
      </span>
      {wide != null && <span className={styles.rowWide}>{wide}</span>}
      {end != null && <span className={styles.rowEnd}>{end}</span>}
      {chevron && <ChevronRight aria-hidden className={styles.chevron} />}
    </>
  )
  return href ? (
    <Link href={href} prefetch={false} className={styles.row} data-stack={stack || undefined}>
      {content}
    </Link>
  ) : (
    <div className={styles.row} data-stack={stack || undefined}>{content}</div>
  )
}

/**
 * Çerçeveli TR plaka rozeti. `country` başına yazısız mavi bant ekler,
 * `size="lg"` büyük plaka çizer. İkisi de varsayılanda kapalı.
 */
export function DashPlate({
  plate,
  country = false,
  size = "md",
}: {
  plate: string
  country?: boolean
  size?: "md" | "lg"
}) {
  return (
    <span
      className={styles.plate}
      data-country={country || undefined}
      data-size={size === "lg" ? "lg" : undefined}
    >
      {country && <span className={styles.plateCountry} aria-hidden="true" />}
      {formatTurkishPlate(plate)}
    </span>
  )
}

export function DashPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cn(styles.pill, toneClass[tone])}>{children}</span>
}

export function DashTile({
  tone,
  circle = false,
  children,
}: {
  tone: Tone
  circle?: boolean
  children: ReactNode
}) {
  return (
    <span aria-hidden className={cn(styles.tile, toneClass[tone])} data-shape={circle ? "circle" : undefined}>
      {children}
    </span>
  )
}

const ORDER_TONE: Record<OrderStatusKey, Tone> = {
  draft: "neutral",
  waiting_approval: "warning",
  approved: "info",
  in_progress: "info",
  waiting_parts: "warning",
  ready_for_delivery: "success",
  delivered: "success",
  cancelled: "destructive",
}

export function DashOrderStatus({ status }: { status: string }) {
  const key = status as OrderStatusKey
  return <DashPill tone={ORDER_TONE[key] ?? "neutral"}>{ORDER_STATUS[key]?.label ?? status}</DashPill>
}

const APPOINTMENT_TONE: Record<AppointmentStatusKey, Tone> = {
  scheduled: "info",
  confirmed: "success",
  arrived: "info",
  converted: "info",
  completed: "success",
  cancelled: "neutral",
  no_show: "destructive",
}

export function DashAppointmentStatus({ status }: { status: string }) {
  const key = status as AppointmentStatusKey
  return <DashPill tone={APPOINTMENT_TONE[key] ?? "neutral"}>{APPOINTMENT_STATUS[key]?.label ?? status}</DashPill>
}

/** Baş harfler (avatar). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2)
  return letters.toLocaleUpperCase("tr-TR")
}

export function formatTime(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
}

/**
 * İstatistik kutusu: üstte etiket + ikon kutusu, altta rakam. `tone` verilirse
 * (değer sıfırdan büyükken) rakam ve ikon kutusu o tona boyanır.
 */
export function DashStat({
  label,
  value,
  href,
  icon,
  tone,
}: {
  label: string
  value: ReactNode
  href: string
  icon?: ReactNode
  tone?: "warning" | "destructive"
}) {
  return (
    <Link href={href} prefetch={false} className={styles.stat}>
      <span className={styles.statHead}>
        <span className={styles.statLabel}>{label}</span>
        {icon != null && (
          <span aria-hidden className={cn(styles.statIcon, toneClass[tone ?? "neutral"])}>
            {icon}
          </span>
        )}
      </span>
      <span className={styles.statValue} data-tone={tone}>{value}</span>
    </Link>
  )
}

export function DashStatGrid({ label, children, count }: { label: string; children: ReactNode; count: number }) {
  return (
    <div className={styles.stats} aria-label={label}>
      <div className={styles.statGrid} data-count={count}>{children}</div>
    </div>
  )
}
