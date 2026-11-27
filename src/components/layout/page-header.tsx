"use client"

import { createContext, useContext, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PageTrail } from "@/components/layout/page-trail"
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
  // e-santral `.d-blue.big` = `size="lg"` (50px telefon / 44px md+). Birincil
  // DOM'da ikincillerden sonra gelir; telefonda tam genişlik ve ilk satırda.
  return primary ? (
    <Button variant="default" size="lg" className="order-first w-full sm:order-none sm:w-auto" data-tour={action.tourId} asChild>
      {content}
    </Button>
  ) : (
    <Button variant="outline" size="lg" data-tour={action.tourId} asChild>
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
  const rawSub = subtitle ?? header.description
  const subText = rawSub === "" ? undefined : rawSub
  const reserveSub = subText === undefined && header.dynamicSubtitle
  const hasSub = subText !== undefined || reserveSub
  const recordMode = header.titleMode === "record"
  // Kayıt adı yüklenirken başlık satırı boş ayrılır; gelince dolar (#855).
  const reserveTitle = header.title === ""

  return (
    <header data-slot="page-header" data-tour={header.tourId} className={styles.header}>
      <PageTrail crumbs={crumbs} back={header.back} />
      <div className={styles.row}>
        <h1
          data-slot="page-title"
          className={recordMode ? cn(styles.title, styles.titleRecord) : styles.title}
          // Kısalan kayıt adının tamamı (#855).
          title={recordMode && !reserveTitle ? header.title : undefined}
          aria-hidden={reserveTitle || undefined}
        >
          {reserveTitle ? "\u00a0" : header.title}
        </h1>
        {(primaryAction || secondaryActions.length > 0) && (
          <div className={cn(styles.actions, header.desktopActionsOnly && "max-lg:hidden")}>
            {secondaryActions.length > 0 && (
              <div className={styles.secondary}>
                {secondaryActions.map((action) => (
                  <ActionButton key={action.href} action={action} primary={false} />
                ))}
              </div>
            )}
            {primaryAction && <ActionButton action={primaryAction} primary />}
          </div>
        )}
      </div>
      {hasSub && (
        <p data-slot="page-subtitle" className={styles.subline} aria-hidden={reserveSub || undefined}>
          {reserveSub ? "\u00a0" : subText}
        </p>
      )}
    </header>
  )
}

/**
 * Kayıtlı yolda çerçeve + başlık + children; kayıtsız yolda yalnız children.
 * Detay sayfası `recordTitle` verir; yükleme ekranı vermez (zincir kısa, başlık boş).
 */
export function PageFrame({
  subtitle,
  recordTitle,
  children,
}: {
  subtitle?: ReactNode
  recordTitle?: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const access = useContext(PageHeaderAccessContext)
  const header = resolvePageHeader(pathname, access, { recordTitle })
  if (!header) return <>{children}</>
  return (
    <div className={styles.frame}>
      <PageHeaderView header={header} subtitle={subtitle} />
      {children}
    </div>
  )
}
