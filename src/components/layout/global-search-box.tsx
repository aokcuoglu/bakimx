"use client"

import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { UserRole } from "@prisma/client"
import { ArrowDown, ArrowLeft, ArrowUp, BellRing, CornerDownLeft, CalendarClock, Car, FileText, Search, Settings2, UserRound, Users, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useSidebar } from "@/components/ui/sidebar"
import { CREATE_OPTIONS } from "@/components/layout/create-center"
import { newIntakeHref } from "@/lib/intake/entry-links"
import { fetchGlobalSearchResults, fetchOrderSearchResults, resultHref, type OrderSearchResult } from "@/components/layout/global-search"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import type { UnifiedResult } from "@/lib/search/unified-results"
import { trIncludes } from "@/lib/tr-search"
import type { GatedFeature } from "@/lib/plan"
import { lockedFeatureLabels } from "@/lib/feature-catalog"
import { cn } from "@/lib/utils"
import styles from "./global-search-box.module.css"

export type SearchDestination = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  feature?: GatedFeature
}

type SearchItem = SearchDestination & { id: string; sublabel?: string }

const CREATE_ICONS = {
  order: Wrench,
  quote: FileText,
  appointment: CalendarClock,
  reminder: BellRing,
} as const

const CREATE_FEATURES: Partial<Record<(typeof CREATE_OPTIONS)[number]["id"], GatedFeature>> = {
  quote: "quotes",
  appointment: "appointments",
  reminder: "automatedReminders",
}

export function GlobalSearch({
  open,
  onOpenChange,
  navigation,
  enabledFeatures,
  role,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  navigation: SearchDestination[]
  enabledFeatures: GatedFeature[]
  role?: UserRole
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<"all" | "records">("all")
  const [records, setRecords] = useState<UnifiedResult[]>([])
  const [orders, setOrders] = useState<OrderSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const isTechRole = isTechnicianRestrictedRole(role)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpenChange(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onOpenChange])

  useEffect(() => {
    const q = query.trim()
    if (!open || q.length < 2) return
    let active = true
    const timeout = setTimeout(async () => {
      const [foundRecords, foundOrders] = isTechRole
        ? [[], []] as [UnifiedResult[], OrderSearchResult[]]
        : await Promise.all([fetchGlobalSearchResults(q), fetchOrderSearchResults(q)])
      if (!active) return
      setRecords(foundRecords)
      setOrders(foundOrders)
      setLoading(false)
    }, 250)
    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [open, query, isTechRole])

  function changeOpen(next: boolean) {
    onOpenChange(next)
    if (!next) {
      setQuery("")
      setScope("all")
      setRecords([])
      setOrders([])
      setLoading(false)
      setActiveIndex(0)
    }
  }

  function changeQuery(value: string) {
    setQuery(value)
    setRecords([])
    setOrders([])
    setLoading(value.trim().length >= 2)
    setActiveIndex(0)
  }

  function navigate(item: SearchItem) {
    if (item.id === "search-records") {
      setScope("records")
      changeQuery("")
      inputRef.current?.focus()
      return
    }
    changeOpen(false)
    setOpenMobile(false)
    router.push(item.href)
  }

  const quickActions: SearchItem[] = [
    ...(!isTechRole ? [{ id: "search-records", href: "#", label: "Kayıtlarda ara", icon: Search }] : []),
    ...CREATE_OPTIONS.filter((option) => {
      const feature = CREATE_FEATURES[option.id]
      return !feature || enabledFeatures.includes(feature)
    }).map((option) => ({
      id: `create-${option.id}`,
      // Araç kabulü açıldığı sayfaya geri döner (#842).
      href: option.id === "order" ? newIntakeHref({ back: pathname }) : option.href,
      label: `Yeni ${option.title.toLocaleLowerCase("tr")}`,
      sublabel: option.description,
      icon: CREATE_ICONS[option.id],
    })),
    ...(!isTechRole ? [
      { id: "create-customer", href: "/customers/new", label: "Yeni müşteri", icon: Users },
      { id: "create-vehicle", href: "/vehicles/new", label: "Yeni araç", icon: Car },
      { id: "account-settings", href: "/settings/account", label: "Hesap ayarlarını aç", icon: Settings2 },
    ] : []),
  ]
  const pageItems: SearchItem[] = [...new Map(navigation.map((item) => [item.href, item])).values()]
    .map((item) => ({ ...item, id: `page-${item.href}` }))
  const q = query.trim()
  const matchingActions = scope === "all" ? quickActions.filter((item) => trIncludes(`${item.label} ${item.sublabel ?? ""}`, q)) : []
  const matchingPages = scope === "all" ? pageItems.filter((item) => trIncludes(item.label, q)) : []
  const recordItems: SearchItem[] = q.length >= 2 ? [
    ...records.map((record) => ({
      id: `${record.kind}-${record.kind === "vehicle" ? record.vehicleId : record.customerId}`,
      href: resultHref(record),
      label: record.label,
      sublabel: record.sublabel,
      icon: record.kind === "vehicle" ? Car : UserRound,
    })),
    ...orders.map((order) => ({
      id: `order-${order.id}`,
      href: `/orders/${order.id}`,
      label: order.label,
      sublabel: order.sublabel,
      icon: Wrench,
    })),
  ] : []
  const sections = [
    { title: "Hızlı işlemler", items: matchingActions },
    { title: "Sayfalar ve özellikler", items: matchingPages },
    { title: "Kayıtlar", items: recordItems },
  ].filter((section) => section.items.length > 0)
  const allItems = sections.flatMap((section) => section.items)
  const selectedIndex = Math.min(activeIndex, allItems.length - 1)

  useEffect(() => {
    if (open && selectedIndex >= 0) {
      document.getElementById(`global-search-option-${selectedIndex}`)?.scrollIntoView({ block: "nearest" })
    }
  }, [open, selectedIndex])

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, allItems.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === "Enter" && selectedIndex >= 0) {
      event.preventDefault()
      navigate(allItems[selectedIndex]!)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-transparent supports-backdrop-filter:backdrop-blur-none"
        className={styles.panel}
      >
        <DialogTitle className="sr-only">Genel arama</DialogTitle>
        <DialogDescription className="sr-only">Sayfaları, hızlı işlemleri ve kayıtları arayın.</DialogDescription>
        <div className={styles.header}>
          {scope === "records" ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Tüm aramaya dön" onClick={() => { setScope("all"); inputRef.current?.focus() }}>
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}
          <Input
            ref={inputRef}
            autoFocus
            type="search"
            role="combobox"
            aria-label="Sayfaları, işlemleri ve kayıtları ara"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls="global-search-results"
            aria-activedescendant={selectedIndex >= 0 ? `global-search-option-${selectedIndex}` : undefined}
            placeholder={scope === "records" ? "Müşteri, araç veya araç kabulü ara..." : "Sayfaları, işlemleri ve kayıtları ara..."}
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            className={styles.input}
          />
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Aramayı kapat">
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>

        <div id="global-search-results" role="listbox" aria-label="Arama sonuçları" className={styles.results}>
          {sections.map((section) => (
            <div role="group" aria-label={section.title} key={section.title}>
              <p className={styles.sectionTitle}>{section.title}</p>
              {section.items.map((item) => {
                const index = allItems.indexOf(item)
                const Icon = item.icon
                const locked = Boolean(item.feature && !enabledFeatures.includes(item.feature))
                return (
                  <Button
                    key={item.id}
                    id={`global-search-option-${index}`}
                    role="option"
                    aria-selected={index === selectedIndex}
                    type="button"
                    variant="ghost"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigate(item)}
                    className={cn(styles.option, index === selectedIndex && styles.selected)}
                  >
                    <span className={styles.icon}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-5 tracking-[-0.005em] text-foreground">{item.label}</span>
                      {q && item.sublabel ? <span className="block truncate text-xs leading-4 text-muted-foreground">{item.sublabel}</span> : null}
                    </span>
                    {locked && item.feature ? <span className="text-xs font-medium text-muted-foreground">{lockedFeatureLabels(item.feature).label}</span> : null}
                  </Button>
                )
              })}
            </div>
          ))}
          {q.length >= 2 && loading ? <p className="px-2 py-3 text-sm text-muted-foreground">Kayıtlar aranıyor…</p> : null}
          {scope === "records" && !q ? <p className="px-2 py-8 text-center text-sm text-muted-foreground">Müşteri, araç veya araç kabulü arayın.</p> : null}
          {q && !loading && allItems.length === 0 ? <p className="px-2 py-8 text-center text-sm text-muted-foreground">Sonuç bulunamadı.</p> : null}
        </div>

        <div className={styles.footer}>
          <span className={styles.keyboardHint}>
            <span className={styles.arrowKeys} aria-hidden><ArrowUp /><ArrowDown /></span>
            <span>Gezin<span className={styles.desktopHint}> · Esc kapat</span></span>
          </span>
          {selectedIndex >= 0 ? (
            <Button type="button" variant="foreground" onClick={() => navigate(allItems[selectedIndex]!)} className={styles.action}>
              <span className="truncate">{allItems[selectedIndex]!.label}</span>
              <span className={styles.enterKey} aria-hidden><CornerDownLeft className="size-3" /></span>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
