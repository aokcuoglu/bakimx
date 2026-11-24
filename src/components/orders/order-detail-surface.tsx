import type { ReactNode } from "react"
import surface from "@/components/dashboard/surface.module.css"
import { PAYMENT_STATUS } from "@/lib/constants"
import { paymentPillTone } from "@/lib/orders/payment-pill"
import { cn } from "@/lib/utils"
import detail from "./order-detail.module.css"

// `surface.tsx` değil `surface.module.css` doğrudan içeri alınır: surface.tsx
// KPI fontu için `next/font/google` yükler ve bu modülü (dolaylı olarak)
// içeri alan birim testleri (ör. header-actions.test.ts) bun'da çökerdi.
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
