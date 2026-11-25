import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import surface from "@/components/dashboard/surface.module.css"
import { PAYMENT_STATUS } from "@/lib/constants"
import { paymentPillTone } from "@/lib/orders/payment-pill"
import { cn } from "@/lib/utils"
import detail from "./order-detail.module.css"

// Birim testlerinden erişilebilen modüller (header-actions.test.ts →
// order-management-panel → burası) `surface.tsx`i içeri almamalı: KPI fontu için
// `next/font/google` yükler ve bun'da çöker. work-order-detail.tsx surface.tsx'i
// kendisi içeri alır; burada yalnız CSS modülü kullanılır.
export { detail, surface }

/**
 * Detay sayfası paneli: kart dışında bölüm başlığı + çerçevesiz beyaz kart.
 * `DashPanel` yalnız bağlantı eylemi alır; burada başlığın yanına düğme/hap
 * (`aside`) konabilir.
 */
export function DetailPanel({
  title,
  aside,
  className,
  children,
  bare = false,
}: {
  title: string
  aside?: ReactNode
  className?: string
  children: ReactNode
  /** true → içerik kendi kartlarını çizer. */
  bare?: boolean
}) {
  return (
    <section aria-label={title} className={cn(surface.panel, className)}>
      <div className={surface.panelHead}>
        <h3 className={surface.panelTitle}>{title}</h3>
        {aside}
      </div>
      {bare ? children : <div className={surface.card}>{children}</div>}
    </section>
  )
}

/** Etiket solda soluk, değer sağda; `stack` uzun metin için alt alta. */
export function DetailRow({
  label,
  children,
  stack = false,
}: {
  label: string
  children: ReactNode
  stack?: boolean
}) {
  return (
    <div className={cn(detail.kv, stack && detail.kvStack)}>
      <div className={detail.kvLabel}>{label}</div>
      <div className={detail.kvValue}>{children}</div>
    </div>
  )
}

export function OrderPaymentPill({ status }: { status: string }) {
  return (
    <span className={cn(surface.pill, surface[`tone-${paymentPillTone(status)}`])}>
      {PAYMENT_STATUS[status as keyof typeof PAYMENT_STATUS]?.label ?? status}
    </span>
  )
}

export type DetailTone = "info" | "warning" | "success" | "destructive" | "neutral"

export function DetailPill({ tone, children }: { tone: DetailTone; children: ReactNode }) {
  return <span className={cn(surface.pill, surface[`tone-${tone}`])}>{children}</span>
}

export function DetailEmpty({ children }: { children: ReactNode }) {
  return <p className={detail.emptyText}>{children}</p>
}

/** Gruplu liste satırı: başlangıç + (başlık / alt satır / zaman) + son. */
export function DetailItem({
  href,
  start,
  title,
  sub,
  meta,
  end,
  chevron = Boolean(href),
}: {
  href?: string
  start?: ReactNode
  title: ReactNode
  sub?: ReactNode
  meta?: ReactNode
  end?: ReactNode
  chevron?: boolean
}) {
  const content = (
    <>
      {start ? <span className={detail.itemStart}>{start}</span> : null}
      <span className={detail.itemMain}>
        <span className={cn(detail.itemTitle, "block")}>{title}</span>
        {sub ? <span className={cn(detail.itemSub, "block")}>{sub}</span> : null}
        {meta ? <span className={cn(detail.itemMeta, "block")}>{meta}</span> : null}
      </span>
      {end || chevron ? (
        <span className={detail.itemEnd}>
          {end}
          {chevron ? <ChevronRight aria-hidden className={surface.chevron} /> : null}
        </span>
      ) : null}
    </>
  )
  if (href) {
    return (
      <Link href={href} prefetch={false} className={detail.item}>
        {content}
      </Link>
    )
  }
  return <div className={detail.item}>{content}</div>
}
