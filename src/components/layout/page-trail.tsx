import { Fragment } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import type { Crumb, LinkCrumb } from "@/lib/navigation/page-headers"
import { cn } from "@/lib/utils"
import styles from "./page-trail.module.css"

export type PageTrailProps = {
  /** Root → this page. href → link. Last crumb without href = current page (aria-current). Middle crumb without href = section label (plain text). While loading, chain ends at the last known link. */
  crumbs: readonly Crumb[]
  /** Sub-pages only. <640px one back link replaces the breadcrumb in the same row. null/undefined → breadcrumb at every width (menu pages, #823 behaviour). */
  back?: LinkCrumb | null
  className?: string
}

/**
 * Başlığın üstündeki yol satırı (#855). Breadcrumb ve telefondaki geri
 * bağlantısı ikisi de DOM'dadır; hangisinin görüneceğine CSS karar verir
 * (JS medya sorgusu yok → hidrasyon farkı yok). Hook kullanmaz: sunucu ve
 * istemci ağacında aynı çizilir.
 */
export function PageTrail({ crumbs, back, className }: PageTrailProps) {
  return (
    <div data-slot="page-trail" data-has-back={back ? "true" : undefined} className={cn(styles.trail, className)}>
      <Breadcrumb aria-label="Sayfa yolu" className={styles.crumbs}>
        <BreadcrumbList className="text-[length:inherit]">
          {crumbs.map((crumb, i) => (
            <Fragment key={`${i}-${crumb.label}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : i === crumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      {back ? (
        <Link href={back.href} data-slot="page-back" className={styles.back}>
          <ChevronLeft aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
    </div>
  )
}
