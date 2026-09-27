"use client"

import { useEffect, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import type { UserRole } from "@prisma/client"
import { ArrowLeft, BellRing, CalendarClock, Car, FileText, Search, Settings2, UserRound, Users, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useSidebar } from "@/components/ui/sidebar"
import { CREATE_OPTIONS } from "@/components/layout/create-center"
import { fetchGlobalSearchResults, fetchOrderSearchResults, resultHref, type OrderSearchResult } from "@/components/layout/global-search"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import type { UnifiedResult } from "@/lib/search/unified-results"
import { trIncludes } from "@/lib/tr-search"
import type { GatedFeature } from "@/lib/plan"
import { cn } from "@/lib/utils"

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
      href: option.href,
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
        className="top-[5vh] max-h-[90dvh] w-[calc(100%-1rem)] max-w-none translate-y-0 gap-0 overflow-hidden rounded-xl p-0 shadow-lg sm:top-[14vh] sm:h-[min(70dvh,42.5rem)] sm:max-w-[58rem]"
      >
        <DialogTitle className="sr-only">Genel arama</DialogTitle>
        <DialogDescription className="sr-only">Sayfaları, hızlı işlemleri ve kayıtları arayın.</DialogDescription>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          {scope === "records" ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Tüm aramaya dön" onClick={() => { setScope("all"); inputRef.current?.focus() }}>
              <ArrowLeft className="size-4" />
            </Button>
          ) : <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
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
            placeholder={scope === "records" ? "Müşteri, araç veya iş emri ara..." : "Sayfaları, işlemleri ve kayıtları ara..."}
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            className="h-10 flex-1 border-0 px-0 text-base leading-5 shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-base"
          />
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Aramayı kapat">
              <X className="size-4" />
            </Button>
          </DialogClose>
        </div>

        <div id="global-search-results" role="listbox" aria-label="Arama sonuçları" className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {sections.map((section) => (
            <div role="group" aria-label={section.title} key={section.title} className="mb-4 last:mb-0">
              <p className="px-2 pb-2 text-xs font-medium leading-4 text-muted-foreground">{section.title}</p>
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
                    className={cn("h-auto min-h-11 w-full justify-start gap-3 rounded-lg px-2 py-2 text-left font-normal", index === selectedIndex && "bg-muted")}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-5 tracking-[-0.005em] text-foreground">{item.label}</span>
                      {q && item.sublabel ? <span className="block truncate text-xs leading-4 text-muted-foreground">{item.sublabel}</span> : null}
                    </span>
                    {locked ? <span className="text-xs font-medium text-muted-foreground">PRO</span> : null}
                  </Button>
                )
              })}
            </div>
          ))}
          {q.length >= 2 && loading ? <p className="px-2 py-3 text-sm text-muted-foreground">Kayıtlar aranıyor…</p> : null}
          {scope === "records" && !q ? <p className="px-2 py-8 text-center text-sm text-muted-foreground">Müşteri, araç veya iş emri arayın.</p> : null}
          {q && !loading && allItems.length === 0 ? <p className="px-2 py-8 text-center text-sm text-muted-foreground">Sonuç bulunamadı.</p> : null}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5">
          <span>↑ ↓ gezin · Enter aç · Esc kapat</span>
          <span>⌘ K</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
