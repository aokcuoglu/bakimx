"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDateTime } from "@/lib/utils-client"

type TechnicianNotification = {
  id: string
  orderId: string
  createdAt: string
  title: string
  description?: string
}

/**
 * Teknisyen paneli bildirim zili (BAK-109, Faz A).
 *
 * 30 sn'lik yoklama seçildi: iş emri ataması/durumu/parça kararı bir alarm
 * değil, teknisyenin fiilen çalıştığı akışa dair — saniyeler içinde haberdar
 * olmanın müşteri deneyimine etkisi yok, ama her 5 sn'de bir istek (bkz.
 * use-order-sync.ts, tek iş emrini canlı düzenleme senaryosu) burada mobil
 * veri/pil için gereksiz olurdu. Sekme arka plandayken yoklama TAMAMEN durur
 * (version-update-notice.tsx ile aynı desen) ve odağa dönünce anında yeniden
 * dener; hiçbir olay kaybolmaz çünkü `since` cursor'ı yalnız başarılı bir
 * yoklamada ilerler.
 *
 * Cursor bu bileşenin mount anında "şimdi"ye sıfırlanır — panel açılmadan
 * önceki olaylar toast'a boğmaz (Faz A kapsamı: "panel açıkken çalışan hafif
 * bir kanal"), bildirim geçmişi kalıcı DEĞİLDİR.
 */
const POLL_INTERVAL_MS = 30 * 1000
const MAX_VISIBLE = 8

export function TechnicianNotificationsBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<TechnicianNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pollError, setPollError] = useState(false)
  const cursorRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)
  const tickRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    cursorRef.current = new Date().toISOString()
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    const tick = async () => {
      if (document.hidden || inFlightRef.current || !cursorRef.current) return
      inFlightRef.current = true
      try {
        const res = await fetch(
          `/api/technician/notifications?since=${encodeURIComponent(cursorRef.current)}`,
          { cache: "no-store" },
        )
        if (!res.ok) {
          if (!cancelled) setPollError(true)
          return
        }
        const data = (await res.json()) as { notifications?: TechnicianNotification[] }
        const notifications = data.notifications ?? []
        if (cancelled) return
        setPollError(false)
        if (notifications.length === 0) return

        cursorRef.current = notifications[notifications.length - 1].createdAt

        for (const notification of notifications) {
          toast.info(notification.title, {
            id: `technician-notification-${notification.id}`,
            description: notification.description,
            duration: 10000,
            action: {
              label: "İş emrine git",
              onClick: () => router.push(`/technician/orders/${notification.orderId}`),
            },
          })
        }

        setItems((prev) => [...notifications].reverse().concat(prev).slice(0, MAX_VISIBLE))
        setUnreadCount((prev) => prev + notifications.length)
      } catch {
        // Çevrimdışı/geçici ağ hatası — sessizce geç, ama durumu göster ki
        // "Henüz bildirim yok" ile karıştırılmasın; sonraki turda yeniden dene.
        if (!cancelled) setPollError(true)
      } finally {
        inFlightRef.current = false
      }
    }
    tickRef.current = tick

    const start = () => {
      if (timer) return
      timer = setInterval(() => void tick(), POLL_INTERVAL_MS)
    }
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        void tick()
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [router])

  function handleRetry() {
    void tickRef.current()
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) setUnreadCount(0)
  }

  function goToOrder(orderId: string) {
    setOpen(false)
    router.push(`/technician/orders/${orderId}`)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="relative size-11 md:size-8"
            aria-label={unreadCount > 0 ? `Bildirimler (${unreadCount} okunmamış)` : "Bildirimler"}
          />
        }
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 justify-center px-1 text-[10px] leading-none"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <PopoverHeader>
          <PopoverTitle>Bildirimler</PopoverTitle>
        </PopoverHeader>
        {pollError ? (
          <div className="flex flex-col items-center gap-2 px-1 py-4 text-center">
            <p className="text-sm text-destructive-strong">Bildirimler alınamadı</p>
            <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
              Tekrar dene
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="px-1 py-4 text-center text-sm text-muted-foreground">Henüz bildirim yok.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((notification) => (
              <li key={notification.id}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => goToOrder(notification.orderId)}
                  className="h-auto min-h-11 w-full flex-col items-start justify-start gap-0.5 whitespace-normal rounded-md p-2 text-left md:min-h-9"
                >
                  <span className="text-sm font-medium">{notification.title}</span>
                  {notification.description && (
                    <span className="text-xs text-muted-foreground">{notification.description}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDateTime(notification.createdAt)}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
