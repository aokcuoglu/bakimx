"use client"

import { createContext, Fragment, useContext, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import type { GatedFeature } from "@/lib/plan"
import {
  resolvePageHeader,
  type PageAction,
  type PageHeaderActor,
  type ResolvedPageHeader,
} from "@/lib/navigation/page-headers"
import { cn } from "@/lib/utils"
import styles from "./page-header.module.css"

export type PageHeaderAccess = {
  enabledFeatures: readonly GatedFeature[]
  actor: PageHeaderActor | null
}

export const PageHeaderAccessContext = createContext<PageHeaderAccess>({
  enabledFeatures: [],
  actor: null,
})

function ActionButton({ action, primary }: { action: PageAction; primary: boolean }) {
  const Icon = action.icon
  const content = (
    <Link href={action.href}>
      <Icon aria-hidden="true" />
      {action.label}
    </Link>
  )
  return primary ? (
    <Button variant="default" className={cn(styles.cta, styles.primary)} data-tour={action.tourId} asChild>
      {content}
    </Button>
  ) : (
    <Button variant="outline" className={styles.cta} data-tour={action.tourId} asChild>
      {content}
    </Button>
  )
}

export function PageHeaderView({
  header,
  subtitle,
}: {
  header: ResolvedPageHeader
  subtitle?: ReactNode
}) {
  const { crumbs, primaryAction, secondaryActions } = header
  const subText = subtitle ?? header.description
  const reserveSub = subText === undefined && header.dynamicSubtitle
  const hasSub = subText !== undefined || reserveSub

  return (
    <header data-slot="page-header" data-tour={header.tourId} className={styles.header}>
      <Breadcrumb aria-label="Sayfa yolu" className={styles.crumbs}>
        <BreadcrumbList className="text-[length:inherit]">
          {crumbs.map((crumb, i) => (
            <Fragment key={`${i}-${crumb.label}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {i === crumbs.length - 1 ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className={styles.row}>
        <h1 className={styles.title}>{header.title}</h1>
        {(primaryAction || secondaryActions.length > 0) && (
          <div className={styles.actions}>
            {primaryAction && <ActionButton action={primaryAction} primary />}
            {secondaryActions.length > 0 && (
              <div className={styles.secondary}>
                {secondaryActions.map((action) => (
                  <ActionButton key={action.href} action={action} primary={false} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {hasSub && (
        <p data-slot="page-subtitle" className={styles.subline} aria-hidden={reserveSub || undefined}>
          {reserveSub ? " " : subText}
        </p>
      )}
    </header>
  )
}

/** Kayıtlı yolda çerçeve + başlık + children; kayıtsız yolda yalnız children. */
export function PageFrame({ subtitle, children }: { subtitle?: ReactNode; children: ReactNode }) {
  const pathname = usePathname()
  const access = useContext(PageHeaderAccessContext)
  const header = resolvePageHeader(pathname, access)
  if (!header) return <>{children}</>
  return (
    <div className={styles.frame}>
      <PageHeaderView header={header} subtitle={subtitle} />
      {children}
    </div>
  )
}
