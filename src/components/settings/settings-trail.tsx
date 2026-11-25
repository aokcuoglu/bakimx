"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { PageTrail } from "@/components/layout/page-trail"
import { PageHeaderAccessContext } from "@/components/layout/page-header"
import { buildSettingsTrail, shouldShowSettingsTrail } from "@/lib/settings-nav"

const SetRecordTitleContext = createContext<(title: string | undefined) => void>(() => {})
const RecordTitleContext = createContext<string | undefined>(undefined)

/** Ayarlar içeriğini sarar: kayıt sayfaları adını `SettingsRecordTitle` ile yol satırına iletir. */
export function SettingsTrailProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | undefined>()
  return (
    <SetRecordTitleContext.Provider value={setTitle}>
      <RecordTitleContext.Provider value={title}>{children}</RecordTitleContext.Provider>
    </SetRecordTitleContext.Provider>
  )
}

/** Kayıt sayfasında (ekip) son breadcrumb halkasını verir; görünür bir şey çizmez. */
export function SettingsRecordTitle({ title }: { title: string }) {
  const setTitle = useContext(SetRecordTitleContext)
  useEffect(() => {
    setTitle(title)
    return () => setTitle(undefined)
  }, [setTitle, title])
  return null
}

/**
 * Ayarlar sayfalarının yol satırı (#856). Her sayfa buraya AppShell'in Ayarlar
 * dalından ve `settings/loading.tsx`ten geçer; sayfalar PageTrail'i çağırmaz.
 */
export function SettingsTrail() {
  const pathname = usePathname()
  const recordTitle = useContext(RecordTitleContext)
  const { actor } = useContext(PageHeaderAccessContext)
  const trail = useMemo(() => buildSettingsTrail(pathname, { recordTitle }), [pathname, recordTitle])
  if (!shouldShowSettingsTrail(actor, trail.crumbs)) return null
  return <PageTrail crumbs={trail.crumbs} back={trail.back} className="mb-2" />
}
